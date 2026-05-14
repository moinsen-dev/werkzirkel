/**
 * Foerdermitgliedschaft — Stufen-Konfiguration.
 *
 * Mappt die vier PRD-§8.13-Stufen auf:
 *   - Stripe-Price-IDs (aus env.STRIPE_PRICE_*).
 *   - Anzeige-Label (Deutsch).
 *   - Preis-Klartext fuer die UI.
 *
 * Diese Datei ist die EINZIGE Quelle der Wahrheit fuer Stufen-Metadaten;
 * sowohl der Start-Endpoint als auch die /einstellungen-UI lesen hier.
 */

import { env } from '@/lib/env';
import type { FoermitglStufe } from '@/lib/db/schema/enums';

export interface StufeMeta {
  stufe: FoermitglStufe;
  label: string;
  preisText: string;
  beschreibung: string;
}

export const STUFEN: ReadonlyArray<StufeMeta> = [
  {
    stufe: 'monatlich',
    label: 'Monatlich',
    preisText: '9 € / Monat',
    beschreibung:
      'Foerder-Mitgliedschaft mit monatlicher Abbuchung. Jederzeit kuendbar.',
  },
  {
    stufe: 'jaehrlich',
    label: 'Jaehrlich',
    preisText: '90 € / Jahr',
    beschreibung:
      'Foerder-Mitgliedschaft mit jaehrlicher Abbuchung. Spart zwei Monate gegenueber dem Monats-Plan.',
  },
  {
    stufe: 'foerderer_privat',
    label: 'Foerder:in (privat)',
    preisText: '240 € / Jahr',
    beschreibung:
      'Verstaerkter Foerder-Beitrag fuer Privatpersonen, die die Werkstatt nachhaltig tragen wollen.',
  },
  {
    stufe: 'foerderer_organisation',
    label: 'Foerder:in (Organisation)',
    preisText: '1.200 € / Jahr',
    beschreibung:
      'Foerder-Beitrag fuer Organisationen, Stiftungen oder Unternehmen.',
  },
];

/**
 * Liefert die Stripe-Price-ID fuer die gegebene Stufe — oder `null`, wenn
 * die env-Variable nicht gesetzt ist. Aufrufer:innen sollten in diesem Fall
 * 422 mit klarer Meldung zurueckgeben.
 */
export function priceIdForStufe(stufe: FoermitglStufe): string | null {
  const map: Record<FoermitglStufe, string | undefined> = {
    monatlich: env.STRIPE_PRICE_FOERDER_MONATLICH,
    jaehrlich: env.STRIPE_PRICE_FOERDER_JAEHRLICH,
    foerderer_privat: env.STRIPE_PRICE_FOERDERER_PRIVAT,
    foerderer_organisation: env.STRIPE_PRICE_FOERDERER_ORG,
  };
  const id = map[stufe]?.trim();
  return id && id.length > 0 ? id : null;
}
