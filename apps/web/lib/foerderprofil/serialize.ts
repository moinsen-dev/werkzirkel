/**
 * Foerderprofil-Serialisierung fuer API-Antworten.
 *
 * - snake_case-Keys (PRD §15.5).
 * - KEIN Auslieferung interner/sensibler Felder. Konkret werden Stripe-IDs
 *   (`stripe_customer_id`, `stripe_subscription_id`) NICHT exportiert; die
 *   Foerderprofil-Tabelle enthaelt sie aktuell nicht, der Field-Set hier
 *   ist als Allowlist gepflegt und veraendert sich nur explizit.
 * - Bei `gegenleistung_typ === 'equity_offline'` wird ein expliziter
 *   `equity_hinweistext` mitgeliefert (PRD §11A Schutz Kulturverlust 5):
 *   Werkzirkel vermittelt KEINE Beteiligungen — Gespraeche dazu finden
 *   ausschliesslich offline statt.
 */

import type { Foerderprofil } from '@/lib/db/schema';

export const EQUITY_HINWEISTEXT =
  'Werkzirkel vermittelt keine Beteiligungen. Equity-Gespraeche finden ' +
  'ausschliesslich offline und in eigener Verantwortung der Beteiligten ' +
  'statt — die Plattform nimmt daran keinen Anteil.';

/**
 * Allowlist der public Felder fuer Foerderprofile.
 *
 * Wird auch fuer Unit-Tests verwendet, die pruefen, dass sensible Felder
 * (z.B. Stripe-IDs) niemals im JSON erscheinen.
 */
export const FOERDERPROFIL_PUBLIC_FIELDS = [
  'id',
  'nutzer_id',
  'organisation',
  'foerderart',
  'foerderrahmen_jahr_min_euro_cent',
  'foerderrahmen_jahr_max_euro_cent',
  'foerderrahmen_einzel_max_euro_cent',
  'bevorzugte_werke',
  'gegenleistung_typ',
  'gegenleistung_text',
  'verifikation_status',
  'verifizierer_id',
  'verifiziert_am',
  'pausiert_seit',
  'letzte_bedarfsschau_id',
  'letzte_bedarfsschau_am',
  'erstellt_am',
  'aktualisiert_am',
  // Computed-Hinweis (nur bei equity_offline gesetzt).
  'equity_hinweistext',
] as const;

export function serializeFoerderprofil(
  fp: Foerderprofil,
): Record<string, unknown> {
  const base: Record<string, unknown> = {
    id: fp.id,
    nutzer_id: fp.nutzerId,
    organisation: fp.organisation,
    foerderart: fp.foerderart,
    foerderrahmen_jahr_min_euro_cent: fp.foerderrahmenJahrMinEuroCent,
    foerderrahmen_jahr_max_euro_cent: fp.foerderrahmenJahrMaxEuroCent,
    foerderrahmen_einzel_max_euro_cent: fp.foerderrahmenEinzelMaxEuroCent,
    bevorzugte_werke: fp.bevorzugteWerke,
    gegenleistung_typ: fp.gegenleistungTyp,
    gegenleistung_text: fp.gegenleistungText,
    verifikation_status: fp.verifikationStatus,
    verifizierer_id: fp.verifiziererId,
    verifiziert_am: fp.verifiziertAm,
    pausiert_seit: fp.pausiertSeit,
    letzte_bedarfsschau_id: fp.letzteBedarfsschauId,
    letzte_bedarfsschau_am: fp.letzteBedarfsschauAm,
    erstellt_am: fp.erstelltAm,
    aktualisiert_am: fp.aktualisiertAm,
  };

  if (fp.gegenleistungTyp === 'equity_offline') {
    base.equity_hinweistext = EQUITY_HINWEISTEXT;
  }

  return base;
}
