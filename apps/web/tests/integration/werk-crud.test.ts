/**
 * Integration-Tests fuer Werk-CRUD-API.
 *
 * Methode: Route-Handler direkt importieren und mit synthetischen
 * `Request`-Objekten aufrufen. Sessions werden direkt in der DB angelegt.
 */

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createId } from '@paralleldrive/cuid2';
import { and, eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import {
  nutzer,
  session as sessionTable,
  werk,
  werkHistorie,
} from '@/lib/db/schema';
import { env } from '@/lib/env';
import { buildSessionCookie } from '@/lib/auth/session';

import {
  POST as werkePost,
  GET as werkeGet,
} from '@/app/api/v1/werke/route';
import {
  GET as werkGet,
  PATCH as werkPatch,
  DELETE as werkDelete,
} from '@/app/api/v1/werke/[id]/route';

import { truncateAll } from '../_helpers/db-cleanup';

const APP_ORIGIN = new URL(env.APP_URL).origin;

async function macherAnlegen(opts: {
  email: string;
  rollen?: ('macher' | 'bedarfstraeger' | 'foerderer' | 'kurator' | 'admin')[];
  stadtId?: string;
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

const validBody = (overrides: Record<string, unknown> = {}) => ({
  name: 'Test Werk',
  kurzbeschreibung: 'Eine kurze Beschreibung.',
  problem: 'Wir loesen ein Problem.',
  zielgruppe: 'Indie Macher:innen',
  werkstand: 'idee',
  hilfebedarf: ['ux_test'],
  ...overrides,
});

describe('POST /api/v1/werke', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  it('legt eigenes Werk an → 201 + in DB persistiert', async () => {
    const userId = await macherAnlegen({ email: 'crud-1@test.werkzirkel.de' });
    const sid = await sessionAnlegen(userId);

    const res = await werkePost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/werke',
        sessionId: sid,
        body: validBody(),
      }),
    );
    expect(res.status).toBe(201);
    const data = (await res.json()) as {
      werk: { id: string; name: string; nutzer_id: string };
    };
    expect(data.werk.name).toBe('Test Werk');
    expect(data.werk.nutzer_id).toBe(userId);

    const rows = await db
      .select()
      .from(werk)
      .where(eq(werk.id, data.werk.id));
    expect(rows.length).toBe(1);
  });

  it('ohne Session → 401', async () => {
    const res = await werkePost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/werke',
        body: validBody(),
      }),
    );
    expect(res.status).toBe(401);
  });

  it('ohne macher-Rolle → 403', async () => {
    const userId = await macherAnlegen({
      email: 'crud-2@test.werkzirkel.de',
      rollen: ['bedarfstraeger'],
    });
    // Bedarfstraeger braucht klarname — den haben wir oben gesetzt.
    const sid = await sessionAnlegen(userId);

    const res = await werkePost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/werke',
        sessionId: sid,
        body: validBody(),
      }),
    );
    expect(res.status).toBe(403);
    const data = (await res.json()) as { error: { code: string } };
    expect(data.error.code).toBe('rolle_fehlt');
  });

  it('kurzbeschreibung > 280 chars → 422 mit deutscher Fehlermeldung', async () => {
    const userId = await macherAnlegen({ email: 'crud-3@test.werkzirkel.de' });
    const sid = await sessionAnlegen(userId);

    const res = await werkePost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/werke',
        sessionId: sid,
        body: validBody({ kurzbeschreibung: 'x'.repeat(281) }),
      }),
    );
    expect(res.status).toBe(422);
    const data = (await res.json()) as {
      fehler: string;
      details: Record<string, string[]>;
    };
    expect(data.fehler).toBe('validierung');
    const msgs = data.details.kurzbeschreibung ?? [];
    expect(msgs.some((m) => /280 Zeichen/i.test(m))).toBe(true);
  });

  it('6. Werk → 422 mit limit-Fehler', async () => {
    const userId = await macherAnlegen({ email: 'crud-4@test.werkzirkel.de' });
    const sid = await sessionAnlegen(userId);

    for (let i = 1; i <= 5; i++) {
      const r = await werkePost(
        buildRequest({
          method: 'POST',
          path: '/api/v1/werke',
          sessionId: sid,
          body: validBody({ name: `Werk ${i}` }),
        }),
      );
      expect(r.status).toBe(201);
    }

    const res = await werkePost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/werke',
        sessionId: sid,
        body: validBody({ name: 'Werk 6' }),
      }),
    );
    expect(res.status).toBe(422);
    const data = (await res.json()) as { error: { code: string; message: string } };
    expect(data.error.code).toBe('limit_erreicht');
    expect(data.error.message).toMatch(/Foerdermitgliedschaft/i);
  });
});

describe('PATCH /api/v1/werke/:id', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  async function werkPosten(sid: string, name = 'Original'): Promise<string> {
    const r = await werkePost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/werke',
        sessionId: sid,
        body: validBody({ name }),
      }),
    );
    const data = (await r.json()) as { werk: { id: string } };
    return data.werk.id;
  }

  it('Werkstand-Wechsel idee → prototyp erzeugt zusätzlich zur Anlage-Row eine Transitions-Row', async () => {
    const userId = await macherAnlegen({ email: 'patch-1@test.werkzirkel.de' });
    const sid = await sessionAnlegen(userId);
    const wId = await werkPosten(sid);

    const res = await werkPatch(
      buildRequest({
        method: 'PATCH',
        path: `/api/v1/werke/${wId}`,
        sessionId: sid,
        body: { werkstand: 'prototyp' },
      }),
      { params: Promise.resolve({ id: wId }) },
    );
    expect(res.status).toBe(200);

    const historie = await db
      .select()
      .from(werkHistorie)
      .where(eq(werkHistorie.werkId, wId))
      .orderBy(werkHistorie.geaendertAm);
    // 1) Initial bei werk-create (werkstandAlt=null, werkstandNeu='idee')
    // 2) Transition durch PATCH (werkstandAlt='idee', werkstandNeu='prototyp')
    expect(historie.length).toBe(2);
    expect(historie[0]?.werkstandAlt).toBe(null);
    expect(historie[0]?.werkstandNeu).toBe('idee');
    expect(historie[1]?.werkstandAlt).toBe('idee');
    expect(historie[1]?.werkstandNeu).toBe('prototyp');
    expect(historie[1]?.geaendertVon).toBe(userId);
  });

  it('PATCH mit gleichem Werkstand → KEIN zusätzlicher werk_historie-Eintrag (nur Anlage-Row)', async () => {
    const userId = await macherAnlegen({ email: 'patch-2@test.werkzirkel.de' });
    const sid = await sessionAnlegen(userId);
    const wId = await werkPosten(sid);

    const res = await werkPatch(
      buildRequest({
        method: 'PATCH',
        path: `/api/v1/werke/${wId}`,
        sessionId: sid,
        body: { werkstand: 'idee', name: 'neuer Name' },
      }),
      { params: Promise.resolve({ id: wId }) },
    );
    expect(res.status).toBe(200);

    const historie = await db
      .select()
      .from(werkHistorie)
      .where(eq(werkHistorie.werkId, wId));
    // Nur die Anlage-Row, kein Transitions-Insert bei No-Op-PATCH.
    expect(historie.length).toBe(1);
    expect(historie[0]?.werkstandAlt).toBe(null);
  });

  it('PATCH von fremdem Nutzer → 403', async () => {
    const ownerId = await macherAnlegen({ email: 'owner@test.werkzirkel.de' });
    const ownerSid = await sessionAnlegen(ownerId);
    const wId = await werkPosten(ownerSid);

    const fremdId = await macherAnlegen({ email: 'fremd@test.werkzirkel.de' });
    const fremdSid = await sessionAnlegen(fremdId);

    const res = await werkPatch(
      buildRequest({
        method: 'PATCH',
        path: `/api/v1/werke/${wId}`,
        sessionId: fremdSid,
        body: { name: 'feindliche Uebernahme' },
      }),
      { params: Promise.resolve({ id: wId }) },
    );
    expect(res.status).toBe(403);
    const data = (await res.json()) as { error: { code: string } };
    expect(data.error.code).toBe('kein_zugriff');
  });

  it('PATCH auf nicht-existentes Werk → 404', async () => {
    const userId = await macherAnlegen({ email: 'patch-404@test.werkzirkel.de' });
    const sid = await sessionAnlegen(userId);
    const res = await werkPatch(
      buildRequest({
        method: 'PATCH',
        path: '/api/v1/werke/nonexistent',
        sessionId: sid,
        body: { name: 'x' },
      }),
      { params: Promise.resolve({ id: 'nonexistent' }) },
    );
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/v1/werke/:id', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  it('Inhaber:in loescht eigenes Werk → 204, CASCADE raeumt werk_historie', async () => {
    const userId = await macherAnlegen({ email: 'del-1@test.werkzirkel.de' });
    const sid = await sessionAnlegen(userId);

    const postRes = await werkePost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/werke',
        sessionId: sid,
        body: validBody(),
      }),
    );
    const created = (await postRes.json()) as { werk: { id: string } };
    const wId = created.werk.id;

    // Werkstand-Wechsel, damit werk_historie befuellt ist.
    await werkPatch(
      buildRequest({
        method: 'PATCH',
        path: `/api/v1/werke/${wId}`,
        sessionId: sid,
        body: { werkstand: 'prototyp' },
      }),
      { params: Promise.resolve({ id: wId }) },
    );

    const histVor = await db
      .select()
      .from(werkHistorie)
      .where(eq(werkHistorie.werkId, wId));
    // 1) Anlage (werkstandAlt=null), 2) PATCH-Transition
    expect(histVor.length).toBe(2);

    const delRes = await werkDelete(
      buildRequest({
        method: 'DELETE',
        path: `/api/v1/werke/${wId}`,
        sessionId: sid,
      }),
      { params: Promise.resolve({ id: wId }) },
    );
    expect(delRes.status).toBe(204);

    const werkRows = await db.select().from(werk).where(eq(werk.id, wId));
    expect(werkRows.length).toBe(0);

    const histNach = await db
      .select()
      .from(werkHistorie)
      .where(eq(werkHistorie.werkId, wId));
    expect(histNach.length).toBe(0);
  });

  it('DELETE von fremdem Nutzer → 403', async () => {
    const ownerId = await macherAnlegen({ email: 'del-owner@test.werkzirkel.de' });
    const ownerSid = await sessionAnlegen(ownerId);
    const postRes = await werkePost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/werke',
        sessionId: ownerSid,
        body: validBody(),
      }),
    );
    const wId = ((await postRes.json()) as { werk: { id: string } }).werk.id;

    const fremdId = await macherAnlegen({ email: 'del-fremd@test.werkzirkel.de' });
    const fremdSid = await sessionAnlegen(fremdId);

    const res = await werkDelete(
      buildRequest({
        method: 'DELETE',
        path: `/api/v1/werke/${wId}`,
        sessionId: fremdSid,
      }),
      { params: Promise.resolve({ id: wId }) },
    );
    expect(res.status).toBe(403);
  });
});

describe('GET /api/v1/werke/:id Sichtbarkeit', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  it('pausiert anonym → 404, als Inhaber → 200', async () => {
    const userId = await macherAnlegen({ email: 'pause-owner@test.werkzirkel.de' });
    const sid = await sessionAnlegen(userId);
    const postRes = await werkePost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/werke',
        sessionId: sid,
        body: validBody(),
      }),
    );
    const wId = ((await postRes.json()) as { werk: { id: string } }).werk.id;

    // Auf pausiert setzen.
    await db
      .update(werk)
      .set({ sichtbarkeit: 'pausiert' })
      .where(eq(werk.id, wId));

    // Anonym → 404
    const anon = await werkGet(
      buildRequest({ method: 'GET', path: `/api/v1/werke/${wId}` }),
      { params: Promise.resolve({ id: wId }) },
    );
    expect(anon.status).toBe(404);

    // Als Inhaber:in → 200
    const owner = await werkGet(
      buildRequest({
        method: 'GET',
        path: `/api/v1/werke/${wId}`,
        sessionId: sid,
      }),
      { params: Promise.resolve({ id: wId }) },
    );
    expect(owner.status).toBe(200);
    const data = (await owner.json()) as { werk: { sichtbarkeit: string } };
    expect(data.werk.sichtbarkeit).toBe('pausiert');
  });

  it('ausgeblendet anonym → 404', async () => {
    const userId = await macherAnlegen({ email: 'aus-owner@test.werkzirkel.de' });
    const sid = await sessionAnlegen(userId);
    const postRes = await werkePost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/werke',
        sessionId: sid,
        body: validBody(),
      }),
    );
    const wId = ((await postRes.json()) as { werk: { id: string } }).werk.id;

    await db
      .update(werk)
      .set({ status: 'ausgeblendet' })
      .where(eq(werk.id, wId));

    const res = await werkGet(
      buildRequest({ method: 'GET', path: `/api/v1/werke/${wId}` }),
      { params: Promise.resolve({ id: wId }) },
    );
    expect(res.status).toBe(404);
  });

  it('oeffentlich + aktiv anonym → 200 mit inhaber-public-Daten (KEIN email/klarname)', async () => {
    const userId = await macherAnlegen({ email: 'pub-owner@test.werkzirkel.de' });
    const sid = await sessionAnlegen(userId);
    const postRes = await werkePost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/werke',
        sessionId: sid,
        body: validBody(),
      }),
    );
    const wId = ((await postRes.json()) as { werk: { id: string } }).werk.id;

    const res = await werkGet(
      buildRequest({ method: 'GET', path: `/api/v1/werke/${wId}` }),
      { params: Promise.resolve({ id: wId }) },
    );
    expect(res.status).toBe(200);
    const payload = await res.text();
    expect(payload).not.toMatch(/pub-owner@test\.werkzirkel\.de/);
    expect(payload).not.toMatch(/Klar pub-owner/);
    const data = JSON.parse(payload) as {
      inhaber: { anzeigename: string; stadt_id: string };
    };
    expect(data.inhaber.anzeigename).toBeTruthy();
    expect(data.inhaber.stadt_id).toBe('hh');
  });
});

describe('GET /api/v1/werke (Liste) Basis', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  it('zeigt eigene oeffentliche Werke', async () => {
    const userId = await macherAnlegen({ email: 'list-1@test.werkzirkel.de' });
    const sid = await sessionAnlegen(userId);
    await werkePost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/werke',
        sessionId: sid,
        body: validBody({ name: 'Werk A' }),
      }),
    );

    const res = await werkeGet(
      buildRequest({ method: 'GET', path: '/api/v1/werke' }),
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      werke: Array<{ name: string }>;
      nextCursor: string | null;
    };
    expect(data.werke.length).toBe(1);
    expect(data.werke[0]?.name).toBe('Werk A');
  });

  it('versteckt pausierte Werke aus der Liste', async () => {
    const userId = await macherAnlegen({ email: 'list-2@test.werkzirkel.de' });
    const sid = await sessionAnlegen(userId);
    const postRes = await werkePost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/werke',
        sessionId: sid,
        body: validBody({ name: 'Versteckt' }),
      }),
    );
    const wId = ((await postRes.json()) as { werk: { id: string } }).werk.id;
    await db
      .update(werk)
      .set({ sichtbarkeit: 'pausiert' })
      .where(eq(werk.id, wId));

    const res = await werkeGet(
      buildRequest({ method: 'GET', path: '/api/v1/werke' }),
    );
    const data = (await res.json()) as { werke: unknown[] };
    expect(data.werke.length).toBe(0);
  });
});

// Hilfs-Eq-Marker, damit ungenutzte Imports nicht bemaengelt werden.
void and;
