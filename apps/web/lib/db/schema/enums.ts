/**
 * Werkzirkel — Enums als TypeScript-Konstanten.
 *
 * Drizzle-PG-Enums könnten Migrations brüchig machen (Werte-Änderungen sind kostspielig);
 * wir verwenden stattdessen `text` mit App-validierten Werten und exportieren die
 * erlaubten Werte hier als Single Source of Truth.
 */

// ────── Konto ──────
export const rolle = ['macher', 'bedarfstraeger', 'foerderer', 'kurator', 'admin'] as const;
export type Rolle = (typeof rolle)[number];

export const nutzerStatus = ['aktiv', 'pausiert', 'gesperrt', 'loeschung_anstehend'] as const;
export type NutzerStatus = (typeof nutzerStatus)[number];

export const teilnahmeart = ['online', 'vor_ort', 'beides'] as const;
export type Teilnahmeart = (typeof teilnahmeart)[number];

// ────── Magic Link ──────
export const magicLinkZweck = [
  'login',
  'registrierung',
  'registrierung-bedarf',
  'registrierung-foerder',
  'konto_loeschen_bestaetigung',
] as const;
export type MagicLinkZweck = (typeof magicLinkZweck)[number];

// ────── Stadt ──────
export const stadtStatus = ['aktiv', 'vorbereitung', 'inaktiv'] as const;
export type StadtStatus = (typeof stadtStatus)[number];

// ────── Werk ──────
export const werkstand = [
  'idee',
  'prototyp',
  'testversion',
  'oeffentlich',
  'wachsend',
  'pausiert',
] as const;
export type Werkstand = (typeof werkstand)[number];

export const werkSichtbarkeit = ['oeffentlich', 'nur_zirkel', 'pausiert'] as const;
export type WerkSichtbarkeit = (typeof werkSichtbarkeit)[number];

export const werkStatus = ['aktiv', 'ausgeblendet'] as const;
export type WerkStatus = (typeof werkStatus)[number];

export const hilfebedarf = [
  'nutzerfeedback',
  'ux_test',
  'technisches_feedback',
  'marketing',
  'positionierung',
  'erste_kundinnen',
  'mitstreiterinnen',
  'rechtliches_steuern_austausch',
] as const;
export type Hilfebedarf = (typeof hilfebedarf)[number];

// ────── Prüfrunde ──────
export const pruefrundeStatus = [
  'entwurf',
  'oeffentlich',
  'geschlossen',
  'abgeschlossen',
] as const;
export type PruefrundeStatus = (typeof pruefrundeStatus)[number];

export const pruefrundeAnmeldungStatus = [
  'angemeldet',
  'feedback_gegeben',
  'zurueckgezogen',
] as const;
export type PruefrundeAnmeldungStatus = (typeof pruefrundeAnmeldungStatus)[number];

export const feedbackKategorie = [
  'erster_eindruck',
  'verstaendlichkeit',
  'nutzen',
  'bedienbarkeit',
  'fehler',
  'positionierung',
  'zahlungsbereitschaft',
  'verbesserungen',
] as const;
export type FeedbackKategorie = (typeof feedbackKategorie)[number];

export const verpflichtungStatus = ['offen', 'erfuellt', 'verfallen'] as const;
export type VerpflichtungStatus = (typeof verpflichtungStatus)[number];

// ────── Werkstattbeitrag ──────
export const werkstattbeitragArt = [
  'schauabend_teilnahme',
  'geldbeitrag',
  'sachleistung',
] as const;
export type WerkstattbeitragArt = (typeof werkstattbeitragArt)[number];

export const werkstattbeitragStatus = ['erfasst', 'verifiziert', 'abgelehnt'] as const;
export type WerkstattbeitragStatus = (typeof werkstattbeitragStatus)[number];

// ────── Bedarf ──────
export const bedarfStatus = [
  'entwurf',
  'in_pruefung',
  'oeffentlich',
  'in_gespraechen',
  'erfuellt',
  'eingestellt',
] as const;
export type BedarfStatus = (typeof bedarfStatus)[number];

export const werkangebotStatus = [
  'eingereicht',
  'in_gespraechen',
  'beauftragt',
  'nicht_gewaehlt',
  'zurueckgezogen',
] as const;
export type WerkangebotStatus = (typeof werkangebotStatus)[number];

// ────── Förderprofil ──────
export const foerderart = [
  'geld',
  'raum',
  'mentoring',
  'sachmittel',
  'vertriebszugang',
  'mischung',
] as const;
export type Foerderart = (typeof foerderart)[number];

export const gegenleistungTyp = [
  'keine',
  'sichtbarkeit',
  'berichterstattung',
  'equity_offline',
  'mischung',
] as const;
export type GegenleistungTyp = (typeof gegenleistungTyp)[number];

export const foerderprofilStatus = [
  'entwurf',
  'in_verifikation',
  'verifiziert',
  'pausiert',
  'abgelehnt',
] as const;
export type FoerderprofilStatus = (typeof foerderprofilStatus)[number];

// ────── Termin ──────
export const terminTyp = [
  'pruefabend',
  'schauabend',
  'bedarfsschau',
  'baurunde',
  'werkgespraech',
  'kennenlernrunde',
] as const;
export type TerminTyp = (typeof terminTyp)[number];

export const terminStatus = [
  'geplant',
  'veroeffentlicht',
  'abgesagt',
  'durchgefuehrt',
] as const;
export type TerminStatus = (typeof terminStatus)[number];

export const terminAnmeldungStatus = [
  'angemeldet',
  'warteliste',
  'anwesend',
  'nicht_anwesend',
  'storniert',
] as const;
export type TerminAnmeldungStatus = (typeof terminAnmeldungStatus)[number];

// ────── Hilfegesuch ──────
export const hilfegesuchStatus = ['offen', 'beantwortet', 'abgelaufen'] as const;
export type HilfegesuchStatus = (typeof hilfegesuchStatus)[number];

// ────── Erfolgsbeitrag ──────
export const erfolgsbeitragStatus = ['initiiert', 'bezahlt', 'fehlgeschlagen', 'storniert'] as const;
export type ErfolgsbeitragStatus = (typeof erfolgsbeitragStatus)[number];

// ────── Werkstatt-Kasse ──────
export const kasseTyp = ['eingang', 'ausgang'] as const;
export type KasseTyp = (typeof kasseTyp)[number];

export const kasseKategorieEingang = [
  'werkstattbeitraege',
  'erfolgsbeitraege',
  'foerder_mitgliedsbeitraege',
  'sonstige_spenden',
] as const;
export type KasseKategorieEingang = (typeof kasseKategorieEingang)[number];

export const kasseKategorieAusgang = [
  'raum_miete',
  'getraenke_essen',
  'kurator_aufwandsentschaedigung',
  'werkzeug_hosting',
  'sonstiges',
] as const;
export type KasseKategorieAusgang = (typeof kasseKategorieAusgang)[number];

// ────── Fördermitgliedschaft ──────
export const foermitglStufe = [
  'monatlich',
  'jaehrlich',
  'foerderer_privat',
  'foerderer_organisation',
] as const;
export type FoermitglStufe = (typeof foermitglStufe)[number];

export const foermitglStatus = ['aktiv', 'gekuendigt', 'zahlung_fehlt'] as const;
export type FoermitglStatus = (typeof foermitglStatus)[number];

// ────── Meldung ──────
export const meldungReferenzTyp = [
  'werk',
  'bedarf',
  'werkangebot',
  'foerderprofil',
  'nutzer',
  'feedback',
  'hilfegesuch_antwort',
] as const;
export type MeldungReferenzTyp = (typeof meldungReferenzTyp)[number];

export const meldungKategorie = [
  'cold_outreach',
  'sales_sprech',
  'spam',
  'beleidigung',
  'sonstiges',
] as const;
export type MeldungKategorie = (typeof meldungKategorie)[number];

export const meldungStatus = ['offen', 'in_pruefung', 'erledigt', 'verworfen'] as const;
export type MeldungStatus = (typeof meldungStatus)[number];

// ────── E-Mail Log ──────
export const emailStatus = ['gesendet', 'fehlgeschlagen', 'bounced'] as const;
export type EmailStatus = (typeof emailStatus)[number];
