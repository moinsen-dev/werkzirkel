/**
 * Werk-Serialisierung fuer API-Antworten.
 *
 * - `serializeWerk`: vollstaendige Werk-Felder (id, name, ...).
 *   Verwendet in POST/PATCH-Responses und im GET-Detail.
 * - `serializeWerkOeffentlich`: identisch — Werk hat keine privaten Felder.
 * - `serializeInhaberPublic`: Inhaber:innen-Daten, nur public Felder.
 *   NIEMALS email oder klarname zurueckgeben.
 */

import type { Werk } from '@/lib/db/schema';

export interface InhaberPublic {
  id: string;
  anzeigename: string;
  avatar_url: string | null;
  stadt_id: string;
}

export function serializeWerk(w: Werk): Record<string, unknown> {
  return {
    id: w.id,
    nutzer_id: w.nutzerId,
    name: w.name,
    kurzbeschreibung: w.kurzbeschreibung,
    problem: w.problem,
    zielgruppe: w.zielgruppe,
    werkstand: w.werkstand,
    hilfebedarf: w.hilfebedarf,
    link: w.link,
    screenshots: w.screenshots,
    sichtbarkeit: w.sichtbarkeit,
    status: w.status,
    erstellt_am: w.erstelltAm,
    aktualisiert_am: w.aktualisiertAm,
  };
}

export function serializeInhaberPublic(opts: {
  id: string;
  anzeigename: string;
  avatarUrl: string | null;
  stadtId: string;
}): InhaberPublic {
  return {
    id: opts.id,
    anzeigename: opts.anzeigename,
    avatar_url: opts.avatarUrl,
    stadt_id: opts.stadtId,
  };
}
