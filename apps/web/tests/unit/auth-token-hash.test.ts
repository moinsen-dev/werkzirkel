/**
 * Unit-Test fuer Magic-Link-Token-Hashing.
 *
 * Sichert die Schluesseleigenschaft aus PRD §16:
 *   "Token in `magic_link_token.token_hash` ist SHA-256-Hash, niemals Klartext."
 *
 * Wir verifizieren:
 * 1. Die exportierte `hashMagicLinkToken`-Funktion liefert exakt den
 *    SHA-256-Hex-Hash, den Node's `crypto.createHash('sha256')` erzeugt.
 * 2. `generateMagicLinkToken()` produziert konsistente clear+hash-Paare:
 *    `hashMagicLinkToken(clear) === tokenHash`.
 * 3. Der Klartext-Token taucht NIRGENDS im persistierten Hash auf
 *    (Sanity-Check gegen versehentliche Klartext-Speicherung).
 */

import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import {
  generateMagicLinkToken,
  hashMagicLinkToken,
} from '@/lib/auth/magic-link';

describe('Magic-Link-Token: SHA-256-Hash, niemals Klartext', () => {
  it('hashMagicLinkToken nutzt SHA-256 (Referenz: Node crypto)', () => {
    const sample = 'abc123-very-secret-token';
    const expected = createHash('sha256').update(sample).digest('hex');
    expect(hashMagicLinkToken(sample)).toBe(expected);
  });

  it('generateMagicLinkToken liefert clear+hash-Paar, das konsistent ist', () => {
    const { clearToken, tokenHash } = generateMagicLinkToken();
    expect(clearToken).toBeTruthy();
    expect(tokenHash).toBeTruthy();
    expect(tokenHash).toBe(hashMagicLinkToken(clearToken));
    // SHA-256 hex = 64 Zeichen
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('Hash enthaelt NIE den Klartext-Token als Substring', () => {
    // Wenn jemand versehentlich die Hash-Funktion auf Identity oder Base64 umstellt,
    // wuerde der Klartext im Hash auftauchen — dieser Test schlaegt dann an.
    for (let i = 0; i < 25; i++) {
      const { clearToken, tokenHash } = generateMagicLinkToken();
      expect(tokenHash.includes(clearToken)).toBe(false);
      // base64url-Variante koennte auch ohne Padding/=s auftauchen — daher
      // zusaetzlich Substring-Check gegen die ersten 16 Zeichen (genug Entropie).
      expect(tokenHash.includes(clearToken.slice(0, 16))).toBe(false);
    }
  });

  it('zwei aufeinanderfolgende Tokens unterscheiden sich', () => {
    const a = generateMagicLinkToken();
    const b = generateMagicLinkToken();
    expect(a.clearToken).not.toBe(b.clearToken);
    expect(a.tokenHash).not.toBe(b.tokenHash);
  });
});
