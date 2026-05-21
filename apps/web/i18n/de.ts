/**
 * Zentrale UI-Strings (Deutsch)
 *
 * Wachstumsdokument — wird mit jedem Feature ergänzt.
 * Vorbereitet für späteres `i18next`/`next-intl`, aber v1.0 nutzt direkt diese Konstanten.
 *
 * Vokabular-Refactor 2026-05-21:
 * Werkstatt-Metaphorik → Tech/Startup-Sprache (Werk → Build, Prüfrunde →
 * Feedback-Loop, Schauabend → Demo Night, Macher:in → Builder:in,
 * Bedarfsträger:in → Auftraggeber:in, Förder:in → Sponsor:in, Kurator:in →
 * City-Lead, Werkstattbeitrag → Membership-Beitrag, Werkangebot → Match-
 * Angebot, Hilfegesuch → Quick-Help). Routen und DB-Bezeichner bleiben.
 * "Werkzirkel" bleibt als Markenname.
 */

export const de = {
  app: {
    name: 'Werkzirkel',
    untertitel: 'Build in Public — mit echten Testern.',
    leitsatz: 'Erst zeigen. Dann testen. Dann verbessern. Dann sichtbar machen.',
  },
  rolle: {
    macher: 'Builder:in',
    bedarfstraeger: 'Auftraggeber:in',
    foerderer: 'Sponsor:in',
    kurator: 'City-Lead',
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
    testversion: 'Beta',
    oeffentlich: 'Live',
    wachsend: 'Stabil',
    pausiert: 'Pausiert',
  },
  werk_sichtbarkeit: {
    oeffentlich: 'Öffentlich sichtbar',
    nur_zirkel: 'Nur für Werkzirkel-Mitglieder',
    pausiert: 'Pausiert (für andere unsichtbar)',
  },
  werk_form: {
    titel_neu: 'Neuen Build anlegen',
    titel_bearbeiten: 'Build bearbeiten',
    untertitel_neu:
      'Beschreibe deinen Build in wenigen Feldern. Du kannst alles später bearbeiten und Screenshots nach dem Speichern hochladen.',
    untertitel_bearbeiten:
      'Aktualisiere die Angaben zu deinem Build. Werkstand-Wechsel landen im öffentlichen Verlauf.',
    label_name: 'Build-Name',
    label_kurzbeschreibung: 'Kurzbeschreibung (max. 280 Zeichen)',
    label_problem: 'Welches Problem löst dein Build?',
    label_zielgruppe: 'Für wen ist der Build?',
    label_werkstand: 'Build-Stand',
    label_hilfebedarf: 'Wobei brauchst du Feedback? (Mehrfach möglich)',
    label_link: 'Link zur Live-Version oder Demo (optional)',
    label_sichtbarkeit: 'Sichtbarkeit',
    label_screenshots: 'Screenshots (bis zu 3)',
    button_anlegen: 'Build anlegen',
    button_speichern: 'Änderungen speichern',
    button_loeschen: 'Build endgültig löschen',
    button_loeschen_bestaetigen:
      'Build wirklich löschen? Dieser Schritt kann nicht rückgängig gemacht werden.',
    erfolg_gespeichert: 'Build gespeichert.',
    erfolg_frisch_angelegt:
      'Build angelegt. Lade jetzt bis zu drei Screenshots hoch, damit andere deinen Build schneller verstehen.',
    fehler_keine_rolle:
      'Du brauchst eine Builder:innen-Rolle, um Builds anzulegen. Sprich mit dem City-Lead oder ergänze die Rolle in deinen Einstellungen.',
    fehler_limit:
      'Du hast bereits 5 Builds. Eine Pro-Membership hebt das Limit auf.',
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
    titel: 'Meine Builds',
    untertitel:
      'Hier findest du alle deine Builds — auch pausierte und nur intern sichtbare.',
    leer_titel: 'Du hast noch keinen Build angelegt.',
    leer_text:
      'Leg deinen ersten Build an, damit andere Builder:innen ihn bei Feedback-Loops sehen und du echtes Tester-Feedback einholen kannst.',
    neues_werk: 'Neuen Build anlegen',
    limit_erreicht_hinweis:
      'Du hast das Limit von 5 Builds erreicht. Eine Pro-Membership hebt das Limit auf.',
    bearbeiten: 'Bearbeiten',
    badge_pausiert: 'Pausiert',
    badge_ausgeblendet: 'Ausgeblendet',
    badge_nur_zirkel: 'Nur Werkzirkel',
    werkstand_label: 'Build-Stand',
  },
  hilfegesuche: {
    nav: 'Quick-Help',
    liste_titel: 'Quick-Help-Anfragen',
    liste_untertitel:
      'Kleine, kurzfristige Help-Requests aus dem Werkzirkel. Max. 14 Tage sichtbar — also: schnell antworten lohnt sich.',
    neues_anlegen: 'Neue Quick-Help',
    leer_titel: 'Aktuell keine offenen Quick-Help-Anfragen.',
    leer_text:
      'Du hängst gerade an etwas? Stell eine Quick-Help — bleibt bis zu 14 Tage sichtbar.',
    filter_status_label: 'Status',
    filter_status_offen: 'Offen',
    filter_status_beantwortet: 'Beantwortet',
    filter_status_abgelaufen: 'Abgelaufen',
    detail_zurueck: 'Zurück zur Liste',
    detail_gueltig_bis: 'Gültig bis',
    detail_status_offen: 'Offen',
    detail_status_beantwortet: 'Beantwortet',
    detail_status_abgelaufen: 'Abgelaufen — Antworten geschlossen',
    detail_keine_antworten: 'Noch keine Antworten. Sei die erste Person, die antwortet.',
    detail_antworten_titel: 'Antworten',
    detail_antwort_form_titel: 'Antwort schreiben',
    detail_antwort_label:
      'Was hilft? Ein Hinweis, eine Frage, ein Tipp — alles willkommen.',
    detail_antwort_button: 'Antwort posten',
    detail_loeschen_button: 'Quick-Help löschen',
    detail_antwort_loeschen: 'Antwort löschen',
    neu_titel: 'Neue Quick-Help',
    neu_untertitel:
      'Kurz beschreiben, wobei du gerade Hilfe brauchst. Wird 14 Tage angezeigt, danach automatisch beendet.',
    neu_label_titel: 'Titel',
    neu_label_beschreibung: 'Beschreibung',
    neu_label_tags: 'Tags (Komma-getrennt, max 10)',
    neu_label_gueltig_bis: 'Gültig bis (max. 14 Tage)',
    neu_button: 'Quick-Help anlegen',
    fehler_validierung: 'Bitte prüfe die markierten Felder.',
    fehler_abgelaufen:
      'Diese Quick-Help ist abgelaufen. Antworten sind nicht mehr möglich.',
    uebersicht_titel: 'Meine Hilfegesuche',
    uebersicht_untertitel:
      'Alle Hilfegesuche, die du selbst angelegt hast — offen, beantwortet oder abgelaufen.',
    uebersicht_leer: 'Du hast noch keine Quick-Help angelegt.',
    badge_antworten: 'Antworten',
  },
  termin_typ: {
    pruefabend: 'Feedback-Loop-Abend',
    schauabend: 'Demo Night',
    bedarfsschau: 'Briefing Night',
    baurunde: 'Build-Runde',
    werkgespraech: 'Build-Gespräch',
    kennenlernrunde: 'Kennenlernrunde',
  },
  hilfebedarf: {
    nutzerfeedback: 'Nutzer-Feedback',
    ux_test: 'UX-Test',
    technisches_feedback: 'Technisches Review',
    marketing: 'Go-To-Market',
    positionierung: 'Positionierung',
    erste_kundinnen: 'Erste Kund:innen',
    mitstreiterinnen: 'Co-Builder:innen',
    rechtliches_steuern_austausch: 'Rechtliches/Steuern (Austausch)',
  },
  fehler: {
    unbekannt: 'Etwas ist schiefgelaufen.',
    nicht_gefunden: 'Nicht gefunden.',
    nicht_berechtigt: 'Dafür reicht deine Rolle nicht.',
    werkstattbeitrag_fehlt: 'Bevor du einen Bedarf veröffentlichst, brauchst du einen Membership-Beitrag.',
    reziprozitaet_offen:
      'Du hast eine offene Feedback-Schuld. Bitte zuerst Feedback zu zwei anderen Builds geben.',
  },
  teilnahmeart: {
    online: 'Nur online',
    vor_ort: 'Nur vor Ort',
    beides: 'Online + vor Ort',
  },
  benachrichtigung: {
    pruefrunde_anmeldungen: 'Anmeldungen zu meinen Feedback-Loops',
    pruefrunde_feedback: 'Neues Feedback zu meinen Builds',
    pruefrunde_frist: 'Fristen für Feedback, das ich gegeben habe',
    werkangebote: 'Werkangebote auf meine Bedarfe',
    bedarf_passend: 'Neue Bedarfe, die zu mir passen',
    termin_erinnerungen: 'Erinnerungen zu Terminen, zu denen ich angemeldet bin',
    stadt_digest: 'Wochen-Digest meiner Stadt (kann jederzeit abbestellt werden)',
    kurator_mitteilungen: 'Persönliche Mitteilungen meines City-Leads',
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
      'Eine Pause bedeutet: keine neuen Anmeldungen, keine neuen Werkangebote, keine neuen Bedarfe. Bisherige Builds und Beiträge bleiben sichtbar. Reaktivieren kannst du jederzeit.',
    konto_loeschen_ueberschrift: 'Konto endgültig löschen',
    konto_loeschen_erklaerung:
      'Wir senden dir einen Bestätigungs-Link per E-Mail. Nach Klick auf den Link beginnt eine 7-Tage-Karenzfrist. In dieser Zeit kannst du die Löschung widerrufen. Nach Ablauf werden Builds, Bedarfe, Werkangebote und alle persönlichen Daten endgültig entfernt — Feedbacks bleiben anonymisiert erhalten.',
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
    link_foerdern: 'Builds sponsorn',
  },
  uebersicht: {
    eyebrow_template: (stadtName: string) => `Werkzirkel ${stadtName}`,
    nav_uebersicht: 'Übersicht',
    nav_werke: 'Builds',
    nav_pruefrunden: 'Feedback-Loops',
    nav_termine: 'Termine',
    hallo: (anzeigename: string) => `Hallo, ${anzeigename}.`,
    subline:
      'Schön, dass du da bist. Hier siehst du dein Builder-Profil, dein Feedback-Saldo und deine nächsten Schritte.',
    werkpass_titel: 'Builder-Profil',
    werkpass_bearbeiten: 'Builder-Profil bearbeiten',
    test_saldo_titel: 'Feedback-Saldo',
    gegeben: 'Gegeben',
    erhalten: 'Erhalten',
    offen: 'Offen',
    offene_verpflichtung: (n: number, frist: string) =>
      `Du hast ${n} offene Feedback-Schuld${n === 1 ? '' : 'en'} bis ${frist}. Bitte zuerst Feedback zu zwei Builds geben.`,
    saldo_leer_erklaerung:
      'Du hast noch keine Feedback-Loops gegeben oder erhalten. Wenn du einen Build testen lässt, gibst du zuerst zwei Tests an anderen Builds.',
    frist_banner_titel: 'Feedback-Schuld läuft bald ab',
    frist_banner_text: (n: number, frist: string) =>
      `Du hast ${n} offene Feedback-Schuld${n === 1 ? '' : 'en'}. Frist: ${frist}.`,
    frist_banner_link: 'Jetzt einen Build testen',
    schnellzugriff_titel: 'Schnellzugriff',
    meine_werke: 'Meine Builds',
    meine_pruefrunden: 'Meine Feedback-Loops',
    termine_in: (stadtName: string) => `Termine in ${stadtName}`,
    in_vorbereitung: '(in Vorbereitung)',
    in_vorbereitung_text: 'Folgt mit dem nächsten Sprint.',
    abmelden: 'Abmelden',
  },
  pruefrunden: {
    feedback_kategorie: {
      erster_eindruck: 'Erster Eindruck',
      verstaendlichkeit: 'Verständlichkeit',
      nutzen: 'Nutzen',
      bedienbarkeit: 'Bedienbarkeit',
      fehler: 'Fehler',
      positionierung: 'Positionierung',
      zahlungsbereitschaft: 'Zahlungsbereitschaft',
      verbesserungen: 'Verbesserungen',
    },
    status: {
      entwurf: 'Entwurf',
      oeffentlich: 'Öffentlich',
      geschlossen: 'Geschlossen',
      abgeschlossen: 'Abgeschlossen',
    },
    liste: {
      eyebrow: (stadtName: string) => `Werkzirkel ${stadtName} · Feedback-Loops`,
      titel: (stadtName: string) => `Feedback-Loops im Werkzirkel ${stadtName}`,
      counter: (n: number) =>
        n === 1 ? '1 Feedback-Loop sucht Tester:innen.' : `${n} Feedback-Loops suchen Tester:innen.`,
      leer_titel: (stadtName: string) =>
        `Noch keine offenen Feedback-Loops in ${stadtName}.`,
      leer_text:
        'Schau bald wieder vorbei oder leg einen eigenen Feedback-Loop für deinen Build an.',
      filter_titel: 'Filter',
      filter_stadt: 'Stadt',
      filter_status: 'Status',
      tester_counter: (n: number, m: number) =>
        `${n} / ${m} Tester:in${m === 1 ? '' : 'nen'} angemeldet`,
      frist_label: 'Frist',
      zum_detail: 'Details ansehen',
    },
    detail: {
      eyebrow: 'Werkzirkel · Feedback-Loop',
      werk_label: 'Build',
      inhaber_label: 'Builder:in',
      frist_label: 'Frist',
      tester_label: 'Tester:innen',
      sektion_was_getestet: 'Was getestet werden soll',
      sektion_testziel: 'Testziel',
      sektion_testaufgabe: 'Testaufgabe',
      sektion_zielgruppe: 'Zielgruppe',
      sektion_was_wissen: 'Was wir wissen wollen',
      sektion_zeitaufwand: 'Zeitaufwand',
      zeitbedarf: (min: number) => `${min} Minuten für einen sauberen Durchlauf.`,
      action_anonym: 'Anmelden, um Tester:in zu werden',
      action_anmelden_button: 'Als Tester:in anmelden',
      action_angemeldet: (frist: string) =>
        `Du bist angemeldet. Frist: ${frist}.`,
      action_feedback_link: 'Feedback abgeben',
      action_feedback_gegeben:
        'Du hast Feedback zu diesem Feedback-Loop abgegeben. Danke!',
      action_voll: (n: number, m: number) =>
        `Plätze voll (${n}/${m}). Keine weiteren Anmeldungen möglich.`,
      action_eigenes_werk:
        'Das ist dein eigener Feedback-Loop. Du kannst dich nicht selbst als Tester:in anmelden.',
      action_nicht_oeffentlich:
        'Dieser Feedback-Loop nimmt keine Anmeldungen mehr an.',
      verwalten_titel: 'Deinen Feedback-Loop verwalten',
      verwalten_tester_titel: 'Angemeldete Tester:innen',
      verwalten_keine_tester: 'Noch keine Tester:innen angemeldet.',
      verwalten_status_angemeldet: 'angemeldet',
      verwalten_status_feedback: 'Feedback gegeben',
      verwalten_status_zurueckgezogen: 'zurückgezogen',
      verwalten_schliessen: 'Anmeldungen schließen',
      verwalten_schliessen_hinweis:
        'Schließe den Feedback-Loop, wenn du alle Anmeldungen hast — Tester:innen können weiter Feedback abgeben.',
      verwalten_abschliessen: 'Feedback-Loop abschließen',
      verwalten_abschliessen_hinweis:
        'Markiere mindestens ein Feedback als hilfreich, dann kannst du den Feedback-Loop endgültig abschließen.',
      verwalten_zum_bearbeiten: 'Entwurf bearbeiten',
      verwalten_feedback_link: 'Feedback ansehen',
    },
    neu: {
      eyebrow: 'Werkzirkel · Neuer Feedback-Loop',
      titel: 'Feedback-Loop für einen Build anlegen',
      untertitel:
        'Leg fest, was getestet werden soll, wen du suchst und bis wann das Feedback eintreffen muss. Du kannst alles bis zur Veröffentlichung anpassen.',
      label_werk: 'Build',
      label_werk_hilfe: 'Wähle einen deiner Builds aus.',
      label_titel: 'Titel des Feedback-Loops',
      label_testziel: 'Testziel — was willst du herausfinden?',
      label_testaufgabe: 'Testaufgabe (Markdown erlaubt)',
      label_zielgruppe: 'Wen suchst du als Tester:in?',
      label_zeitbedarf: 'Zeitbedarf (5–120 Minuten)',
      label_gesuchte_tester: 'Anzahl gesuchter Tester:innen (1–10)',
      label_feedback_kategorien:
        'Worauf sollen Tester:innen achten? (Mehrfachauswahl)',
      label_frist: 'Frist für Feedback (zwischen morgen und 60 Tagen)',
      button_anlegen: 'Feedback-Loop als Entwurf anlegen',
      button_abbrechen: 'Abbrechen',
      fehler_keine_rolle:
        'Du brauchst eine Builder:innen-Rolle, um Feedback-Loops anzulegen.',
      fehler_kein_werk:
        'Du brauchst zuerst einen eigenen Build, um einen Feedback-Loop anzubieten.',
      fehler_validierung: 'Bitte prüfe die markierten Felder.',
      fehler_werk_nicht_eigen:
        'Du kannst nur für eigene Builds Feedback-Loops anlegen.',
    },
    bearbeiten: {
      eyebrow: 'Werkzirkel · Feedback-Loop',
      titel: 'Feedback-Loop bearbeiten und veröffentlichen',
      untertitel:
        'Solange der Feedback-Loop im Entwurf ist, kannst du alles anpassen. Beim Veröffentlichen prüfen wir dein Feedback-Saldo.',
      nicht_editierbar_titel: 'Dieser Feedback-Loop ist bereits veröffentlicht.',
      nicht_editierbar_text:
        'Veröffentlichte Feedback-Loops können nicht mehr bearbeitet werden. Leg bei Bedarf einen neuen an.',
      button_speichern: 'Änderungen speichern',
      button_veroeffentlichen: 'Feedback-Loop veröffentlichen',
      button_loeschen: 'Entwurf löschen',
      erfolg_gespeichert: 'Änderungen gespeichert.',
      erfolg_veroeffentlicht_saldo:
        'Feedback-Loop veröffentlicht. Dein Feedback-Saldo reicht aus — keine neue Feedback-Schuld.',
      erfolg_veroeffentlicht_verpflichtung: (frist: string) =>
        `Feedback-Loop veröffentlicht. Im Gegenzug verpflichtest du dich, bis ${frist} zwei Builds anderer zu testen. So funktioniert "Gib zwei, nimm eins".`,
      fehler_reziprozitaet:
        'Du hast eine abgelaufene Feedback-Schuld. Bitte teste zuerst zwei Builds anderer, bevor du einen neuen Feedback-Loop veröffentlichst.',
      fehler_validierung: 'Bitte prüfe die markierten Felder.',
      fehler_kein_zugriff: 'Du kannst nur eigene Feedback-Loops bearbeiten.',
      pruefrunden_finden: 'Feedback-Loops zum Testen finden',
    },
    feedback_form: {
      eyebrow: 'Werkzirkel · Feedback abgeben',
      titel: (werkName: string) => `Feedback zu „${werkName}"`,
      untertitel:
        'Beantworte die Fragen so konkret und wertschätzend, wie du es selbst gerne lesen würdest. Nur die Builder:in sieht das Feedback — bis sie es als hilfreich markiert.',
      gesamteindruck_label: 'Dein Gesamteindruck (Pflicht)',
      kategorie_label: (label: string) => `${label}`,
      button_abgeben: 'Feedback abgeben',
      button_abbrechen: 'Abbrechen',
      fehler_nicht_angemeldet:
        'Du bist nicht als Tester:in für diesen Feedback-Loop angemeldet.',
      fehler_bereits_gegeben:
        'Du hast für diesen Feedback-Loop bereits Feedback abgegeben.',
      fehler_validierung: 'Bitte prüfe die markierten Felder.',
    },
    meine: {
      eyebrow: 'Werkzirkel · Meine Feedback-Loops',
      titel: 'Meine Feedback-Loops',
      untertitel:
        'Hier siehst du Feedback-Loops, die du gestartet hast, und solche, an denen du als Tester:in beteiligt bist.',
      verpflichtung_banner_titel: 'Offene Feedback-Schulden',
      verpflichtung_banner_text: (n: number, frist: string) =>
        `Du hast ${n} offene Feedback-Schuld${n === 1 ? '' : 'en'} bis ${frist}. Bitte teste zwei Builds anderer, damit du weitere Feedback-Loops starten kannst.`,
      verpflichtung_link: 'Feedback-Loops zum Testen finden',
      sektion_gestartet: 'Eigene Feedback-Loops',
      sektion_gestartet_leer:
        'Du hast noch keinen Feedback-Loop angelegt. Leg einen Build an und biete einen Feedback-Loop dazu an.',
      sektion_als_tester: 'Als Tester:in angemeldet',
      sektion_als_tester_leer:
        'Du bist aktuell für keinen Feedback-Loop als Tester:in angemeldet.',
      neue_pruefrunde: 'Neuen Feedback-Loop anlegen',
      erfolg_feedback_abgegeben:
        'Danke für dein Feedback! Die Builder:in sieht es jetzt.',
    },
    werk: {
      pruefrunde_anbieten: 'Feedback-Loop anbieten',
      anonym_anmelden_hinweis:
        'Melde dich an, um einen Feedback-Loop zu diesem Build anzubieten.',
      nicht_inhaber_hinweis: 'Nur die Builder:in kann Feedback-Loops anbieten.',
    },
  },
  termine: {
    status: {
      geplant: 'Geplant',
      veroeffentlicht: 'Veröffentlicht',
      abgesagt: 'Abgesagt',
      durchgefuehrt: 'Durchgeführt',
    },
    liste: {
      eyebrow: (stadtName: string) => `Werkzirkel ${stadtName} · Termine`,
      titel: (stadtName: string) => `Termine im Werkzirkel ${stadtName}`,
      counter: (n: number) =>
        n === 1 ? '1 kommender Termin.' : `${n} kommende Termine.`,
      leer_titel: 'Noch keine veröffentlichten Termine für diese Filter.',
      leer_text: 'Schau bald wieder vorbei.',
      filter_titel: 'Filter',
      filter_stadt: 'Stadt',
      filter_typ: 'Termin-Typ',
      filter_anwenden: 'Filter anwenden',
      teilnehmer_counter: (n: number, m: number) => `${n}/${m} Teilnehmer:in`,
      ort_online: 'Online',
      zum_detail: 'Details',
    },
    detail: {
      eyebrow: 'Werkzirkel · Termin',
      sektion_was_passiert: 'Was passiert',
      sektion_ort: 'Ort',
      ort_online_label: 'Online-Link öffnen',
      action_anonym: 'Anmelden, um teilzunehmen',
      action_anmelden: 'Anmelden',
      action_warteliste: 'Auf Warteliste setzen',
      action_storniert: 'Stornieren',
      action_du_angemeldet: 'Du bist angemeldet.',
      action_du_warteliste: 'Du stehst auf der Warteliste.',
      action_du_anwesend: 'Du warst dabei.',
      action_du_nicht_anwesend: 'Du warst nicht dabei.',
      action_ical: 'In Kalender übernehmen',
      action_vorbei: 'Dieser Termin ist bereits vorbei.',
      banner_abgesagt: 'Dieser Termin wurde abgesagt.',
      verwalten_titel: 'Verwalten',
      verwalten_bearbeiten: 'Bearbeiten',
      verwalten_absagen: 'Termin absagen',
      verwalten_veroeffentlichen: 'Veröffentlichen',
      verwalten_durchgefuehrt: 'Als durchgeführt markieren',
      verwalten_anwesenheit: 'Anwesenheit dokumentieren',
      teilnehmer_counter: (n: number, m: number) => `${n}/${m} Teilnehmer:in`,
      warteliste_counter: (n: number) =>
        n === 1 ? '1 auf der Warteliste' : `${n} auf der Warteliste`,
    },
    neu: {
      eyebrow: 'Werkzirkel · Neuer Termin',
      titel: 'Termin anlegen',
      untertitel:
        'Leg Typ, Titel, Beschreibung, Ort und Datum fest. Du kannst alles bis zur Veröffentlichung anpassen.',
      label_typ: 'Termin-Typ',
      label_titel: 'Titel',
      label_beschreibung: 'Beschreibung',
      label_ort: 'Ort (z.B. Adresse, Co-Working)',
      label_online_link: 'Online-Link (optional)',
      label_datum: 'Datum und Uhrzeit',
      label_max_teilnehmer: 'Maximale Teilnehmer:innen-Zahl (2–100)',
      hinweis_ort_oder_link:
        'Ein Termin braucht entweder einen Ort oder einen Online-Link (oder beides).',
      button_anlegen: 'Termin als Entwurf anlegen',
      button_abbrechen: 'Abbrechen',
      fehler_keine_rolle:
        'Du brauchst eine City-Lead-Rolle für diese Stadt, um Termine anzulegen.',
      fehler_validierung: 'Bitte prüfe die markierten Felder.',
    },
    bearbeiten: {
      eyebrow: 'Werkzirkel · Termin',
      titel: 'Termin bearbeiten',
      untertitel:
        'Aktualisiere die Termin-Angaben oder ändere den Status. Veröffentlichte Termine können nur in begrenztem Umfang bearbeitet werden.',
      button_speichern: 'Änderungen speichern',
      erfolg_gespeichert: 'Termin gespeichert.',
      erfolg_frisch_angelegt:
        'Termin angelegt. Du kannst ihn jetzt veröffentlichen oder weiter bearbeiten.',
      nicht_editierbar:
        'Dieser Termin kann nicht mehr bearbeitet werden (Status: durchgeführt oder abgesagt).',
    },
    anwesenheit: {
      eyebrow: 'Werkzirkel · Anwesenheit',
      titel: 'Anwesenheit dokumentieren',
      untertitel:
        'Markiere die anwesenden Personen. Alle anderen werden als nicht anwesend gezählt. Stornierte Anmeldungen bleiben unberührt.',
      label_notizen: 'Notizen nach dem Termin (optional)',
      keine_anmeldungen: 'Keine Anmeldungen zu diesem Termin.',
      button_speichern: 'Anwesenheit speichern',
      erfolg: 'Anwesenheit gespeichert.',
      zurueck_link: 'Zurück zum Termin',
    },
    meine: {
      eyebrow: 'Werkzirkel · Meine Termine',
      titel: 'Meine Termine',
      untertitel:
        'Hier siehst du Termine, zu denen du angemeldet bist oder warst.',
      sektion_kommend: 'Kommende Termine',
      sektion_vergangen: 'Vergangene Termine',
      sektion_kommend_leer:
        'Du bist aktuell für keinen Termin angemeldet. Schau dir die offenen Termine in deiner Stadt an.',
      sektion_vergangen_leer: 'Noch keine vergangenen Termine.',
      anmeldung_status: {
        angemeldet: 'Angemeldet',
        warteliste: 'Warteliste',
        anwesend: 'Anwesend',
        nicht_anwesend: 'Nicht anwesend',
        storniert: 'Storniert',
      },
    },
    fehler: {
      voll: 'Der Termin ist voll. Du kannst dich auf die Warteliste setzen.',
      falscher_status: 'Anmeldungen sind aktuell nicht möglich.',
      termin_vergangen: 'Dieser Termin ist bereits vorbei.',
      bereits_storniert: 'Deine Anmeldung ist bereits storniert.',
    },
    bedarfsschau: {
      sektion_bedarfe_titel: 'Bedarfe in dieser Briefing Night',
      sektion_bedarfe_leer:
        'Für diese Briefing Night wurden noch keine Bedarfe ausgewählt.',
      sektion_foerderprofile_titel: 'Sponsor-Profile in dieser Briefing Night',
      sektion_foerderprofile_leer:
        'Für diese Briefing Night wurden noch keine Sponsor-Profile ausgewählt.',
      bearbeiten_bedarfe_titel: 'Bedarfe für diese Briefing Night auswählen',
      bearbeiten_bedarfe_hinweis:
        'Wähle die öffentlichen Bedarfe der Stadt aus, die bei dieser Briefing Night vorgestellt werden.',
      bearbeiten_foerderprofile_titel:
        'Sponsor-Profile für diese Briefing Night auswählen',
      bearbeiten_foerderprofile_hinweis:
        'Wähle die verifizierten Sponsor-Profile der Stadt aus, die sich auf dieser Briefing Night persönlich vorstellen.',
      button_bedarfe_speichern: 'Bedarfe speichern',
      button_foerderprofile_speichern: 'Sponsor-Profile speichern',
      keine_bedarfe_verfuegbar:
        'Aktuell gibt es keine öffentlichen Bedarfe in dieser Stadt.',
      keine_foerderprofile_verfuegbar:
        'Aktuell gibt es keine verifizierten Sponsor-Profile in dieser Stadt.',
      erfolg_bedarfe_gespeichert: 'Bedarfe der Briefing Night gespeichert.',
      erfolg_foerderprofile_gespeichert:
        'Sponsor-Profile der Briefing Night gespeichert.',
    },
  },
  bedarfsseite: {
    nav_bedarfe: 'Bedarfe',
    nav_foerderprofile: 'Sponsor-Profile',
    nav_meine_bedarfe: 'Meine Bedarfe',
    nav_meine_werkangebote: 'Meine Werkangebote',
    nav_mein_foerderprofil: 'Mein Sponsor-Profil',
    nav_werkstattbeitrag: 'Membership-Beitrag',
    foerderart_label: {
      geld: 'Geld',
      raum: 'Raum',
      mentoring: 'Mentoring',
      sachmittel: 'Sachmittel',
      vertriebszugang: 'Vertriebszugang',
      mischung: 'Mischung',
    },
    gegenleistung_typ_label: {
      keine: 'Keine Gegenleistung',
      sichtbarkeit: 'Sichtbarkeit',
      berichterstattung: 'Berichterstattung',
      equity_offline: 'Equity (offline besprochen)',
      mischung: 'Mischung',
    },
    bedarf_status_label: {
      entwurf: 'Entwurf',
      in_pruefung: 'In Prüfung',
      oeffentlich: 'Öffentlich',
      in_gespraechen: 'In Gesprächen',
      erfuellt: 'Erfüllt',
      eingestellt: 'Eingestellt',
    },
    werkangebot_status_label: {
      eingereicht: 'Eingereicht',
      in_gespraechen: 'In Gesprächen',
      beauftragt: 'Beauftragt',
      nicht_gewaehlt: 'Nicht gewählt',
      zurueckgezogen: 'Zurückgezogen',
    },
    werkstattbeitrag_art_label: {
      schauabend_teilnahme: 'Demo-Night-Teilnahme',
      geldbeitrag: 'Geldbeitrag',
      sachleistung: 'Sachleistung',
    },
    werkstattbeitrag_status_label: {
      erfasst: 'Erfasst',
      verifiziert: 'Verifiziert',
      abgelehnt: 'Abgelehnt',
    },
    foerderprofil_status_label: {
      entwurf: 'Entwurf',
      in_verifikation: 'In Verifikation',
      verifiziert: 'Verifiziert',
      pausiert: 'Pausiert',
      abgelehnt: 'Abgelehnt',
    },
    bedarfe_liste: {
      eyebrow: 'Werkzirkel · Bedarfe',
      titel: 'Bedarfe im Werkzirkel',
      untertitel:
        'Hamburger Auftraggeber:innen suchen Builder:innen. Werkangebote entstehen aus einer konkreten Build-Erfahrung — Werkzirkel vermittelt nicht, sondern macht sichtbar.',
      counter: (n: number) =>
        n === 1
          ? '1 öffentlicher Bedarf wartet auf Werkangebote.'
          : `${n} öffentliche Bedarfe warten auf Werkangebote.`,
      filter_titel: 'Filter',
      filter_stadt: 'Stadt',
      filter_anwenden: 'Filter anwenden',
      leer_titel: 'Aktuell keine öffentlichen Bedarfe.',
      leer_text:
        'Schau bald wieder vorbei oder bring einen eigenen Bedarf ein.',
      zum_detail: 'Bedarf ansehen',
      frist_label: 'Frist',
      geldrahmen_label: 'Geldrahmen',
      bevorzugter_werkstand_label: 'Bevorzugter Build-Stand',
      neuer_bedarf: 'Bedarf einbringen',
    },
    bedarf_detail: {
      eyebrow: 'Werkzirkel · Bedarf',
      sektion_problem: 'Das Problem',
      sektion_nutzen: 'Der erwartete Nutzen',
      sektion_groesse: 'Größenordnung',
      sektion_frist: 'Frist',
      sektion_organisation: 'Organisation',
      action_anonym: 'Anmelden, um auf diesen Bedarf zu reagieren',
      action_macher_werkangebot: 'Match-Angebot abgeben',
      action_macher_hinweis:
        'Du antwortest mit einem deiner Builds. Sichtbar wird das Match-Angebot nur für die Auftraggeber:in und dich — kein öffentlicher Pitch-Wettbewerb.',
      action_kein_macher_hinweis:
        'Nur Builder:innen können Werkangebote abgeben. Leg erst ein Builder-Profil an.',
      action_kein_zugriff:
        'Nur die Auftraggeber:in und Builder:innen mit eigenem Match-Angebot sehen dieses Aktions-Panel.',
      verwalten_titel: 'Deine Werkangebote',
      verwalten_keine:
        'Noch keine Werkangebote zu diesem Bedarf eingegangen.',
      verwalten_status_setzen: 'Status setzen',
      verwalten_in_gespraechen: 'In Gespräche aufnehmen',
      verwalten_beauftragt: 'Beauftragt markieren',
      verwalten_nicht_gewaehlt: 'Nicht gewählt markieren',
      verwalten_erfuellt: 'Bedarf als erfüllt markieren',
      verwalten_erfuellt_hinweis:
        'Markiere den Bedarf als erfüllt, wenn du dich offline mit einer Builder:in geeinigt hast. Ein Erfolgsbeitrag an den Community-Pool ist freiwillig.',
    },
    bedarf_neu: {
      eyebrow: 'Werkzirkel · Neuer Bedarf',
      titel: 'Bedarf einbringen',
      untertitel:
        'In drei Schritten: Membership-Beitrag wählen, Bedarf beschreiben, einreichen. Ein City-Lead prüft sprachlich und schaltet öffentlich frei.',
      schritt_1_titel: 'Schritt 1: Membership-Beitrag',
      schritt_1_hinweis:
        'Bevor dein Bedarf öffentlich wird, brauchst du einen Membership-Beitrag. Drei Wege — du wählst, was zu dir passt.',
      schritt_1_bestehend_titel: 'Du hast bereits einen gültigen Membership-Beitrag.',
      schritt_1_bestehend_weiter: 'Weiter mit diesem Beitrag',
      schritt_1_pfad_a_titel: 'Demo Night besuchen',
      schritt_1_pfad_a_text:
        'Komm zur nächsten Hamburger Demo Night. Anwesenheit wird dokumentiert und schaltet deinen Bedarf frei.',
      schritt_1_pfad_a_button: 'Termine ansehen',
      schritt_1_pfad_b_titel: 'Geldbeitrag (50 / 100 / 150 €)',
      schritt_1_pfad_b_text:
        'Bezahle online via Stripe — gültig für 4 Bedarfe oder 6 Monate.',
      schritt_1_pfad_b_button: 'Geldbeitrag wählen',
      schritt_1_pfad_c_titel: 'Sachleistung anbieten',
      schritt_1_pfad_c_text:
        'Raum, Mentoring, Material — beschreibe deinen Beitrag, der City-Lead verifiziert ihn.',
      schritt_1_pfad_c_button: 'Sachleistung beschreiben',
      schritt_1_pfad_c_label: 'Sachleistung beschreiben',
      schritt_1_pfad_c_textarea_label:
        'Beschreibe deine Sachleistung (mindestens 30 Zeichen)',
      schritt_1_pfad_c_submit: 'Sachleistung einreichen',
      schritt_2_titel: 'Schritt 2: Bedarf beschreiben',
      schritt_2_label_organisation: 'Deine Organisation',
      schritt_2_label_titel: 'Titel des Bedarfs',
      schritt_2_label_problem: 'Welches Problem soll gelöst werden?',
      schritt_2_label_nutzen: 'Welchen Nutzen erwartest du?',
      schritt_2_label_groesse_zeit: 'Größenordnung Zeit (Wochen, optional)',
      schritt_2_label_groesse_aufwand: 'Größenordnung Aufwand (Tage, optional)',
      schritt_2_label_geldrahmen_min: 'Geldrahmen min (€, optional)',
      schritt_2_label_geldrahmen_max: 'Geldrahmen max (€, optional)',
      schritt_2_label_frist: 'Frist (mindestens morgen)',
      schritt_2_label_branche: 'Branche (optional)',
      schritt_2_label_werkstand: 'Bevorzugter Build-Stand (optional)',
      schritt_2_button: 'Bedarf anlegen und einreichen',
      schritt_3_titel: 'Schritt 3: Bestätigung',
      schritt_3_text:
        'Dein Bedarf ist eingereicht und wird von einem City-Lead geprüft. Du erhältst eine Bestätigung per E-Mail.',
      fehler_keine_rolle:
        'Du brauchst eine Auftraggeber:innen-Rolle, um einen Bedarf einzubringen.',
      fehler_keine_rolle_link: 'Auftraggeber:innen-Rolle hinzufügen',
      fehler_klarname_fehlt:
        'Bitte ergänze deinen Klarnamen in den Einstellungen, bevor du einen Bedarf einbringst.',
      fehler_validierung: 'Bitte prüfe die markierten Felder.',
      fehler_werkstattbeitrag_fehlt:
        'Bitte hinterlege zuerst einen gültigen Membership-Beitrag.',
      fehler_unbekannt: 'Etwas ist schiefgelaufen.',
    },
    werkangebot_neu: {
      eyebrow: 'Werkzirkel · Match-Angebot',
      titel: 'Match-Angebot abgeben',
      untertitel:
        'Du antwortest mit einem deiner Builds. Beschreibe konkretes Vorgehen, expliziten Ausschluss und einen ersten Liefer-Meilenstein — kein Pitch, kein Preis.',
      label_werk: 'Build, mit dem du antwortest',
      label_werk_hilfe: 'Wähle einen deiner bestehenden Builds aus.',
      label_konkretes_vorgehen:
        'Konkretes Vorgehen (mindestens 50 Zeichen)',
      label_ausschluss:
        'Was ist ausdrücklich NICHT enthalten? (mindestens 20 Zeichen)',
      label_meilenstein:
        'Erster prüfbarer Liefer-Meilenstein (mindestens 20 Zeichen)',
      button_abgeben: 'Match-Angebot abgeben',
      button_abbrechen: 'Abbrechen',
      fehler_keine_rolle:
        'Du brauchst eine Builder:innen-Rolle, um Werkangebote abzugeben.',
      fehler_kein_werk:
        'Du brauchst zuerst einen eigenen Build, um auf Bedarfe zu antworten.',
      fehler_validierung: 'Bitte prüfe die markierten Felder.',
      fehler_bereits_eingereicht:
        'Du hast mit diesem Build bereits ein Match-Angebot zu diesem Bedarf eingereicht.',
      fehler_bedarf_nicht_offen:
        'Zu diesem Bedarf können aktuell keine Werkangebote eingereicht werden.',
    },
    foerderprofile_liste: {
      eyebrow: 'Werkzirkel · Sponsor-Profile',
      titel: 'Sponsor-Profile im Werkzirkel',
      untertitel:
        'Verifizierte Sponsor:innen, die persönlich auf einer Briefing Night sichtbar werden. Werkzirkel vermittelt keine Beteiligungen — Equity-Gespräche finden offline statt.',
      counter: (n: number) =>
        n === 1
          ? '1 verifiziertes Sponsor-Profil.'
          : `${n} verifizierte Sponsor-Profile.`,
      filter_titel: 'Filter',
      filter_foerderart: 'Sponsor-Art',
      filter_gegenleistung: 'Gegenleistung-Typ',
      filter_anwenden: 'Filter anwenden',
      leer_titel: 'Noch keine verifizierten Sponsor-Profile.',
      leer_text:
        'Schau bald wieder vorbei oder leg ein eigenes Sponsor-Profil an.',
      zum_detail: 'Sponsor-Profil ansehen',
      equity_badge: 'Equity offline',
      neues_profil: 'Sponsor-Profil anlegen',
    },
    foerderprofil_detail: {
      eyebrow: 'Werkzirkel · Sponsor-Profil',
      sektion_organisation: 'Organisation',
      sektion_foerderart: 'Sponsor-Art',
      sektion_foerderrahmen: 'Sponsor-Budget',
      sektion_bevorzugte_werke: 'Bevorzugte Builds',
      sektion_gegenleistung: 'Gegenleistung',
      equity_hinweis_titel: 'Hinweis zu Equity-Beteiligungen',
      kontakt_titel: 'Kontakt',
      kontakt_werkpass_link: 'Builder-Profil dieser Person ansehen',
      kontakt_anonym_hinweis:
        'Anmelden, um Sponsor:in zu kontaktieren.',
      kontakt_bedarfsschau_hinweis:
        'Auf einer Briefing Night lernst du diese Person persönlich kennen.',
    },
    foerderprofil_neu: {
      eyebrow: 'Werkzirkel · Neues Sponsor-Profil',
      titel: 'Sponsor-Profil anlegen',
      untertitel:
        'Beschreibe deine Förderung und die gewünschte Gegenleistung. Ein City-Lead prüft und verifiziert dein Profil persönlich.',
      label_organisation: 'Organisation',
      label_foerderart: 'Sponsor-Art',
      label_foerderrahmen_jahr_min: 'Sponsor-Budget pro Jahr min (€, optional)',
      label_foerderrahmen_jahr_max: 'Sponsor-Budget pro Jahr max (€, optional)',
      label_foerderrahmen_einzel: 'Maximaler Einzel-Betrag (€, optional)',
      label_bevorzugte_werke:
        'Bevorzugte Builds / Themen (optional, Freitext)',
      label_gegenleistung_typ: 'Art der Gegenleistung',
      label_gegenleistung_text: 'Beschreibung der Gegenleistung (optional)',
      equity_hinweis:
        'Achtung: Werkzirkel vermittelt keine Beteiligungen. Equity-Gespräche finden ausschließlich offline statt.',
      button_anlegen: 'Sponsor-Profil anlegen und einreichen',
      button_abbrechen: 'Abbrechen',
      fehler_keine_rolle:
        'Du brauchst eine Sponsor:innen-Rolle, um ein Profil anzulegen.',
      fehler_bereits_vorhanden:
        'Du hast bereits ein Sponsor-Profil. Bearbeite es über deine Übersicht.',
      fehler_validierung: 'Bitte prüfe die markierten Felder.',
    },
    uebersicht_bedarfe: {
      eyebrow: 'Werkzirkel · Meine Bedarfe',
      titel: 'Meine Bedarfe',
      untertitel:
        'Eigene Bedarfe, gruppiert nach Status. Hier siehst du auch deinen Membership-Beitrag-Stand.',
      neu_button: 'Neuen Bedarf einbringen',
      leer_titel: 'Du hast noch keinen Bedarf eingebracht.',
      leer_text:
        'Leg deinen ersten Bedarf an — drei Schritte, dann prüft ein City-Lead.',
      sektion_aktiv: 'Aktive Bedarfe',
      sektion_in_pruefung: 'In Prüfung',
      sektion_entwuerfe: 'Entwürfe',
      sektion_abgeschlossen: 'Erfüllte und eingestellte Bedarfe',
      werkstattbeitrag_titel: 'Mein Membership-Beitrag',
      werkstattbeitrag_aktiv: (anzahl: number, bis: string) =>
        `Aktiv: ${anzahl} ${anzahl === 1 ? 'Beitrag' : 'Beiträge'} (gültig bis ${bis}).`,
      werkstattbeitrag_keiner:
        'Aktuell kein gültiger Membership-Beitrag. Bei deinem nächsten Bedarf wirst du gefragt.',
    },
    uebersicht_werkangebote: {
      eyebrow: 'Werkzirkel · Meine Werkangebote',
      titel: 'Meine Werkangebote',
      untertitel:
        'Werkangebote, die du als Builder:in zu Bedarfen eingereicht hast.',
      leer_titel: 'Du hast noch kein Match-Angebot eingereicht.',
      leer_text:
        'Schau dir die öffentlichen Bedarfe an und antworte mit einem deiner Builds.',
      bedarfe_durchsuchen: 'Bedarfe durchsuchen',
    },
    uebersicht_foerderprofil: {
      eyebrow: 'Werkzirkel · Mein Sponsor-Profil',
      titel: 'Mein Sponsor-Profil',
      untertitel:
        'Verifikations-Status, letzte Briefing-Night-Teilnahme und Sponsor-Budget.',
      leer_titel: 'Du hast noch kein Sponsor-Profil angelegt.',
      leer_text:
        'Leg ein Sponsor-Profil an, damit City-Leads dich auf eine Briefing Night einladen können.',
      bearbeiten: 'Sponsor-Profil bearbeiten',
      letzte_bedarfsschau: (datum: string) =>
        `Letzte Briefing-Night-Teilnahme: ${datum}`,
      keine_bedarfsschau:
        'Bisher keine Briefing-Night-Teilnahme dokumentiert.',
    },
    uebersicht_werkstattbeitrag: {
      eyebrow: 'Werkzirkel · Membership-Beitrag',
      titel: 'Mein Membership-Beitrag',
      untertitel:
        'Demo-Night-Teilnahmen, Geldbeiträge und Sachleistungen — Status und Gültigkeit auf einen Blick.',
      leer_titel: 'Noch kein Membership-Beitrag erfasst.',
      leer_text:
        'Bei deinem ersten Bedarf wirst du gefragt, welchen der drei Pfade du wählst.',
      banner_erfolg: 'Geldbeitrag erfolgreich verbucht. Danke!',
      banner_abgebrochen:
        'Geldbeitrag abgebrochen. Du kannst es jederzeit erneut versuchen.',
    },
  },
  anmelden: {
    eyebrow: 'Hamburger Werkzirkel',
    titel: 'Anmelden oder Builder-Profil anlegen',
    untertitel:
      'Wir schicken dir einen Magic-Link per E-Mail. Klick rein, und du bist drin. Kein Passwort, keine Cookies-Banner-Wand.',
    email_label: 'E-Mail-Adresse',
    email_placeholder: 'deine-mail@beispiel.de',
    button_login: 'Anmelden',
    button_registrieren: 'Builder-Profil anlegen',
    button_bedarf: 'Bedarf einbringen',
    button_foerderer: 'Sponsor:in werden',
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
