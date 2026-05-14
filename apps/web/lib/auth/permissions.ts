/**
 * Permission-Helper fuer rollenbasierte Schreib-Operationen.
 *
 * `istKuratorVon(nutzer_id, stadt_id)` liefert true, wenn die Person
 * fuer die jeweilige Stadt Schreib-Rechte hat:
 *   a) `nutzer.rollen` enthaelt 'admin' (Admin-Override fuer alle Staedte)
 *   b) `nutzer.rollen` enthaelt 'kurator' UND `nutzer.stadtId === stadt_id`
 *   c) `stadt.kuratorId === nutzer_id` (explizite Kurator-Verknuepfung auf
 *      der Stadt-Row, gesetzt per Seed/Admin)
 *
 * Genutzt z.B. von der Termin-CRUD-API.
 */

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { nutzer } from '@/lib/db/schema/nutzer';
import { stadt } from '@/lib/db/schema/stadt';

export async function istKuratorVon(
  nutzerId: string,
  stadtId: string,
): Promise<boolean> {
  const userRows = await db
    .select({ rollen: nutzer.rollen, stadtId: nutzer.stadtId })
    .from(nutzer)
    .where(eq(nutzer.id, nutzerId))
    .limit(1);
  const user = userRows[0];
  if (!user) return false;

  // a) admin override
  if (user.rollen.includes('admin')) return true;

  // b) kurator-Rolle UND eigene Stadt entspricht der angefragten
  if (user.rollen.includes('kurator') && user.stadtId === stadtId) return true;

  // c) Stadt-Row referenziert diese Person als kurator
  const stadtRows = await db
    .select({ kuratorId: stadt.kuratorId })
    .from(stadt)
    .where(eq(stadt.id, stadtId))
    .limit(1);
  if (stadtRows[0]?.kuratorId === nutzerId) return true;

  return false;
}
