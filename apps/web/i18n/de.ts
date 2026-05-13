/**
 * Zentrale UI-Strings (Deutsch)
 *
 * Wachstumsdokument — wird mit jedem Feature ergänzt.
 * Vorbereitet für späteres `i18next`/`next-intl`, aber v1.0 nutzt direkt diese Konstanten.
 */

export const de = {
  app: {
    name: 'Werkzirkel',
    untertitel: 'Gemeinsam digitale Produkte bauen.',
    leitsatz: 'Erst zeigen. Dann testen. Dann verbessern. Dann sichtbar machen.',
  },
  rolle: {
    macher: 'Macher:in',
    bedarfstraeger: 'Bedarfsträger:in',
    foerderer: 'Förder:in',
    kurator: 'Kurator:in',
    admin: 'Admin',
  },
  stadt: {
    hh: 'Hamburg',
    b: 'Berlin',
    m: 'München',
  },
  werkstand: {
    idee: 'Idee',
    prototyp: 'Prototyp',
    testversion: 'Testversion',
    oeffentlich: 'Öffentlich',
    wachsend: 'Wachsend',
    pausiert: 'Pausiert',
  },
  termin_typ: {
    pruefabend: 'Prüfabend',
    schauabend: 'Schauabend',
    bedarfsschau: 'Bedarfsschau',
    baurunde: 'Baurunde',
    werkgespraech: 'Werkgespräch',
    kennenlernrunde: 'Kennenlernrunde',
  },
  hilfebedarf: {
    nutzerfeedback: 'Nutzerfeedback',
    ux_test: 'UX-Test',
    technisches_feedback: 'Technisches Feedback',
    marketing: 'Marketing',
    positionierung: 'Positionierung',
    erste_kundinnen: 'Erste Kund:innen',
    mitstreiterinnen: 'Mitstreiter:innen',
    rechtliches_steuern_austausch: 'Rechtliches/Steuern (Austausch)',
  },
  fehler: {
    unbekannt: 'Etwas ist schiefgelaufen.',
    nicht_gefunden: 'Nicht gefunden.',
    nicht_berechtigt: 'Dafür reicht deine Rolle nicht.',
    werkstattbeitrag_fehlt: 'Bevor du einen Bedarf veröffentlichst, brauchst du einen Werkstattbeitrag.',
    reziprozitaet_offen:
      'Du hast eine offene Reziprozitäts-Verpflichtung. Bitte zuerst Feedback zu zwei Werken geben.',
  },
} as const;

export type DeStrings = typeof de;
