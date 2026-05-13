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
