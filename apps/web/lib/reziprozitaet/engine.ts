/**
 * Reziprozitaets-Engine — identitaetsbildende Mechanik von Werkzirkel
 * (PRD Prinzip P5, §17, §8.4 Reziprozitäts-Regel).
 *
 * Drei pure async-Funktionen:
 *
 *  - `kannPruefrundeStarten(nutzer_id, pruefrunde_frist, pruefrunde_id)`
 *    Prueft Test-Saldo. Wenn `tests_gegeben >= 2`: erlaubt ohne Verpflichtung.
 *    Sonst: erzeugt eine `pruefrunden_verpflichtung` mit Frist =
 *    `pruefrunde.frist + 14 Tage` und gibt sie zurueck. Existieren bereits
 *    abgelaufene offene Verpflichtungen → blockiert.
 *
 *  - `feedbackGegeben(tester_id, feedback_id)`
 *    Inkrementiert `tests_gegeben`. Schliesst aelteste offene Verpflichtung
 *    (FOR UPDATE) und re-aggregiert `offene_verpflichtung_anzahl` +
 *    `naechste_verpflichtung_frist`.
 *
 *  - `feedbackErhalten(werk_inhaber_id, delta)`
 *    Inkrementiert `tests_erhalten` um `delta`. Reine Materialisierung,
 *    keine Verpflichtungs-Logik (Empfangen ist asymmetrisch zum Geben).
 *
 * Alle DB-Writes laufen in `db.transaction(...)` mit FOR UPDATE-Sperren,
 * damit zwei parallele Calls nicht dieselbe Verpflichtung schliessen oder
 * den Saldo doppelt aufzehren (PRD §17 „Race-Conditions").
 *
 * Die Funktionen akzeptieren optional eine `Db`-Instanz (Test-Injection /
 * Outer-Transaktion). Default ist der globale `db`-Export.
 */

import { and, asc, desc, eq, lt, ne, notInArray, sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';

import { db as defaultDb } from '@/lib/db';
import {
  feedback,
  pruefrunde,
  pruefrundenVerpflichtung,
  testSaldo,
  werk,
} from '@/lib/db/schema';

import { ensureSaldoRow, recomputeSaldoVerpflichtungen } from './saldo';

// Anzahl Tage, die nach Ablauf der Pruefrunden-Frist auf die
// Verpflichtungs-Frist aufgeschlagen werden (PRD §17 / §8.4).
const VERPFLICHTUNGS_KARENZ_TAGE = 14;

// Mindest-Tests-Saldo, der eine Pruefrunden-Veroeffentlichung ohne neue
// Verpflichtung erlaubt (PRD §8.4: „zwei Tests im Voraus").
const SALDO_SCHWELLE = 2;

/**
 * Akzeptiert sowohl die globale `db`-Instanz als auch `tx` aus
 * `db.transaction(...)`. Erlaubt Outer-Transaktionen vom Aufrufer.
 */
type DbOrTx = typeof defaultDb | Parameters<Parameters<typeof defaultDb.transaction>[0]>[0];

export type SaldoCheckResult =
  | { ok: true; modus: 'saldo_erfuellt'; tests_gegeben: number }
  | { ok: true; modus: 'neue_verpflichtung'; frist: Date; verpflichtungs_id: string }
  | { ok: false; grund: 'frist_abgelaufen'; offene_anzahl: number }
  | { ok: false; grund: 'saldo_zu_niedrig'; tests_gegeben: number };

export interface KannPruefrundeStartenOptions {
  /**
   * Explizit eingeholtes Einverständnis der Nutzer:in, eine 14-Tage-
   * Verpflichtung einzugehen (PRD §8.4 Reziprozitäts-Regel). Default `false`:
   * ohne Einverständnis blockiert die Engine bei `tests_gegeben < 2` mit
   * `grund='saldo_zu_niedrig'`, statt automatisch eine Verpflichtung anzulegen.
   *
   * Die UI ist dafür verantwortlich, der Nutzer:in vor dem Aufruf die
   * Auswahl zwischen "zuerst Feedback geben" und "Verpflichtung eingehen"
   * sichtbar zu machen und nur bei expliziter Wahl `true` zu senden.
   */
  verpflichtung_akzeptiert?: boolean;
}

/**
 * Berechnet Verpflichtungs-Frist: `pruefrunde_frist + 14 Tage`.
 * Eigene Funktion, damit Tests die Konstante direkt nutzen koennen.
 */
export function berechneVerpflichtungsFrist(pruefrunde_frist: Date): Date {
  return new Date(
    pruefrunde_frist.getTime() + VERPFLICHTUNGS_KARENZ_TAGE * 24 * 60 * 60 * 1000,
  );
}

/**
 * Prueft, ob `nutzer_id` eine Pruefrunde starten darf.
 *
 * Drei moegliche Ausgaenge:
 *  1. `saldo_erfuellt`: tests_gegeben >= 2 → durch, keine neue Verpflichtung.
 *  2. `frist_abgelaufen`: es existiert mind. eine offene Verpflichtung mit
 *     frist < now → blockiert. Der Nutzer muss sie erst nachholen
 *     (oder warten, bis der Cron sie auf 'verfallen' setzt — danach kommt
 *     er ueberhaupt nicht mehr durch, bis der Saldo wieder >= 2 ist).
 *  3. `neue_verpflichtung`: noch kein Saldo, aber keine abgelaufenen offenen
 *     Verpflichtungen → neue Verpflichtung wird angelegt, Pruefrunde darf
 *     veroeffentlicht werden.
 *
 * `pruefrunde_id` ist die ID der gerade angelegten Pruefrunde (FK-Ziel
 * `aus_pruefrunde_id`). Sie muss bereits in der `pruefrunde`-Tabelle
 * existieren — die Engine ruft kein eigenes INSERT auf diese Tabelle.
 */
export async function kannPruefrundeStarten(
  nutzer_id: string,
  pruefrunde_frist: Date,
  pruefrunde_id: string,
  dbInstance: DbOrTx = defaultDb,
  options: KannPruefrundeStartenOptions = {},
): Promise<SaldoCheckResult> {
  const verpflichtungAkzeptiert = options.verpflichtung_akzeptiert === true;
  // 1) Saldo-Row sicherstellen (idempotent, kein Race-Problem).
  await ensureSaldoRow(nutzer_id, dbInstance);

  // 2) Eigentliche Check-+-Write-Phase in einer Transaktion mit FOR UPDATE.
  return await dbInstance.transaction(async (tx) => {
    // Saldo-Row exklusiv sperren — verhindert, dass zwei parallele
    // Pruefrunden-Starts beide den 2/0-Saldo aufessen.
    const saldoRows = await tx.execute<{
      tests_gegeben: number;
      offene_verpflichtung_anzahl: number;
    }>(sql`
      SELECT tests_gegeben, offene_verpflichtung_anzahl
        FROM test_saldo
       WHERE nutzer_id = ${nutzer_id}
       FOR UPDATE
    `);

    const saldoRow = saldoRows[0];
    const tests_gegeben = saldoRow?.tests_gegeben ?? 0;

    if (tests_gegeben >= SALDO_SCHWELLE) {
      return { ok: true as const, modus: 'saldo_erfuellt' as const, tests_gegeben };
    }

    // 3) Abgelaufene offene Verpflichtungen? Dann blockiert.
    const abgelaufenRows = await tx.execute<{ anzahl: number }>(sql`
      SELECT COUNT(*)::int AS anzahl
        FROM pruefrunden_verpflichtung
       WHERE nutzer_id = ${nutzer_id}
         AND status = 'offen'
         AND frist < now()
    `);
    const abgelaufen = abgelaufenRows[0]?.anzahl ?? 0;
    if (abgelaufen > 0) {
      return {
        ok: false as const,
        grund: 'frist_abgelaufen' as const,
        offene_anzahl: abgelaufen,
      };
    }

    // 4) Saldo<2 ohne explizites Einverständnis → harter Block. PRD §8.4
    //    verlangt, dass der User vor der Wahl steht: "zuerst 2 Tests geben"
    //    ODER "Verpflichtung eingehen". Die alte Default-Wahl (automatische
    //    Verpflichtung) ist Dark-Pattern-Risiko und entfernt die Wahl.
    if (!verpflichtungAkzeptiert) {
      return {
        ok: false as const,
        grund: 'saldo_zu_niedrig' as const,
        tests_gegeben,
      };
    }

    // 5) Neue Verpflichtung erzeugen (nur wenn explizit akzeptiert).
    const verpflichtungs_id = createId();
    const frist = berechneVerpflichtungsFrist(pruefrunde_frist);

    await tx.insert(pruefrundenVerpflichtung).values({
      id: verpflichtungs_id,
      nutzerId: nutzer_id,
      ausPruefrundeId: pruefrunde_id,
      frist,
      status: 'offen',
    });

    // Materialisierung pflegen: offene_anzahl + naechste_frist neu setzen.
    // postgres-js erlaubt Date-Werte nur via Drizzle-Spalten-Mapping, nicht
    // direkt in einer Raw-SQL-Bind-Position — daher ISO-String + ::timestamptz.
    const fristIso = frist.toISOString();
    await tx.execute(sql`
      UPDATE test_saldo
         SET offene_verpflichtung_anzahl = offene_verpflichtung_anzahl + 1,
             naechste_verpflichtung_frist = CASE
               WHEN naechste_verpflichtung_frist IS NULL THEN ${fristIso}::timestamptz
               WHEN naechste_verpflichtung_frist < ${fristIso}::timestamptz THEN naechste_verpflichtung_frist
               ELSE ${fristIso}::timestamptz
             END
       WHERE nutzer_id = ${nutzer_id}
    `);

    return {
      ok: true as const,
      modus: 'neue_verpflichtung' as const,
      frist,
      verpflichtungs_id,
    };
  });
}

/**
 * Wird aufgerufen, wenn `tester_id` ein Feedback abgegeben hat.
 *
 * Schritte (in EINER Transaktion mit FOR UPDATE):
 *  1. `tests_gegeben += 1` auf der Saldo-Row.
 *  2. Aelteste offene Verpflichtung (status='offen') schliessen:
 *     - Sperren mit FOR UPDATE SKIP LOCKED, damit parallele
 *       feedbackGegeben-Calls nicht dieselbe Row anfassen.
 *     - status='erfuellt', erfuellt_durch_feedback_id=feedback_id.
 *  3. `offene_verpflichtung_anzahl` + `naechste_verpflichtung_frist`
 *     aus den verbleibenden offenen Verpflichtungen neu aggregieren.
 *
 * Idempotenz: NICHT vorhanden — der Aufrufer muss sicherstellen, dass er
 * pro Feedback-Row genau einmal ruft (Feedback-API: UNIQUE-Constraint auf
 * (pruefrunde_id, tester_id) verhindert Doppel-Inserts).
 */
export async function feedbackGegeben(
  tester_id: string,
  feedback_id: string,
  dbInstance: DbOrTx = defaultDb,
): Promise<void> {
  await ensureSaldoRow(tester_id, dbInstance);

  await dbInstance.transaction(async (tx) => {
    // 1) Saldo-Row exklusiv sperren + tests_gegeben hochzaehlen.
    //    UPDATE-Statement nimmt den Row-Lock implizit.
    await tx
      .update(testSaldo)
      .set({ testsGegeben: sql`${testSaldo.testsGegeben} + 1` })
      .where(eq(testSaldo.nutzerId, tester_id));

    // 2) Aelteste offene Verpflichtung sperren — wenn parallele Aufrufer
    //    da sind, ueberspringt SKIP LOCKED die schon gesperrte Row, sodass
    //    der zweite Call die naechste freie schliesst (nicht doppelt!).
    const offene = await tx.execute<{ id: string }>(sql`
      SELECT id FROM pruefrunden_verpflichtung
       WHERE nutzer_id = ${tester_id} AND status = 'offen'
       ORDER BY frist ASC
       LIMIT 1
       FOR UPDATE SKIP LOCKED
    `);

    if (offene.length > 0) {
      const verpflichtungs_id = offene[0]!.id;
      await tx
        .update(pruefrundenVerpflichtung)
        .set({
          status: 'erfuellt',
          erfuelltDurchFeedbackId: feedback_id,
        })
        .where(eq(pruefrundenVerpflichtung.id, verpflichtungs_id));
    }

    // 3) Materialisierung neu berechnen (offene_anzahl + min(frist)).
    await recomputeSaldoVerpflichtungen(tester_id, tx);
  });
}

/**
 * Wird aufgerufen, wenn `werk_inhaber_id` ein Feedback erhalten hat.
 * Reine Zaehler-Erhoehung — keine Verpflichtungs-Logik (Empfangen erzeugt
 * keine Schuld, sondern dokumentiert die andere Seite des Tausches).
 */
export async function feedbackErhalten(
  werk_inhaber_id: string,
  delta: number,
  dbInstance: DbOrTx = defaultDb,
): Promise<void> {
  if (delta === 0) return;
  await ensureSaldoRow(werk_inhaber_id, dbInstance);
  await dbInstance
    .update(testSaldo)
    .set({ testsErhalten: sql`${testSaldo.testsErhalten} + ${delta}` })
    .where(eq(testSaldo.nutzerId, werk_inhaber_id));
}

/**
 * Markiert ALLE offenen Verpflichtungen mit `frist < now()` als 'verfallen'.
 * Wird vom Cron-Job genutzt. Gibt die betroffenen `nutzer_id`s zurueck,
 * damit der Aufrufer fuer jeden einzelnen den Saldo re-aggregieren kann.
 *
 * Nicht in einer expliziten Transaktion — das einzelne UPDATE ist atomar
 * (Postgres). Recompute laeuft danach pro Nutzer separat.
 */
export async function markiereAbgelaufeneVerpflichtungen(
  dbInstance: DbOrTx = defaultDb,
): Promise<string[]> {
  const rows = await dbInstance
    .update(pruefrundenVerpflichtung)
    .set({ status: 'verfallen' })
    .where(
      and(
        eq(pruefrundenVerpflichtung.status, 'offen'),
        lt(pruefrundenVerpflichtung.frist, new Date()),
      ),
    )
    .returning({ nutzerId: pruefrundenVerpflichtung.nutzerId });

  // Eindeutige Nutzer-IDs (mehrere abgelaufene Verpflichtungen pro Nutzer
  // moeglich, wenn jemand mehrere Pruefrunden im Stapel veroeffentlicht hat).
  return Array.from(new Set(rows.map((r) => r.nutzerId)));
}

/**
 * Lookup: aktuell offene Pruefrunden ANDERER Werke, bei denen `nutzer_id`
 * noch kein Feedback gegeben hat. Default-Limit 2, weil die Reziprozitäts-
 * Regel nur 2 Tests verlangt — die Wahl-UI soll genau diese 2 anbieten.
 *
 * Pure read — keine Mutation. Ergebnis ist eine flache Liste mit den
 * minimal benoetigten Render-Feldern (id, titel, werk.name, frist).
 */
export interface OffenePruefrundeAndererItem {
  id: string;
  titel: string;
  werkName: string;
  frist: Date;
}

export async function findeOffenePruefrundenAnderer(
  nutzer_id: string,
  limit = 2,
  dbInstance: DbOrTx = defaultDb,
): Promise<OffenePruefrundeAndererItem[]> {
  // Pruefrunden, bei denen `nutzer_id` schon Feedback gegeben hat —
  // diese ausschliessen, damit wir nur Restposten anzeigen.
  const eigeneFeedbacks = await dbInstance
    .select({ pruefrundeId: feedback.pruefrundeId })
    .from(feedback)
    .where(eq(feedback.testerId, nutzer_id));
  const ausgeschlossene = eigeneFeedbacks.map((r) => r.pruefrundeId);

  const baseWhere = [
    eq(pruefrunde.status, 'oeffentlich'),
    // Eigene Werke ausschliessen — Reziprozitaet gilt nur cross-werk.
    ne(werk.nutzerId, nutzer_id),
  ];
  if (ausgeschlossene.length > 0) {
    baseWhere.push(notInArray(pruefrunde.id, ausgeschlossene));
  }

  const rows = await dbInstance
    .select({
      id: pruefrunde.id,
      titel: pruefrunde.titel,
      werkName: werk.name,
      frist: pruefrunde.frist,
    })
    .from(pruefrunde)
    .innerJoin(werk, eq(werk.id, pruefrunde.werkId))
    .where(and(...baseWhere))
    .orderBy(desc(pruefrunde.erstelltAm))
    .limit(limit);

  return rows;
}

// Re-export fuer einfacheren Konsum von aussen.
export { ensureSaldoRow, getSaldoForUser, recomputeSaldoVerpflichtungen } from './saldo';

// asc wird hier nicht direkt importiert (raw SQL nutzt ORDER BY) — Anker
// gegen ungenutzten Import-Warner falls jemand die Datei refactored.
void asc;
