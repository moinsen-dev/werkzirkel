/**
 * Integration-Tests fuer GET /api/v1/me/export (DSGVO Self-Service, PRD §34).
 *
 * Verifiziert:
 * - 200 + Content-Type/Content-Disposition fuer authenticated request
 * - Body ist valides JSON mit allen erwarteten Top-Level-Keys
 * - 2. Aufruf innerhalb einer Stunde → 429 (Rate-Limit)
 * - Aufruf ohne Session → 401
 */

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createId } from '@paralleldrive/cuid2';
import { inArray } from 'drizzle-orm';

import { db } from '@/lib/db';
import {
  auditLog,
  nutzer,
  rateLimitBucket,
  session as sessionTable,
} from '@/lib/db/schema';

import { GET as exportGet } from '@/app/api/v1/me/export/route';
import { buildSessionCookie } from '@/lib/auth/session';
import { truncateAll } from '../_helpers/db-cleanup';

const EXPORT_USER_EMAIL = 'dsgvo-export@test.werkzirkel.de';

async function cleanupTestState(): Promise<void> {
  await truncateAll();
  // Folgende Spezial-Deletes sind nach truncateAll No-ops, dokumentieren
  // aber die urspruengliche Aufraeum-Intention pro Suite.
  const testNutzer = await db
    .select({ id: nutzer.id })
    .from(nutzer)
    .where(inArray(nutzer.email, [EXPORT_USER_EMAIL]));
  const ids = testNutzer.map((n) => n.id);
  await db.delete(rateLimitBucket);
  if (ids.length > 0) {
    await db.delete(auditLog).where(inArray(auditLog.nutzerId, ids));
    await db.delete(sessionTable).where(inArray(sessionTable.nutzerId, ids));
    await db.delete(nutzer).where(inArray(nutzer.id, ids));
  }
}

async function createUser(): Promise<string> {
  const id = createId();
  await db.insert(nutzer).values({
    id,
    email: EXPORT_USER_EMAIL,
    klarname: 'Export Test',
    anzeigename: 'export-test',
    stadtId: 'hh',
    rollen: ['macher'],
    emailVerifiziertAm: new Date(),
  });
  return id;
}

async function createSessionFor(nutzerId: string): Promise<string> {
  const id = createId();
  await db.insert(sessionTable).values({
    id,
    nutzerId,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    userAgent: 'integration-test',
    ipAdresse: '127.0.0.1',
  });
  return id;
}

function exportRequest(sessionId?: string): Request {
  const headers: Record<string, string> = {
    'x-forwarded-for': '127.0.0.1',
  };
  if (sessionId) {
    headers.cookie = buildSessionCookie(sessionId).split(';')[0]!;
  }
  return new Request('http://localhost:3210/api/v1/me/export', {
    method: 'GET',
    headers,
  });
}

describe('GET /api/v1/me/export', () => {
  beforeEach(async () => {
    await cleanupTestState();
  });

  afterAll(async () => {
    await cleanupTestState();
  });

  it('ohne Session → 401', async () => {
    const res = await exportGet(exportRequest());
    expect(res.status).toBe(401);
  });

  it('mit Session → 200, application/json + attachment Content-Disposition', async () => {
    const userId = await createUser();
    const sessId = await createSessionFor(userId);

    const res = await exportGet(exportRequest(sessId));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/json; charset=utf-8');
    const cd = res.headers.get('content-disposition') ?? '';
    expect(cd).toMatch(/^attachment; filename="werkzirkel-export-\d{4}-\d{2}-\d{2}\.json"$/);

    const body = await res.json();
    expect(body).toBeTypeOf('object');
    // Alle PRD §34-Top-Level-Keys vorhanden.
    for (const key of [
      'exportiert_am',
      'exportiert_fuer',
      'profil',
      'werke',
      'pruefrunden_eigene',
      'pruefrunden_gegebene',
      'bedarfe',
      'werkangebote',
      'foerderprofil',
      'termin_anmeldungen',
      'werkstattbeitraege',
      'erfolgsbeitraege',
      'foerdermitgliedschaft',
      'audit',
    ]) {
      expect(body).toHaveProperty(key);
    }
    expect(body.profil.email).toBe(EXPORT_USER_EMAIL);
  });

  it('2. Aufruf innerhalb einer Stunde → 429', async () => {
    const userId = await createUser();
    const sessId = await createSessionFor(userId);

    const first = await exportGet(exportRequest(sessId));
    expect(first.status).toBe(200);
    // Body lesen, damit der Stream geschlossen wird.
    await first.text();

    const second = await exportGet(exportRequest(sessId));
    expect(second.status).toBe(429);
  });
});
