/**
 * JSON-Serialisierung für werkstatt_kasse_eintrag.
 *
 * Trennt DB-Zeilen-Form (camelCase, Date-Objekte) von der API-Form
 * (snake_case, ISO-Strings). Wird sowohl von den Kurator-/Admin-Routen
 * als auch von der öffentlichen `/api/v1/werkstatt-kasse/:stadt`-Route
 * verwendet, damit das Wire-Format einheitlich bleibt.
 */

import type { WerkstattKasseEintrag } from '@/lib/db/schema';

export interface SerializedKasseEintrag {
  id: string;
  stadt_id: string;
  typ: string;
  kategorie: string;
  hoehe_euro_cent: number;
  beschreibung: string;
  beleg_url: string | null;
  referenz_typ: string | null;
  referenz_id: string | null;
  datum: string;
  quartal: string;
  erfasst_durch: string;
  freigegeben_durch: string | null;
  freigegeben_am: string | null;
  erstellt_am: string;
}

export function serializeKasseEintrag(
  r: WerkstattKasseEintrag,
): SerializedKasseEintrag {
  return {
    id: r.id,
    stadt_id: r.stadtId,
    typ: r.typ,
    kategorie: r.kategorie,
    hoehe_euro_cent: r.hoeheEuroCent,
    beschreibung: r.beschreibung,
    beleg_url: r.belegUrl,
    referenz_typ: r.referenzTyp,
    referenz_id: r.referenzId,
    datum: r.datum,
    quartal: r.quartal,
    erfasst_durch: r.erfasstDurch,
    freigegeben_durch: r.freigegebenDurch,
    freigegeben_am: r.freigegebenAm ? r.freigegebenAm.toISOString() : null,
    erstellt_am: r.erstelltAm ? r.erstelltAm.toISOString() : '',
  };
}
