/**
 * Bedarf-Serialisierung fuer API-Antworten.
 *
 * snake_case-Keys (PRD §15.5). Allowlist verhindert versehentliche Exporte
 * privater Felder beim Schema-Wachstum.
 */

import type { Bedarf } from '@/lib/db/schema';

export const BEDARF_PUBLIC_FIELDS = [
  'id',
  'nutzer_id',
  'organisation',
  'titel',
  'problem',
  'nutzen',
  'stadt_id',
  'groessenordnung_zeit_wochen',
  'groessenordnung_aufwand_tage',
  'geldrahmen_min_euro_cent',
  'geldrahmen_max_euro_cent',
  'frist',
  'werkstattbeitrag_id',
  'branche',
  'bevorzugter_werkstand',
  'status',
  'erfuellt_von_werk_id',
  'selbstauskunft_groesse_euro_cent_min',
  'selbstauskunft_groesse_euro_cent_max',
  'erfuellt_am',
  'erstellt_am',
  'aktualisiert_am',
] as const;

export function serializeBedarf(b: Bedarf): Record<string, unknown> {
  return {
    id: b.id,
    nutzer_id: b.nutzerId,
    organisation: b.organisation,
    titel: b.titel,
    problem: b.problem,
    nutzen: b.nutzen,
    stadt_id: b.stadtId,
    groessenordnung_zeit_wochen: b.groessenordnungZeitWochen,
    groessenordnung_aufwand_tage: b.groessenordnungAufwandTage,
    geldrahmen_min_euro_cent: b.geldrahmenMinEuroCent,
    geldrahmen_max_euro_cent: b.geldrahmenMaxEuroCent,
    frist: b.frist,
    werkstattbeitrag_id: b.werkstattbeitragId,
    branche: b.branche,
    bevorzugter_werkstand: b.bevorzugterWerkstand,
    status: b.status,
    erfuellt_von_werk_id: b.erfuelltVonWerkId,
    selbstauskunft_groesse_euro_cent_min: b.selbstauskunftGroesseEuroCentMin,
    selbstauskunft_groesse_euro_cent_max: b.selbstauskunftGroesseEuroCentMax,
    erfuellt_am: b.erfuelltAm,
    erstellt_am: b.erstelltAm,
    aktualisiert_am: b.aktualisiertAm,
  };
}
