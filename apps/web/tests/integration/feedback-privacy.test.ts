/**
 * Integration-Tests fuer Privacy-Layer auf
 * GET /api/v1/pruefrunden/:id/feedbacks (PRD §F-205).
 *
 *  - Anonymer GET → 401
 *  - Tester:in (auch mit eigenem Feedback) → 403 kein_zugriff
 *  - Werk-Inhaber:in → 200 mit allen Feedbacks inkl. tester-Daten
 *  - nicht-existente Pruefrunde → 404
 */

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createId } from '@paralleldrive/cuid2';

import { db } from '@/lib/db';
import {
  feedback,
  nutzer,
  pruefrunde,
  session as sessionTable,
  werk,
} from '@/lib/db/schema';
import { env } from '@/lib/env';
import { buildSessionCookie } from '@/lib/auth/session';

import { GET as feedbacksGet } from '@/app/api/v1/pruefrunden/[id]/feedbacks/route';

import { truncateAll } from '../_helpers/db-cleanup';

const APP_ORIGIN = new URL(env.APP_URL).origin;

async function nutzerAnlegen(email: string, anzeigename?: string): Promise<string> {
  const id = createId();
  await db.insert(nutzer).values({
    id,
    email,
    klarname: `Klar ${email}`,
    anzeigename: anzeigename ?? `anz-${id.slice(0, 6)}`,
    stadtId: 'hh',
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

async function setup(): Promise<{
  inhaberId: string;
  inhaberSid: string;
  testerAId: string;
  testerASid: string;
  testerBId: string;
  prId: string;
  feedbackAId: string;
  feedbackBId: string;
}> {
  const inhaberId = await nutzerAnlegen(
    `pv-inhaber-${createId().slice(0, 6)}@test.werkzirkel.de`,
    'Inhaber',
  );
  const inhaberSid = await sessionAnlegen(inhaberId);

  const werkId = createId();
  await db.insert(werk).values({
    id: werkId,
    nutzerId: inhaberId,
    name: 'Werk Priv',
    kurzbeschreibung: 'Eine Kurzbeschreibung.',
    problem: 'Wir loesen ein Problem.',
    zielgruppe: 'Indie-Macher:innen',
    werkstand: 'idee',
  });

  const prId = createId();
  await db.insert(pruefrunde).values({
    id: prId,
    werkId,
    titel: 'PR Priv',
    testziel: 'Z',
    testaufgabe: 'A',
    zielgruppe: 'ZG',
    zeitbedarfMinuten: 30,
    gesuchteTester: 3,
    feedbackKategorien: ['erster_eindruck'],
    frist: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    status: 'oeffentlich',
  });

  const testerAId = await nutzerAnlegen(
    `pv-tester-a-${createId().slice(0, 6)}@test.werkzirkel.de`,
    'Tester A',
  );
  const testerASid = await sessionAnlegen(testerAId);
  const testerBId = await nutzerAnlegen(
    `pv-tester-b-${createId().slice(0, 6)}@test.werkzirkel.de`,
    'Tester B',
  );

  const feedbackAId = createId();
  await db.insert(feedback).values({
    id: feedbackAId,
    pruefrundeId: prId,
    testerId: testerAId,
    gesamteindruck: 'A meint: solide.',
    ersterEindruck: 'Ueberraschend klar.',
  });
  const feedbackBId = createId();
  await db.insert(feedback).values({
    id: feedbackBId,
    pruefrundeId: prId,
    testerId: testerBId,
    gesamteindruck: 'B meint: noch unklar.',
  });

  return {
    inhaberId,
    inhaberSid,
    testerAId,
    testerASid,
    testerBId,
    prId,
    feedbackAId,
    feedbackBId,
  };
}

function buildRequest(opts: {
  path: string;
  sessionId?: string;
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
    method: 'GET',
    headers,
  });
}

describe('GET /api/v1/pruefrunden/:id/feedbacks', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  it('Anonymer GET → 401', async () => {
    const { prId } = await setup();
    const res = await feedbacksGet(
      buildRequest({ path: `/api/v1/pruefrunden/${prId}/feedbacks` }),
      { params: Promise.resolve({ id: prId }) },
    );
    expect(res.status).toBe(401);
  });

  it('Tester:in (eigenes Feedback) → 403 kein_zugriff', async () => {
    const { prId, testerASid } = await setup();
    const res = await feedbacksGet(
      buildRequest({
        path: `/api/v1/pruefrunden/${prId}/feedbacks`,
        sessionId: testerASid,
      }),
      { params: Promise.resolve({ id: prId }) },
    );
    expect(res.status).toBe(403);
    const data = (await res.json()) as { error: { code: string } };
    expect(data.error.code).toBe('kein_zugriff');
  });

  it('Werk-Inhaber:in → 200 mit allen Feedbacks + tester-Daten', async () => {
    const { prId, inhaberSid } = await setup();
    const res = await feedbacksGet(
      buildRequest({
        path: `/api/v1/pruefrunden/${prId}/feedbacks`,
        sessionId: inhaberSid,
      }),
      { params: Promise.resolve({ id: prId }) },
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      feedbacks: Array<{
        id: string;
        gesamteindruck: string;
        tester: { id: string; anzeigename: string } | null;
      }>;
    };
    expect(data.feedbacks.length).toBe(2);
    const namen = data.feedbacks.map((f) => f.tester?.anzeigename).sort();
    expect(namen).toEqual(['Tester A', 'Tester B']);
    const inhalte = data.feedbacks.map((f) => f.gesamteindruck).sort();
    expect(inhalte).toEqual(['A meint: solide.', 'B meint: noch unklar.']);
  });

  it('Nicht-existente Pruefrunde → 404', async () => {
    const id = await nutzerAnlegen(
      `pv-x-${createId().slice(0, 6)}@test.werkzirkel.de`,
    );
    const sid = await sessionAnlegen(id);
    const res = await feedbacksGet(
      buildRequest({
        path: '/api/v1/pruefrunden/does-not-exist/feedbacks',
        sessionId: sid,
      }),
      { params: Promise.resolve({ id: 'does-not-exist' }) },
    );
    expect(res.status).toBe(404);
  });
});
