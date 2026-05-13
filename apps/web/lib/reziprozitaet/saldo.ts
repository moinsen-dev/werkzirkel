/**
 * Saldo-Lese- und Init-Helper fuer die Reziprozitaets-Engine.
 *
 * Wird sowohl von `engine.ts` als auch von Read-Sites (UI / API) genutzt:
 *  - `ensureSaldoRow(nutzer_id)` legt eine 0/0/0-Row an, wenn keine existiert.
 *  - `getSaldoForUser(nutzer_id)` liefert die aktuellen Zaehlerstaende (oder
 *    0/0/0-Default, wenn noch nie eine Verpflichtung/Feedback existierte).
 *
 * Keine Transaktion noetig — beides sind idempotente Single-Row-Operationen.
 * PRD-Referenz: §17 (Reziprozitaets-Engine), §13.10 (test_saldo).
 */

import { eq, sql } from 'drizzle-orm';

import { db as defaultDb } from '@/lib/db';
import { testSaldo } from '@/lib/db/schema';

/**
 * Akzeptiert sowohl die globale `db`-Instanz als auch das `tx`-Argument aus
 * `db.transaction(...)`. Drizzle's `PgTransaction` fehlt der `$client`, deshalb
 * type wir bewusst auf den gemeinsamen Subset (Parameters-Inferenz aus
 * `db.transaction`).
 */
type DbOrTx = typeof defaultDb | Parameters<Parameters<typeof defaultDb.transaction>[0]>[0];

export interface SaldoSnapshot {
  tests_gegeben: number;
  tests_erhalten: number;
  offene_verpflichtung_anzahl: number;
  naechste_verpflichtung_frist: Date | null;
}

/**
 * Legt `test_saldo`-Row mit 0/0/0-Default an, falls noch nicht vorhanden.
 * Idempotent ueber ON CONFLICT DO NOTHING.
 */
export async function ensureSaldoRow(
  nutzer_id: string,
  db: DbOrTx = defaultDb,
): Promise<void> {
  await db
    .insert(testSaldo)
    .values({ nutzerId: nutzer_id })
    .onConflictDoNothing({ target: testSaldo.nutzerId });
}

/**
 * Liest den aktuellen Saldo-Snapshot. Wenn keine Row existiert, wird sie
 * NICHT angelegt — der Aufrufer bekommt 0/0/0/null zurueck.
 *
 * (Read-Pfad legt keine Rows an, damit /uebersicht & Co. nicht jede anonyme
 * Profil-Anzeige zu einem INSERT machen.)
 */
export async function getSaldoForUser(
  nutzer_id: string,
  db: DbOrTx = defaultDb,
): Promise<SaldoSnapshot> {
  const rows = await db
    .select()
    .from(testSaldo)
    .where(eq(testSaldo.nutzerId, nutzer_id))
    .limit(1);

  if (rows.length === 0) {
    return {
      tests_gegeben: 0,
      tests_erhalten: 0,
      offene_verpflichtung_anzahl: 0,
      naechste_verpflichtung_frist: null,
    };
  }
  const row = rows[0]!;
  return {
    tests_gegeben: row.testsGegeben,
    tests_erhalten: row.testsErhalten,
    offene_verpflichtung_anzahl: row.offeneVerpflichtungAnzahl,
    naechste_verpflichtung_frist: row.naechsteVerpflichtungFrist,
  };
}

/**
 * Re-aggregiert `offene_verpflichtung_anzahl` und `naechste_verpflichtung_frist`
 * aus dem aktuellen Stand der `pruefrunden_verpflichtung`-Tabelle.
 *
 * Wird genutzt nach:
 *  - `feedbackGegeben` (Verpflichtung wurde erfuellt → recompute).
 *  - Cron-Lauf (Verpflichtungen wurden auf 'verfallen' gesetzt → recompute).
 *
 * Pure SQL — kein Round-Trip durch JS-Land, atomar in einer Statement-Folge.
 */
export async function recomputeSaldoVerpflichtungen(
  nutzer_id: string,
  db: DbOrTx = defaultDb,
): Promise<void> {
  // Drizzle 0.36 hat noch kein `.update().setFromSelect()`-Helfer, daher
  // raw SQL — voll parametriert, kein Injection-Risiko.
  await db.execute(sql`
    UPDATE test_saldo
       SET offene_verpflichtung_anzahl = (
             SELECT COUNT(*)::int FROM pruefrunden_verpflichtung
              WHERE nutzer_id = ${nutzer_id} AND status = 'offen'
           ),
           naechste_verpflichtung_frist = (
             SELECT MIN(frist) FROM pruefrunden_verpflichtung
              WHERE nutzer_id = ${nutzer_id} AND status = 'offen'
           )
     WHERE nutzer_id = ${nutzer_id}
  `);
}
