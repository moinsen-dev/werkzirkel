/**
 * Integration-Tests fuer PATCH /api/v1/feedback/:id/hilfreich.
 *
 * Deckt PRD §F-206 (hilfreich-Markierung):
 *  - Werk-Inhaber:in markiert hilfreich=true → 200 + DB-Update
 *  - Fremder Nutzer markiert → 403 kein_zugriff
 *  - Demarkieren hilfreich=false → hilfreich_markiert_am=null
 *  - Validierungsfehler bei fehlendem Body → 422
 *  - Ohne Session → 401
 *  - nicht-existentes Feedback → 404
 */

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createId } from '@paralleldrive/cuid2';
import { eq } from 'drizzle-orm';

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

import { PATCH as hilfreichPatch } from '@/app/api/v1/feedback/[id]/hilfreich/route';

import { truncateAll } from '../_helpers/db-cleanup';

const APP_ORIGIN = new URL(env.APP_URL).origin;

async function nutzerAnlegen(email: string): Promise<string> {
  const id = createId();
  await db.insert(nutzer).values({
    id,
    email,
    klarname: `Klar ${email}`,
    anzeigename: `anz-${id.slice(0, 6)}`,
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

async function setupFeedback(): Promise<{
  inhaberId: string;
  inhaberSid: string;
  testerId: string;
  feedbackId: string;
}> {
  const inhaberId = await nutzerAnlegen(
    `h-inhaber-${createId().slice(0, 6)}@test.werkzirkel.de`,
  );
  const inhaberSid = await sessionAnlegen(inhaberId);

  const werkId = createId();
  await db.insert(werk).values({
    id: werkId,
    nutzerId: inhaberId,
    name: 'Werk H',
    kurzbeschreibung: 'Eine Kurzbeschreibung.',
    problem: 'Wir loesen ein Problem.',
    zielgruppe: 'Indie-Macher:innen',
    werkstand: 'idee',
  });

  const prId = createId();
  await db.insert(pruefrunde).values({
    id: prId,
    werkId,
    titel: 'PR H',
    testziel: 'Z',
    testaufgabe: 'A',
    zielgruppe: 'ZG',
    zeitbedarfMinuten: 30,
    gesuchteTester: 3,
    feedbackKategorien: ['erster_eindruck'],
    frist: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    status: 'oeffentlich',
  });

  const testerId = await nutzerAnlegen(
    `h-tester-${createId().slice(0, 6)}@test.werkzirkel.de`,
  );

  const feedbackId = createId();
  await db.insert(feedback).values({
    id: feedbackId,
    pruefrundeId: prId,
    testerId,
    gesamteindruck: 'War okay.',
  });

  return { inhaberId, inhaberSid, testerId, feedbackId };
}

function buildRequest(opts: {
  method: 'PATCH' | 'GET';
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

describe('PATCH /api/v1/feedback/:id/hilfreich', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  it('Werk-Inhaber:in markiert hilfreich=true → 200 + DB-Update', async () => {
    const { inhaberSid, feedbackId } = await setupFeedback();

    const res = await hilfreichPatch(
      buildRequest({
        method: 'PATCH',
        path: `/api/v1/feedback/${feedbackId}/hilfreich`,
        sessionId: inhaberSid,
        body: { hilfreich: true },
      }),
      { params: Promise.resolve({ id: feedbackId }) },
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      feedback: {
        id: string;
        hilfreich_markiert: boolean;
        hilfreich_markiert_am: string | null;
      };
    };
    expect(data.feedback.hilfreich_markiert).toBe(true);
    expect(data.feedback.hilfreich_markiert_am).not.toBeNull();

    const rows = await db
      .select()
      .from(feedback)
      .where(eq(feedback.id, feedbackId));
    expect(rows[0]?.hilfreichMarkiert).toBe(true);
    expect(rows[0]?.hilfreichMarkiertAm).toBeInstanceOf(Date);
  });

  it('Fremder Nutzer markiert → 403 kein_zugriff', async () => {
    const { feedbackId } = await setupFeedback();
    const fremdId = await nutzerAnlegen(
      `h-fremd-${createId().slice(0, 6)}@test.werkzirkel.de`,
    );
    const sid = await sessionAnlegen(fremdId);

    const res = await hilfreichPatch(
      buildRequest({
        method: 'PATCH',
        path: `/api/v1/feedback/${feedbackId}/hilfreich`,
        sessionId: sid,
        body: { hilfreich: true },
      }),
      { params: Promise.resolve({ id: feedbackId }) },
    );
    expect(res.status).toBe(403);
    const data = (await res.json()) as { error: { code: string } };
    expect(data.error.code).toBe('kein_zugriff');
  });

  it('Demarkieren hilfreich=false → hilfreich_markiert_am=null', async () => {
    const { inhaberSid, feedbackId } = await setupFeedback();

    // Zuerst markieren.
    await db
      .update(feedback)
      .set({ hilfreichMarkiert: true, hilfreichMarkiertAm: new Date() })
      .where(eq(feedback.id, feedbackId));

    const res = await hilfreichPatch(
      buildRequest({
        method: 'PATCH',
        path: `/api/v1/feedback/${feedbackId}/hilfreich`,
        sessionId: inhaberSid,
        body: { hilfreich: false },
      }),
      { params: Promise.resolve({ id: feedbackId }) },
    );
    expect(res.status).toBe(200);

    const rows = await db
      .select()
      .from(feedback)
      .where(eq(feedback.id, feedbackId));
    expect(rows[0]?.hilfreichMarkiert).toBe(false);
    expect(rows[0]?.hilfreichMarkiertAm).toBeNull();
  });

  it('Validierung: Body ohne hilfreich-Feld → 422', async () => {
    const { inhaberSid, feedbackId } = await setupFeedback();

    const res = await hilfreichPatch(
      buildRequest({
        method: 'PATCH',
        path: `/api/v1/feedback/${feedbackId}/hilfreich`,
        sessionId: inhaberSid,
        body: {},
      }),
      { params: Promise.resolve({ id: feedbackId }) },
    );
    expect(res.status).toBe(422);
  });

  it('Ohne Session → 401', async () => {
    const { feedbackId } = await setupFeedback();

    const res = await hilfreichPatch(
      buildRequest({
        method: 'PATCH',
        path: `/api/v1/feedback/${feedbackId}/hilfreich`,
        body: { hilfreich: true },
      }),
      { params: Promise.resolve({ id: feedbackId }) },
    );
    expect(res.status).toBe(401);
  });

  it('Nicht-existentes Feedback → 404', async () => {
    const id = await nutzerAnlegen(
      `h-x-${createId().slice(0, 6)}@test.werkzirkel.de`,
    );
    const sid = await sessionAnlegen(id);

    const res = await hilfreichPatch(
      buildRequest({
        method: 'PATCH',
        path: '/api/v1/feedback/does-not-exist/hilfreich',
        sessionId: sid,
        body: { hilfreich: true },
      }),
      { params: Promise.resolve({ id: 'does-not-exist' }) },
    );
    expect(res.status).toBe(404);
  });
});
