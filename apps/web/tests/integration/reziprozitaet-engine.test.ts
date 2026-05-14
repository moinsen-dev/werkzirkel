/**
 * Unit-Tests der Reziprozitaets-Engine.
 *
 * Verifiziert PRD §17 (kannPruefrundeStarten, feedbackGegeben,
 * feedbackErhalten):
 *  - Saldo-Auto-Init via ensureSaldoRow
 *  - 0-Saldo → neue Verpflichtung, frist = pruefrunde.frist + 14d
 *  - 2/0 Saldo → 'saldo_erfuellt' ohne neue Verpflichtung
 *  - Abgelaufene Verpflichtung → 'frist_abgelaufen'
 *  - 3 offene Verpflichtungen → naechste_verpflichtung_frist = MIN(fristen)
 *  - feedbackGegeben inkrementiert tests_gegeben
 *  - feedbackGegeben mit offener Verpflichtung → schliesst aelteste,
 *    aktualisiert offene_anzahl + naechste_frist
 *  - feedbackGegeben ohne offene Verpflichtung → nur tests_gegeben++
 *
 * Race-Test (parallele feedbackGegeben) liegt in der Integration-Suite —
 * dort haben wir die echte Postgres-Concurrency, was happy-dom nicht
 * simulieren kann.
 */

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createId } from '@paralleldrive/cuid2';
import { and, eq, inArray } from 'drizzle-orm';

import { db } from '@/lib/db';
import {
  feedback as feedbackTable,
  nutzer,
  pruefrunde,
  pruefrundenVerpflichtung,
  testSaldo,
  werk,
} from '@/lib/db/schema';
import {
  berechneVerpflichtungsFrist,
  feedbackErhalten,
  feedbackGegeben,
  getSaldoForUser,
  kannPruefrundeStarten,
} from '@/lib/reziprozitaet/engine';
import { truncateAll } from '../_helpers/db-cleanup';

const TEST_EMAILS = [
  'rezi-unit-tester@test.werkzirkel.de',
  'rezi-unit-inhaber@test.werkzirkel.de',
];

interface Setup {
  testerId: string;
  werkInhaberId: string;
  pruefrundeId: string;
  pruefrundeFrist: Date;
}

async function setupNutzerUndPruefrunde(): Promise<Setup> {
  const testerId = createId();
  await db.insert(nutzer).values({
    id: testerId,
    email: TEST_EMAILS[0]!,
    klarname: 'Rezi Tester',
    anzeigename: 'rezi-tester',
    stadtId: 'hh',
    rollen: ['macher'],
    emailVerifiziertAm: new Date(),
  });
  const werkInhaberId = createId();
  await db.insert(nutzer).values({
    id: werkInhaberId,
    email: TEST_EMAILS[1]!,
    klarname: 'Werk Inhaber',
    anzeigename: 'werk-inhaber',
    stadtId: 'hh',
    rollen: ['macher'],
    emailVerifiziertAm: new Date(),
  });
  const werkId = createId();
  await db.insert(werk).values({
    id: werkId,
    nutzerId: werkInhaberId,
    name: 'Rezi Werk',
    kurzbeschreibung: 'k',
    problem: 'p',
    zielgruppe: 'z',
    werkstand: 'idee',
  });
  const pruefrundeId = createId();
  const pruefrundeFrist = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await db.insert(pruefrunde).values({
    id: pruefrundeId,
    werkId,
    titel: 't',
    testziel: 'tz',
    testaufgabe: 'ta',
    zielgruppe: 'z',
    zeitbedarfMinuten: 30,
    gesuchteTester: 3,
    feedbackKategorien: ['erster_eindruck'],
    frist: pruefrundeFrist,
    status: 'oeffentlich',
  });
  return { testerId, werkInhaberId, pruefrundeId, pruefrundeFrist };
}

async function cleanup(): Promise<void> {
  await truncateAll();
}

describe('Reziprozitaets-Engine', () => {
  beforeEach(cleanup);
  afterAll(cleanup);

  describe('berechneVerpflichtungsFrist', () => {
    it('addiert genau 14 Tage auf die Pruefrunden-Frist', () => {
      const basis = new Date('2026-06-01T10:00:00.000Z');
      const ergebnis = berechneVerpflichtungsFrist(basis);
      expect(ergebnis.toISOString()).toBe('2026-06-15T10:00:00.000Z');
    });
  });

  describe('kannPruefrundeStarten', () => {
    it('mit verpflichtung_akzeptiert=true bei 0-Saldo: legt test_saldo lazy an und erzeugt neue Verpflichtung', async () => {
      const { testerId, pruefrundeId, pruefrundeFrist } =
        await setupNutzerUndPruefrunde();

      const result = await kannPruefrundeStarten(
        testerId,
        pruefrundeFrist,
        pruefrundeId,
        undefined,
        { verpflichtung_akzeptiert: true },
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.modus).toBe('neue_verpflichtung');
      if (result.modus !== 'neue_verpflichtung') return;
      expect(result.verpflichtungs_id).toBeTruthy();
      // Frist = pruefrunde.frist + 14 Tage
      const erwartet = berechneVerpflichtungsFrist(pruefrundeFrist);
      expect(result.frist.toISOString()).toBe(erwartet.toISOString());

      // Saldo-Row jetzt vorhanden + Verpflichtung gezaehlt
      const saldo = await getSaldoForUser(testerId);
      expect(saldo.tests_gegeben).toBe(0);
      expect(saldo.offene_verpflichtung_anzahl).toBe(1);
      expect(saldo.naechste_verpflichtung_frist?.toISOString()).toBe(
        erwartet.toISOString(),
      );

      // DB-Verpflichtungs-Row passt
      const rows = await db
        .select()
        .from(pruefrundenVerpflichtung)
        .where(eq(pruefrundenVerpflichtung.nutzerId, testerId));
      expect(rows.length).toBe(1);
      expect(rows[0]!.status).toBe('offen');
      expect(rows[0]!.ausPruefrundeId).toBe(pruefrundeId);
    });

    it('mit tests_gegeben >= 2 → saldo_erfuellt, keine neue Verpflichtung', async () => {
      const { testerId, pruefrundeId, pruefrundeFrist } =
        await setupNutzerUndPruefrunde();

      // Saldo direkt auf 2 setzen
      await db.insert(testSaldo).values({
        nutzerId: testerId,
        testsGegeben: 2,
      });

      const result = await kannPruefrundeStarten(
        testerId,
        pruefrundeFrist,
        pruefrundeId,
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.modus).toBe('saldo_erfuellt');
      if (result.modus !== 'saldo_erfuellt') return;
      expect(result.tests_gegeben).toBe(2);

      // Keine Verpflichtung entstanden
      const rows = await db
        .select()
        .from(pruefrundenVerpflichtung)
        .where(eq(pruefrundenVerpflichtung.nutzerId, testerId));
      expect(rows.length).toBe(0);
    });

    it('mit offener abgelaufener Verpflichtung → blockiert (frist_abgelaufen)', async () => {
      const { testerId, pruefrundeId, pruefrundeFrist } =
        await setupNutzerUndPruefrunde();

      // Abgelaufene Verpflichtung (frist=gestern) einseeden
      await db.insert(pruefrundenVerpflichtung).values({
        nutzerId: testerId,
        ausPruefrundeId: pruefrundeId,
        frist: new Date(Date.now() - 24 * 60 * 60 * 1000),
        status: 'offen',
      });

      const result = await kannPruefrundeStarten(
        testerId,
        pruefrundeFrist,
        pruefrundeId,
      );
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.grund).toBe('frist_abgelaufen');
      expect(result.offene_anzahl).toBe(1);
    });

    it('default ohne verpflichtung_akzeptiert bei 0-Saldo → blockiert mit saldo_zu_niedrig', async () => {
      // PRD §8.4: das Reziprozitäts-Gate muss eine bewusste Wahl erzwingen
      // (zuerst Feedback geben ODER explizit Verpflichtung eingehen).
      // Ohne expliziten Opt-In darf die Engine keine Verpflichtung anlegen.
      const { testerId, pruefrundeId, pruefrundeFrist } =
        await setupNutzerUndPruefrunde();

      const result = await kannPruefrundeStarten(
        testerId,
        pruefrundeFrist,
        pruefrundeId,
      );
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.grund).toBe('saldo_zu_niedrig');
      if (result.grund !== 'saldo_zu_niedrig') return;
      expect(result.tests_gegeben).toBe(0);

      // Keine Verpflichtung wurde angelegt
      const rows = await db
        .select()
        .from(pruefrundenVerpflichtung)
        .where(eq(pruefrundenVerpflichtung.nutzerId, testerId));
      expect(rows.length).toBe(0);
    });

    it('drei offene Verpflichtungen + Opt-In → naechste_verpflichtung_frist = MIN(fristen)', async () => {
      const { testerId, pruefrundeId, pruefrundeFrist } =
        await setupNutzerUndPruefrunde();

      const fristen = [
        new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
        new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // <- frueheste
        new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      ];
      for (const f of fristen) {
        await db.insert(pruefrundenVerpflichtung).values({
          nutzerId: testerId,
          ausPruefrundeId: pruefrundeId,
          frist: f,
          status: 'offen',
        });
      }
      await db
        .insert(testSaldo)
        .values({
          nutzerId: testerId,
          offeneVerpflichtungAnzahl: 3,
          naechsteVerpflichtungFrist: fristen[1]!, // schon korrekt
        });

      // Jetzt eine weitere Pruefrunde starten — kein Saldo, keine
      // abgelaufene Frist, also wird mit Opt-In eine NEUE Verpflichtung
      // angelegt.
      const result = await kannPruefrundeStarten(
        testerId,
        pruefrundeFrist,
        pruefrundeId,
        undefined,
        { verpflichtung_akzeptiert: true },
      );
      expect(result.ok).toBe(true);
      if (!result.ok || result.modus !== 'neue_verpflichtung') return;

      const saldo = await getSaldoForUser(testerId);
      expect(saldo.offene_verpflichtung_anzahl).toBe(4);
      // naechste_verpflichtung_frist bleibt die frueheste = fristen[1]
      expect(saldo.naechste_verpflichtung_frist?.toISOString()).toBe(
        fristen[1]!.toISOString(),
      );
    });
  });

  describe('feedbackGegeben', () => {
    it('inkrementiert tests_gegeben (ohne offene Verpflichtung)', async () => {
      const { testerId, werkInhaberId, pruefrundeId } =
        await setupNutzerUndPruefrunde();
      const feedbackId = createId();
      await db.insert(feedbackTable).values({
        id: feedbackId,
        pruefrundeId,
        testerId,
        gesamteindruck: 'super',
      });

      await feedbackGegeben(testerId, feedbackId);

      const saldo = await getSaldoForUser(testerId);
      expect(saldo.tests_gegeben).toBe(1);
      expect(saldo.offene_verpflichtung_anzahl).toBe(0);
      expect(saldo.naechste_verpflichtung_frist).toBeNull();
      void werkInhaberId;
    });

    it('schliesst aelteste offene Verpflichtung + recomputed offene_anzahl', async () => {
      const { testerId, pruefrundeId } = await setupNutzerUndPruefrunde();

      const fristAelt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      const fristNeu = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
      const idAelt = createId();
      const idNeu = createId();
      await db.insert(pruefrundenVerpflichtung).values([
        {
          id: idAelt,
          nutzerId: testerId,
          ausPruefrundeId: pruefrundeId,
          frist: fristAelt,
          status: 'offen',
        },
        {
          id: idNeu,
          nutzerId: testerId,
          ausPruefrundeId: pruefrundeId,
          frist: fristNeu,
          status: 'offen',
        },
      ]);
      await db.insert(testSaldo).values({
        nutzerId: testerId,
        offeneVerpflichtungAnzahl: 2,
        naechsteVerpflichtungFrist: fristAelt,
      });

      // Feedback-Row anlegen (FK-Ziel fuer erfuellt_durch_feedback_id)
      const feedbackId = createId();
      await db.insert(feedbackTable).values({
        id: feedbackId,
        pruefrundeId,
        testerId,
        gesamteindruck: 'gut',
      });

      await feedbackGegeben(testerId, feedbackId);

      // tests_gegeben hoch
      const saldo = await getSaldoForUser(testerId);
      expect(saldo.tests_gegeben).toBe(1);
      // offene_anzahl runter
      expect(saldo.offene_verpflichtung_anzahl).toBe(1);
      // naechste_frist jetzt = fristNeu (alte ist weg)
      expect(saldo.naechste_verpflichtung_frist?.toISOString()).toBe(
        fristNeu.toISOString(),
      );

      // Aelteste Verpflichtung jetzt 'erfuellt'
      const aelt = await db
        .select()
        .from(pruefrundenVerpflichtung)
        .where(eq(pruefrundenVerpflichtung.id, idAelt));
      expect(aelt[0]!.status).toBe('erfuellt');
      expect(aelt[0]!.erfuelltDurchFeedbackId).toBe(feedbackId);
      // Neuere bleibt 'offen'
      const neu = await db
        .select()
        .from(pruefrundenVerpflichtung)
        .where(eq(pruefrundenVerpflichtung.id, idNeu));
      expect(neu[0]!.status).toBe('offen');
    });

    it('mehrfacher Aufruf inkrementiert tests_gegeben korrekt', async () => {
      const { testerId, pruefrundeId } = await setupNutzerUndPruefrunde();
      const f1 = createId();
      const f2 = createId();
      await db.insert(feedbackTable).values([
        { id: f1, pruefrundeId, testerId, gesamteindruck: 'a' },
      ]);
      await feedbackGegeben(testerId, f1);
      // Zweite Pruefrunde anlegen, um doppelte (pruefrundeId, testerId)
      // Unique-Constraint zu umgehen — eigentlich erlaubt das DB-Schema
      // pro pruefrunde nur ein feedback pro tester. Wir nutzen also eine
      // zweite Pruefrunde.
      const werkInhaberRow = await db
        .select()
        .from(nutzer)
        .where(eq(nutzer.email, TEST_EMAILS[1]!));
      const werkRow = await db
        .select()
        .from(werk)
        .where(eq(werk.nutzerId, werkInhaberRow[0]!.id));
      const pruefrunde2Id = createId();
      await db.insert(pruefrunde).values({
        id: pruefrunde2Id,
        werkId: werkRow[0]!.id,
        titel: 't2',
        testziel: 'tz',
        testaufgabe: 'ta',
        zielgruppe: 'z',
        zeitbedarfMinuten: 30,
        gesuchteTester: 3,
        feedbackKategorien: ['erster_eindruck'],
        frist: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        status: 'oeffentlich',
      });
      await db.insert(feedbackTable).values([
        { id: f2, pruefrundeId: pruefrunde2Id, testerId, gesamteindruck: 'b' },
      ]);
      await feedbackGegeben(testerId, f2);

      const saldo = await getSaldoForUser(testerId);
      expect(saldo.tests_gegeben).toBe(2);
    });
  });

  describe('feedbackErhalten', () => {
    it('legt Saldo-Row an und inkrementiert tests_erhalten', async () => {
      const { werkInhaberId } = await setupNutzerUndPruefrunde();
      await feedbackErhalten(werkInhaberId, 1);
      const saldo = await getSaldoForUser(werkInhaberId);
      expect(saldo.tests_erhalten).toBe(1);
    });

    it('delta=0 ist No-Op und legt keine Row an', async () => {
      const { werkInhaberId } = await setupNutzerUndPruefrunde();
      await feedbackErhalten(werkInhaberId, 0);
      const rows = await db
        .select()
        .from(testSaldo)
        .where(eq(testSaldo.nutzerId, werkInhaberId));
      expect(rows.length).toBe(0);
    });
  });

  // sanity: alle imports referenziert
  it('schema-imports sanity', () => {
    void and;
    void inArray;
    expect(true).toBe(true);
  });
});
