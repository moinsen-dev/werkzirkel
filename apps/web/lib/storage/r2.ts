/**
 * Cloudflare-R2-Wrapper (S3-kompatibel).
 *
 * Quelle: PRD §25 (File-Upload-Pipeline) und §34 (Datenminimierung — Original
 * wird nicht persistiert).
 *
 * Wiederverwendbar fuer Avatar-Upload, Werk-Screenshots usw. Der eigentliche
 * `S3Client` wird lazy initialisiert — wir bauen ihn nur, wenn R2-Pfad aktiv
 * ist. Im Dev-/Test-Lauf ohne R2-Keys wird `isR2Configured()` `false`, und
 * Caller fallen auf data: URLs zurueck (siehe Aufrufer-Code).
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { env } from '@/lib/env';

let _client: S3Client | null = null;

/** True wenn alle R2-Pflicht-Env-Vars vorhanden sind. */
export function isR2Configured(): boolean {
  return Boolean(
    env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY,
  );
}

/**
 * Liefert einen (lazy gecachten) S3Client gegen die R2-Endpunkte.
 * Wirft, wenn `isR2Configured()` false ist — Caller muessen vorher pruefen.
 */
export function getR2Client(): S3Client {
  if (!_client) {
    if (!isR2Configured()) {
      throw new Error('R2 ist nicht konfiguriert — pruefe R2_*-Env-Vars.');
    }
    _client = new S3Client({
      region: 'auto',
      endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID!,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }
  return _client;
}

/**
 * Laedt `body` unter `key` ins R2-Bucket. Liefert die oeffentliche URL
 * (`R2_PUBLIC_URL`-Praefix + Pfad) zurueck.
 * CacheControl ist immutable — Filenames sollten eindeutig sein (cuid2-Suffix).
 */
export async function uploadToR2(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string,
): Promise<string> {
  const client = getR2Client();
  await client.send(
    new PutObjectCommand({
      Bucket: env.R2_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  );
  const base = env.R2_PUBLIC_URL
    ? env.R2_PUBLIC_URL.replace(/\/$/, '')
    : `https://${env.R2_BUCKET}.r2.cloudflarestorage.com`;
  return `${base}/${key}`;
}

/**
 * Loescht einen R2-Key. Idempotent — wirft nicht, wenn der Key fehlt.
 * (S3-DeleteObject ist von Hause aus idempotent.)
 */
export async function deleteFromR2(key: string): Promise<void> {
  const client = getR2Client();
  await client.send(
    new DeleteObjectCommand({ Bucket: env.R2_BUCKET, Key: key }),
  );
}

/**
 * Versucht, aus einer (R2-)URL den Key (Pfad innerhalb des Buckets) zu
 * extrahieren. Liefert `null`, wenn die URL nicht zum konfigurierten Bucket
 * passt — z.B. eine alte data:-URL aus dem Dev-Fallback.
 */
export function extractKeyFromUrl(url: string): string | null {
  if (!env.R2_PUBLIC_URL) return null;
  const base = env.R2_PUBLIC_URL.replace(/\/$/, '');
  if (!url.startsWith(base + '/')) return null;
  return url.slice(base.length + 1);
}
