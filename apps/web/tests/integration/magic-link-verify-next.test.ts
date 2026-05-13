/**
 * Integration-Tests fuer den `next_path`-Durchschleif-Pfad der
 * Magic-Link-Verify-Route.
 *
 * Sicherheits-Wichtig: NUR same-origin Redirects erlauben. Patterns mit
 * `//` oder `http(s)://` muessen zu `/uebersicht` fallback-redirected
 * werden — keine Off-Site-Targets.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import {
  magicLinkToken,
  nutzer,
  session as sessionTable,
} from '@/lib/db/schema/nutzer';
import { rateLimitBucket } from '@/lib/db/schema/rate-limit';
import { env } from '@/lib/env';

import { GET as verifyGet } from '@/app/api/v1/auth/magic-link/verify/route';
import { generateMagicLinkToken } from '@/lib/auth/magic-link';
import { truncateAll } from '../_helpers/db-cleanup';

const APP_ORIGIN = new URL(env.APP_URL).origin;
const TEST_EMAIL = 'verify-next-test@test.werkzirkel.de';

function getRequest(path: string): Request {
  return new Request(`${APP_ORIGIN}${path}`, {
    method: 'GET',
    headers: { 'x-forwarded-for': '1.2.3.4' },
  });
}

async function insertToken(opts: {
  nextPath: string | null;
}): Promise<string> {
  const { clearToken, tokenHash } = generateMagicLinkToken();
  await db.insert(magicLinkToken).values({
    email: TEST_EMAIL,
    tokenHash,
    zweck: 'registrierung',
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    nextPath: opts.nextPath,
  });
  return clearToken;
}

async function resetState(): Promise<void> {
  await truncateAll();
  // Folgende Spezial-Deletes sind nach truncateAll No-ops, dokumentieren
  // aber die urspruengliche Aufraeum-Intention pro Suite.
  await db.delete(magicLinkToken);
  await db.delete(rateLimitBucket);
  await db.delete(sessionTable);
  await db.delete(nutzer).where(eq(nutzer.email, TEST_EMAIL));
}

describe('Magic-Link Verify mit next_path', () => {
  beforeEach(async () => {
    await resetState();
  });

  it('next_path=/werke → redirect zu /werke (nicht /uebersicht)', async () => {
    const clear = await insertToken({ nextPath: '/werke' });
    const res = await verifyGet(
      getRequest(`/api/v1/auth/magic-link/verify?token=${encodeURIComponent(clear)}`),
    );
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe(`${env.APP_URL}/werke`);
  });

  it('next_path=//evil.com/phish → off-site blockiert → /uebersicht', async () => {
    const clear = await insertToken({ nextPath: '//evil.com/phish' });
    const res = await verifyGet(
      getRequest(`/api/v1/auth/magic-link/verify?token=${encodeURIComponent(clear)}`),
    );
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe(`${env.APP_URL}/uebersicht`);
  });

  it('next_path=https://evil.com → off-site blockiert → /uebersicht', async () => {
    const clear = await insertToken({ nextPath: 'https://evil.com' });
    const res = await verifyGet(
      getRequest(`/api/v1/auth/magic-link/verify?token=${encodeURIComponent(clear)}`),
    );
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe(`${env.APP_URL}/uebersicht`);
  });

  it('next_path=null → Default /uebersicht', async () => {
    const clear = await insertToken({ nextPath: null });
    const res = await verifyGet(
      getRequest(`/api/v1/auth/magic-link/verify?token=${encodeURIComponent(clear)}`),
    );
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe(`${env.APP_URL}/uebersicht`);
  });

  it('next_path=/werke?ref=foo (mit Query) → bleibt erhalten', async () => {
    const clear = await insertToken({ nextPath: '/werke?ref=foo' });
    const res = await verifyGet(
      getRequest(`/api/v1/auth/magic-link/verify?token=${encodeURIComponent(clear)}`),
    );
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe(`${env.APP_URL}/werke?ref=foo`);
  });
});
