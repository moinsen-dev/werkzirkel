/**
 * Integration-Tests fuer POST /api/v1/pruefrunden/:id/feedback.
 *
 * Deckt PRD §F-204, §F-205, §13.9, §8.4:
 *  - Angemeldete:r Tester:in gibt Feedback → 201
 *  - pruefrunden_anmeldung.status='feedback_gegeben' nach Submit
 *  - test_saldo.tests_gegeben fuer Tester:in inkrementiert
 *  - test_saldo.tests_erhalten fuer Werk-Inhaber:in inkrementiert
 *  - T-102 versendet (Mock-Mode, in email_benachrichtigung_log)
 *  - Doppel-Feedback → 422 'bereits_feedback_gegeben'
 *  - Feedback ohne Anmeldung → 422 'nicht_angemeldet'
 *  - Feedback gegen Pruefrunde mit status='entwurf' → 422 'falscher_status'
 *  - Werk-Inhaber:in gegen eigene Pruefrunde → 422 'eigenes_werk'
 *  - Validierungs-Fehler (gesamteindruck fehlt) → 422
 *  - Ohne Session → 401, Ohne 'macher'-Rolle → 403
 */

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createId } from '@paralleldrive/cuid2';
import { and, eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import {
  emailBenachrichtigungLog,
  feedback,
  nutzer,
  pruefrunde,
  pruefrundenAnmeldung,
  session as sessionTable,
  testSaldo,
  werk,
} from '@/lib/db/schema';
import { env } from '@/lib/env';
import { buildSessionCookie } from '@/lib/auth/session';

import { POST as feedbackPost } from '@/app/api/v1/pruefrunden/[id]/feedback/route';

import { truncateAll } from '../_helpers/db-cleanup';

const APP_ORIGIN = new URL(env.APP_URL).origin;

async function macherAnlegen(opts: {
  email: string;
  stadtId?: string;
  rollen?: ('macher' | 'bedarfstraeger' | 'foerderer' | 'kurator' | 'admin')[];
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

async function pruefrundeAnlegen(opts: {
  werkId: string;
  status?: 'entwurf' | 'oeffentlich' | 'geschlossen' | 'abgeschlossen';
  gesuchteTester?: number;
}): Promise<string> {
  const id = createId();
  await db.insert(pruefrunde).values({
    id,
    werkId: opts.werkId,
    titel: 'Test-Pruefrunde Feedback',
    testziel: 'Test-Ziel',
    testaufgabe: 'Test-Aufgabe',
    zielgruppe: 'Test-Zielgruppe',
    zeitbedarfMinuten: 30,
    gesuchteTester: opts.gesuchteTester ?? 3,
    feedbackKategorien: ['erster_eindruck', 'verstaendlichkeit'],
    frist: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    status: opts.status ?? 'oeffentlich',
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

const VALID_BODY = {
  erster_eindruck: 'Sieht aufgeraeumt aus.',
  verstaendlichkeit: 'Die Hauptseite ist klar.',
  gesamteindruck:
    'Ich finde das Werk insgesamt gut aufgestellt — der erste Schritt ist klar, der Nutzen erkennbar.',
};

describe('POST /api/v1/pruefrunden/:id/feedback', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  it('Angemeldete:r Tester:in gibt Feedback ab → 201 + Saldo-Wechsel + T-102', async () => {
    const inhaberEmail = 'fb-inhaber-1@test.werkzirkel.de';
    const inhaberId = await macherAnlegen({ email: inhaberEmail });
    const werkId = await werkAnlegen(inhaberId);
    const prId = await pruefrundeAnlegen({ werkId });

    const testerId = await macherAnlegen({
      email: 'fb-tester-1@test.werkzirkel.de',
    });
    const testerSid = await sessionAnlegen(testerId);

    // Anmeldung als Seed (sonst 422 nicht_angemeldet).
    await db.insert(pruefrundenAnmeldung).values({
      pruefrundeId: prId,
      testerId,
      status: 'angemeldet',
    });

    const res = await feedbackPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/pruefrunden/${prId}/feedback`,
        sessionId: testerSid,
        body: VALID_BODY,
      }),
      { params: Promise.resolve({ id: prId }) },
    );
    expect(res.status).toBe(201);
    const data = (await res.json()) as {
      feedback: { id: string; pruefrunde_id: string; tester_id: string };
      anzahl_feedbacks: number;
    };
    expect(data.feedback.tester_id).toBe(testerId);
    expect(data.anzahl_feedbacks).toBe(1);

    // DB-Assertion: feedback-Row + Anmeldung-Status.
    const feedbackRows = await db
      .select()
      .from(feedback)
      .where(eq(feedback.id, data.feedback.id));
    expect(feedbackRows.length).toBe(1);
    expect(feedbackRows[0]?.gesamteindruck).toBe(VALID_BODY.gesamteindruck);
    expect(feedbackRows[0]?.ersterEindruck).toBe(VALID_BODY.erster_eindruck);
    expect(feedbackRows[0]?.hilfreichMarkiert).toBe(false);

    const anmRows = await db
      .select()
      .from(pruefrundenAnmeldung)
      .where(
        and(
          eq(pruefrundenAnmeldung.pruefrundeId, prId),
          eq(pruefrundenAnmeldung.testerId, testerId),
        ),
      );
    expect(anmRows[0]?.status).toBe('feedback_gegeben');

    // Saldo-Wechsel.
    const testerSaldo = await db
      .select()
      .from(testSaldo)
      .where(eq(testSaldo.nutzerId, testerId));
    expect(testerSaldo[0]?.testsGegeben).toBe(1);

    const inhaberSaldo = await db
      .select()
      .from(testSaldo)
      .where(eq(testSaldo.nutzerId, inhaberId));
    expect(inhaberSaldo[0]?.testsErhalten).toBe(1);

    // T-102-Eintrag im email_benachrichtigung_log.
    const mailLog = await db
      .select()
      .from(emailBenachrichtigungLog)
      .where(eq(emailBenachrichtigungLog.template, 'T-102'));
    expect(mailLog.length).toBe(1);
    expect(mailLog[0]?.email).toBe(inhaberEmail);
    expect(mailLog[0]?.nutzerId).toBe(inhaberId);
    expect(mailLog[0]?.status).toBe('gesendet');
  });

  it('Doppel-Feedback → 422 bereits_feedback_gegeben', async () => {
    const inhaberId = await macherAnlegen({
      email: 'fb-inhaber-2@test.werkzirkel.de',
    });
    const werkId = await werkAnlegen(inhaberId);
    const prId = await pruefrundeAnlegen({ werkId });

    const testerId = await macherAnlegen({
      email: 'fb-tester-2@test.werkzirkel.de',
    });
    const testerSid = await sessionAnlegen(testerId);
    await db.insert(pruefrundenAnmeldung).values({
      pruefrundeId: prId,
      testerId,
      status: 'angemeldet',
    });

    const first = await feedbackPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/pruefrunden/${prId}/feedback`,
        sessionId: testerSid,
        body: VALID_BODY,
      }),
      { params: Promise.resolve({ id: prId }) },
    );
    expect(first.status).toBe(201);

    const second = await feedbackPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/pruefrunden/${prId}/feedback`,
        sessionId: testerSid,
        body: VALID_BODY,
      }),
      { params: Promise.resolve({ id: prId }) },
    );
    expect(second.status).toBe(422);
    const data = (await second.json()) as { error: { code: string } };
    expect(data.error.code).toBe('bereits_feedback_gegeben');
  });

  it('Feedback ohne Anmeldung → 422 nicht_angemeldet', async () => {
    const inhaberId = await macherAnlegen({
      email: 'fb-inhaber-3@test.werkzirkel.de',
    });
    const werkId = await werkAnlegen(inhaberId);
    const prId = await pruefrundeAnlegen({ werkId });

    const testerId = await macherAnlegen({
      email: 'fb-tester-3@test.werkzirkel.de',
    });
    const sid = await sessionAnlegen(testerId);

    const res = await feedbackPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/pruefrunden/${prId}/feedback`,
        sessionId: sid,
        body: VALID_BODY,
      }),
      { params: Promise.resolve({ id: prId }) },
    );
    expect(res.status).toBe(422);
    const data = (await res.json()) as { error: { code: string } };
    expect(data.error.code).toBe('nicht_angemeldet');
  });

  it('Feedback gegen Pruefrunde im Status entwurf → 422 falscher_status', async () => {
    const inhaberId = await macherAnlegen({
      email: 'fb-inhaber-4@test.werkzirkel.de',
    });
    const werkId = await werkAnlegen(inhaberId);
    const prId = await pruefrundeAnlegen({ werkId, status: 'entwurf' });

    const testerId = await macherAnlegen({
      email: 'fb-tester-4@test.werkzirkel.de',
    });
    const sid = await sessionAnlegen(testerId);

    const res = await feedbackPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/pruefrunden/${prId}/feedback`,
        sessionId: sid,
        body: VALID_BODY,
      }),
      { params: Promise.resolve({ id: prId }) },
    );
    expect(res.status).toBe(422);
    const data = (await res.json()) as { error: { code: string } };
    expect(data.error.code).toBe('falscher_status');
  });

  it('Werk-Inhaber:in gibt Feedback an eigener Pruefrunde → 422 eigenes_werk', async () => {
    const inhaberId = await macherAnlegen({
      email: 'fb-inhaber-5@test.werkzirkel.de',
    });
    const sid = await sessionAnlegen(inhaberId);
    const werkId = await werkAnlegen(inhaberId);
    const prId = await pruefrundeAnlegen({ werkId });

    const res = await feedbackPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/pruefrunden/${prId}/feedback`,
        sessionId: sid,
        body: VALID_BODY,
      }),
      { params: Promise.resolve({ id: prId }) },
    );
    expect(res.status).toBe(422);
    const data = (await res.json()) as { error: { code: string } };
    expect(data.error.code).toBe('eigenes_werk');
  });

  it('Validierung: gesamteindruck fehlt → 422', async () => {
    const inhaberId = await macherAnlegen({
      email: 'fb-inhaber-6@test.werkzirkel.de',
    });
    const werkId = await werkAnlegen(inhaberId);
    const prId = await pruefrundeAnlegen({ werkId });

    const testerId = await macherAnlegen({
      email: 'fb-tester-6@test.werkzirkel.de',
    });
    const sid = await sessionAnlegen(testerId);
    await db.insert(pruefrundenAnmeldung).values({
      pruefrundeId: prId,
      testerId,
      status: 'angemeldet',
    });

    const res = await feedbackPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/pruefrunden/${prId}/feedback`,
        sessionId: sid,
        body: { erster_eindruck: 'kurz' },
      }),
      { params: Promise.resolve({ id: prId }) },
    );
    expect(res.status).toBe(422);
    const data = (await res.json()) as { fehler: string };
    expect(data.fehler).toBe('validierung');
  });

  it('Ohne Session → 401', async () => {
    const inhaberId = await macherAnlegen({
      email: 'fb-inhaber-7@test.werkzirkel.de',
    });
    const werkId = await werkAnlegen(inhaberId);
    const prId = await pruefrundeAnlegen({ werkId });

    const res = await feedbackPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/pruefrunden/${prId}/feedback`,
        body: VALID_BODY,
      }),
      { params: Promise.resolve({ id: prId }) },
    );
    expect(res.status).toBe(401);
  });

  it('Ohne macher-Rolle → 403 rolle_fehlt', async () => {
    const inhaberId = await macherAnlegen({
      email: 'fb-inhaber-8@test.werkzirkel.de',
    });
    const werkId = await werkAnlegen(inhaberId);
    const prId = await pruefrundeAnlegen({ werkId });

    const bedarfId = await macherAnlegen({
      email: 'fb-bedarf-8@test.werkzirkel.de',
      rollen: ['bedarfstraeger'],
    });
    const sid = await sessionAnlegen(bedarfId);

    const res = await feedbackPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/pruefrunden/${prId}/feedback`,
        sessionId: sid,
        body: VALID_BODY,
      }),
      { params: Promise.resolve({ id: prId }) },
    );
    expect(res.status).toBe(403);
    const data = (await res.json()) as { error: { code: string } };
    expect(data.error.code).toBe('rolle_fehlt');
  });
});
