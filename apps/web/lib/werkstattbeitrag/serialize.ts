/**
 * Werkstattbeitrag-Serialisierung fuer API-Antworten.
 *
 * snake_case-Keys (PRD §15.5). Allowlist gepflegt — fuer Tests, die
 * pruefen, dass keine internen Felder geleakt werden.
 */

import type { Werkstattbeitrag } from '@/lib/db/schema';

export const WERKSTATTBEITRAG_PUBLIC_FIELDS = [
  'id',
  'nutzer_id',
  'art',
  'hoehe_euro_cent',
  'nachweis_text',
  'nachweis_dokument_url',
  'termin_id',
  'stripe_session_id',
  'status',
  'verifiziert_durch',
  'verifiziert_am',
  'gueltig_bis',
  'verwendet_fuer_bedarfe',
  'erstellt_am',
] as const;

export function serializeWerkstattbeitrag(
  wb: Werkstattbeitrag,
): Record<string, unknown> {
  return {
    id: wb.id,
    nutzer_id: wb.nutzerId,
    art: wb.art,
    hoehe_euro_cent: wb.hoeheEuroCent,
    nachweis_text: wb.nachweisText,
    nachweis_dokument_url: wb.nachweisDokumentUrl,
    termin_id: wb.terminId,
    stripe_session_id: wb.stripeSessionId,
    status: wb.status,
    verifiziert_durch: wb.verifiziertDurch,
    verifiziert_am: wb.verifiziertAm,
    gueltig_bis: wb.gueltigBis,
    verwendet_fuer_bedarfe: wb.verwendetFuerBedarfe,
    erstellt_am: wb.erstelltAm,
  };
}
