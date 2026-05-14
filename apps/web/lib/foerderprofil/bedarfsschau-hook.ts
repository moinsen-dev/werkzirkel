/**
 * Foerderprofil-Hook fuer Bedarfsschau-Anwesenheit.
 *
 * Wenn eine Person mit Rolle 'foerderer' als 'anwesend' auf einem
 * Bedarfsschau-Termin markiert wird, pflegen wir das zugehoerige
 * Foerderprofil:
 *   - `letzte_bedarfsschau_id` und `letzte_bedarfsschau_am` werden auf den
 *     Termin gesetzt (PRD §11A Schutz Kulturverlust 4: 4 Quartale ohne
 *     Bedarfsschau → Auto-Pause).
 *   - Wenn das Foerderprofil vorher `pausiert` war, wird es durch die
 *     Anwesenheit reaktiviert auf `verifiziert` (Bonus-Pfad).
 *
 * - Nur fuer Termin-Typ 'bedarfsschau'.
 * - Nur fuer Personen, deren `rollen` 'foerderer' enthaelt.
 * - Idempotent: mehrfaches Auslosen mit demselben Termin ist ein No-Op
 *   ausser im Aktualisierungs-Zeitstempel (keine Werte-Veraenderung).
 *
 * Defensiv: jede Branche (kein Foerderer, falscher Typ, kein Profil)
 * ist ein lautloses No-Op. Der Hook darf nie den Erfolg der
 * Anwesenheits-API blockieren — Fehler werden vom Aufrufer gefangen.
 */

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { nutzer, foerderprofil, termin } from '@/lib/db/schema';
import type { Rolle } from '@/lib/db/schema/enums';

const BEDARFSSCHAU_TYP = 'bedarfsschau';

export async function maybeUpdateFoerderprofilBedarfsschau(opts: {
  nutzer_id: string;
  termin_id: string;
  termin_typ: string;
}): Promise<void> {
  if (opts.termin_typ !== BEDARFSSCHAU_TYP) return;

  const userRows = await db
    .select({ rollen: nutzer.rollen })
    .from(nutzer)
    .where(eq(nutzer.id, opts.nutzer_id))
    .limit(1);
  const user = userRows[0];
  if (!user) return;
  if (!(user.rollen as Rolle[]).includes('foerderer')) return;

  const fpRows = await db
    .select()
    .from(foerderprofil)
    .where(eq(foerderprofil.nutzerId, opts.nutzer_id))
    .limit(1);
  const fp = fpRows[0];
  if (!fp) return;

  // Termin-Datum laden, damit `letzte_bedarfsschau_am` exakt das Termin-Datum
  // ist (nicht der Zeitpunkt der Anwesenheits-Eintragung).
  const tRows = await db
    .select({ datumUhrzeit: termin.datumUhrzeit })
    .from(termin)
    .where(eq(termin.id, opts.termin_id))
    .limit(1);
  const t = tRows[0];
  if (!t) return;

  const update: {
    letzteBedarfsschauId: string;
    letzteBedarfsschauAm: Date;
    aktualisiertAm: Date;
    verifikationStatus?: 'verifiziert';
    pausiertSeit?: Date | null;
  } = {
    letzteBedarfsschauId: opts.termin_id,
    letzteBedarfsschauAm:
      t.datumUhrzeit instanceof Date
        ? t.datumUhrzeit
        : new Date(t.datumUhrzeit as unknown as string),
    aktualisiertAm: new Date(),
  };

  // Reaktivierung: pausiertes Profil → wieder verifiziert.
  if (fp.verifikationStatus === 'pausiert') {
    update.verifikationStatus = 'verifiziert';
    update.pausiertSeit = null;
  }

  await db
    .update(foerderprofil)
    .set(update)
    .where(eq(foerderprofil.id, fp.id));
}
