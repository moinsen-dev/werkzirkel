/**
 * Werk-Limit-Check fuer Anlegen.
 *
 * PRD §F-101: max 5 Werke pro Macher:in (kostenlos), unbegrenzt fuer aktive
 * Foerdermitglieder. Diese Logik liegt in einer eigenen Datei, damit sie
 * sowohl in der API als auch in Server-Actions (UI) genutzt werden kann.
 */

import { and, eq, count } from 'drizzle-orm';
import { db } from '@/lib/db';
import { foerdermitgliedschaft, werk } from '@/lib/db/schema';

export const MAX_WERKE_FREI = 5;

export interface LimitCheckResult {
  erlaubt: boolean;
  anzahlBestehend: number;
  foerdermitgliedAktiv: boolean;
}

/**
 * Prueft, ob die gegebene Nutzer:in noch ein weiteres Werk anlegen darf.
 *
 * - Zaehlt ALLE Werke (auch ausgeblendete) — das Limit soll nicht durch
 *   eigenes Ausblenden umgangen werden koennen.
 * - Foerdermitgliedschaft mit `status='aktiv'` hebt das Limit auf.
 */
export async function pruefeWerkAnlegenLimit(
  nutzerId: string,
): Promise<LimitCheckResult> {
  const [werkeCountRows, mitgliedschaftRows] = await Promise.all([
    db
      .select({ anzahl: count() })
      .from(werk)
      .where(eq(werk.nutzerId, nutzerId)),
    db
      .select({ id: foerdermitgliedschaft.id })
      .from(foerdermitgliedschaft)
      .where(
        and(
          eq(foerdermitgliedschaft.nutzerId, nutzerId),
          eq(foerdermitgliedschaft.status, 'aktiv'),
        ),
      )
      .limit(1),
  ]);

  const anzahlBestehend = werkeCountRows[0]?.anzahl ?? 0;
  const foerdermitgliedAktiv = mitgliedschaftRows.length > 0;
  const erlaubt = foerdermitgliedAktiv || anzahlBestehend < MAX_WERKE_FREI;

  return { erlaubt, anzahlBestehend, foerdermitgliedAktiv };
}
