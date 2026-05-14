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
 *
 * `hasRolle()`, `istBedarfstraeger()`, `istFoerderer()` sind reine
 * In-Memory-Helper, die gegen die Rollen-Array eines bereits geladenen
 * `nutzer`-Records pruefen (kein DB-Hit). Werden in API-Routes der
 * Bedarfsseite (Bedarf-CRUD, Werkangebote, Foerderprofile) verwendet,
 * nachdem `getSessionFromRequest()` den Nutzer geladen hat.
 */

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { nutzer } from '@/lib/db/schema/nutzer';
import { stadt } from '@/lib/db/schema/stadt';
import type { Rolle } from '@/lib/db/schema/enums';

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

/**
 * Pruest, ob ein bereits geladener Nutzer eine bestimmte Rolle hat.
 *
 * Reine In-Memory-Pruefung — kein DB-Hit. Akzeptiert ein minimales Objekt
 * `{ rollen: string[] | Rolle[] }`, damit auch Test-Fixtures damit arbeiten
 * koennen, ohne ein vollstaendiges `Nutzer`-Objekt aufzubauen.
 */
export function hasRolle(
  nutzerLike: { rollen: readonly string[] },
  rolle: Rolle,
): boolean {
  return nutzerLike.rollen.includes(rolle);
}

export function istBedarfstraeger(nutzerLike: {
  rollen: readonly string[];
}): boolean {
  return hasRolle(nutzerLike, 'bedarfstraeger');
}

export function istFoerderer(nutzerLike: {
  rollen: readonly string[];
}): boolean {
  return hasRolle(nutzerLike, 'foerderer');
}

/**
 * Reine In-Memory-Pruefung gegen ein bereits geladenes Nutzer-Objekt.
 *
 * Wird von allen `/api/v1/admin/*`-Routes und allen `/admin/*`-Pages genutzt,
 * um den Permission-Gate vor jedem Schreibzugriff zu setzen.
 */
export function istAdmin(nutzerLike: { rollen: readonly string[] }): boolean {
  return hasRolle(nutzerLike, 'admin');
}
