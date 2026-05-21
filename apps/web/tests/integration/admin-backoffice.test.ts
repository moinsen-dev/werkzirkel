/**
 * Integration-Tests fuer das Admin-Backoffice (PRD §15.14 + §26).
 *
 * Endpunkte:
 *   GET   /api/v1/admin/nutzer                   — Liste mit Suche/Filter
 *   GET   /api/v1/admin/nutzer/:id               — Detail
 *   POST  /api/v1/admin/nutzer/:id/sperren       — sperren + Sessions invalidieren
 *   POST  /api/v1/admin/nutzer/:id/entsperren    — entsperren
 *   GET   /api/v1/admin/staedte                  — Liste
 *   POST  /api/v1/admin/staedte                  — anlegen
 *   PATCH /api/v1/admin/staedte/:id              — aktivieren/deaktivieren
 *   POST  /api/v1/admin/staedte/:id/kurator      — Kurator ernennen (atomar)
 *   GET   /api/v1/admin/audit-log                — paginiertes Audit-Log mit Filter
 *   GET   /api/v1/admin/email-log                — paginiertes E-Mail-Log
 *
 * Akzeptanz-Kriterien:
 *   1. Permission durchgesetzt — Nicht-Admins bekommen 403 bei ALLEN Routes.
 *   2. Sperren invalidiert alle aktiven Sessions.
 *   3. Kurator-Ernennen setzt stadt.kuratorId UND nutzer.rollen += kurator atomar.
 *   4. Audit-Log-Filter aktion/nutzer_id/datum funktional.
 */

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createId } from '@paralleldrive/cuid2';
import { eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import {
  auditLog,
  emailBenachrichtigungLog,
  nutzer,
  session as sessionTable,
  stadt,
} from '@/lib/db/schema';
import type { Rolle } from '@/lib/db/schema/enums';
import { env } from '@/lib/env';
import { buildSessionCookie } from '@/lib/auth/session';

import { GET as nutzerListGET } from '@/app/api/v1/admin/nutzer/route';
import { GET as nutzerDetailGET } from '@/app/api/v1/admin/nutzer/[id]/route';
import { POST as sperrenPOST } from '@/app/api/v1/admin/nutzer/[id]/sperren/route';
import { POST as entsperrenPOST } from '@/app/api/v1/admin/nutzer/[id]/entsperren/route';
import {
  GET as staedteGET,
  POST as staedtePOST,
} from '@/app/api/v1/admin/staedte/route';
import { PATCH as stadtPATCH } from '@/app/api/v1/admin/staedte/[id]/route';
import { POST as kuratorPOST } from '@/app/api/v1/admin/staedte/[id]/kurator/route';
import { GET as auditLogGET } from '@/app/api/v1/admin/audit-log/route';
import { GET as emailLogGET } from '@/app/api/v1/admin/email-log/route';

import { truncateAll } from '../_helpers/db-cleanup';

const APP_ORIGIN = new URL(env.APP_URL).origin;

async function nutzerAnlegen(opts: {
  email: string;
  stadtId?: string;
  rollen?: Rolle[];
  klarname?: string;
  anzeigename?: string;
}): Promise<string> {
  const id = createId();
  await db.insert(nutzer).values({
    id,
    email: opts.email,
    klarname: opts.klarname ?? `Klar ${opts.email}`,
    anzeigename: opts.anzeigename ?? `anz-${id.slice(0, 6)}`,
    stadtId: opts.stadtId ?? 'hh',
    rollen: opts.rollen ?? ['macher'],
    emailVerifiziertAm: new Date(),
  });
  return id;
}

async function sessionAnlegen(nutzerId: string): Promise<string> {
  const sid = createId();
  await db.insert(sessionTable).values({
    id: sid,
    nutzerId,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });
  return sid;
}

function buildRequest(opts: {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  sessionId?: string;
  body?: unknown;
  ip?: string;
}): Request {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    origin: APP_ORIGIN,
    'x-forwarded-for': opts.ip ?? '127.0.0.1',
  };
  if (opts.sessionId) {
    headers.cookie = buildSessionCookie(opts.sessionId).split(';')[0]!;
  }
  return new Request(`${APP_ORIGIN}${opts.path}`, {
    method: opts.method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

// ───────────────────────────────────────────────────────────
// GET /api/v1/admin/nutzer
// ───────────────────────────────────────────────────────────

describe('GET /api/v1/admin/nutzer', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  it('Nicht eingeloggt → 401', async () => {
    const res = await nutzerListGET(
      buildRequest({ method: 'GET', path: '/api/v1/admin/nutzer' }),
    );
    expect(res.status).toBe(401);
  });

  it('Eingeloggt aber kein Admin → 403', async () => {
    const u = await nutzerAnlegen({ email: 'noperm@test.werkzirkel.de' });
    const sid = await sessionAnlegen(u);
    const res = await nutzerListGET(
      buildRequest({
        method: 'GET',
        path: '/api/v1/admin/nutzer',
        sessionId: sid,
      }),
    );
    expect(res.status).toBe(403);
  });

  it('Admin → 200 mit Liste + Suche funktioniert', async () => {
    const admin = await nutzerAnlegen({
      email: 'admin1@test.werkzirkel.de',
      rollen: ['admin'],
    });
    const sid = await sessionAnlegen(admin);
    await nutzerAnlegen({
      email: 'mariesucher@test.werkzirkel.de',
      anzeigename: 'mariefoo',
    });
    await nutzerAnlegen({
      email: 'jensbeispiel@test.werkzirkel.de',
      anzeigename: 'jens',
    });

    const resAll = await nutzerListGET(
      buildRequest({
        method: 'GET',
        path: '/api/v1/admin/nutzer',
        sessionId: sid,
      }),
    );
    expect(resAll.status).toBe(200);
    const dAll = (await resAll.json()) as { nutzer: unknown[] };
    expect(dAll.nutzer.length).toBe(3);

    // q-Filter auf email-Pattern
    const resQ = await nutzerListGET(
      buildRequest({
        method: 'GET',
        path: '/api/v1/admin/nutzer?q=mariesucher',
        sessionId: sid,
      }),
    );
    expect(resQ.status).toBe(200);
    const dQ = (await resQ.json()) as {
      nutzer: Array<{ email: string }>;
    };
    expect(dQ.nutzer.length).toBe(1);
    expect(dQ.nutzer[0]!.email).toBe('mariesucher@test.werkzirkel.de');

    // q-Filter case-insensitive auf anzeigename
    const resQ2 = await nutzerListGET(
      buildRequest({
        method: 'GET',
        path: '/api/v1/admin/nutzer?q=MARIEF',
        sessionId: sid,
      }),
    );
    const dQ2 = (await resQ2.json()) as {
      nutzer: Array<{ anzeigename: string }>;
    };
    expect(dQ2.nutzer.length).toBe(1);
    expect(dQ2.nutzer[0]!.anzeigename).toBe('mariefoo');
  });

  it('Filter rolle ANY-Match funktioniert', async () => {
    const admin = await nutzerAnlegen({
      email: 'admin-rolle@test.werkzirkel.de',
      rollen: ['admin'],
    });
    const sid = await sessionAnlegen(admin);
    await nutzerAnlegen({
      email: 'k-rolle@test.werkzirkel.de',
      rollen: ['macher', 'kurator'],
    });

    const res = await nutzerListGET(
      buildRequest({
        method: 'GET',
        path: '/api/v1/admin/nutzer?rolle=kurator',
        sessionId: sid,
      }),
    );
    const d = (await res.json()) as { nutzer: Array<{ email: string }> };
    expect(d.nutzer.map((n) => n.email)).toContain('k-rolle@test.werkzirkel.de');
    expect(d.nutzer.map((n) => n.email)).not.toContain('admin-rolle@test.werkzirkel.de');
  });
});

// ───────────────────────────────────────────────────────────
// GET /api/v1/admin/nutzer/:id
// ───────────────────────────────────────────────────────────

describe('GET /api/v1/admin/nutzer/:id', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  it('Nicht-Admin → 403', async () => {
    const u = await nutzerAnlegen({ email: 'detail-no@test.werkzirkel.de' });
    const sid = await sessionAnlegen(u);
    const res = await nutzerDetailGET(
      buildRequest({
        method: 'GET',
        path: `/api/v1/admin/nutzer/${u}`,
        sessionId: sid,
      }),
      { params: Promise.resolve({ id: u }) },
    );
    expect(res.status).toBe(403);
  });

  it('Admin → 200 mit aktive_sessions-Count', async () => {
    const admin = await nutzerAnlegen({
      email: 'admin-d@test.werkzirkel.de',
      rollen: ['admin'],
    });
    const sid = await sessionAnlegen(admin);
    const ziel = await nutzerAnlegen({ email: 'ziel-d@test.werkzirkel.de' });
    await sessionAnlegen(ziel);
    await sessionAnlegen(ziel);

    const res = await nutzerDetailGET(
      buildRequest({
        method: 'GET',
        path: `/api/v1/admin/nutzer/${ziel}`,
        sessionId: sid,
      }),
      { params: Promise.resolve({ id: ziel }) },
    );
    expect(res.status).toBe(200);
    const d = (await res.json()) as {
      nutzer: { id: string };
      aktive_sessions: number;
    };
    expect(d.nutzer.id).toBe(ziel);
    expect(d.aktive_sessions).toBe(2);
  });
});

// ───────────────────────────────────────────────────────────
// POST /api/v1/admin/nutzer/:id/sperren
// ───────────────────────────────────────────────────────────

describe('POST /api/v1/admin/nutzer/:id/sperren', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  it('Nicht-Admin → 403', async () => {
    const u = await nutzerAnlegen({ email: 'sp-no@test.werkzirkel.de' });
    const sid = await sessionAnlegen(u);
    const res = await sperrenPOST(
      buildRequest({
        method: 'POST',
        path: `/api/v1/admin/nutzer/${u}/sperren`,
        sessionId: sid,
        body: {},
      }),
      { params: Promise.resolve({ id: u }) },
    );
    expect(res.status).toBe(403);
  });

  it('Admin sperrt → status=gesperrt + alle Sessions invalidiert', async () => {
    const admin = await nutzerAnlegen({
      email: 'admin-sp@test.werkzirkel.de',
      rollen: ['admin'],
    });
    const adminSid = await sessionAnlegen(admin);
    const ziel = await nutzerAnlegen({ email: 'ziel-sp@test.werkzirkel.de' });
    await sessionAnlegen(ziel);
    await sessionAnlegen(ziel);
    await sessionAnlegen(ziel);

    const res = await sperrenPOST(
      buildRequest({
        method: 'POST',
        path: `/api/v1/admin/nutzer/${ziel}/sperren`,
        sessionId: adminSid,
        body: { grund: 'Spam-Werbung' },
      }),
      { params: Promise.resolve({ id: ziel }) },
    );
    expect(res.status).toBe(200);

    const d = (await res.json()) as { sessions_invalidiert: number };
    expect(d.sessions_invalidiert).toBe(3);

    // DB-Check
    const row = (
      await db.select().from(nutzer).where(eq(nutzer.id, ziel)).limit(1)
    )[0]!;
    expect(row.status).toBe('gesperrt');

    const sessions = await db
      .select()
      .from(sessionTable)
      .where(eq(sessionTable.nutzerId, ziel));
    expect(sessions.length).toBe(0);

    // Audit-Log
    const audits = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.aktion, 'nutzer.gesperrt'));
    expect(audits.length).toBe(1);
    expect(
      (audits[0]!.metadaten as Record<string, unknown>).sessions_invalidiert,
    ).toBe(3);
  });

  it('Admin kann sich nicht selbst sperren → 422', async () => {
    const admin = await nutzerAnlegen({
      email: 'admin-self@test.werkzirkel.de',
      rollen: ['admin'],
    });
    const sid = await sessionAnlegen(admin);
    const res = await sperrenPOST(
      buildRequest({
        method: 'POST',
        path: `/api/v1/admin/nutzer/${admin}/sperren`,
        sessionId: sid,
        body: {},
      }),
      { params: Promise.resolve({ id: admin }) },
    );
    expect(res.status).toBe(422);
  });

  it('Falscher Origin → 403', async () => {
    const admin = await nutzerAnlegen({
      email: 'admin-orig@test.werkzirkel.de',
      rollen: ['admin'],
    });
    const adminSid = await sessionAnlegen(admin);
    const ziel = await nutzerAnlegen({ email: 'ziel-orig@test.werkzirkel.de' });
    const req = new Request(
      `https://evil.example.com/api/v1/admin/nutzer/${ziel}/sperren`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: 'https://evil.example.com',
          cookie: buildSessionCookie(adminSid).split(';')[0]!,
        },
        body: '{}',
      },
    );
    const res = await sperrenPOST(req, {
      params: Promise.resolve({ id: ziel }),
    });
    expect(res.status).toBe(403);
  });
});

// ───────────────────────────────────────────────────────────
// POST /api/v1/admin/nutzer/:id/entsperren
// ───────────────────────────────────────────────────────────

describe('POST /api/v1/admin/nutzer/:id/entsperren', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  it('Admin entsperrt → status=aktiv + Audit-Log', async () => {
    const admin = await nutzerAnlegen({
      email: 'admin-ent@test.werkzirkel.de',
      rollen: ['admin'],
    });
    const sid = await sessionAnlegen(admin);
    const ziel = await nutzerAnlegen({
      email: 'ziel-ent@test.werkzirkel.de',
    });
    await db.update(nutzer).set({ status: 'gesperrt' }).where(eq(nutzer.id, ziel));

    const res = await entsperrenPOST(
      buildRequest({
        method: 'POST',
        path: `/api/v1/admin/nutzer/${ziel}/entsperren`,
        sessionId: sid,
      }),
      { params: Promise.resolve({ id: ziel }) },
    );
    expect(res.status).toBe(200);

    const row = (
      await db.select().from(nutzer).where(eq(nutzer.id, ziel)).limit(1)
    )[0]!;
    expect(row.status).toBe('aktiv');

    const audits = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.aktion, 'nutzer.entsperrt'));
    expect(audits.length).toBe(1);
  });
});

// ───────────────────────────────────────────────────────────
// Staedte
// ───────────────────────────────────────────────────────────

describe('Staedte (Admin)', () => {
  // Test-Staedte werden mit eindeutigem Praefix angelegt und am Ende wieder
  // entfernt, damit der Seed-Zustand (hh/b/m) fuer andere Test-Files
  // (insb. zirkel-stadt-seite.test.ts) unveraendert bleibt.
  const TEST_STADT_IDS = ['tst-koeln', 'tst-bremen', 'tst-aachen'];

  beforeEach(async () => {
    await truncateAll();
    // Test-Staedte aus eventuellen Vorlaeufen entfernen
    for (const id of TEST_STADT_IDS) {
      await db.delete(stadt).where(eq(stadt.id, id));
    }
  });
  afterAll(async () => {
    await truncateAll();
    for (const id of TEST_STADT_IDS) {
      await db.delete(stadt).where(eq(stadt.id, id));
    }
  });

  it('GET /api/v1/admin/staedte: Nicht-Admin → 403, Admin → 200', async () => {
    const u = await nutzerAnlegen({ email: 'stno@test.werkzirkel.de' });
    const sid = await sessionAnlegen(u);
    const res403 = await staedteGET(
      buildRequest({
        method: 'GET',
        path: '/api/v1/admin/staedte',
        sessionId: sid,
      }),
    );
    expect(res403.status).toBe(403);

    const admin = await nutzerAnlegen({
      email: 'stadmin@test.werkzirkel.de',
      rollen: ['admin'],
    });
    const adminSid = await sessionAnlegen(admin);
    const res200 = await staedteGET(
      buildRequest({
        method: 'GET',
        path: '/api/v1/admin/staedte',
        sessionId: adminSid,
      }),
    );
    expect(res200.status).toBe(200);
    const d = (await res200.json()) as { staedte: unknown[] };
    expect(Array.isArray(d.staedte)).toBe(true);
  });

  it('POST /api/v1/admin/staedte legt neue Stadt an + Audit-Log', async () => {
    const admin = await nutzerAnlegen({
      email: 'stadmin2@test.werkzirkel.de',
      rollen: ['admin'],
    });
    const sid = await sessionAnlegen(admin);

    const res = await staedtePOST(
      buildRequest({
        method: 'POST',
        path: '/api/v1/admin/staedte',
        sessionId: sid,
        body: {
          id: 'tst-koeln',
          name: 'Test-Koeln',
          status: 'vorbereitung',
          beschreibung: 'Koeln in Vorbereitung.',
          sortierung: 30,
        },
      }),
    );
    expect(res.status).toBe(201);
    const d = (await res.json()) as {
      stadt: { id: string; name: string; status: string };
    };
    expect(d.stadt.id).toBe('tst-koeln');
    expect(d.stadt.name).toBe('Test-Koeln');

    const audits = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.aktion, 'stadt.angelegt'));
    expect(audits.length).toBe(1);
  });

  it('POST /api/v1/admin/staedte mit existierendem Kuerzel → 409', async () => {
    const admin = await nutzerAnlegen({
      email: 'stadmin3@test.werkzirkel.de',
      rollen: ['admin'],
    });
    const sid = await sessionAnlegen(admin);
    const res = await staedtePOST(
      buildRequest({
        method: 'POST',
        path: '/api/v1/admin/staedte',
        sessionId: sid,
        body: { id: 'hh', name: 'Hamburg-Duplikat' },
      }),
    );
    expect(res.status).toBe(409);
  });

  it('PATCH /api/v1/admin/staedte/:id aendert status', async () => {
    const admin = await nutzerAnlegen({
      email: 'stadmin4@test.werkzirkel.de',
      rollen: ['admin'],
    });
    const sid = await sessionAnlegen(admin);

    // Eigene Test-Stadt anlegen (Seed-Staedte hh/b/m nicht anfassen — andere
    // Test-Files lesen deren Beschreibung).
    await db.insert(stadt).values({
      id: 'tst-bremen',
      name: 'Test-Bremen',
      status: 'vorbereitung',
      sortierung: 99,
    });

    const res = await stadtPATCH(
      buildRequest({
        method: 'PATCH',
        path: '/api/v1/admin/staedte/tst-bremen',
        sessionId: sid,
        body: { status: 'aktiv' },
      }),
      { params: Promise.resolve({ id: 'tst-bremen' }) },
    );
    expect(res.status).toBe(200);
    const row = (
      await db.select().from(stadt).where(eq(stadt.id, 'tst-bremen')).limit(1)
    )[0]!;
    expect(row.status).toBe('aktiv');
  });

  it('POST /api/v1/admin/staedte/:id/kurator setzt stadt.kuratorId UND nutzer.rollen += kurator atomar', async () => {
    const admin = await nutzerAnlegen({
      email: 'stadmin5@test.werkzirkel.de',
      rollen: ['admin'],
    });
    const sid = await sessionAnlegen(admin);
    const kandidat = await nutzerAnlegen({
      email: 'kandidat@test.werkzirkel.de',
      rollen: ['macher'],
    });

    // Eigene Test-Stadt (Seed-Staedte nicht anfassen).
    await db.insert(stadt).values({
      id: 'tst-aachen',
      name: 'Test-Aachen',
      status: 'vorbereitung',
      sortierung: 99,
    });

    const res = await kuratorPOST(
      buildRequest({
        method: 'POST',
        path: '/api/v1/admin/staedte/tst-aachen/kurator',
        sessionId: sid,
        body: { nutzer_id: kandidat },
      }),
      { params: Promise.resolve({ id: 'tst-aachen' }) },
    );
    expect(res.status).toBe(200);

    const stadtRow = (
      await db.select().from(stadt).where(eq(stadt.id, 'tst-aachen')).limit(1)
    )[0]!;
    expect(stadtRow.kuratorId).toBe(kandidat);

    const kandidatRow = (
      await db.select().from(nutzer).where(eq(nutzer.id, kandidat)).limit(1)
    )[0]!;
    expect(kandidatRow.rollen).toContain('kurator');
    expect(kandidatRow.rollen).toContain('macher'); // bestehende Rolle bleibt

    const audits = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.aktion, 'kurator.ernannt'));
    expect(audits.length).toBe(1);
  });

  it('Kurator-Ernennen mit nicht-existentem User → 404', async () => {
    const admin = await nutzerAnlegen({
      email: 'stadmin6@test.werkzirkel.de',
      rollen: ['admin'],
    });
    const sid = await sessionAnlegen(admin);
    const res = await kuratorPOST(
      buildRequest({
        method: 'POST',
        path: '/api/v1/admin/staedte/hh/kurator',
        sessionId: sid,
        body: { nutzer_id: 'gibts-nicht-123' },
      }),
      { params: Promise.resolve({ id: 'hh' }) },
    );
    expect(res.status).toBe(404);
  });

  it('Kurator-Ernennen idempotent — bereits-kurator bleibt rollen=1x kurator', async () => {
    const admin = await nutzerAnlegen({
      email: 'stadmin7@test.werkzirkel.de',
      rollen: ['admin'],
    });
    const sid = await sessionAnlegen(admin);
    const kandidat = await nutzerAnlegen({
      email: 'doppel@test.werkzirkel.de',
      rollen: ['macher', 'kurator'],
    });
    await db.insert(stadt).values({
      id: 'tst-aachen',
      name: 'Test-Aachen',
      status: 'vorbereitung',
      sortierung: 99,
    });

    const res = await kuratorPOST(
      buildRequest({
        method: 'POST',
        path: '/api/v1/admin/staedte/tst-aachen/kurator',
        sessionId: sid,
        body: { nutzer_id: kandidat },
      }),
      { params: Promise.resolve({ id: 'tst-aachen' }) },
    );
    expect(res.status).toBe(200);

    const kandidatRow = (
      await db.select().from(nutzer).where(eq(nutzer.id, kandidat)).limit(1)
    )[0]!;
    const kuratorCount = kandidatRow.rollen.filter((r) => r === 'kurator').length;
    expect(kuratorCount).toBe(1);
  });
});

// ───────────────────────────────────────────────────────────
// Audit-Log
// ───────────────────────────────────────────────────────────

describe('GET /api/v1/admin/audit-log', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  it('Nicht-Admin → 403', async () => {
    const u = await nutzerAnlegen({ email: 'al-no@test.werkzirkel.de' });
    const sid = await sessionAnlegen(u);
    const res = await auditLogGET(
      buildRequest({
        method: 'GET',
        path: '/api/v1/admin/audit-log',
        sessionId: sid,
      }),
    );
    expect(res.status).toBe(403);
  });

  it('Filter aktion / nutzer_id / Datum funktioniert', async () => {
    const admin = await nutzerAnlegen({
      email: 'al-admin@test.werkzirkel.de',
      rollen: ['admin'],
    });
    const sid = await sessionAnlegen(admin);
    const u1 = await nutzerAnlegen({ email: 'al-u1@test.werkzirkel.de' });
    const u2 = await nutzerAnlegen({ email: 'al-u2@test.werkzirkel.de' });

    // Drei Audit-Eintraege:
    //  - heute, aktion=test.alpha, nutzer=u1
    //  - heute, aktion=test.beta,  nutzer=u2
    //  - gestern, aktion=test.alpha, nutzer=u2
    const heute = new Date();
    const gestern = new Date(heute);
    gestern.setUTCDate(gestern.getUTCDate() - 1);

    await db.insert(auditLog).values([
      {
        nutzerId: u1,
        aktion: 'test.alpha',
        referenzTyp: 'x',
        referenzId: 'a1',
        metadaten: {},
        erstelltAm: heute,
      },
      {
        nutzerId: u2,
        aktion: 'test.beta',
        referenzTyp: 'x',
        referenzId: 'b1',
        metadaten: {},
        erstelltAm: heute,
      },
      {
        nutzerId: u2,
        aktion: 'test.alpha',
        referenzTyp: 'x',
        referenzId: 'a2',
        metadaten: {},
        erstelltAm: gestern,
      },
    ]);

    // aktion-Filter
    const resA = await auditLogGET(
      buildRequest({
        method: 'GET',
        path: '/api/v1/admin/audit-log?aktion=test.alpha',
        sessionId: sid,
      }),
    );
    expect(resA.status).toBe(200);
    const dA = (await resA.json()) as { eintraege: Array<{ aktion: string }> };
    expect(dA.eintraege.length).toBe(2);
    for (const e of dA.eintraege) expect(e.aktion).toBe('test.alpha');

    // nutzer-Filter
    const resN = await auditLogGET(
      buildRequest({
        method: 'GET',
        path: `/api/v1/admin/audit-log?nutzer_id=${u2}`,
        sessionId: sid,
      }),
    );
    const dN = (await resN.json()) as { eintraege: Array<{ nutzerId: string }> };
    expect(dN.eintraege.length).toBe(2);
    for (const e of dN.eintraege) expect(e.nutzerId).toBe(u2);

    // Datum-Filter: nur heute
    const isoHeute = heute.toISOString().slice(0, 10);
    const resD = await auditLogGET(
      buildRequest({
        method: 'GET',
        path: `/api/v1/admin/audit-log?von=${isoHeute}&bis=${isoHeute}`,
        sessionId: sid,
      }),
    );
    const dD = (await resD.json()) as { eintraege: unknown[] };
    expect(dD.eintraege.length).toBe(2);
  });
});

// ───────────────────────────────────────────────────────────
// Email-Log
// ───────────────────────────────────────────────────────────

describe('GET /api/v1/admin/email-log', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  it('Nicht-Admin → 403', async () => {
    const u = await nutzerAnlegen({ email: 'el-no@test.werkzirkel.de' });
    const sid = await sessionAnlegen(u);
    const res = await emailLogGET(
      buildRequest({
        method: 'GET',
        path: '/api/v1/admin/email-log',
        sessionId: sid,
      }),
    );
    expect(res.status).toBe(403);
  });

  it('Admin → 200, Filter template + status funktionieren', async () => {
    const admin = await nutzerAnlegen({
      email: 'el-admin@test.werkzirkel.de',
      rollen: ['admin'],
    });
    const sid = await sessionAnlegen(admin);
    const u1 = await nutzerAnlegen({ email: 'el-u1@test.werkzirkel.de' });

    await db.insert(emailBenachrichtigungLog).values([
      {
        nutzerId: u1,
        email: 'el-u1@test.werkzirkel.de',
        template: 'T-101 pruefrunde-neue-anmeldung',
        betreff: 'Neue Anmeldung',
        status: 'gesendet',
      },
      {
        nutzerId: u1,
        email: 'el-u1@test.werkzirkel.de',
        template: 'T-101 pruefrunde-neue-anmeldung',
        betreff: 'Neue Anmeldung (Bounce)',
        status: 'bounced',
        fehlerMeldung: 'mailbox unavailable',
      },
      {
        nutzerId: u1,
        email: 'el-u1@test.werkzirkel.de',
        template: 'T-200 werkangebot',
        betreff: 'Match-Angebot',
        status: 'gesendet',
      },
    ]);

    const resT = await emailLogGET(
      buildRequest({
        method: 'GET',
        path: '/api/v1/admin/email-log?template=T-101 pruefrunde-neue-anmeldung',
        sessionId: sid,
      }),
    );
    const dT = (await resT.json()) as { eintraege: Array<{ template: string }> };
    expect(dT.eintraege.length).toBe(2);

    const resS = await emailLogGET(
      buildRequest({
        method: 'GET',
        path: '/api/v1/admin/email-log?status=bounced',
        sessionId: sid,
      }),
    );
    const dS = (await resS.json()) as { eintraege: Array<{ status: string }> };
    expect(dS.eintraege.length).toBe(1);
    expect(dS.eintraege[0]!.status).toBe('bounced');
  });
});
