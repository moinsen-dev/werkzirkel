/**
 * Integration-Tests fuer den Cron-Endpunkt
 *   POST /api/v1/cron/ip-kuerzung
 *
 * Verifiziert (PRD §34):
 *  - Sessions / Audit-Eintraege > 30 Tage: letztes IP-Oktett genullt.
 *  - Sessions / Audit-Eintraege > 90 Tage: user_agent NULL.
 *  - Eintraege unter 30 Tagen bleiben unveraendert.
 *  - Idempotenz: zweiter Aufruf macht keine Updates mehr.
 *  - 401 ohne korrektes Secret.
 */

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createId } from '@paralleldrive/cuid2';
import { eq, inArray } from 'drizzle-orm';

import { db } from '@/lib/db';
import { auditLog, nutzer, session as sessionTable } from '@/lib/db/schema';
import { env } from '@/lib/env';

import { POST as cronPost } from '@/app/api/v1/cron/ip-kuerzung/route';

const APP_ORIGIN = new URL(env.APP_URL).origin;
const CRON_SECRET = env.CRON_SECRET!;
const TEST_EMAIL = 'cron-ip-kuerzung@test.werkzirkel.de';

const TAG_MS = 24 * 60 * 60 * 1000;

let nutzerIdForTest: string;

async function cleanup(): Promise<void> {
  const ids = (
    await db.select({ id: nutzer.id }).from(nutzer).where(eq(nutzer.email, TEST_EMAIL))
  ).map((n) => n.id);
  if (ids.length) {
    await db.delete(sessionTable).where(inArray(sessionTable.nutzerId, ids));
    await db.delete(auditLog).where(inArray(auditLog.nutzerId, ids));
    await db.delete(nutzer).where(inArray(nutzer.id, ids));
  }
  await db.delete(auditLog).where(eq(auditLog.aktion, 'cron.ip-kuerzung'));
}

async function createUser(): Promise<string> {
  const id = createId();
  await db.insert(nutzer).values({
    id,
    email: TEST_EMAIL,
    klarname: 'IP Test',
    anzeigename: 'ip-test',
    stadtId: 'hh',
    rollen: ['macher'],
    emailVerifiziertAm: new Date(),
  });
  return id;
}

function cronRequest(secret?: string): Request {
  const headers: Record<string, string> = {};
  if (secret !== undefined) headers['x-cron-secret'] = secret;
  return new Request(`${APP_ORIGIN}/api/v1/cron/ip-kuerzung`, {
    method: 'POST',
    headers,
  });
}

describe('POST /api/v1/cron/ip-kuerzung', () => {
  beforeEach(async () => {
    await cleanup();
    nutzerIdForTest = await createUser();
  });
  afterAll(cleanup);

  it('ohne Secret → 401', async () => {
    const res = await cronPost(cronRequest());
    expect(res.status).toBe(401);
  });

  it('kuerzt Session-IP nach 30d, loescht User-Agent nach 90d, neue Eintraege bleiben', async () => {
    // 40 Tage alt: IP gekuerzt, UA bleibt
    const session40 = createId();
    await db.insert(sessionTable).values({
      id: session40,
      nutzerId: nutzerIdForTest,
      expiresAt: new Date(Date.now() + 30 * TAG_MS),
      ipAdresse: '192.168.1.42',
      userAgent: 'mozilla',
      erstelltAm: new Date(Date.now() - 40 * TAG_MS),
    });
    // 100 Tage alt: IP gekuerzt, UA NULL
    const session100 = createId();
    await db.insert(sessionTable).values({
      id: session100,
      nutzerId: nutzerIdForTest,
      expiresAt: new Date(Date.now() + 30 * TAG_MS),
      ipAdresse: '10.0.0.55',
      userAgent: 'firefox',
      erstelltAm: new Date(Date.now() - 100 * TAG_MS),
    });
    // 5 Tage alt: bleibt unveraendert
    const sessionFresh = createId();
    await db.insert(sessionTable).values({
      id: sessionFresh,
      nutzerId: nutzerIdForTest,
      expiresAt: new Date(Date.now() + 30 * TAG_MS),
      ipAdresse: '203.0.113.99',
      userAgent: 'chrome',
      erstelltAm: new Date(Date.now() - 5 * TAG_MS),
    });

    const res = await cronPost(cronRequest(CRON_SECRET));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      session_ip_kuerzungen: number;
      session_ua_geloescht: number;
    };
    expect(body.session_ip_kuerzungen).toBe(2);
    expect(body.session_ua_geloescht).toBe(1);

    // Pruefen
    const s40 = (
      await db.select().from(sessionTable).where(eq(sessionTable.id, session40))
    )[0]!;
    expect(s40.ipAdresse).toBe('192.168.1.0');
    expect(s40.userAgent).toBe('mozilla');

    const s100 = (
      await db.select().from(sessionTable).where(eq(sessionTable.id, session100))
    )[0]!;
    expect(s100.ipAdresse).toBe('10.0.0.0');
    expect(s100.userAgent).toBeNull();

    const sFresh = (
      await db.select().from(sessionTable).where(eq(sessionTable.id, sessionFresh))
    )[0]!;
    expect(sFresh.ipAdresse).toBe('203.0.113.99');
    expect(sFresh.userAgent).toBe('chrome');
  });

  it('Idempotenz: zweiter Lauf liefert 0 IP-Kuerzungen und 0 UA-Loeschungen', async () => {
    // 40 Tage alter Eintrag
    await db.insert(sessionTable).values({
      id: createId(),
      nutzerId: nutzerIdForTest,
      expiresAt: new Date(Date.now() + 30 * TAG_MS),
      ipAdresse: '192.168.1.42',
      userAgent: 'mozilla',
      erstelltAm: new Date(Date.now() - 40 * TAG_MS),
    });

    const first = await cronPost(cronRequest(CRON_SECRET));
    expect(first.status).toBe(200);
    const f = (await first.json()) as { session_ip_kuerzungen: number };
    expect(f.session_ip_kuerzungen).toBe(1);

    const second = await cronPost(cronRequest(CRON_SECRET));
    expect(second.status).toBe(200);
    const s = (await second.json()) as {
      session_ip_kuerzungen: number;
      session_ua_geloescht: number;
    };
    expect(s.session_ip_kuerzungen).toBe(0);
    expect(s.session_ua_geloescht).toBe(0);
  });

  it('Audit-Log: IP nach 30d gekuerzt, UA nach 90d NULL', async () => {
    await db.insert(auditLog).values({
      nutzerId: nutzerIdForTest,
      aktion: 'test.fixture',
      ipAdresse: '198.51.100.7',
      userAgent: 'curl',
      erstelltAm: new Date(Date.now() - 40 * TAG_MS),
    });
    await db.insert(auditLog).values({
      nutzerId: nutzerIdForTest,
      aktion: 'test.fixture',
      ipAdresse: '198.51.100.8',
      userAgent: 'curl',
      erstelltAm: new Date(Date.now() - 100 * TAG_MS),
    });

    const res = await cronPost(cronRequest(CRON_SECRET));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      audit_ip_kuerzungen: number;
      audit_ua_geloescht: number;
    };
    expect(body.audit_ip_kuerzungen).toBe(2);
    expect(body.audit_ua_geloescht).toBe(1);
  });
});
