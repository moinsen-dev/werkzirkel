/**
 * Race-Test der Reziprozitaets-Engine.
 *
 * Verifiziert: zwei parallele `feedbackGegeben`-Aufrufe duerfen
 *   - NICHT dieselbe Verpflichtung beide schliessen,
 *   - sondern jede schliesst genau EINE (die jeweils naechst-aelteste).
 *
 * Die Engine verwendet `FOR UPDATE SKIP LOCKED` beim Selektieren der
 * Verpflichtung; dieser Test stellt sicher, dass das Pattern bei echter
 * Postgres-Concurrency das gewuenschte Verhalten zeigt.
 *
 * Hintergrund: Mit `FOR UPDATE` (ohne SKIP LOCKED) wuerde Call B auf den
 * Lock von Call A warten und dann denselben Row sehen, ihn aber bereits
 * 'erfuellt' finden — was wir nicht-explizit handlen. SKIP LOCKED skippt
 * die A-Row und gibt Call B die naechste aelteste — sauber.
 */

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createId } from '@paralleldrive/cuid2';
import { eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import {
  feedback as feedbackTable,
  nutzer,
  pruefrunde,
  pruefrundenVerpflichtung,
  werk,
} from '@/lib/db/schema';
import { feedbackGegeben, getSaldoForUser } from '@/lib/reziprozitaet/engine';
import { truncateAll } from '../_helpers/db-cleanup';

const TESTER_EMAIL = 'rezi-race-tester@test.werkzirkel.de';
const INHABER_EMAIL = 'rezi-race-inhaber@test.werkzirkel.de';

interface RaceSetup {
  testerId: string;
  pruefrunde1Id: string;
  pruefrunde2Id: string;
  feedback1Id: string;
  feedback2Id: string;
  verpfl1Id: string;
  verpfl2Id: string;
}

async function setupRaceScenario(): Promise<RaceSetup> {
  const testerId = createId();
  await db.insert(nutzer).values({
    id: testerId,
    email: TESTER_EMAIL,
    klarname: 'Race Tester',
    anzeigename: 'race-tester',
    stadtId: 'hh',
    rollen: ['macher'],
    emailVerifiziertAm: new Date(),
  });
  const inhaberId = createId();
  await db.insert(nutzer).values({
    id: inhaberId,
    email: INHABER_EMAIL,
    klarname: 'Race Inhaber',
    anzeigename: 'race-inhaber',
    stadtId: 'hh',
    rollen: ['macher'],
    emailVerifiziertAm: new Date(),
  });
  const werkId = createId();
  await db.insert(werk).values({
    id: werkId,
    nutzerId: inhaberId,
    name: 'Race-Werk',
    kurzbeschreibung: 'k',
    problem: 'p',
    zielgruppe: 'z',
    werkstand: 'idee',
  });

  // Zwei Pruefrunden anlegen (fuer die zwei Feedbacks des Testers).
  const pruefrunde1Id = createId();
  const pruefrunde2Id = createId();
  for (const id of [pruefrunde1Id, pruefrunde2Id]) {
    await db.insert(pruefrunde).values({
      id,
      werkId,
      titel: `pr-${id.slice(0, 6)}`,
      testziel: 'tz',
      testaufgabe: 'ta',
      zielgruppe: 'z',
      zeitbedarfMinuten: 30,
      gesuchteTester: 3,
      feedbackKategorien: ['erster_eindruck'],
      frist: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      status: 'oeffentlich',
    });
  }

  // Zwei offene Verpflichtungen — beide muessen geschlossen werden.
  const verpfl1Id = createId();
  const verpfl2Id = createId();
  await db.insert(pruefrundenVerpflichtung).values([
    {
      id: verpfl1Id,
      nutzerId: testerId,
      ausPruefrundeId: pruefrunde1Id,
      frist: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      status: 'offen',
    },
    {
      id: verpfl2Id,
      nutzerId: testerId,
      ausPruefrundeId: pruefrunde2Id,
      frist: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      status: 'offen',
    },
  ]);

  // Zwei Feedbacks — eines pro Pruefrunde.
  const feedback1Id = createId();
  const feedback2Id = createId();
  await db.insert(feedbackTable).values([
    {
      id: feedback1Id,
      pruefrundeId: pruefrunde1Id,
      testerId,
      gesamteindruck: 'a',
    },
    {
      id: feedback2Id,
      pruefrundeId: pruefrunde2Id,
      testerId,
      gesamteindruck: 'b',
    },
  ]);

  return {
    testerId,
    pruefrunde1Id,
    pruefrunde2Id,
    feedback1Id,
    feedback2Id,
    verpfl1Id,
    verpfl2Id,
  };
}

describe('Reziprozitaets-Engine — Race (FOR UPDATE SKIP LOCKED)', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  it('zwei parallele feedbackGegeben-Calls schliessen JEDE eine Verpflichtung — nicht doppelt dieselbe', async () => {
    const setup = await setupRaceScenario();

    // Beide Calls parallel feuern — Postgres-Locking entscheidet die
    // Reihenfolge intern. Wir verlangen NICHT, dass eine bestimmte Reihenfolge
    // gewonnen wird — nur dass am Ende BEIDE Verpflichtungen erfuellt sind.
    await Promise.all([
      feedbackGegeben(setup.testerId, setup.feedback1Id),
      feedbackGegeben(setup.testerId, setup.feedback2Id),
    ]);

    // tests_gegeben muss exakt 2 sein — pro Call genau ein Increment.
    const saldo = await getSaldoForUser(setup.testerId);
    expect(saldo.tests_gegeben).toBe(2);
    expect(saldo.offene_verpflichtung_anzahl).toBe(0);
    expect(saldo.naechste_verpflichtung_frist).toBeNull();

    // Beide Verpflichtungen 'erfuellt', jede mit einer verschiedenen
    // feedback_id verlinkt.
    const verpflRows = await db
      .select()
      .from(pruefrundenVerpflichtung)
      .where(eq(pruefrundenVerpflichtung.nutzerId, setup.testerId));
    expect(verpflRows.length).toBe(2);
    for (const r of verpflRows) {
      expect(r.status).toBe('erfuellt');
      expect(r.erfuelltDurchFeedbackId).toBeTruthy();
    }
    const linkedIds = verpflRows
      .map((r) => r.erfuelltDurchFeedbackId)
      .filter(Boolean) as string[];
    // Genau die zwei Feedback-IDs — keine Duplikate.
    expect(new Set(linkedIds).size).toBe(2);
    expect(linkedIds.sort()).toEqual(
      [setup.feedback1Id, setup.feedback2Id].sort(),
    );
  });
});
