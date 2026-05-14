/**
 * Werkstattbeitrag-Hook fuer Bedarfstraeger:innen-Schauabend-Teilnahme.
 *
 * Wenn eine Person mit Rolle 'bedarfstraeger' als 'anwesend' auf einem
 * Schauabend- oder Bedarfsschau-Termin markiert wird, erzeugt dieser Hook
 * einen Werkstattbeitrag-Eintrag mit `art='schauabend_teilnahme'`, der
 * 6 Monate gueltig ist (PRD §17 Bedarfsseite-Vorbereitung).
 *
 * - Nur fuer Termin-Typ 'schauabend' oder 'bedarfsschau'.
 * - Nur fuer Personen, deren `rollen` 'bedarfstraeger' enthaelt.
 * - Idempotent: existiert bereits ein Werkstattbeitrag mit gleichem
 *   `(nutzer_id, termin_id, art='schauabend_teilnahme')`, wird KEIN
 *   zweiter angelegt.
 *
 * Defensiv: jede Branche (kein Bedarfstraeger, falscher Typ, schon vorhanden)
 * ist ein lautloses No-Op. Der Hook darf nie den Erfolg der Anwesenheits-API
 * blockieren — Fehler werden vom Aufrufer gefangen.
 */

import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { nutzer } from '@/lib/db/schema/nutzer';
import { werkstattbeitrag } from '@/lib/db/schema/werkstattbeitrag';
import type { Rolle } from '@/lib/db/schema/enums';

const SCHAUABEND_TYPEN = new Set<string>(['schauabend', 'bedarfsschau']);
const GUELTIGKEIT_MONATE = 6;

export async function maybeCreateSchauabendBeitrag(opts: {
  nutzer_id: string;
  termin_id: string;
  termin_typ: string;
}): Promise<void> {
  if (!SCHAUABEND_TYPEN.has(opts.termin_typ)) return;

  const userRows = await db
    .select({ rollen: nutzer.rollen })
    .from(nutzer)
    .where(eq(nutzer.id, opts.nutzer_id))
    .limit(1);
  const user = userRows[0];
  if (!user) return;
  if (!(user.rollen as Rolle[]).includes('bedarfstraeger')) return;

  const existing = await db
    .select({ id: werkstattbeitrag.id })
    .from(werkstattbeitrag)
    .where(
      and(
        eq(werkstattbeitrag.nutzerId, opts.nutzer_id),
        eq(werkstattbeitrag.terminId, opts.termin_id),
        eq(werkstattbeitrag.art, 'schauabend_teilnahme'),
      ),
    )
    .limit(1);
  if (existing.length) return;

  const gueltigBis = new Date(
    Date.now() + GUELTIGKEIT_MONATE * 30 * 24 * 60 * 60 * 1000,
  );

  await db.insert(werkstattbeitrag).values({
    nutzerId: opts.nutzer_id,
    art: 'schauabend_teilnahme',
    terminId: opts.termin_id,
    status: 'verifiziert',
    verifiziertAm: new Date(),
    gueltigBis,
  });
}
