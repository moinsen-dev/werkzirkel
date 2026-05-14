/**
 * Integration-Tests fuer Termin-CRUD-API.
 *
 * Deckt PRD §F-401..§F-405, §15.8, §8.8, §14.6:
 *  - POST anlegen + Permission-Check (Kurator:in der Stadt / fremd / admin)
 *  - GET Detail (geplant nur fuer Kurator:in, sonst public)
 *  - PATCH nur in 'geplant' oder 'veroeffentlicht'
 *  - DELETE nur in 'geplant'
 *  - Statusmaschine geplant → veroeffentlicht → abgesagt | durchgefuehrt
 *  - absagen sendet T-404 an alle Angemeldeten (Mock-Log)
 *  - durchgefuehrt nur wenn datum < now
 *  - Validierung (Termin in Vergangenheit, weder Ort noch Link)
 */

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createId } from '@paralleldrive/cuid2';
import { eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import {
  emailBenachrichtigungLog,
  nutzer,
  session as sessionTable,
  stadt,
  termin,
  terminAnmeldung,
} from '@/lib/db/schema';
import { env } from '@/lib/env';
import { buildSessionCookie } from '@/lib/auth/session';

import { POST as terminePost, GET as termineGet } from '@/app/api/v1/termine/route';
import {
  GET as terminGet,
  PATCH as terminPatch,
  DELETE as terminDelete,
} from '@/app/api/v1/termine/[id]/route';
import { POST as veroeffentlichenPost } from '@/app/api/v1/termine/[id]/veroeffentlichen/route';
import { POST as absagenPost } from '@/app/api/v1/termine/[id]/absagen/route';
import { POST as durchgefuehrtPost } from '@/app/api/v1/termine/[id]/durchgefuehrt/route';

import { truncateAll } from '../_helpers/db-cleanup';

const APP_ORIGIN = new URL(env.APP_URL).origin;

/**
 * Test-User mit beliebigen Rollen anlegen.
 */
async function userAnlegen(opts: {
  email: string;
  stadtId?: string;
  rollen?: Array<'macher' | 'bedarfstraeger' | 'foerderer' | 'kurator' | 'admin'>;
}): Promise<string> {
  const id = createId();
  await db.insert(nutzer).values({
    id,
    email: opts.email,
    klarname: `Klar ${opts.email}`,
    anzeigename: `anz-${id.slice(0, 6)}`,
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
}): Request {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    origin: APP_ORIGIN,
    'x-forwarded-for': '127.0.0.1',
  };
  if (opts.sessionId) {
    headers.cookie = buildSessionCookie(opts.sessionId).split(';')[0]!;
  }
  return new Request(`${APP_ORIGIN}${opts.path}`, {
    method: opts.method,
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
}

const inEinerWoche = () =>
  new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

const validBody = (overrides: Record<string, unknown> = {}) => ({
  stadt_id: 'hh',
  typ: 'schauabend',
  titel: 'Schauabend Mai',
  beschreibung: 'Drei Werke stellen sich vor.',
  ort_text: 'Werkstatt St. Pauli, Hamburg',
  datum_uhrzeit: inEinerWoche(),
  max_teilnehmer: 20,
  ...overrides,
});

describe('POST /api/v1/termine (anlegen)', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  it('Kurator:in der Stadt legt Termin als geplant an → 201', async () => {
    const kuratorId = await userAnlegen({
      email: 'crud-kur@test.werkzirkel.de',
      rollen: ['kurator'],
    });
    const sid = await sessionAnlegen(kuratorId);

    const res = await terminePost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/termine',
        sessionId: sid,
        body: validBody(),
      }),
    );
    expect(res.status).toBe(201);
    const data = (await res.json()) as {
      termin: { id: string; status: string; typ: string; stadt_id: string };
    };
    expect(data.termin.status).toBe('geplant');
    expect(data.termin.typ).toBe('schauabend');
    expect(data.termin.stadt_id).toBe('hh');

    const rows = await db
      .select()
      .from(termin)
      .where(eq(termin.id, data.termin.id));
    expect(rows.length).toBe(1);
    expect(rows[0]?.erstelltVon).toBe(kuratorId);
  });

  it('ohne Session → 401', async () => {
    const res = await terminePost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/termine',
        body: validBody(),
      }),
    );
    expect(res.status).toBe(401);
  });

  it('Macher:in ohne Kurator-Rolle → 403 kein_zugriff', async () => {
    const userId = await userAnlegen({
      email: 'crud-noKur@test.werkzirkel.de',
      rollen: ['macher'],
    });
    const sid = await sessionAnlegen(userId);

    const res = await terminePost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/termine',
        sessionId: sid,
        body: validBody(),
      }),
    );
    expect(res.status).toBe(403);
    const data = (await res.json()) as { error: { code: string } };
    expect(data.error.code).toBe('kein_zugriff');
  });

  it('Kurator:in fremder Stadt → 403', async () => {
    const kuratorBId = await userAnlegen({
      email: 'crud-kurB@test.werkzirkel.de',
      stadtId: 'b',
      rollen: ['kurator'],
    });
    const sid = await sessionAnlegen(kuratorBId);

    const res = await terminePost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/termine',
        sessionId: sid,
        body: validBody({ stadt_id: 'hh' }),
      }),
    );
    expect(res.status).toBe(403);
  });

  it('Admin legt Termin in beliebiger Stadt an → 201', async () => {
    const adminId = await userAnlegen({
      email: 'crud-admin@test.werkzirkel.de',
      rollen: ['admin'],
      stadtId: 'b',
    });
    const sid = await sessionAnlegen(adminId);

    const res = await terminePost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/termine',
        sessionId: sid,
        body: validBody({ stadt_id: 'hh' }),
      }),
    );
    expect(res.status).toBe(201);
  });

  it('Stadt-kurator_id-Verknuepfung (statt Rolle) wird akzeptiert → 201', async () => {
    // Person ohne 'kurator'-Rolle, aber stadt.kurator_id zeigt auf sie.
    const userId = await userAnlegen({
      email: 'crud-stadtkur@test.werkzirkel.de',
      rollen: ['macher'],
    });
    await db.update(stadt).set({ kuratorId: userId }).where(eq(stadt.id, 'hh'));
    const sid = await sessionAnlegen(userId);

    const res = await terminePost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/termine',
        sessionId: sid,
        body: validBody(),
      }),
    );
    expect(res.status).toBe(201);
  });

  it('Termin in der Vergangenheit → 422', async () => {
    const kuratorId = await userAnlegen({
      email: 'crud-past@test.werkzirkel.de',
      rollen: ['kurator'],
    });
    const sid = await sessionAnlegen(kuratorId);

    const res = await terminePost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/termine',
        sessionId: sid,
        body: validBody({
          datum_uhrzeit: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        }),
      }),
    );
    expect(res.status).toBe(422);
    const data = (await res.json()) as {
      fehler: string;
      details: Record<string, string[]>;
    };
    expect(data.fehler).toBe('validierung');
    expect(data.details.datum_uhrzeit?.some((m) => /Zukunft/i.test(m))).toBe(
      true,
    );
  });

  it('weder ort_text noch online_link → 422', async () => {
    const kuratorId = await userAnlegen({
      email: 'crud-noort@test.werkzirkel.de',
      rollen: ['kurator'],
    });
    const sid = await sessionAnlegen(kuratorId);

    const body = validBody();
    delete (body as Record<string, unknown>).ort_text;

    const res = await terminePost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/termine',
        sessionId: sid,
        body,
      }),
    );
    expect(res.status).toBe(422);
    const data = (await res.json()) as { fehler: string };
    expect(data.fehler).toBe('validierung');
  });

  it('online_link allein reicht → 201', async () => {
    const kuratorId = await userAnlegen({
      email: 'crud-online@test.werkzirkel.de',
      rollen: ['kurator'],
    });
    const sid = await sessionAnlegen(kuratorId);

    const body = validBody({ online_link: 'https://meet.example.com/abc' });
    delete (body as Record<string, unknown>).ort_text;

    const res = await terminePost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/termine',
        sessionId: sid,
        body,
      }),
    );
    expect(res.status).toBe(201);
  });

  it('max_teilnehmer < 2 → 422', async () => {
    const kuratorId = await userAnlegen({
      email: 'crud-mt@test.werkzirkel.de',
      rollen: ['kurator'],
    });
    const sid = await sessionAnlegen(kuratorId);

    const res = await terminePost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/termine',
        sessionId: sid,
        body: validBody({ max_teilnehmer: 1 }),
      }),
    );
    expect(res.status).toBe(422);
  });

  it('ungueltiger Termin-Typ → 422', async () => {
    const kuratorId = await userAnlegen({
      email: 'crud-typ@test.werkzirkel.de',
      rollen: ['kurator'],
    });
    const sid = await sessionAnlegen(kuratorId);

    const res = await terminePost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/termine',
        sessionId: sid,
        body: validBody({ typ: 'haxor' }),
      }),
    );
    expect(res.status).toBe(422);
  });
});

describe('GET /api/v1/termine/:id (Detail)', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  it('geplant anonym → 404', async () => {
    const kuratorId = await userAnlegen({
      email: 'det-1@test.werkzirkel.de',
      rollen: ['kurator'],
    });
    const sid = await sessionAnlegen(kuratorId);

    const post = await terminePost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/termine',
        sessionId: sid,
        body: validBody(),
      }),
    );
    const tid = ((await post.json()) as { termin: { id: string } }).termin.id;

    const anon = await terminGet(
      buildRequest({ method: 'GET', path: `/api/v1/termine/${tid}` }),
      { params: Promise.resolve({ id: tid }) },
    );
    expect(anon.status).toBe(404);
  });

  it('geplant als Kurator:in der Stadt → 200', async () => {
    const kuratorId = await userAnlegen({
      email: 'det-2@test.werkzirkel.de',
      rollen: ['kurator'],
    });
    const sid = await sessionAnlegen(kuratorId);

    const post = await terminePost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/termine',
        sessionId: sid,
        body: validBody(),
      }),
    );
    const tid = ((await post.json()) as { termin: { id: string } }).termin.id;

    const res = await terminGet(
      buildRequest({
        method: 'GET',
        path: `/api/v1/termine/${tid}`,
        sessionId: sid,
      }),
      { params: Promise.resolve({ id: tid }) },
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      termin: { id: string; status: string };
      counts: { angemeldet: number; warteliste: number };
    };
    expect(data.termin.status).toBe('geplant');
    expect(data.counts.angemeldet).toBe(0);
    expect(data.counts.warteliste).toBe(0);
  });

  it('veroeffentlicht anonym → 200', async () => {
    const kuratorId = await userAnlegen({
      email: 'det-3@test.werkzirkel.de',
      rollen: ['kurator'],
    });
    const sid = await sessionAnlegen(kuratorId);

    const post = await terminePost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/termine',
        sessionId: sid,
        body: validBody(),
      }),
    );
    const tid = ((await post.json()) as { termin: { id: string } }).termin.id;
    await db
      .update(termin)
      .set({ status: 'veroeffentlicht' })
      .where(eq(termin.id, tid));

    const res = await terminGet(
      buildRequest({ method: 'GET', path: `/api/v1/termine/${tid}` }),
      { params: Promise.resolve({ id: tid }) },
    );
    expect(res.status).toBe(200);
  });

  it('nicht existent → 404', async () => {
    const res = await terminGet(
      buildRequest({ method: 'GET', path: '/api/v1/termine/does-not-exist' }),
      { params: Promise.resolve({ id: 'does-not-exist' }) },
    );
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/v1/termine/:id', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  async function setup(): Promise<{
    kuratorId: string;
    sid: string;
    terminId: string;
  }> {
    const kuratorId = await userAnlegen({
      email: 'patch-1@test.werkzirkel.de',
      rollen: ['kurator'],
    });
    const sid = await sessionAnlegen(kuratorId);
    const post = await terminePost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/termine',
        sessionId: sid,
        body: validBody(),
      }),
    );
    const tid = ((await post.json()) as { termin: { id: string } }).termin.id;
    return { kuratorId, sid, terminId: tid };
  }

  it('Kurator:in aendert Titel in geplant → 200', async () => {
    const { sid, terminId } = await setup();
    const res = await terminPatch(
      buildRequest({
        method: 'PATCH',
        path: `/api/v1/termine/${terminId}`,
        sessionId: sid,
        body: { titel: 'Neuer Titel' },
      }),
      { params: Promise.resolve({ id: terminId }) },
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { termin: { titel: string } };
    expect(data.termin.titel).toBe('Neuer Titel');
  });

  it('PATCH in veroeffentlicht ist erlaubt → 200', async () => {
    const { sid, terminId } = await setup();
    await db
      .update(termin)
      .set({ status: 'veroeffentlicht' })
      .where(eq(termin.id, terminId));

    const res = await terminPatch(
      buildRequest({
        method: 'PATCH',
        path: `/api/v1/termine/${terminId}`,
        sessionId: sid,
        body: { beschreibung: 'Update nach Veroeffentlichung.' },
      }),
      { params: Promise.resolve({ id: terminId }) },
    );
    expect(res.status).toBe(200);
  });

  it('PATCH in abgesagt → 422 nicht_editierbar', async () => {
    const { sid, terminId } = await setup();
    await db
      .update(termin)
      .set({ status: 'abgesagt' })
      .where(eq(termin.id, terminId));

    const res = await terminPatch(
      buildRequest({
        method: 'PATCH',
        path: `/api/v1/termine/${terminId}`,
        sessionId: sid,
        body: { titel: 'Verboten' },
      }),
      { params: Promise.resolve({ id: terminId }) },
    );
    expect(res.status).toBe(422);
    const data = (await res.json()) as { error: { code: string } };
    expect(data.error.code).toBe('nicht_editierbar');
  });

  it('PATCH von fremder Kurator:in (andere Stadt) → 403', async () => {
    const { terminId } = await setup();
    const fremdId = await userAnlegen({
      email: 'patch-fremd@test.werkzirkel.de',
      stadtId: 'b',
      rollen: ['kurator'],
    });
    const fremdSid = await sessionAnlegen(fremdId);

    const res = await terminPatch(
      buildRequest({
        method: 'PATCH',
        path: `/api/v1/termine/${terminId}`,
        sessionId: fremdSid,
        body: { titel: 'feindlich' },
      }),
      { params: Promise.resolve({ id: terminId }) },
    );
    expect(res.status).toBe(403);
  });

  it('PATCH macht ort_text=null wenn online_link gesetzt ist → 200', async () => {
    const { sid, terminId } = await setup();
    await db
      .update(termin)
      .set({ onlineLink: 'https://meet.example.com/x' })
      .where(eq(termin.id, terminId));

    const res = await terminPatch(
      buildRequest({
        method: 'PATCH',
        path: `/api/v1/termine/${terminId}`,
        sessionId: sid,
        body: { ort_text: null },
      }),
      { params: Promise.resolve({ id: terminId }) },
    );
    expect(res.status).toBe(200);
  });

  it('PATCH macht ort_text=null OHNE online_link → 422 (weder Ort noch Link)', async () => {
    const { sid, terminId } = await setup();
    const res = await terminPatch(
      buildRequest({
        method: 'PATCH',
        path: `/api/v1/termine/${terminId}`,
        sessionId: sid,
        body: { ort_text: null },
      }),
      { params: Promise.resolve({ id: terminId }) },
    );
    expect(res.status).toBe(422);
  });
});

describe('DELETE /api/v1/termine/:id', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  it('Kurator:in loescht geplanten Termin → 204', async () => {
    const kuratorId = await userAnlegen({
      email: 'del-1@test.werkzirkel.de',
      rollen: ['kurator'],
    });
    const sid = await sessionAnlegen(kuratorId);
    const post = await terminePost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/termine',
        sessionId: sid,
        body: validBody(),
      }),
    );
    const tid = ((await post.json()) as { termin: { id: string } }).termin.id;

    const res = await terminDelete(
      buildRequest({
        method: 'DELETE',
        path: `/api/v1/termine/${tid}`,
        sessionId: sid,
      }),
      { params: Promise.resolve({ id: tid }) },
    );
    expect(res.status).toBe(204);
    const rows = await db.select().from(termin).where(eq(termin.id, tid));
    expect(rows.length).toBe(0);
  });

  it('DELETE eines veroeffentlichten Termins → 422 nicht_loeschbar', async () => {
    const kuratorId = await userAnlegen({
      email: 'del-2@test.werkzirkel.de',
      rollen: ['kurator'],
    });
    const sid = await sessionAnlegen(kuratorId);
    const post = await terminePost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/termine',
        sessionId: sid,
        body: validBody(),
      }),
    );
    const tid = ((await post.json()) as { termin: { id: string } }).termin.id;
    await db
      .update(termin)
      .set({ status: 'veroeffentlicht' })
      .where(eq(termin.id, tid));

    const res = await terminDelete(
      buildRequest({
        method: 'DELETE',
        path: `/api/v1/termine/${tid}`,
        sessionId: sid,
      }),
      { params: Promise.resolve({ id: tid }) },
    );
    expect(res.status).toBe(422);
    const data = (await res.json()) as { error: { code: string } };
    expect(data.error.code).toBe('nicht_loeschbar');
  });
});

describe('Status-Transitions', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  async function setupGeplant(): Promise<{ sid: string; terminId: string; kuratorId: string }> {
    const kuratorId = await userAnlegen({
      email: 'st-1@test.werkzirkel.de',
      rollen: ['kurator'],
    });
    const sid = await sessionAnlegen(kuratorId);
    const post = await terminePost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/termine',
        sessionId: sid,
        body: validBody(),
      }),
    );
    const tid = ((await post.json()) as { termin: { id: string } }).termin.id;
    return { sid, terminId: tid, kuratorId };
  }

  it('geplant → veroeffentlicht', async () => {
    const { sid, terminId } = await setupGeplant();
    const res = await veroeffentlichenPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/termine/${terminId}/veroeffentlichen`,
        sessionId: sid,
      }),
      { params: Promise.resolve({ id: terminId }) },
    );
    expect(res.status).toBe(200);
    const rows = await db.select().from(termin).where(eq(termin.id, terminId));
    expect(rows[0]?.status).toBe('veroeffentlicht');
  });

  it('veroeffentlichen aus veroeffentlicht → 422', async () => {
    const { sid, terminId } = await setupGeplant();
    await db
      .update(termin)
      .set({ status: 'veroeffentlicht' })
      .where(eq(termin.id, terminId));
    const res = await veroeffentlichenPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/termine/${terminId}/veroeffentlichen`,
        sessionId: sid,
      }),
      { params: Promise.resolve({ id: terminId }) },
    );
    expect(res.status).toBe(422);
  });

  it('veroeffentlichen von fremder Kurator:in → 403', async () => {
    const { terminId } = await setupGeplant();
    const fremdId = await userAnlegen({
      email: 'st-fremd@test.werkzirkel.de',
      stadtId: 'b',
      rollen: ['kurator'],
    });
    const fremdSid = await sessionAnlegen(fremdId);
    const res = await veroeffentlichenPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/termine/${terminId}/veroeffentlichen`,
        sessionId: fremdSid,
      }),
      { params: Promise.resolve({ id: terminId }) },
    );
    expect(res.status).toBe(403);
  });

  it('veroeffentlicht → abgesagt mit T-404 an Angemeldete', async () => {
    const { sid, terminId } = await setupGeplant();
    await db
      .update(termin)
      .set({ status: 'veroeffentlicht' })
      .where(eq(termin.id, terminId));

    // Zwei Angemeldete + 1 Wartelisten-Person seeden.
    const a = await userAnlegen({ email: 'st-a@test.werkzirkel.de' });
    const b = await userAnlegen({ email: 'st-b@test.werkzirkel.de' });
    const c = await userAnlegen({ email: 'st-c@test.werkzirkel.de' });
    await db.insert(terminAnmeldung).values([
      { terminId, nutzerId: a, status: 'angemeldet' },
      { terminId, nutzerId: b, status: 'angemeldet' },
      { terminId, nutzerId: c, status: 'warteliste' },
    ]);

    const res = await absagenPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/termine/${terminId}/absagen`,
        sessionId: sid,
        body: { absage_grund: 'Krankheit der Kurator:in' },
      }),
      { params: Promise.resolve({ id: terminId }) },
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      termin: { status: string };
      benachrichtigt: number;
    };
    expect(data.termin.status).toBe('abgesagt');
    expect(data.benachrichtigt).toBe(3);

    // T-404-Mail-Log pruefen.
    const logRows = await db
      .select()
      .from(emailBenachrichtigungLog);
    const t404 = logRows.filter((r) => r.template === 'T-404');
    expect(t404.length).toBe(3);
  });

  it('absagen ohne Anmeldungen → 200, kein Crash', async () => {
    const { sid, terminId } = await setupGeplant();
    await db
      .update(termin)
      .set({ status: 'veroeffentlicht' })
      .where(eq(termin.id, terminId));

    const res = await absagenPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/termine/${terminId}/absagen`,
        sessionId: sid,
        body: {},
      }),
      { params: Promise.resolve({ id: terminId }) },
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { benachrichtigt: number };
    expect(data.benachrichtigt).toBe(0);
  });

  it('absagen aus geplant → 422 falscher_status', async () => {
    const { sid, terminId } = await setupGeplant();
    const res = await absagenPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/termine/${terminId}/absagen`,
        sessionId: sid,
        body: {},
      }),
      { params: Promise.resolve({ id: terminId }) },
    );
    expect(res.status).toBe(422);
  });

  it('durchgefuehrt nur wenn datum < now → 422 wenn Zukunft', async () => {
    const { sid, terminId } = await setupGeplant();
    await db
      .update(termin)
      .set({ status: 'veroeffentlicht' })
      .where(eq(termin.id, terminId));

    const res = await durchgefuehrtPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/termine/${terminId}/durchgefuehrt`,
        sessionId: sid,
      }),
      { params: Promise.resolve({ id: terminId }) },
    );
    expect(res.status).toBe(422);
    const data = (await res.json()) as { error: { code: string } };
    expect(data.error.code).toBe('termin_in_zukunft');
  });

  it('durchgefuehrt nach Termin-Zeitpunkt → 200', async () => {
    const { sid, terminId } = await setupGeplant();
    // Manuelle Datum-Manipulation: datum_uhrzeit in die Vergangenheit ziehen.
    // Status auf veroeffentlicht setzen.
    await db
      .update(termin)
      .set({
        status: 'veroeffentlicht',
        datumUhrzeit: new Date(Date.now() - 24 * 60 * 60 * 1000),
      })
      .where(eq(termin.id, terminId));

    const res = await durchgefuehrtPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/termine/${terminId}/durchgefuehrt`,
        sessionId: sid,
      }),
      { params: Promise.resolve({ id: terminId }) },
    );
    expect(res.status).toBe(200);
    const rows = await db.select().from(termin).where(eq(termin.id, terminId));
    expect(rows[0]?.status).toBe('durchgefuehrt');
  });

  it('durchgefuehrt aus geplant → 422 falscher_status', async () => {
    const { sid, terminId } = await setupGeplant();
    // datum in Vergangenheit ziehen, Status bleibt 'geplant'.
    await db
      .update(termin)
      .set({
        datumUhrzeit: new Date(Date.now() - 24 * 60 * 60 * 1000),
      })
      .where(eq(termin.id, terminId));

    const res = await durchgefuehrtPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/termine/${terminId}/durchgefuehrt`,
        sessionId: sid,
      }),
      { params: Promise.resolve({ id: terminId }) },
    );
    expect(res.status).toBe(422);
    const data = (await res.json()) as { error: { code: string } };
    expect(data.error.code).toBe('falscher_status');
  });
});

// Ankerimport — sicherstellen dass termineGet referenziert wird (Lint-Hilfe).
void termineGet;
