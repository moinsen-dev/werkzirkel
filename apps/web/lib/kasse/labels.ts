/**
 * Deutsche Labels für Werkstatt-Kasse-Kategorien.
 *
 * Single Source of Truth für UI-Anzeigen — die Schema-Werte (siehe
 * `kasseKategorieEingang` / `kasseKategorieAusgang` in `db/schema/enums`)
 * bleiben deutsch-kebab; hier nur die schöner gesetzten Anzeige-Strings.
 */

export const KATEGORIE_LABEL: Record<string, string> = {
  // Eingang
  werkstattbeitraege: 'Werkstattbeiträge',
  erfolgsbeitraege: 'Erfolgsbeiträge',
  foerder_mitgliedsbeitraege: 'Fördermitgliedsbeiträge',
  sonstige_spenden: 'Sonstige Spenden',
  // Ausgang
  raum_miete: 'Raum-Miete',
  getraenke_essen: 'Getränke & Essen',
  kurator_aufwandsentschaedigung: 'Kurator-Aufwandsentschädigung',
  werkzeug_hosting: 'Werkzeug & Hosting',
  sonstiges: 'Sonstiges',
};

export function kategorieLabel(k: string): string {
  return KATEGORIE_LABEL[k] ?? k;
}

export function euroFormat(cent: number): string {
  const euro = cent / 100;
  return euro.toLocaleString('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
