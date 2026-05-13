/**
 * Test-DB-Cleanup-Helper.
 *
 * - `truncateAll()` raeumt alle Datentabellen ausser `stadt` (Stadt-Seeds
 *   bleiben erhalten) und der Drizzle-Migrations-Tabelle. CASCADE klaert
 *   FK-Verkettungen mit weg, RESTART IDENTITY setzt etwaige Sequenzen
 *   zurueck. Gedacht fuer `beforeEach` in Integration-Tests.
 *
 * - `deleteTestNutzer(pattern)` loescht selektiv Nutzer:innen per SQL
 *   LIKE-Pattern und liefert die Anzahl geloeschter Rows zurueck. CASCADE
 *   raeumt abhaengige Werke/Sessions/etc. mit weg.
 *
 * WICHTIG: Beide Funktionen wirken destruktiv. Niemals gegen die Prod-DB
 *   verwenden. Der einmal-Cleanup-Skript `cleanup-test-residue.ts` hat
 *   einen NODE_ENV-Guard; diese Helper laufen ausschliesslich in Tests
 *   und vertrauen auf die Test-Konfiguration.
 */

import { sql, like } from 'drizzle-orm';

import { db } from '@/lib/db';
import { nutzer } from '@/lib/db/schema/nutzer';

/**
 * Tabellen, die durch `truncateAll` geleert werden.
 *
 * Liste hardgecoded statt aus `information_schema` geholt — uebersichtlicher,
 * leichter zu reviewen, und wir wissen genau was passiert. Wenn neue Tabellen
 * dazukommen, muessen sie hier ergaenzt werden (oder via Schema-Re-Export, was
 * fragiler waere).
 *
 * Nicht in der Liste:
 *  - `stadt`                       — Seed-Defaults (Hamburg/Berlin/Muenchen) bleiben
 *  - `__drizzle_migrations`        — Migrations-Buchhaltung niemals anfassen
 */
const TRUNCATABLE_TABLES = [
  'audit_log',
  'bedarf',
  'email_benachrichtigung_log',
  'erfolgsbeitrag',
  'feedback',
  'foerdermitgliedschaft',
  'foerderprofil',
  'hilfegesuch',
  'hilfegesuch_antwort',
  'magic_link_token',
  'meldung',
  'nutzer',
  'pruefrunde',
  'pruefrunden_anmeldung',
  'pruefrunden_verpflichtung',
  'rate_limit_bucket',
  'session',
  'termin',
  'termin_anmeldung',
  'termin_bedarf_bezug',
  'termin_foerderprofil_bezug',
  'termin_werk_bezug',
  'test_saldo',
  'werk',
  'werk_historie',
  'werkangebot',
  'werkstatt_kasse_eintrag',
  'werkstattbeitrag',
] as const;

/**
 * Truncate aller Test-relevanten Tabellen mit CASCADE + RESTART IDENTITY.
 *
 * `stadt` und die Drizzle-Migrations-Tabelle bleiben unberuehrt — Stadt-Seeds
 * werden so von Tests nicht versehentlich entfernt.
 */
export async function truncateAll(): Promise<void> {
  // Postgres erlaubt TRUNCATE auf mehreren Tabellen in einem Statement —
  // schneller und atomar gegenueber Schleifen-Loeschungen.
  const tableList = TRUNCATABLE_TABLES.map((t) => `"${t}"`).join(', ');
  await db.execute(sql.raw(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`));
}

/**
 * Loescht Nutzer:innen, deren E-Mail dem SQL-LIKE-Pattern entspricht.
 *
 * Beispiele:
 *   await deleteTestNutzer('%@test.local')
 *   await deleteTestNutzer('seed%@%')
 *
 * @returns Anzahl geloeschter Rows.
 */
export async function deleteTestNutzer(emailPattern: string): Promise<number> {
  const rows = await db
    .delete(nutzer)
    .where(like(nutzer.email, emailPattern))
    .returning({ id: nutzer.id });
  return rows.length;
}
