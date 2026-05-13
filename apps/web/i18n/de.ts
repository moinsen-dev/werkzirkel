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
  werk_sichtbarkeit: {
    oeffentlich: 'Öffentlich sichtbar',
    nur_zirkel: 'Nur für Werkzirkel-Mitglieder',
    pausiert: 'Pausiert (für andere unsichtbar)',
  },
  werk_form: {
    titel_neu: 'Neues Werk anlegen',
    titel_bearbeiten: 'Werk bearbeiten',
    untertitel_neu:
      'Beschreibe dein Werk in wenigen Feldern. Du kannst alles später bearbeiten und Screenshots nach dem Speichern hochladen.',
    untertitel_bearbeiten:
      'Aktualisiere die Angaben zu deinem Werk. Werkstand-Wechsel landen im öffentlichen Verlauf.',
    label_name: 'Werkname',
    label_kurzbeschreibung: 'Kurzbeschreibung (max. 280 Zeichen)',
    label_problem: 'Welches Problem löst dein Werk?',
    label_zielgruppe: 'Für wen ist das Werk?',
    label_werkstand: 'Werkstand',
    label_hilfebedarf: 'Wobei möchtest du Hilfe? (Mehrfach möglich)',
    label_link: 'Link zur Live-Version oder Demo (optional)',
    label_sichtbarkeit: 'Sichtbarkeit',
    label_screenshots: 'Screenshots (bis zu 3)',
    button_anlegen: 'Werk anlegen',
    button_speichern: 'Änderungen speichern',
    button_loeschen: 'Werk endgültig löschen',
    button_loeschen_bestaetigen:
      'Werk wirklich löschen? Dieser Schritt kann nicht rückgängig gemacht werden.',
    erfolg_gespeichert: 'Werk gespeichert.',
    erfolg_frisch_angelegt:
      'Werk angelegt. Lade jetzt bis zu drei Screenshots hoch, damit andere dein Werk schneller verstehen.',
    fehler_keine_rolle:
      'Du brauchst eine Macher:innen-Rolle, um Werke anzulegen. Sprich mit der Kurator:in oder ergänze die Rolle in deinen Einstellungen.',
    fehler_limit:
      'Du hast bereits 5 Werke. Eine Fördermitgliedschaft hebt das Limit auf.',
    fehler_validierung:
      'Bitte prüfe die markierten Felder.',
    screenshots_max_erreicht:
      'Maximum von 3 Screenshots erreicht. Lösche einen Screenshot, um einen neuen hochzuladen.',
    screenshots_keine: 'Noch keine Screenshots hochgeladen.',
    screenshots_hochladen: 'Screenshot hochladen',
    screenshots_loeschen: 'Screenshot löschen',
    screenshots_laeuft: 'Wird hochgeladen…',
  },
  werke_uebersicht: {
    titel: 'Meine Werke',
    untertitel:
      'Hier findest du alle deine Werke — auch pausierte und nur intern sichtbare.',
    leer_titel: 'Du hast noch kein Werk angelegt.',
    leer_text:
      'Lege dein erstes Werk an, damit andere Macher:innen es bei Prüfrunden sehen und du Feedback einholen kannst.',
    neues_werk: 'Neues Werk anlegen',
    limit_erreicht_hinweis:
      'Du hast das Limit von 5 Werken erreicht. Eine Fördermitgliedschaft hebt das Limit auf.',
    bearbeiten: 'Bearbeiten',
    badge_pausiert: 'Pausiert',
    badge_ausgeblendet: 'Ausgeblendet',
    badge_nur_zirkel: 'Nur Zirkel',
    werkstand_label: 'Werkstand',
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
  teilnahmeart: {
    online: 'Nur online',
    vor_ort: 'Nur vor Ort',
    beides: 'Online + vor Ort',
  },
  benachrichtigung: {
    pruefrunde_anmeldungen: 'Anmeldungen zu meinen Prüfrunden',
    pruefrunde_feedback: 'Neues Feedback zu meinen Werken',
    pruefrunde_frist: 'Fristen für Feedback, die ich gegeben habe',
    werkangebote: 'Werkangebote auf meine Bedarfe',
    bedarf_passend: 'Neue Bedarfe, die zu mir passen',
    termin_erinnerungen: 'Erinnerungen zu Terminen, zu denen ich angemeldet bin',
    stadt_digest: 'Wochen-Digest meiner Stadt (kann jederzeit abbestellt werden)',
    kurator_mitteilungen: 'Persönliche Mitteilungen meiner Kurator:innen',
  },
  einstellungen: {
    titel: 'Einstellungen',
    tab_profil: 'Profil',
    tab_benachrichtigungen: 'Benachrichtigungen',
    tab_datenschutz: 'Datenschutz',
    profil_speichern: 'Profil speichern',
    profil_gespeichert: 'Profil gespeichert.',
    benachrichtigungen_speichern: 'Benachrichtigungen speichern',
    benachrichtigungen_gespeichert: 'Benachrichtigungen gespeichert.',
    avatar_hochladen: 'Avatar hochladen',
    avatar_hochgeladen: 'Avatar gespeichert.',
    konto_pausieren: 'Konto pausieren',
    konto_pausiert: 'Konto ist pausiert.',
    konto_reaktivieren: 'Konto reaktivieren',
    konto_reaktiviert: 'Konto ist wieder aktiv.',
    konto_pausieren_erklaerung:
      'Eine Pause bedeutet: keine neuen Anmeldungen, keine neuen Werkangebote, keine neuen Bedarfe. Bisherige Werke und Beiträge bleiben sichtbar. Reaktivieren kannst du jederzeit.',
    konto_loeschen_ueberschrift: 'Konto endgültig löschen',
    konto_loeschen_erklaerung:
      'Wir senden dir einen Bestätigungs-Link per E-Mail. Nach Klick auf den Link beginnt eine 7-Tage-Karenzfrist. In dieser Zeit kannst du die Löschung widerrufen. Nach Ablauf werden Werke, Bedarfe, Werkangebote und alle persönlichen Daten endgültig entfernt — Feedbacks bleiben anonymisiert erhalten.',
    konto_loeschen_anfordern: 'Konto löschen anfordern',
    konto_loeschen_bestaetigung_versendet:
      'Bestätigungs-Link versendet. Bitte prüfe dein E-Mail-Postfach.',
    konto_loeschen_bestaetigt:
      'Löschung bestätigt. Die 7-Tage-Karenzfrist läuft jetzt — du kannst sie hier jederzeit widerrufen.',
    konto_loeschen_anstehend_banner: (datum: string) =>
      `Dein Konto wird am ${datum} gelöscht.`,
    konto_loeschen_widerrufen: 'Löschung widerrufen',
    konto_loeschen_widerrufen_ok:
      'Löschung widerrufen — dein Konto bleibt aktiv.',
  },
  not_found: {
    eyebrow: '404 — Nicht gefunden',
    titel: 'Diese Seite gibt es nicht.',
    untertitel:
      'Vielleicht haben wir sie noch nicht gebaut, oder der Link ist veraltet. Hier sind ein paar Orte, die du stattdessen besuchen kannst.',
    link_start: 'Zum Werkzirkel',
    link_bedarf: 'Bedarf einbringen',
    link_foerdern: 'Werke fördern',
  },
  uebersicht: {
    eyebrow_template: (stadtName: string) => `Werkzirkel ${stadtName}`,
    nav_uebersicht: 'Übersicht',
    nav_werke: 'Werke',
    nav_pruefrunden: 'Prüfrunden',
    nav_termine: 'Termine',
    hallo: (anzeigename: string) => `Hallo, ${anzeigename}.`,
    subline:
      'Schön, dass du da bist. Hier siehst du dein Werkpass-Status, dein Test-Saldo und deine nächsten Schritte.',
    werkpass_titel: 'Werkpass',
    werkpass_bearbeiten: 'Werkpass bearbeiten',
    test_saldo_titel: 'Test-Saldo',
    gegeben: 'Gegeben',
    erhalten: 'Erhalten',
    offen: 'Offen',
    offene_verpflichtung: (n: number, frist: string) =>
      `Du hast ${n} offene Verpflichtung${n === 1 ? '' : 'en'} bis ${frist}. Bitte zuerst Feedback zu zwei Werken geben.`,
    saldo_leer_erklaerung:
      'Du hast noch keine Prüfrunden gegeben oder erhalten. Wenn du ein Werk testen lässt, gibst du zuerst zwei Tests an anderen Werken.',
    schnellzugriff_titel: 'Schnellzugriff',
    meine_werke: 'Meine Werke',
    meine_pruefrunden: 'Meine Prüfrunden',
    termine_in: (stadtName: string) => `Termine in ${stadtName}`,
    in_vorbereitung: '(in Vorbereitung)',
    in_vorbereitung_text: 'Folgt mit dem nächsten Bau-Sprint.',
    abmelden: 'Abmelden',
  },
  anmelden: {
    eyebrow: 'Hamburger Werkzirkel',
    titel: 'Anmelden oder Werkpass anlegen',
    untertitel:
      'Wir schicken dir einen Magic-Link per E-Mail. Klick rein, und du bist drin. Kein Passwort, keine Cookies-Banner-Wand.',
    email_label: 'E-Mail-Adresse',
    email_placeholder: 'deine-mail@beispiel.de',
    button_login: 'Anmelden',
    button_registrieren: 'Werkpass anlegen',
    erfolg:
      'Wir haben dir eine E-Mail geschickt. Schau in deinem Postfach (auch im Spam-Ordner). Der Link ist 15 Minuten gültig.',
    fehler_token_ungueltig:
      'Der Anmelde-Link ist abgelaufen oder bereits benutzt. Fordere einen neuen an.',
    fehler_loeschung_token_ungueltig:
      'Der Bestätigungs-Link für die Konto-Löschung ist abgelaufen. Fordere bei Bedarf eine neue Löschung in den Einstellungen an.',
    fehler_rate_limit:
      'Zu viele Anfragen in kurzer Zeit. Bitte warte eine Stunde und versuche es erneut.',
    fehler_ungueltige_email: 'Bitte gib eine gültige E-Mail-Adresse ein.',
  },
} as const;

export type DeStrings = typeof de;
