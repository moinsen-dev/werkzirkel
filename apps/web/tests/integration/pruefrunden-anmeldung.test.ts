/**
 * Integration-Tests fuer die Pruefrunde-Anmeldung-API.
 *
 * Deckt PRD §F-203, §15.4, §8.4 (Slot-System):
 *  - POST anlegen + Slot-Check + Doppel-Anmeldung-Block + Eigentum-Block + Status-Check
 *  - DELETE Anmeldung in 'angemeldet' / 'feedback_gegeben'
 *  - GET Liste fuer Werk-Inhaber:in / 403 fuer Fremde
 *  - T-101-Versand im Mock-Mode (Eintrag in email_benachrichtigung_log)
 *
 * Methode wie in `pruefrunde-crud.test.ts`: Route-Handler direkt importieren,
 * synthetische `Request`-Objekte mit Cookie + Origin-Header.
 */

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createId } from '@paralleldrive/cuid2';
import { and, eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import {
  emailBenachrichtigungLog,
  nutzer,
  pruefrunde,
  pruefrundenAnmeldung,
  session as sessionTable,
  werk,
} from '@/lib/db/schema';
import { env } from '@/lib/env';
import { buildSessionCookie } from '@/lib/auth/session';

import {
  POST as anmeldungPost,
  DELETE as anmeldungDelete,
} from '@/app/api/v1/pruefrunden/[id]/anmeldung/route';
import { GET as anmeldungenGet } from '@/app/api/v1/pruefrunden/[id]/anmeldungen/route';

import { truncateAll } from '../_helpers/db-cleanup';

const APP_ORIGIN = new URL(env.APP_URL).origin;

async function macherAnlegen(opts: {
  email: string;
  stadtId?: string;
  anzeigename?: string;
}): Promise<string> {
  const id = createId();
  await db.insert(nutzer).values({
    id,
    email: opts.email,
    klarname: `Klar ${opts.email}`,
    anzeigename: opts.anzeigename ?? `anz-${id.slice(0, 6)}`,
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

async function pruefrundeAnlegen(opts: {
  werkId: string;
  status?: 'entwurf' | 'oeffentlich' | 'geschlossen' | 'abgeschlossen';
  gesuchteTester?: number;
  titel?: string;
}): Promise<string> {
  const id = createId();
  await db.insert(pruefrunde).values({
    id,
    werkId: opts.werkId,
    titel: opts.titel ?? 'Eine Test-Pruefrunde',
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
  method: 'GET' | 'POST' | 'DELETE';
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

describe('POST /api/v1/pruefrunden/:id/anmeldung', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  it('Tester:in meldet sich an → 201 + T-101 wird versendet', async () => {
    const inhaberEmail = 'inhaber-1@test.werkzirkel.de';
    const inhaberId = await macherAnlegen({
      email: inhaberEmail,
      anzeigename: 'Inhaber Eins',
    });
    const werkId = await werkAnlegen(inhaberId);
    const prId = await pruefrundeAnlegen({ werkId });

    const testerId = await macherAnlegen({
      email: 'tester-1@test.werkzirkel.de',
      anzeigename: 'Tester Eins',
    });
    const testerSid = await sessionAnlegen(testerId);

    const res = await anmeldungPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/pruefrunden/${prId}/anmeldung`,
        sessionId: testerSid,
      }),
      { params: Promise.resolve({ id: prId }) },
    );
    expect(res.status).toBe(201);
    const data = (await res.json()) as {
      anmeldung: { id: string; status: string; tester_id: string };
      counts: { angemeldet: number; gesuchte_tester: number };
    };
    expect(data.anmeldung.status).toBe('angemeldet');
    expect(data.anmeldung.tester_id).toBe(testerId);
    expect(data.counts.angemeldet).toBe(1);
    expect(data.counts.gesuchte_tester).toBe(3);

    // DB-Assertion: pruefrunden_anmeldung-Row existiert.
    const rows = await db
      .select()
      .from(pruefrundenAnmeldung)
      .where(
        and(
          eq(pruefrundenAnmeldung.pruefrundeId, prId),
          eq(pruefrundenAnmeldung.testerId, testerId),
        ),
      );
    expect(rows.length).toBe(1);
    expect(rows[0]?.status).toBe('angemeldet');

    // T-101-Eintrag im email_benachrichtigung_log.
    const mailLog = await db
      .select()
      .from(emailBenachrichtigungLog)
      .where(eq(emailBenachrichtigungLog.template, 'T-101'));
    expect(mailLog.length).toBe(1);
    expect(mailLog[0]?.email).toBe(inhaberEmail);
    expect(mailLog[0]?.nutzerId).toBe(inhaberId);
    expect(mailLog[0]?.status).toBe('gesendet');
  });

  it('Doppel-Anmeldung → 422 bereits_angemeldet', async () => {
    const inhaberId = await macherAnlegen({
      email: 'inhaber-2@test.werkzirkel.de',
    });
    const werkId = await werkAnlegen(inhaberId);
    const prId = await pruefrundeAnlegen({ werkId });

    const testerId = await macherAnlegen({
      email: 'tester-2@test.werkzirkel.de',
    });
    const sid = await sessionAnlegen(testerId);

    const first = await anmeldungPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/pruefrunden/${prId}/anmeldung`,
        sessionId: sid,
      }),
      { params: Promise.resolve({ id: prId }) },
    );
    expect(first.status).toBe(201);

    const second = await anmeldungPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/pruefrunden/${prId}/anmeldung`,
        sessionId: sid,
      }),
      { params: Promise.resolve({ id: prId }) },
    );
    expect(second.status).toBe(422);
    const data = (await second.json()) as { error: { code: string } };
    expect(data.error.code).toBe('bereits_angemeldet');
  });

  it('Werk-Inhaber:in meldet sich an eigener Pruefrunde an → 422 eigenes_werk', async () => {
    const inhaberId = await macherAnlegen({
      email: 'inhaber-3@test.werkzirkel.de',
    });
    const sid = await sessionAnlegen(inhaberId);
    const werkId = await werkAnlegen(inhaberId);
    const prId = await pruefrundeAnlegen({ werkId });

    const res = await anmeldungPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/pruefrunden/${prId}/anmeldung`,
        sessionId: sid,
      }),
      { params: Promise.resolve({ id: prId }) },
    );
    expect(res.status).toBe(422);
    const data = (await res.json()) as { error: { code: string } };
    expect(data.error.code).toBe('eigenes_werk');
  });

  it('Pruefrunde im Status entwurf → 422 falscher_status', async () => {
    const inhaberId = await macherAnlegen({
      email: 'inhaber-4@test.werkzirkel.de',
    });
    const werkId = await werkAnlegen(inhaberId);
    const prId = await pruefrundeAnlegen({ werkId, status: 'entwurf' });

    const testerId = await macherAnlegen({
      email: 'tester-4@test.werkzirkel.de',
    });
    const sid = await sessionAnlegen(testerId);

    const res = await anmeldungPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/pruefrunden/${prId}/anmeldung`,
        sessionId: sid,
      }),
      { params: Promise.resolve({ id: prId }) },
    );
    expect(res.status).toBe(422);
    const data = (await res.json()) as { error: { code: string } };
    expect(data.error.code).toBe('falscher_status');
  });

  it('Slot voll → 422 pruefrunde_voll', async () => {
    const inhaberId = await macherAnlegen({
      email: 'inhaber-5@test.werkzirkel.de',
    });
    const werkId = await werkAnlegen(inhaberId);
    // gesuchteTester=2 + 2 Anmeldungen vorher seeden → naechste muss 422 sein.
    const prId = await pruefrundeAnlegen({ werkId, gesuchteTester: 2 });

    const tester1 = await macherAnlegen({
      email: 'tester-5a@test.werkzirkel.de',
    });
    const tester2 = await macherAnlegen({
      email: 'tester-5b@test.werkzirkel.de',
    });
    await db.insert(pruefrundenAnmeldung).values([
      { pruefrundeId: prId, testerId: tester1, status: 'angemeldet' },
      { pruefrundeId: prId, testerId: tester2, status: 'feedback_gegeben' },
    ]);

    const tester3 = await macherAnlegen({
      email: 'tester-5c@test.werkzirkel.de',
    });
    const sid = await sessionAnlegen(tester3);

    const res = await anmeldungPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/pruefrunden/${prId}/anmeldung`,
        sessionId: sid,
      }),
      { params: Promise.resolve({ id: prId }) },
    );
    expect(res.status).toBe(422);
    const data = (await res.json()) as { error: { code: string } };
    expect(data.error.code).toBe('pruefrunde_voll');
  });

  it('ohne Session → 401', async () => {
    const inhaberId = await macherAnlegen({
      email: 'inhaber-6@test.werkzirkel.de',
    });
    const werkId = await werkAnlegen(inhaberId);
    const prId = await pruefrundeAnlegen({ werkId });

    const res = await anmeldungPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/pruefrunden/${prId}/anmeldung`,
      }),
      { params: Promise.resolve({ id: prId }) },
    );
    expect(res.status).toBe(401);
  });

  it('nicht-existente Pruefrunde → 404', async () => {
    const testerId = await macherAnlegen({
      email: 'tester-7@test.werkzirkel.de',
    });
    const sid = await sessionAnlegen(testerId);

    const res = await anmeldungPost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/pruefrunden/does-not-exist/anmeldung',
        sessionId: sid,
      }),
      { params: Promise.resolve({ id: 'does-not-exist' }) },
    );
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/v1/pruefrunden/:id/anmeldung', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  it('Anmeldung in status=angemeldet zuruecknehmen → 204', async () => {
    const inhaberId = await macherAnlegen({
      email: 'd-inhaber-1@test.werkzirkel.de',
    });
    const werkId = await werkAnlegen(inhaberId);
    const prId = await pruefrundeAnlegen({ werkId });

    const testerId = await macherAnlegen({
      email: 'd-tester-1@test.werkzirkel.de',
    });
    const sid = await sessionAnlegen(testerId);
    await db.insert(pruefrundenAnmeldung).values({
      pruefrundeId: prId,
      testerId,
      status: 'angemeldet',
    });

    const res = await anmeldungDelete(
      buildRequest({
        method: 'DELETE',
        path: `/api/v1/pruefrunden/${prId}/anmeldung`,
        sessionId: sid,
      }),
      { params: Promise.resolve({ id: prId }) },
    );
    expect(res.status).toBe(204);

    const rows = await db
      .select()
      .from(pruefrundenAnmeldung)
      .where(
        and(
          eq(pruefrundenAnmeldung.pruefrundeId, prId),
          eq(pruefrundenAnmeldung.testerId, testerId),
        ),
      );
    expect(rows.length).toBe(0);
  });

  it('Anmeldung in status=feedback_gegeben → 422 feedback_bereits_gegeben', async () => {
    const inhaberId = await macherAnlegen({
      email: 'd-inhaber-2@test.werkzirkel.de',
    });
    const werkId = await werkAnlegen(inhaberId);
    const prId = await pruefrundeAnlegen({ werkId });

    const testerId = await macherAnlegen({
      email: 'd-tester-2@test.werkzirkel.de',
    });
    const sid = await sessionAnlegen(testerId);
    await db.insert(pruefrundenAnmeldung).values({
      pruefrundeId: prId,
      testerId,
      status: 'feedback_gegeben',
    });

    const res = await anmeldungDelete(
      buildRequest({
        method: 'DELETE',
        path: `/api/v1/pruefrunden/${prId}/anmeldung`,
        sessionId: sid,
      }),
      { params: Promise.resolve({ id: prId }) },
    );
    expect(res.status).toBe(422);
    const data = (await res.json()) as { error: { code: string } };
    expect(data.error.code).toBe('feedback_bereits_gegeben');
  });

  it('keine Anmeldung vorhanden → 404', async () => {
    const inhaberId = await macherAnlegen({
      email: 'd-inhaber-3@test.werkzirkel.de',
    });
    const werkId = await werkAnlegen(inhaberId);
    const prId = await pruefrundeAnlegen({ werkId });

    const testerId = await macherAnlegen({
      email: 'd-tester-3@test.werkzirkel.de',
    });
    const sid = await sessionAnlegen(testerId);

    const res = await anmeldungDelete(
      buildRequest({
        method: 'DELETE',
        path: `/api/v1/pruefrunden/${prId}/anmeldung`,
        sessionId: sid,
      }),
      { params: Promise.resolve({ id: prId }) },
    );
    expect(res.status).toBe(404);
  });

  it('ohne Session → 401', async () => {
    const res = await anmeldungDelete(
      buildRequest({
        method: 'DELETE',
        path: '/api/v1/pruefrunden/whatever/anmeldung',
      }),
      { params: Promise.resolve({ id: 'whatever' }) },
    );
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/pruefrunden/:id/anmeldungen', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  it('Werk-Inhaber:in → 200 mit Liste', async () => {
    const inhaberId = await macherAnlegen({
      email: 'g-inhaber-1@test.werkzirkel.de',
    });
    const sid = await sessionAnlegen(inhaberId);
    const werkId = await werkAnlegen(inhaberId);
    const prId = await pruefrundeAnlegen({ werkId });

    const tester1 = await macherAnlegen({
      email: 'g-tester-1@test.werkzirkel.de',
      anzeigename: 'Anonyme A',
    });
    const tester2 = await macherAnlegen({
      email: 'g-tester-2@test.werkzirkel.de',
      anzeigename: 'Anonyme B',
    });
    await db.insert(pruefrundenAnmeldung).values([
      { pruefrundeId: prId, testerId: tester1, status: 'angemeldet' },
      {
        pruefrundeId: prId,
        testerId: tester2,
        status: 'feedback_gegeben',
      },
    ]);

    const res = await anmeldungenGet(
      buildRequest({
        method: 'GET',
        path: `/api/v1/pruefrunden/${prId}/anmeldungen`,
        sessionId: sid,
      }),
      { params: Promise.resolve({ id: prId }) },
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      anmeldungen: Array<{
        id: string;
        status: string;
        tester: {
          id: string;
          anzeigename: string;
          stadt_id: string;
        };
      }>;
    };
    expect(data.anmeldungen.length).toBe(2);
    const namen = data.anmeldungen.map((a) => a.tester.anzeigename).sort();
    expect(namen).toEqual(['Anonyme A', 'Anonyme B']);
    const stati = data.anmeldungen.map((a) => a.status).sort();
    expect(stati).toEqual(['angemeldet', 'feedback_gegeben']);
  });

  it('fremder Nutzer → 403 kein_zugriff', async () => {
    const inhaberId = await macherAnlegen({
      email: 'g-inhaber-2@test.werkzirkel.de',
    });
    const werkId = await werkAnlegen(inhaberId);
    const prId = await pruefrundeAnlegen({ werkId });

    const fremdId = await macherAnlegen({
      email: 'g-fremd@test.werkzirkel.de',
    });
    const sid = await sessionAnlegen(fremdId);

    const res = await anmeldungenGet(
      buildRequest({
        method: 'GET',
        path: `/api/v1/pruefrunden/${prId}/anmeldungen`,
        sessionId: sid,
      }),
      { params: Promise.resolve({ id: prId }) },
    );
    expect(res.status).toBe(403);
    const data = (await res.json()) as { error: { code: string } };
    expect(data.error.code).toBe('kein_zugriff');
  });

  it('ohne Session → 401', async () => {
    const res = await anmeldungenGet(
      buildRequest({
        method: 'GET',
        path: '/api/v1/pruefrunden/whatever/anmeldungen',
      }),
      { params: Promise.resolve({ id: 'whatever' }) },
    );
    expect(res.status).toBe(401);
  });

  it('nicht-existente Pruefrunde → 404', async () => {
    const id = await macherAnlegen({ email: 'g-x@test.werkzirkel.de' });
    const sid = await sessionAnlegen(id);

    const res = await anmeldungenGet(
      buildRequest({
        method: 'GET',
        path: '/api/v1/pruefrunden/does-not-exist/anmeldungen',
        sessionId: sid,
      }),
      { params: Promise.resolve({ id: 'does-not-exist' }) },
    );
    expect(res.status).toBe(404);
  });
});
