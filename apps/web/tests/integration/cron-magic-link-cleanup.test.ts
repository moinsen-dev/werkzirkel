/**
 * Integration-Tests fuer den Cron-Endpunkt
 *   POST /api/v1/cron/magic-link-cleanup
 *
 * Verifiziert:
 *  - 401 ohne X-Cron-Secret
 *  - Loescht Tokens mit expires_at > 1 Tag in der Vergangenheit
 *  - Belaesst noch nicht abgelaufene oder soeben abgelaufene Tokens (innerhalb 1 Tag)
 *  - Idempotenz: zweiter Aufruf → 0 geloescht
 */

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { eq, inArray } from 'drizzle-orm';

import { db } from '@/lib/db';
import { auditLog, magicLinkToken } from '@/lib/db/schema';
import { env } from '@/lib/env';

import { POST as cronPost } from '@/app/api/v1/cron/magic-link-cleanup/route';

const APP_ORIGIN = new URL(env.APP_URL).origin;
const CRON_SECRET = env.CRON_SECRET!;
const TEST_EMAILS = [
  'cron-mlc-frisch@test.werkzirkel.de',
  'cron-mlc-veraltet@test.werkzirkel.de',
  'cron-mlc-grenzwert@test.werkzirkel.de',
];

async function cleanup(): Promise<void> {
  await db.delete(magicLinkToken).where(inArray(magicLinkToken.email, TEST_EMAILS));
  await db.delete(auditLog).where(eq(auditLog.aktion, 'cron.magic-link-cleanup'));
}

function cronRequest(secret?: string): Request {
  const headers: Record<string, string> = {};
  if (secret !== undefined) headers['x-cron-secret'] = secret;
  return new Request(`${APP_ORIGIN}/api/v1/cron/magic-link-cleanup`, {
    method: 'POST',
    headers,
  });
}

describe('POST /api/v1/cron/magic-link-cleanup', () => {
  beforeEach(cleanup);
  afterAll(cleanup);

  it('ohne Secret → 401', async () => {
    const res = await cronPost(cronRequest());
    expect(res.status).toBe(401);
  });

  it('loescht Tokens > 1d abgelaufen, behaelt frische / im Karenz-Fenster', async () => {
    // Frisch: laeuft erst morgen ab → bleibt
    await db.insert(magicLinkToken).values({
      email: TEST_EMAILS[0]!,
      tokenHash: 'a'.repeat(64),
      zweck: 'login',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    // Veraltet: vor 2 Tagen abgelaufen → wird geloescht
    await db.insert(magicLinkToken).values({
      email: TEST_EMAILS[1]!,
      tokenHash: 'b'.repeat(64),
      zweck: 'login',
      expiresAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    });
    // Grenzwert: 1 Stunde abgelaufen → bleibt (innerhalb 1-Tag-Karenz)
    await db.insert(magicLinkToken).values({
      email: TEST_EMAILS[2]!,
      tokenHash: 'c'.repeat(64),
      zweck: 'login',
      expiresAt: new Date(Date.now() - 60 * 60 * 1000),
    });

    const res = await cronPost(cronRequest(CRON_SECRET));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { geloescht: number };
    expect(body.geloescht).toBe(1);

    // Frisch + Grenzwert bleiben
    const remaining = await db
      .select()
      .from(magicLinkToken)
      .where(inArray(magicLinkToken.email, TEST_EMAILS));
    expect(remaining.length).toBe(2);
    const emails = remaining.map((r) => r.email).sort();
    expect(emails).toEqual([TEST_EMAILS[0]!, TEST_EMAILS[2]!].sort());
  });

  it('Idempotenz: zweiter Aufruf → 0 geloescht', async () => {
    await db.insert(magicLinkToken).values({
      email: TEST_EMAILS[1]!,
      tokenHash: 'd'.repeat(64),
      zweck: 'login',
      expiresAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    });

    const first = await cronPost(cronRequest(CRON_SECRET));
    expect(first.status).toBe(200);
    expect(((await first.json()) as { geloescht: number }).geloescht).toBe(1);

    const second = await cronPost(cronRequest(CRON_SECRET));
    expect(second.status).toBe(200);
    expect(((await second.json()) as { geloescht: number }).geloescht).toBe(0);
  });
});
