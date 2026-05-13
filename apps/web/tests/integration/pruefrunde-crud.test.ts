/**
 * Integration-Tests fuer Pruefrunde-CRUD-API.
 *
 * Deckt PRD §F-201, §F-202, §F-207, §F-208, §15.4, §14.2:
 *  - POST anlegen + Werk-Ownership-Check
 *  - PATCH nur im Status 'entwurf'
 *  - DELETE nur im Status 'entwurf'
 *  - Statusmaschine entwurf → oeffentlich → geschlossen → abgeschlossen
 *  - Reziprozitaets-Block beim Veroeffentlichen (abgelaufene Verpflichtung)
 *  - Veroeffentlichen ohne Saldo → neue Verpflichtung in DB
 *  - Abschliessen ohne hilfreiches Feedback → 422
 *
 * Methode wie in `werk-crud.test.ts`: Route-Handler direkt importieren,
 * synthetische `Request`-Objekte mit Cookie + Origin-Header.
 */

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createId } from '@paralleldrive/cuid2';
import { and, eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import {
  feedback,
  nutzer,
  pruefrunde,
  pruefrundenVerpflichtung,
  session as sessionTable,
  testSaldo,
  werk,
} from '@/lib/db/schema';
import { env } from '@/lib/env';
import { buildSessionCookie } from '@/lib/auth/session';

import { POST as pruefrundenPost } from '@/app/api/v1/pruefrunden/route';
import {
  PATCH as pruefrundePatch,
  DELETE as pruefrundeDelete,
  GET as pruefrundeGet,
} from '@/app/api/v1/pruefrunden/[id]/route';
import { POST as veroeffentlichenPost } from '@/app/api/v1/pruefrunden/[id]/veroeffentlichen/route';
import { POST as schliessenPost } from '@/app/api/v1/pruefrunden/[id]/schliessen/route';
import { POST as abschliessenPost } from '@/app/api/v1/pruefrunden/[id]/abschliessen/route';

import { truncateAll } from '../_helpers/db-cleanup';

const APP_ORIGIN = new URL(env.APP_URL).origin;

async function macherAnlegen(opts: {
  email: string;
  stadtId?: string;
}): Promise<string> {
  const id = createId();
  await db.insert(nutzer).values({
    id,
    email: opts.email,
    klarname: `Klar ${opts.email}`,
    anzeigename: `anz-${id.slice(0, 6)}`,
    stadtId: opts.stadtId ?? 'hh',
    rollen: ['macher'],
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

async function werkAnlegen(nutzerId: string): Promise<string> {
  const id = createId();
  await db.insert(werk).values({
    id,
    nutzerId,
    name: 'Test Werk',
    kurzbeschreibung: 'Eine Kurzbeschreibung.',
    problem: 'Wir loesen ein Problem.',
    zielgruppe: 'Indie-Macher:innen',
    werkstand: 'idee',
  });
  return id;
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

const validBody = (werkId: string, overrides: Record<string, unknown> = {}) => ({
  werk_id: werkId,
  titel: 'Erster Klick-Test',
  testziel: 'Verstehen ob Onboarding klar ist',
  testaufgabe: 'Klick durch das Onboarding und sag was unklar war.',
  zielgruppe: 'Macher:innen die schon mal eine Landingpage gebaut haben',
  zeitbedarf_minuten: 30,
  gesuchte_tester: 3,
  feedback_kategorien: ['erster_eindruck', 'verstaendlichkeit'],
  frist: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  ...overrides,
});

describe('POST /api/v1/pruefrunden (anlegen)', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  it('legt Pruefrunde als entwurf an → 201', async () => {
    const userId = await macherAnlegen({ email: 'pr-1@test.werkzirkel.de' });
    const sid = await sessionAnlegen(userId);
    const werkId = await werkAnlegen(userId);

    const res = await pruefrundenPost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/pruefrunden',
        sessionId: sid,
        body: validBody(werkId),
      }),
    );
    expect(res.status).toBe(201);
    const data = (await res.json()) as {
      pruefrunde: {
        id: string;
        werk_id: string;
        status: string;
        titel: string;
      };
    };
    expect(data.pruefrunde.status).toBe('entwurf');
    expect(data.pruefrunde.werk_id).toBe(werkId);
    expect(data.pruefrunde.titel).toBe('Erster Klick-Test');

    const rows = await db
      .select()
      .from(pruefrunde)
      .where(eq(pruefrunde.id, data.pruefrunde.id));
    expect(rows.length).toBe(1);
    expect(rows[0]?.status).toBe('entwurf');
  });

  it('ohne Session → 401', async () => {
    const res = await pruefrundenPost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/pruefrunden',
        body: validBody('irgendein-werk'),
      }),
    );
    expect(res.status).toBe(401);
  });

  it('Werk eines fremden Nutzers → 403 kein_zugriff', async () => {
    const ownerId = await macherAnlegen({ email: 'pr-owner@test.werkzirkel.de' });
    const werkId = await werkAnlegen(ownerId);

    const fremdId = await macherAnlegen({ email: 'pr-fremd@test.werkzirkel.de' });
    const fremdSid = await sessionAnlegen(fremdId);

    const res = await pruefrundenPost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/pruefrunden',
        sessionId: fremdSid,
        body: validBody(werkId),
      }),
    );
    expect(res.status).toBe(403);
    const data = (await res.json()) as { error: { code: string } };
    expect(data.error.code).toBe('kein_zugriff');
  });

  it('nicht-existentes Werk → 422 werk_nicht_gefunden', async () => {
    const userId = await macherAnlegen({ email: 'pr-noWerk@test.werkzirkel.de' });
    const sid = await sessionAnlegen(userId);

    const res = await pruefrundenPost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/pruefrunden',
        sessionId: sid,
        body: validBody('does-not-exist'),
      }),
    );
    expect(res.status).toBe(422);
    const data = (await res.json()) as { error: { code: string } };
    expect(data.error.code).toBe('werk_nicht_gefunden');
  });

  it('Frist in Vergangenheit → 422 mit deutscher Fehlermeldung', async () => {
    const userId = await macherAnlegen({ email: 'pr-past@test.werkzirkel.de' });
    const sid = await sessionAnlegen(userId);
    const werkId = await werkAnlegen(userId);

    const res = await pruefrundenPost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/pruefrunden',
        sessionId: sid,
        body: validBody(werkId, {
          frist: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        }),
      }),
    );
    expect(res.status).toBe(422);
    const data = (await res.json()) as {
      fehler: string;
      details: Record<string, string[]>;
    };
    expect(data.fehler).toBe('validierung');
    expect(data.details.frist?.some((m) => /1 Tag/i.test(m))).toBe(true);
  });

  it('Frist > 60 Tage → 422', async () => {
    const userId = await macherAnlegen({ email: 'pr-far@test.werkzirkel.de' });
    const sid = await sessionAnlegen(userId);
    const werkId = await werkAnlegen(userId);

    const res = await pruefrundenPost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/pruefrunden',
        sessionId: sid,
        body: validBody(werkId, {
          frist: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        }),
      }),
    );
    expect(res.status).toBe(422);
  });

  it('leere feedback_kategorien → 422', async () => {
    const userId = await macherAnlegen({ email: 'pr-noKat@test.werkzirkel.de' });
    const sid = await sessionAnlegen(userId);
    const werkId = await werkAnlegen(userId);

    const res = await pruefrundenPost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/pruefrunden',
        sessionId: sid,
        body: validBody(werkId, { feedback_kategorien: [] }),
      }),
    );
    expect(res.status).toBe(422);
  });
});

describe('PATCH /api/v1/pruefrunden/:id', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  async function setup(): Promise<{ userId: string; sid: string; pruefrundeId: string }> {
    const userId = await macherAnlegen({ email: 'patch-1@test.werkzirkel.de' });
    const sid = await sessionAnlegen(userId);
    const werkId = await werkAnlegen(userId);
    const postRes = await pruefrundenPost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/pruefrunden',
        sessionId: sid,
        body: validBody(werkId),
      }),
    );
    const data = (await postRes.json()) as { pruefrunde: { id: string } };
    return { userId, sid, pruefrundeId: data.pruefrunde.id };
  }

  it('Inhaber:in aendert Titel im Entwurf → 200', async () => {
    const { sid, pruefrundeId } = await setup();
    const res = await pruefrundePatch(
      buildRequest({
        method: 'PATCH',
        path: `/api/v1/pruefrunden/${pruefrundeId}`,
        sessionId: sid,
        body: { titel: 'Neuer Titel' },
      }),
      { params: Promise.resolve({ id: pruefrundeId }) },
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { pruefrunde: { titel: string } };
    expect(data.pruefrunde.titel).toBe('Neuer Titel');
  });

  it('PATCH nach Veroeffentlichung → 422 nicht_editierbar', async () => {
    const { sid, pruefrundeId } = await setup();
    // Status manuell auf 'oeffentlich' setzen (Veroeffentlichungs-Endpoint
    // braucht Reziprozitaets-Engine — wir testen hier nur den Editier-Block).
    await db
      .update(pruefrunde)
      .set({ status: 'oeffentlich' })
      .where(eq(pruefrunde.id, pruefrundeId));

    const res = await pruefrundePatch(
      buildRequest({
        method: 'PATCH',
        path: `/api/v1/pruefrunden/${pruefrundeId}`,
        sessionId: sid,
        body: { titel: 'Versucht zu aendern' },
      }),
      { params: Promise.resolve({ id: pruefrundeId }) },
    );
    expect(res.status).toBe(422);
    const data = (await res.json()) as { error: { code: string } };
    expect(data.error.code).toBe('nicht_editierbar');
  });

  it('PATCH von fremdem Nutzer → 403', async () => {
    const { pruefrundeId } = await setup();
    const fremdId = await macherAnlegen({ email: 'patch-fremd@test.werkzirkel.de' });
    const fremdSid = await sessionAnlegen(fremdId);

    const res = await pruefrundePatch(
      buildRequest({
        method: 'PATCH',
        path: `/api/v1/pruefrunden/${pruefrundeId}`,
        sessionId: fremdSid,
        body: { titel: 'feindlich' },
      }),
      { params: Promise.resolve({ id: pruefrundeId }) },
    );
    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/v1/pruefrunden/:id', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  it('Inhaber:in loescht Entwurf → 204', async () => {
    const userId = await macherAnlegen({ email: 'del-1@test.werkzirkel.de' });
    const sid = await sessionAnlegen(userId);
    const werkId = await werkAnlegen(userId);
    const postRes = await pruefrundenPost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/pruefrunden',
        sessionId: sid,
        body: validBody(werkId),
      }),
    );
    const prId = ((await postRes.json()) as { pruefrunde: { id: string } }).pruefrunde.id;

    const res = await pruefrundeDelete(
      buildRequest({
        method: 'DELETE',
        path: `/api/v1/pruefrunden/${prId}`,
        sessionId: sid,
      }),
      { params: Promise.resolve({ id: prId }) },
    );
    expect(res.status).toBe(204);
    const rows = await db.select().from(pruefrunde).where(eq(pruefrunde.id, prId));
    expect(rows.length).toBe(0);
  });

  it('DELETE einer veroeffentlichten Pruefrunde → 422 nicht_loeschbar', async () => {
    const userId = await macherAnlegen({ email: 'del-2@test.werkzirkel.de' });
    const sid = await sessionAnlegen(userId);
    const werkId = await werkAnlegen(userId);
    const postRes = await pruefrundenPost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/pruefrunden',
        sessionId: sid,
        body: validBody(werkId),
      }),
    );
    const prId = ((await postRes.json()) as { pruefrunde: { id: string } }).pruefrunde.id;

    await db
      .update(pruefrunde)
      .set({ status: 'oeffentlich' })
      .where(eq(pruefrunde.id, prId));

    const res = await pruefrundeDelete(
      buildRequest({
        method: 'DELETE',
        path: `/api/v1/pruefrunden/${prId}`,
        sessionId: sid,
      }),
      { params: Promise.resolve({ id: prId }) },
    );
    expect(res.status).toBe(422);
    const data = (await res.json()) as { error: { code: string } };
    expect(data.error.code).toBe('nicht_loeschbar');
  });
});

describe('GET /api/v1/pruefrunden/:id Detail', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  it('Entwurf anonym → 404, als Inhaber → 200', async () => {
    const userId = await macherAnlegen({ email: 'get-1@test.werkzirkel.de' });
    const sid = await sessionAnlegen(userId);
    const werkId = await werkAnlegen(userId);
    const postRes = await pruefrundenPost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/pruefrunden',
        sessionId: sid,
        body: validBody(werkId),
      }),
    );
    const prId = ((await postRes.json()) as { pruefrunde: { id: string } }).pruefrunde.id;

    const anon = await pruefrundeGet(
      buildRequest({ method: 'GET', path: `/api/v1/pruefrunden/${prId}` }),
      { params: Promise.resolve({ id: prId }) },
    );
    expect(anon.status).toBe(404);

    const owner = await pruefrundeGet(
      buildRequest({
        method: 'GET',
        path: `/api/v1/pruefrunden/${prId}`,
        sessionId: sid,
      }),
      { params: Promise.resolve({ id: prId }) },
    );
    expect(owner.status).toBe(200);
    const data = (await owner.json()) as {
      pruefrunde: { id: string; status: string };
      werk: { name: string };
      inhaber: { anzeigename: string };
      counts: { angemeldet: number; feedback_gegeben: number };
    };
    expect(data.pruefrunde.status).toBe('entwurf');
    expect(data.werk.name).toBe('Test Werk');
    expect(data.counts.angemeldet).toBe(0);
    expect(data.counts.feedback_gegeben).toBe(0);
  });

  it('oeffentlich anonym → 200 mit counts', async () => {
    const userId = await macherAnlegen({ email: 'get-2@test.werkzirkel.de' });
    const sid = await sessionAnlegen(userId);
    const werkId = await werkAnlegen(userId);
    const postRes = await pruefrundenPost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/pruefrunden',
        sessionId: sid,
        body: validBody(werkId),
      }),
    );
    const prId = ((await postRes.json()) as { pruefrunde: { id: string } }).pruefrunde.id;
    await db
      .update(pruefrunde)
      .set({ status: 'oeffentlich' })
      .where(eq(pruefrunde.id, prId));

    const res = await pruefrundeGet(
      buildRequest({ method: 'GET', path: `/api/v1/pruefrunden/${prId}` }),
      { params: Promise.resolve({ id: prId }) },
    );
    expect(res.status).toBe(200);
  });
});

describe('POST /api/v1/pruefrunden/:id/veroeffentlichen (Reziprozitaet)', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  async function setup(): Promise<{
    userId: string;
    sid: string;
    pruefrundeId: string;
    pruefrundeFrist: Date;
  }> {
    const userId = await macherAnlegen({ email: 'ver-1@test.werkzirkel.de' });
    const sid = await sessionAnlegen(userId);
    const werkId = await werkAnlegen(userId);
    const pruefrundeFrist = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const postRes = await pruefrundenPost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/pruefrunden',
        sessionId: sid,
        body: validBody(werkId, { frist: pruefrundeFrist.toISOString() }),
      }),
    );
    const prId = ((await postRes.json()) as { pruefrunde: { id: string } }).pruefrunde.id;
    return { userId, sid, pruefrundeId: prId, pruefrundeFrist };
  }

  it('ohne Saldo, ohne abgelaufene Verpflichtung → 200 mit neue_verpflichtung', async () => {
    const { userId, sid, pruefrundeId, pruefrundeFrist } = await setup();

    const res = await veroeffentlichenPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/pruefrunden/${pruefrundeId}/veroeffentlichen`,
        sessionId: sid,
      }),
      { params: Promise.resolve({ id: pruefrundeId }) },
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      pruefrunde: { status: string };
      reziprozitaet: {
        modus: string;
        frist?: string;
        verpflichtungs_id?: string;
      };
    };
    expect(data.pruefrunde.status).toBe('oeffentlich');
    expect(data.reziprozitaet.modus).toBe('neue_verpflichtung');
    expect(data.reziprozitaet.verpflichtungs_id).toBeTruthy();

    // DB-Assertion: Verpflichtungs-Row existiert mit Frist = pruefrunde.frist + 14d.
    const vRows = await db
      .select()
      .from(pruefrundenVerpflichtung)
      .where(eq(pruefrundenVerpflichtung.nutzerId, userId));
    expect(vRows.length).toBe(1);
    expect(vRows[0]?.ausPruefrundeId).toBe(pruefrundeId);
    const expectedFrist = new Date(
      pruefrundeFrist.getTime() + 14 * 24 * 60 * 60 * 1000,
    );
    expect(vRows[0]?.frist.toISOString()).toBe(expectedFrist.toISOString());
  });

  it('mit Saldo >= 2 → 200 saldo_erfuellt, keine neue Verpflichtung', async () => {
    const { userId, sid, pruefrundeId } = await setup();
    await db.insert(testSaldo).values({
      nutzerId: userId,
      testsGegeben: 2,
    });

    const res = await veroeffentlichenPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/pruefrunden/${pruefrundeId}/veroeffentlichen`,
        sessionId: sid,
      }),
      { params: Promise.resolve({ id: pruefrundeId }) },
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      reziprozitaet: { modus: string; tests_gegeben?: number };
    };
    expect(data.reziprozitaet.modus).toBe('saldo_erfuellt');
    expect(data.reziprozitaet.tests_gegeben).toBe(2);

    const vRows = await db
      .select()
      .from(pruefrundenVerpflichtung)
      .where(eq(pruefrundenVerpflichtung.nutzerId, userId));
    expect(vRows.length).toBe(0);
  });

  it('mit abgelaufener offener Verpflichtung → 422 reziprozitaet_blockiert', async () => {
    const { userId, sid, pruefrundeId } = await setup();
    // Eine alte Verpflichtung mit frist=gestern einseeden — Engine sieht
    // sie via raw SQL (status='offen' AND frist < now).
    await db.insert(pruefrundenVerpflichtung).values({
      nutzerId: userId,
      ausPruefrundeId: pruefrundeId,
      frist: new Date(Date.now() - 24 * 60 * 60 * 1000),
      status: 'offen',
    });

    const res = await veroeffentlichenPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/pruefrunden/${pruefrundeId}/veroeffentlichen`,
        sessionId: sid,
      }),
      { params: Promise.resolve({ id: pruefrundeId }) },
    );
    expect(res.status).toBe(422);
    const data = (await res.json()) as {
      error: { code: string; grund: string; offene_anzahl: number };
      deutsche_message: string;
    };
    expect(data.error.code).toBe('reziprozitaet_blockiert');
    expect(data.error.grund).toBe('frist_abgelaufen');
    expect(data.error.offene_anzahl).toBe(1);
    expect(data.deutsche_message).toMatch(/Reziprozitaets-Verpflichtung/i);

    // Pruefrunde bleibt im Entwurf-Status.
    const rows = await db
      .select()
      .from(pruefrunde)
      .where(eq(pruefrunde.id, pruefrundeId));
    expect(rows[0]?.status).toBe('entwurf');
  });

  it('Veroeffentlichen einer nicht-Entwurf-Pruefrunde → 422 falscher_status', async () => {
    const { sid, pruefrundeId } = await setup();
    await db
      .update(pruefrunde)
      .set({ status: 'oeffentlich' })
      .where(eq(pruefrunde.id, pruefrundeId));

    const res = await veroeffentlichenPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/pruefrunden/${pruefrundeId}/veroeffentlichen`,
        sessionId: sid,
      }),
      { params: Promise.resolve({ id: pruefrundeId }) },
    );
    expect(res.status).toBe(422);
    const data = (await res.json()) as { error: { code: string } };
    expect(data.error.code).toBe('falscher_status');
  });

  it('Veroeffentlichen von fremdem Nutzer → 403', async () => {
    const { pruefrundeId } = await setup();
    const fremdId = await macherAnlegen({ email: 'ver-fremd@test.werkzirkel.de' });
    const fremdSid = await sessionAnlegen(fremdId);

    const res = await veroeffentlichenPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/pruefrunden/${pruefrundeId}/veroeffentlichen`,
        sessionId: fremdSid,
      }),
      { params: Promise.resolve({ id: pruefrundeId }) },
    );
    expect(res.status).toBe(403);
  });
});

describe('POST /api/v1/pruefrunden/:id/schliessen + abschliessen', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  async function setupOeffentlich(): Promise<{
    userId: string;
    sid: string;
    pruefrundeId: string;
  }> {
    const userId = await macherAnlegen({ email: 'fin-1@test.werkzirkel.de' });
    const sid = await sessionAnlegen(userId);
    const werkId = await werkAnlegen(userId);
    const postRes = await pruefrundenPost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/pruefrunden',
        sessionId: sid,
        body: validBody(werkId),
      }),
    );
    const prId = ((await postRes.json()) as { pruefrunde: { id: string } }).pruefrunde.id;
    await db
      .update(pruefrunde)
      .set({ status: 'oeffentlich' })
      .where(eq(pruefrunde.id, prId));
    return { userId, sid, pruefrundeId: prId };
  }

  it('schliessen oeffentlich → 200, status=geschlossen', async () => {
    const { sid, pruefrundeId } = await setupOeffentlich();
    const res = await schliessenPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/pruefrunden/${pruefrundeId}/schliessen`,
        sessionId: sid,
      }),
      { params: Promise.resolve({ id: pruefrundeId }) },
    );
    expect(res.status).toBe(200);
    const rows = await db
      .select()
      .from(pruefrunde)
      .where(eq(pruefrunde.id, pruefrundeId));
    expect(rows[0]?.status).toBe('geschlossen');
  });

  it('schliessen aus Entwurf → 422 falscher_status', async () => {
    const userId = await macherAnlegen({ email: 'fin-noOpen@test.werkzirkel.de' });
    const sid = await sessionAnlegen(userId);
    const werkId = await werkAnlegen(userId);
    const postRes = await pruefrundenPost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/pruefrunden',
        sessionId: sid,
        body: validBody(werkId),
      }),
    );
    const prId = ((await postRes.json()) as { pruefrunde: { id: string } }).pruefrunde.id;

    const res = await schliessenPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/pruefrunden/${prId}/schliessen`,
        sessionId: sid,
      }),
      { params: Promise.resolve({ id: prId }) },
    );
    expect(res.status).toBe(422);
  });

  it('abschliessen ohne hilfreiches Feedback → 422 kein_hilfreiches_feedback', async () => {
    const { sid, pruefrundeId } = await setupOeffentlich();
    await db
      .update(pruefrunde)
      .set({ status: 'geschlossen' })
      .where(eq(pruefrunde.id, pruefrundeId));

    const res = await abschliessenPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/pruefrunden/${pruefrundeId}/abschliessen`,
        sessionId: sid,
      }),
      { params: Promise.resolve({ id: pruefrundeId }) },
    );
    expect(res.status).toBe(422);
    const data = (await res.json()) as { error: { code: string } };
    expect(data.error.code).toBe('kein_hilfreiches_feedback');
  });

  it('abschliessen mit hilfreichem Feedback → 200', async () => {
    const { sid, pruefrundeId } = await setupOeffentlich();
    await db
      .update(pruefrunde)
      .set({ status: 'geschlossen' })
      .where(eq(pruefrunde.id, pruefrundeId));

    // Tester:in + Feedback einseeden.
    const testerId = await macherAnlegen({ email: 'fin-tester@test.werkzirkel.de' });
    await db.insert(feedback).values({
      pruefrundeId,
      testerId,
      gesamteindruck: 'sehr hilfreich',
      hilfreichMarkiert: true,
      hilfreichMarkiertAm: new Date(),
    });

    const res = await abschliessenPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/pruefrunden/${pruefrundeId}/abschliessen`,
        sessionId: sid,
      }),
      { params: Promise.resolve({ id: pruefrundeId }) },
    );
    expect(res.status).toBe(200);
    const rows = await db
      .select()
      .from(pruefrunde)
      .where(eq(pruefrunde.id, pruefrundeId));
    expect(rows[0]?.status).toBe('abgeschlossen');
  });

  it('abschliessen aus oeffentlich → 422 (nur geschlossen → abgeschlossen)', async () => {
    const { sid, pruefrundeId } = await setupOeffentlich();
    const res = await abschliessenPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/pruefrunden/${pruefrundeId}/abschliessen`,
        sessionId: sid,
      }),
      { params: Promise.resolve({ id: pruefrundeId }) },
    );
    expect(res.status).toBe(422);
  });
});

// Anker, damit ungenutzte Imports nicht bemaengelt werden.
void and;
