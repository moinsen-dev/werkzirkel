/**
 * Integration-Tests fuer GET /api/v1/werke/:id/feedbacks-hilfreich (oeffentlich).
 *
 * Deckt PRD §F-206 + §8.4: anonyme oeffentliche Sicht auf hilfreich-markierte
 * Feedbacks. CRITICAL: KEINE tester_id, KEIN tester.anzeigename, KEIN tester.email
 * im JSON-Body — nur sequentielle Labels.
 *
 *  - Seed 3 Feedbacks (2 hilfreich, 1 nicht) → genau 2 in Response.
 *  - Response-Schema: tester_label statt tester-Objekt.
 *  - JSON enthaelt KEINE tester_id, KEIN anzeigename, KEIN email.
 *  - Werk ohne Feedbacks → 200 + leere Liste.
 *  - Werk nicht existent → 404.
 */

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createId } from '@paralleldrive/cuid2';

import { db } from '@/lib/db';
import {
  feedback,
  nutzer,
  pruefrunde,
  werk,
} from '@/lib/db/schema';
import { env } from '@/lib/env';

import { GET as publicGet } from '@/app/api/v1/werke/[id]/feedbacks-hilfreich/route';

import { truncateAll } from '../_helpers/db-cleanup';

const APP_ORIGIN = new URL(env.APP_URL).origin;

async function nutzerAnlegen(email: string, anzeigename: string): Promise<string> {
  const id = createId();
  await db.insert(nutzer).values({
    id,
    email,
    klarname: `Klar ${email}`,
    anzeigename,
    stadtId: 'hh',
    rollen: ['macher'],
    emailVerifiziertAm: new Date(),
  });
  return id;
}

function buildRequest(path: string): Request {
  return new Request(`${APP_ORIGIN}${path}`, {
    method: 'GET',
    headers: { 'content-type': 'application/json' },
  });
}

describe('GET /api/v1/werke/:id/feedbacks-hilfreich (public)', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  it('Liefert nur hilfreich-markierte Feedbacks, anonymisiert', async () => {
    const inhaberId = await nutzerAnlegen(
      'pub-inhaber@test.werkzirkel.de',
      'Inhaberin',
    );
    const werkId = createId();
    await db.insert(werk).values({
      id: werkId,
      nutzerId: inhaberId,
      name: 'Werk Public',
      kurzbeschreibung: 'k',
      problem: 'p',
      zielgruppe: 'z',
      werkstand: 'idee',
    });

    const prId = createId();
    await db.insert(pruefrunde).values({
      id: prId,
      werkId,
      titel: 'PR Public',
      testziel: 'Z',
      testaufgabe: 'A',
      zielgruppe: 'ZG',
      zeitbedarfMinuten: 30,
      gesuchteTester: 3,
      feedbackKategorien: ['erster_eindruck'],
      frist: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      status: 'oeffentlich',
    });

    const testerA = await nutzerAnlegen(
      'pub-tester-a@test.werkzirkel.de',
      'Geheimer Klarname A',
    );
    const testerB = await nutzerAnlegen(
      'pub-tester-b@test.werkzirkel.de',
      'Geheimer Klarname B',
    );
    const testerC = await nutzerAnlegen(
      'pub-tester-c@test.werkzirkel.de',
      'Geheimer Klarname C',
    );

    // 2 hilfreich, 1 nicht.
    await db.insert(feedback).values([
      {
        id: createId(),
        pruefrundeId: prId,
        testerId: testerA,
        gesamteindruck: 'A: hilfreich markiert.',
        ersterEindruck: 'A-Eindruck.',
        hilfreichMarkiert: true,
        hilfreichMarkiertAm: new Date(Date.now() - 2 * 60 * 60 * 1000),
      },
      {
        id: createId(),
        pruefrundeId: prId,
        testerId: testerB,
        gesamteindruck: 'B: hilfreich markiert.',
        hilfreichMarkiert: true,
        hilfreichMarkiertAm: new Date(Date.now() - 60 * 60 * 1000),
      },
      {
        id: createId(),
        pruefrundeId: prId,
        testerId: testerC,
        gesamteindruck: 'C: nicht hilfreich.',
        hilfreichMarkiert: false,
      },
    ]);

    const res = await publicGet(
      buildRequest(`/api/v1/werke/${werkId}/feedbacks-hilfreich`),
      { params: Promise.resolve({ id: werkId }) },
    );
    expect(res.status).toBe(200);
    const text = await res.text();
    const data = JSON.parse(text) as {
      feedbacks: Array<{
        id: string;
        tester_label: string;
        gesamteindruck: string;
      }>;
    };

    // Genau 2 hilfreich-markierte Feedbacks.
    expect(data.feedbacks.length).toBe(2);

    // Sequentielle Labels in Reihenfolge der Markierung.
    expect(data.feedbacks[0]?.tester_label).toBe('Tester:in 1');
    expect(data.feedbacks[1]?.tester_label).toBe('Tester:in 2');

    // Inhalte: hilfreich markierte. A wurde frueher markiert → erster Eintrag.
    expect(data.feedbacks[0]?.gesamteindruck).toBe('A: hilfreich markiert.');
    expect(data.feedbacks[1]?.gesamteindruck).toBe('B: hilfreich markiert.');

    // CRITICAL: JSON-Body enthaelt KEINE Tester-Identifier.
    expect(text).not.toContain('tester_id');
    expect(text).not.toContain('Geheimer Klarname');
    expect(text).not.toContain('pub-tester');
    expect(text).not.toContain('anzeigename');

    // Auch keine emails / inhaber-emails.
    expect(text).not.toContain('test.werkzirkel.de');
  });

  it('Werk ohne hilfreich-markierte Feedbacks → 200 leere Liste', async () => {
    const inhaberId = await nutzerAnlegen(
      'pub-inhaber-2@test.werkzirkel.de',
      'Inh 2',
    );
    const werkId = createId();
    await db.insert(werk).values({
      id: werkId,
      nutzerId: inhaberId,
      name: 'Werk Leer',
      kurzbeschreibung: 'k',
      problem: 'p',
      zielgruppe: 'z',
      werkstand: 'idee',
    });

    const res = await publicGet(
      buildRequest(`/api/v1/werke/${werkId}/feedbacks-hilfreich`),
      { params: Promise.resolve({ id: werkId }) },
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { feedbacks: unknown[] };
    expect(data.feedbacks).toEqual([]);
  });

  it('Nicht-existentes Werk → 404', async () => {
    const res = await publicGet(
      buildRequest('/api/v1/werke/does-not-exist/feedbacks-hilfreich'),
      { params: Promise.resolve({ id: 'does-not-exist' }) },
    );
    expect(res.status).toBe(404);
  });

  it('Aggregiert hilfreiche Feedbacks ueber mehrere Pruefrunden eines Werks', async () => {
    const inhaberId = await nutzerAnlegen(
      'pub-inhaber-3@test.werkzirkel.de',
      'Inh 3',
    );
    const werkId = createId();
    await db.insert(werk).values({
      id: werkId,
      nutzerId: inhaberId,
      name: 'Werk Multi',
      kurzbeschreibung: 'k',
      problem: 'p',
      zielgruppe: 'z',
      werkstand: 'idee',
    });

    const pr1 = createId();
    const pr2 = createId();
    await db.insert(pruefrunde).values([
      {
        id: pr1,
        werkId,
        titel: 'PR 1',
        testziel: 'Z',
        testaufgabe: 'A',
        zielgruppe: 'ZG',
        zeitbedarfMinuten: 30,
        gesuchteTester: 3,
        feedbackKategorien: ['erster_eindruck'],
        frist: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        status: 'oeffentlich',
      },
      {
        id: pr2,
        werkId,
        titel: 'PR 2',
        testziel: 'Z',
        testaufgabe: 'A',
        zielgruppe: 'ZG',
        zeitbedarfMinuten: 30,
        gesuchteTester: 3,
        feedbackKategorien: ['erster_eindruck'],
        frist: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        status: 'oeffentlich',
      },
    ]);

    const testerA = await nutzerAnlegen(
      'multi-tester-a@test.werkzirkel.de',
      'Multi A',
    );
    const testerB = await nutzerAnlegen(
      'multi-tester-b@test.werkzirkel.de',
      'Multi B',
    );

    await db.insert(feedback).values([
      {
        id: createId(),
        pruefrundeId: pr1,
        testerId: testerA,
        gesamteindruck: 'PR1-A',
        hilfreichMarkiert: true,
        hilfreichMarkiertAm: new Date(Date.now() - 60 * 60 * 1000),
      },
      {
        id: createId(),
        pruefrundeId: pr2,
        testerId: testerB,
        gesamteindruck: 'PR2-B',
        hilfreichMarkiert: true,
        hilfreichMarkiertAm: new Date(Date.now() - 30 * 60 * 1000),
      },
    ]);

    const res = await publicGet(
      buildRequest(`/api/v1/werke/${werkId}/feedbacks-hilfreich`),
      { params: Promise.resolve({ id: werkId }) },
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      feedbacks: Array<{ tester_label: string; gesamteindruck: string }>;
    };
    expect(data.feedbacks.length).toBe(2);
    expect(data.feedbacks.map((f) => f.gesamteindruck)).toEqual([
      'PR1-A',
      'PR2-B',
    ]);
  });
});
