/**
 * POST /api/v1/me/avatar
 *
 * Avatar-Upload. Quelle: PRD §F-002 + §8.2 (Werkpass), §28 (UI).
 *
 * - Auth erforderlich (sonst 401).
 * - Multipart-FormData mit Feld `file`.
 * - MIME-Whitelist: jpeg/png/webp.
 * - Groessen-Limit: 2 MB.
 *
 * Persistenz (zwei Pfade):
 *
 * **Produktion (R2 konfiguriert):** sharp-resize zu 256+512 WebP, Upload nach
 * `avatare/<nutzer-id>-<size>.webp` ins R2-Bucket, persistiertes Feld
 * `nutzer.avatar_url` = R2_PUBLIC_URL + Pfad.
 *
 * **Dev/Test (R2 keys leer):** kein externer Upload. Stattdessen wird die
 * uebermittelte Datei als data-URL persistiert (kein Resize — sharp ist im
 * Dev nicht zwingend installiert; das ist explizit als DEV-Stub markiert).
 *
 * **DSGVO-Datenminimierung:** Original wird in der DB nicht persistiert; nur
 * die resized-Varianten in R2 (oder im Dev-Stub die original-Bytes als
 * data-URL — bewusst gewaehlt, weil in Dev kein Storage verfuegbar ist).
 */

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { nutzer } from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';
import { rejectIfBadOrigin } from '@/lib/auth/csrf';
import { env } from '@/lib/env';

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function POST(req: Request): Promise<Response> {
  const originResp = rejectIfBadOrigin(req);
  if (originResp) return originResp;

  const sess = await getSessionFromRequest(req);
  if (!sess) {
    return Response.json({ fehler: 'unauthenticated' }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return Response.json({ fehler: 'ungueltiger_body' }, { status: 400 });
  }

  const fileEntry = formData.get('file');
  if (!fileEntry || !(fileEntry instanceof Blob)) {
    return Response.json(
      {
        fehler: 'validierung',
        details: { file: ['Bitte eine Bild-Datei im Feld "file" hochladen.'] },
      },
      { status: 422 },
    );
  }

  const mime = (fileEntry.type || '').toLowerCase();
  if (!ALLOWED_MIMES.has(mime)) {
    return Response.json(
      {
        fehler: 'validierung',
        details: {
          file: [
            `Nicht unterstuetzter Bild-Typ: ${mime || 'unbekannt'}. ` +
              'Erlaubt sind JPEG, PNG und WebP.',
          ],
        },
      },
      { status: 422 },
    );
  }

  const arrayBuffer = await fileEntry.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_BYTES) {
    return Response.json(
      {
        fehler: 'validierung',
        details: {
          file: [
            `Datei ist zu gross (${arrayBuffer.byteLength} Bytes). Maximal 2 MB erlaubt.`,
          ],
        },
      },
      { status: 422 },
    );
  }

  const originalBytes = new Uint8Array(arrayBuffer);
  const r2Configured = Boolean(
    env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY,
  );

  let avatarUrl: string;

  if (r2Configured) {
    // ── Produktions-Pfad: R2-Upload mit sharp-Resize ──────────────────────
    avatarUrl = await uploadToR2WithResize({
      bytes: originalBytes,
      nutzerId: sess.nutzerId,
    });
  } else {
    // ── DEV: avatar stored as data: URL because R2 not configured —
    //        production needs R2_* ─────────────────────────────────────────
    // Dev-Stub: Wir versuchen, wenn moeglich, mit sharp auf 256px zu skalieren
    // und als WebP zu serialisieren; ist sharp nicht installiert (lokale
    // Native-Binary-Builds koennen fehlschlagen), behalten wir die original-
    // Bytes mit dem urspruenglichen MIME bei.
    const stub = await tryResizeWithSharp(originalBytes, 256);
    if (stub) {
      avatarUrl = `data:image/webp;base64,${Buffer.from(stub).toString('base64')}`;
    } else {
      avatarUrl = `data:${mime};base64,${Buffer.from(originalBytes).toString('base64')}`;
    }
  }

  const updated = await db
    .update(nutzer)
    .set({ avatarUrl, aktualisiertAm: new Date() })
    .where(eq(nutzer.id, sess.nutzerId))
    .returning({ avatarUrl: nutzer.avatarUrl });

  return Response.json(
    { avatar_url: updated[0]?.avatarUrl ?? avatarUrl },
    { status: 200 },
  );
}

/**
 * Versucht sharp dynamisch zu laden und das Bild auf `size` px zu skalieren
 * (square, cover) und als WebP zu serialisieren. Gibt `null` zurueck, wenn
 * sharp nicht verfuegbar ist (Dev-Maschinen ohne installierte Native-Binary).
 */
async function tryResizeWithSharp(
  bytes: Uint8Array,
  size: number,
): Promise<Uint8Array | null> {
  try {
    // dynamic import — sharp ist eine optionale Production-Dep
    const sharpMod = (await import('sharp').catch(() => null)) as
      | { default: (input: Uint8Array) => SharpInstance }
      | null;
    if (!sharpMod) return null;
    const out = await sharpMod
      .default(bytes)
      .resize(size, size, { fit: 'cover' })
      .webp({ quality: 82 })
      .toBuffer();
    return new Uint8Array(out);
  } catch {
    return null;
  }
}

interface SharpInstance {
  resize: (w: number, h: number, opts: { fit: string }) => SharpInstance;
  webp: (opts: { quality: number }) => SharpInstance;
  toBuffer: () => Promise<Buffer>;
}

/**
 * Produktions-Pfad: resized-Variants ins R2-Bucket schreiben.
 * Throwt bei Fehlern — der Caller behandelt das als 500.
 */
async function uploadToR2WithResize(opts: {
  bytes: Uint8Array;
  nutzerId: string;
}): Promise<string> {
  // Sharp-Resize zu zwei WebP-Varianten.
  const small = await tryResizeWithSharp(opts.bytes, 256);
  const large = await tryResizeWithSharp(opts.bytes, 512);
  if (!small || !large) {
    throw new Error(
      'sharp ist im Produktions-Pfad erforderlich, aber nicht verfuegbar.',
    );
  }

  // S3-Client lazy importieren (nur wenn R2-Pfad aktiv).
  const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
  const accountId = env.R2_ACCOUNT_ID!;
  const accessKeyId = env.R2_ACCESS_KEY_ID!;
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY!;
  const bucket = env.R2_BUCKET;

  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  const keySmall = `avatare/${opts.nutzerId}-256.webp`;
  const keyLarge = `avatare/${opts.nutzerId}-512.webp`;

  await Promise.all([
    client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: keySmall,
        Body: small,
        ContentType: 'image/webp',
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    ),
    client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: keyLarge,
        Body: large,
        ContentType: 'image/webp',
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    ),
  ]);

  const base = env.R2_PUBLIC_URL ?? `https://${bucket}.r2.cloudflarestorage.com`;
  return `${base.replace(/\/$/, '')}/${keySmall}`;
}
