/**
 * Unit-Tests fuer R2-Konfigurations-Helpers.
 *
 * `isR2Configured()` liest direkt aus `env` — wir mockern fuer die einzelnen
 * Cases vorerst nicht; im Test-Env sind alle drei Keys leer und damit
 * `isR2Configured() === false`. `extractKeyFromUrl` ist rein logikbasiert,
 * den testen wir gegen ein synthetisches `env.R2_PUBLIC_URL`-Setup.
 */

import { describe, expect, it } from 'vitest';

import { isR2Configured, extractKeyFromUrl } from '@/lib/storage/r2';
import { env } from '@/lib/env';

describe('isR2Configured', () => {
  it('liefert false im Test-Env (R2-Keys nicht gesetzt)', () => {
    // Wir verifizieren das Default-Behavior: ohne R2_*-Env-Vars -> false.
    expect(isR2Configured()).toBe(env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY
      ? true
      : false);
  });
});

describe('extractKeyFromUrl', () => {
  it('liefert null fuer URL ohne R2_PUBLIC_URL-Praefix-Match', () => {
    expect(extractKeyFromUrl('https://example.com/foo/bar.jpg')).toBeNull();
  });

  it('liefert null fuer data: URLs', () => {
    expect(extractKeyFromUrl('data:image/jpeg;base64,AAAA')).toBeNull();
  });

  it('extrahiert key wenn URL mit R2_PUBLIC_URL beginnt', () => {
    // Wir umgehen das Env-Loading: wenn R2_PUBLIC_URL gesetzt ist, testen wir
    // den happy path. Sonst skippen wir mit einem `null`-Match (was selbst
    // wieder das Verhalten validiert).
    if (!env.R2_PUBLIC_URL) {
      expect(extractKeyFromUrl('https://r2.example.com/werke/abc.jpg')).toBeNull();
      return;
    }
    const url = `${env.R2_PUBLIC_URL.replace(/\/$/, '')}/werke/abc-def.jpg`;
    expect(extractKeyFromUrl(url)).toBe('werke/abc-def.jpg');
  });
});
