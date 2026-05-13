/**
 * Integration-Tests fuer die Server-Action `magicLinkAnfordern`.
 *
 * Methode:
 * - `next/headers` und `next/navigation` werden via Vitest gemockt, damit
 *   die Action aus einem reinen Node-Test-Kontext laufen kann.
 * - `redirect()` aus dem Mock wirft einen sentinel Error → wir fangen ihn,
 *   inspizieren das Redirect-Ziel.
 * - Nach Erfolg pruefen wir den `magic_link_token`-Row mit `next_path`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { magicLinkToken } from '@/lib/db/schema/nutzer';
import { rateLimitBucket } from '@/lib/db/schema/rate-limit';
import { truncateAll } from '../_helpers/db-cleanup';

let lastRedirect: string | null = null;
let mockHeaders = new Map<string, string>();

vi.mock('next/headers', () => ({
  headers: async () => ({
    get: (name: string) => mockHeaders.get(name.toLowerCase()) ?? null,
  }),
}));

vi.mock('next/navigation', () => ({
  redirect: (target: string) => {
    lastRedirect = target;
    const err = new Error(`NEXT_REDIRECT: ${target}`);
    (err as Error & { digest: string }).digest = `NEXT_REDIRECT;replace;${target};307;`;
    throw err;
  },
}));

// Erst nach den Mocks importieren — die Action liest `next/navigation`
// und `next/headers` beim Modul-Init.
const { magicLinkAnfordern } = await import('@/app/anmelden/actions');

const TEST_EMAIL = 'anmelden-action-test@test.werkzirkel.de';

function makeFormData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
}

async function callAction(fields: Record<string, string>): Promise<string> {
  lastRedirect = null;
  try {
    await magicLinkAnfordern(makeFormData(fields));
  } catch (err) {
    // Erwartet — `redirect()` wirft.
    if (!(err instanceof Error) || !err.message.startsWith('NEXT_REDIRECT')) {
      throw err;
    }
  }
  if (!lastRedirect) throw new Error('Action hat nicht redirected.');
  return lastRedirect;
}

async function resetState(): Promise<void> {
  await truncateAll();
  // Folgende Spezial-Deletes sind nach truncateAll No-ops, dokumentieren
  // aber die urspruengliche Aufraeum-Intention pro Suite.
  await db
    .delete(magicLinkToken)
    .where(eq(magicLinkToken.email, TEST_EMAIL));
  await db.delete(rateLimitBucket);
}

beforeEach(async () => {
  mockHeaders = new Map([['x-forwarded-for', '5.6.7.8']]);
  await resetState();
});

afterEach(async () => {
  await resetState();
});

describe('Server-Action magicLinkAnfordern', () => {
  it('Erfolg: legt Token mit next_path an, redirected zu ?gesendet=1', async () => {
    const target = await callAction({
      email: TEST_EMAIL,
      zweck: 'registrierung',
      next: '/uebersicht',
    });
    expect(target).toBe('/anmelden?gesendet=1&next=%2Fuebersicht');

    const rows = await db
      .select()
      .from(magicLinkToken)
      .where(eq(magicLinkToken.email, TEST_EMAIL));
    expect(rows.length).toBe(1);
    expect(rows[0]!.nextPath).toBe('/uebersicht');
  });

  it('Erfolg ohne next: redirect ohne next-Param, next_path = null', async () => {
    const target = await callAction({
      email: TEST_EMAIL,
      zweck: 'registrierung',
    });
    expect(target).toBe('/anmelden?gesendet=1');

    const rows = await db
      .select()
      .from(magicLinkToken)
      .where(eq(magicLinkToken.email, TEST_EMAIL));
    expect(rows[0]!.nextPath).toBeNull();
  });

  it('Off-Site-next wird verworfen (kein next_path im Token)', async () => {
    const target = await callAction({
      email: TEST_EMAIL,
      zweck: 'registrierung',
      next: '//evil.com/phish',
    });
    expect(target).toBe('/anmelden?gesendet=1');

    const rows = await db
      .select()
      .from(magicLinkToken)
      .where(eq(magicLinkToken.email, TEST_EMAIL));
    expect(rows[0]!.nextPath).toBeNull();
  });

  it('ungueltige Email → redirect zu ?fehler=ungueltige-email', async () => {
    const target = await callAction({
      email: 'nicht-eine-email',
      zweck: 'login',
    });
    expect(target).toBe('/anmelden?fehler=ungueltige-email');
  });

  it('Rate-Limit-Treffer (6. Versuch pro E-Mail) → ?fehler=rate-limit', async () => {
    // Erste 5 Versuche → ok
    for (let i = 0; i < 5; i++) {
      const ok = await callAction({
        email: TEST_EMAIL,
        zweck: 'registrierung',
      });
      expect(ok).toBe('/anmelden?gesendet=1');
    }
    const blocked = await callAction({
      email: TEST_EMAIL,
      zweck: 'registrierung',
    });
    expect(blocked).toBe('/anmelden?fehler=rate-limit');
  });
});
