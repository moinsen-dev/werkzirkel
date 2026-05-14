/**
 * Magic-Link-Token-Helpers.
 *
 * Token-Lifecycle:
 * 1. `generateToken()` → liefert 32-Byte-Random als base64url-Klartext
 *    UND den SHA-256-Hash davon. Klartext geht in den Magic-Link in die Mail,
 *    Hash in die DB (`magic_link_token.token_hash`).
 * 2. Bei Verify: eingehenden Klartext-Token wieder hashen und Hash in DB suchen.
 *
 * Hash-Algorithmus: SHA-256 (PRD §16). Niemals Klartext speichern.
 */

import { createHash, randomBytes } from 'node:crypto';

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { magicLinkToken, nutzer } from '@/lib/db/schema/nutzer';
import { env } from '@/lib/env';
import {
  checkMagicLinkEmailLimit,
  checkMagicLinkIpLimit,
} from '@/lib/auth/rate-limit';
import { sendMail } from '@/lib/email/send';

export interface MagicLinkTokenPair {
  /** Klartext-Token, geht in den Magic-Link in die Mail. */
  clearToken: string;
  /** SHA-256-Hex-Hash — geht in `magic_link_token.token_hash`. */
  tokenHash: string;
}

/**
 * Erzeugt einen neuen Token: 32 Byte Zufall (base64url-kodiert ca. 43 Zeichen)
 * und den SHA-256-Hash davon.
 */
export function generateMagicLinkToken(): MagicLinkTokenPair {
  const clearToken = randomBytes(32).toString('base64url');
  const tokenHash = hashMagicLinkToken(clearToken);
  return { clearToken, tokenHash };
}

/**
 * Hasht einen Klartext-Token mit SHA-256 und gibt den Hex-String zurueck.
 * Identisch fuer Erzeugung und Verify.
 */
export function hashMagicLinkToken(clearToken: string): string {
  return createHash('sha256').update(clearToken).digest('hex');
}

const MAGIC_LINK_EXPIRY_MIN = 15;

export type MagicLinkZweckType =
  | 'login'
  | 'registrierung'
  | 'registrierung-bedarf'
  | 'registrierung-foerder';

export type RequestMagicLinkResult =
  | { ok: true }
  | { ok: false; fehler: 'rate_limit_ip' | 'rate_limit_email' };

/**
 * Kern-Funktion fuer das Anfordern eines Magic-Links.
 *
 * Wird sowohl vom HTTP-Endpoint (POST /api/v1/auth/magic-link) als auch von
 * der Server-Action der `/anmelden`-Seite aufgerufen. Kapselt:
 * - Rate-Limit-Checks (IP + E-Mail) — PRD §16.
 * - User-Enumeration-Schutz: bei `login` + unbekannter Mail kein Token,
 *   aber `ok: true` (gegenueber Caller transparent).
 * - Token-Generierung + DB-Insert.
 * - Mail-Versand via `sendMail()` (T-001 oder T-002).
 *
 * Caller liefert die IP fuer den Rate-Limit-Schluessel.
 *
 * @param input.email          Plain-E-Mail-Adresse (wird intern lowercased).
 * @param input.zweck          'login' oder 'registrierung'.
 * @param input.ip             IP des Aufrufers (fuer Rate-Limit).
 * @param input.nextPath       Optionaler Redirect-Pfad nach erfolgreichem
 *                              Verify (z.B. '/werke'). Wird im Token
 *                              persistiert; Verify-Route filtert defensiv
 *                              auf same-origin.
 */
export async function requestMagicLink(input: {
  email: string;
  zweck: MagicLinkZweckType;
  ip: string;
  nextPath?: string | null;
}): Promise<RequestMagicLinkResult> {
  const normalizedEmail = input.email.toLowerCase();

  // ── Rate-Limits PRD §16 ──────────────────────────────────────────────────
  const ipLimit = await checkMagicLinkIpLimit(input.ip);
  if (!ipLimit.ok) return { ok: false, fehler: 'rate_limit_ip' };
  const emailLimit = await checkMagicLinkEmailLimit(normalizedEmail);
  if (!emailLimit.ok) return { ok: false, fehler: 'rate_limit_email' };

  // ── User-Enumeration-Schutz: bei unbekannter Email beim Login NO-OP ────
  const knownNutzer = await db
    .select({ id: nutzer.id, anzeigename: nutzer.anzeigename })
    .from(nutzer)
    .where(eq(nutzer.email, normalizedEmail))
    .limit(1);

  if (input.zweck === 'login' && knownNutzer.length === 0) {
    // unbekannte Mail beim Login → leise Erfolgsmeldung, kein Token, keine Mail
    return { ok: true };
  }

  // ── Token generieren + speichern ─────────────────────────────────────────
  const { clearToken, tokenHash } = generateMagicLinkToken();
  const expiresAt = new Date(Date.now() + MAGIC_LINK_EXPIRY_MIN * 60 * 1000);
  await db.insert(magicLinkToken).values({
    email: normalizedEmail,
    tokenHash,
    zweck: input.zweck,
    expiresAt,
    nextPath: input.nextPath ?? null,
  });

  // ── Mail versenden ───────────────────────────────────────────────────────
  const magicLinkUrl =
    `${env.APP_URL}/api/v1/auth/magic-link/verify?token=${encodeURIComponent(clearToken)}`;

  if (input.zweck === 'login') {
    await sendMail({
      to: normalizedEmail,
      template: 'T-001',
      props: {
        magicLinkUrl,
        expiresInMinutes: MAGIC_LINK_EXPIRY_MIN,
        appUrl: env.APP_URL,
      },
      nutzerId: knownNutzer[0]?.id ?? null,
    });
  } else {
    const anzeigename =
      knownNutzer[0]?.anzeigename ??
      normalizedEmail.split('@')[0] ??
      'Werkzirkel';
    await sendMail({
      to: normalizedEmail,
      template: 'T-002',
      props: {
        magicLinkUrl,
        anzeigename,
        appUrl: env.APP_URL,
      },
      nutzerId: knownNutzer[0]?.id ?? null,
    });
  }

  return { ok: true };
}
