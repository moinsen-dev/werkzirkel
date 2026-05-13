Product Requirement Document v1.0

Arbeitstitel: Werkzirkel

Produkt: Deutschsprachige lokale Hybrid-Plattform für unabhängige digitale Produktmacher:innen UND deren Bedarfsträger:innen/Förder:innen im DACH-Raum.

Status: Bau-Spezifikation v1.0 (build-ready). Wir bauen die vollständige erste Version. Kein MVP-Denken. Kein Phasing „erst Schauabend, dann Plattform" — Plattform und Schauabende laufen parallel ab Tag 1. Drei Städte (Hamburg, Berlin, München) sind strukturell vom Start an angelegt; Hamburg ist der aktive Zirkel, Berlin und München sind als „in Vorbereitung" sichtbar.

Sprache: ausschließlich Deutsch (UI, E-Mails, Systemtexte, Verträge, Hilfeseiten, Rechtstexte).

Sequenzierung gegenüber v0.3: weggeworfen. v0.3 hatte vier Phasen (Phase 0 ohne Software, Phase 1 ohne Plattform, Phase 2 Plattform, Phase 3 Replikation, Phase 4 Bezahlmodell). v1.0 baut die vollständige Plattform am Stück. Lokale Treffen in Hamburg laufen parallel von Tag 1, aber die Plattform ist live, bevor der erste Schauabend stattfindet.

Zielgruppen, Vision, Werkstatt-Kultur, Schutzmechaniken: bleiben aus v0.3 erhalten (siehe Teil A unten).

⸻

INHALTSVERZEICHNIS

Teil A — Produktdefinition (Substanz aus v0.3, konsolidiert)
  1. Mission, Vision, Werkstatt-Kultur
  2. Zielgruppen
  3. Für wen NICHT
  4. Glossar
  5. Produktprinzipien
  6. Tonalität

Teil B — Funktionsumfang v1.0
  7. Rollen und Permissions-Matrix
  8. Funktionsverzeichnis (vollständig, kein „Später")
  9. Schutzmechaniken (technisch durchgesetzt)
  10. Vollständige Nutzerreisen

Teil C — Technische Architektur
  11. Tech-Stack
  12. Repository- und Modul-Struktur
  13. Datenmodell (Tabellen, Spalten, Typen, Indizes, Constraints)
  14. Status-Maschinen
  15. API-Spezifikation (REST)
  16. Auth, Session, Verifikation
  17. Reziprozitäts-Engine
  18. Werkstattbeitrag-Workflow
  19. Förderprofil-Verifikations-Workflow
  20. Bedarf- und Werkangebot-Workflow
  21. Erfolgsbeitrag- und Zahlungs-Flow
  22. Notification-Engine
  23. E-Mail-Templates
  24. Suchen, Filtern, Sortieren
  25. File-Uploads und Speicher
  26. Admin-Backoffice
  27. Moderation und Reporting

Teil D — Qualität, Compliance, Betrieb
  28. UI/UX-Spezifikation
  29. Accessibility (BITV/WCAG 2.1 AA)
  30. Mobile Verhalten und Responsive Design
  31. SEO, Meta, OpenGraph
  32. Performance-Anforderungen
  33. Security-Anforderungen
  34. DSGVO und Datenschutz
  35. Logging, Monitoring, Observability
  36. Hosting und Deployment
  37. CI/CD
  38. Test-Strategie
  39. Migrations- und Seeding-Strategie
  40. Rechtliche Seiten (AGB, Impressum, Datenschutz, Cookies)
  41. Markenidentität und Designsystem-Pointer

Teil E — Plan und Risiken
  42. Bauplan v1.0
  43. Erfolgskennzahlen v1.0
  44. Risiken und Gegenmaßnahmen
  45. Offene strategische Annahmen (aus v0.3 v1.0 übernommen)
  46. Was v1.0 ausdrücklich NICHT ist

⸻

TEIL A — Produktdefinition

⸻

1. Mission, Vision, Werkstatt-Kultur

Mission

Werkzirkel hilft unabhängigen digitalen Macher:innen, ihre Werke schneller zu verbessern, sichtbarer zu werden, nicht allein zu bauen — und in ihrer Stadt von Menschen gesehen zu werden, die konkrete Bedarfe oder Mittel mitbringen.

Vision

Werkzirkel wird das deutschsprachige Zuhause für unabhängige digitale Produktmacher:innen im DACH-Raum und der lokale Knotenpunkt, an dem ihre Werke auf konkrete Bedarfe und Förderwillen aus derselben Stadt treffen.

Werkstatt-Kultur (nicht-verhandelbar)

* keine Jobbörse
* kein klassischer Freelancer-Marktplatz
* kein Pitchwettbewerb
* kein algorithmisches Matching
* keine Vertragsabwicklung über die Plattform
* keine Provision
* kein Treuhandkonto
* keine Equity-Vermittlung
* keine Direktnachrichten an Nachfrageseite
* kein Cold-Outreach
* keine Bewertungen mit Sternen
* keine öffentliche Pitchdeck-Sammlung

Werkzirkel ist eine kuratierte Sichtbarkeitsbühne mit drei Räumen: Werke (Angebot), Bedarfe (Nachfrage), Förderprofile (Mittel). Vermittlungen passieren offline; die Plattform stellt nur den Kontext her.

⸻

2. Zielgruppen

2.1 Angebotsseite (Macher:innen)

Unabhängige digitale Produktmacher:innen im deutschsprachigen Raum: Indie-Developer, App-Entwickler:innen, SaaS-Bootstrapper, Freelancer mit eigenen Produkten, Solo-Founder, KI-Automatisierer:innen, No-Code-/Low-Code-Macher:innen, UX-/UI-Designer:innen mit eigenen Ideen, technische Creator, digitale Handwerker:innen, kleine Agenturmenschen mit Nebenprodukten.

2.2 Bedarfsträger:innen

Inhaber:innen kleinerer Mittelständler (10–80 Beschäftigte), Vereins-/Initiativen-Träger:innen, Stiftungen mit Digitalisierungs-Förderprogrammen, Bildungseinrichtungen, Kulturhäuser, Handwerksbetriebe, Solo-Unternehmer:innen aus Nicht-Tech-Branchen, Produktverantwortliche aus mittelgroßen Firmen.

Gemeinsamer Nenner: lokal verankert, ehrlicher Bedarf, bezahlte Aufträge in der Größenordnung 500 € bis 30.000 €.

2.3 Förder:innen

Business-Angels mit regionalem Bezug, Stiftungen (z.B. Hamburgische Kulturstiftung, ZEIT-Stiftung, Joachim Herz Stiftung, IFB Hamburg), Wirtschaftsförderung, Coworking-Pat:innen, lokale Tech-Unternehmen mit Mentor:innen-Budget, Privatpersonen mit Mäzen:innen-Interesse.

Gemeinsamer Nenner: nicht-anonym, nicht equity-getrieben (zumindest nicht über die Plattform), transparenter Förderrahmen.

⸻

3. Für wen NICHT

Werkzirkel ist nicht für: reine Jobvermittlung, klassische Freelancer-Projektbörse mit Suchschlitz und Sterne-Ranking, VC-getriebene Pitchkultur, LinkedIn-Selbstdarstellung, Agenturen zur Lead-Abschöpfung, rein englischsprachige Indie-Hacker, Krypto-/Hype-/Schneeballsystem-Communities, Bedarfsträger:innen mit Drive-by-Ausschreibungs-Verhalten, anonyme Förder:innen.

⸻

4. Glossar

Plattformbegriff	Bedeutung
Zirkel	regionale Gruppe (Hamburg, Berlin, München, später weitere)
Werk	Projekt, Produkt, App, Tool, digitales Vorhaben
Werkpass	Profil einer Macher:in
Werkstand	Status eines Werks
Hilfegesuch	Bitte um Unterstützung (Macher:in → Kreis)
Prüfrunde	strukturierte Test- und Feedbackrunde
Schauabend	lokales Demo-Format (Angebot zeigt)
Bedarfsschau	lokales Format, in dem Bedarfsträger:innen und Förder:innen sich vorstellen
Baurunde	gemeinsames Arbeiten, online oder vor Ort
Werkgespräch	Wissensformat zu einem Thema
Kennenlernrunde	niedrigschwelliger Einstieg
Bedarf	dokumentiertes Problem / Auftragsidee / Förderwunsch
Werkangebot	strukturierte Antwort eines Werks auf einen Bedarf
Förderprofil	Profil einer Förder:in
Werkstattbeitrag	Beitrag zum Kreis (Pflicht für Bedarfsträger:innen vor Bedarfsfreischaltung)
Erfolgsbeitrag	freiwillige Spende bei erfolgreicher Vermittlung (5 % empfohlen)
Test-Saldo	öffentliche Bilanz „Prüfrunden gegeben / erhalten" einer Macher:in
Werkstatt-Kasse	transparente Kasse für Erfolgsbeiträge und Spenden je Stadt

Verbotene Sprachmuster (in UI, Marketing, E-Mails, Hilfeseiten):

Statt	Werkzirkel
Launch	Start
Founder	Gründer:in / Macher:in
Demo Day	Schauabend
Build Night	Baurunde
Feedback Session	Prüfrunde
Networking	Austausch
Community	Gemeinschaft / Kreis
Project	Werk / Vorhaben
Profile	Werkpass
Job	(nicht verwenden)
Hire	Beauftragen
Bewerbung	Werkangebot
Ausschreibung	Bedarf
Match / Matching	Sichtbarkeit
Provision	Erfolgsbeitrag (freiwillig)
Marktplatz	Kreis / Werkstatt
Pitch / Pitch-Deck	Werkvorstellung
Onboarding	Einstieg
Touchpoint	Kontaktpunkt
Hustle, Unicorn, Scale, Disrupt, 10x, Game-Changer, Synergie	(in Nutzertexten verboten)

⸻

5. Produktprinzipien

P1 — Deutsch-only. Alle Nutzertexte deutsch. Ausnahmen: Eigennamen, technische Begriffe ohne deutsche Entsprechung, Code, Markennamen, externe Links.

P2 — Lokal vor global. Einstieg immer über regionale Zirkel. Jeder Inhalt erbt seine Stadt von der erstellenden Person.

P3 — Werke statt Profile. „Was baust du gerade?" steht vor „Wer bist du?".

P4 — Verbindlichkeit statt Rauschen. Keine endlosen Feeds, keine Likes, keine Follower, keine Algorithmen.

P5 — Gegenseitigkeit verbindlich. Reziprozität gilt auf drei Seiten:
  * Macher:innen: zwei Tests gegeben, bevor eine Prüfrunde gestartet werden kann (oder Schuld-Frist von 14 Tagen).
  * Bedarfsträger:innen: Werkstattbeitrag erbracht (Schauabend-Teilnahme oder Geldbeitrag oder Sachleistung), bevor ein Bedarf freigeschaltet wird.
  * Förder:innen: Kurator:innen-Verifikation plus persönliche Teilnahme an mindestens einer Bedarfsschau pro Quartal; sonst pausiert das Profil.

P6 — Treffen vor Tooling. Funktionen werden gebaut, weil sie in realen Treffen gefehlt haben. v1.0 baut nur, was unten spezifiziert ist — alles weitere wartet auf Bedarfsnachweis aus echten Schauabenden.

P7 — Sichtbarkeit, nicht Vermittlung. Plattform zeigt Werke, Bedarfe, Mittel. Sie kennt keinen Vertrag und kein Geld zwischen den Parteien. Erfolgsbeitrag ist Spende an die Werkstatt-Kasse, nicht Provision.

P8 — Transparenz. Werkstatt-Kasse pro Stadt ist quartalsweise öffentlich. Förderprofile sind nur nach Verifikation öffentlich. Test-Saldi sind im Werkpass öffentlich.

⸻

6. Tonalität

Klar, direkt, produktiv, unprätentiös, deutsch, kollegial, nicht anbiedernd. Keine Werbesprache, keine Pitchsprache, keine Marketing-Floskeln.

Beispiele richtig:
* „Lege deinen Werkpass an."
* „Zeig dein Werk im Hamburger Werkzirkel."
* „Du hast einen digitalen Bedarf? Stelle ihn im Kreis vor."

Beispiele falsch:
* „Join the leading founder community."
* „Crush it with your next big thing."
* „Hire top freelancers fast."

⸻

TEIL B — Funktionsumfang v1.0

⸻

7. Rollen und Permissions-Matrix

Rollen (eine Person kann mehrere haben):

R-Gast — nicht eingeloggt. Lesen öffentlicher Inhalte.
R-Macher — kann Werke, Prüfrunden, Werkangebote, Schauabend-Anmeldungen.
R-Bedarfstraeger — kann Bedarfe nach Werkstattbeitrag-Erfüllung.
R-Foerderer — kann Förderprofil nach Verifikation.
R-Kurator — eine pro Stadt, kann lokale Moderation, Verifikation, Termine.
R-Admin — globale Verwaltung.

Permissions-Matrix (X = darf, — = darf nicht, K = nur Kurator:in der eigenen Stadt, A = Admin):

Aktion	Gast	Macher	Bedarfsträger	Förderer	Kurator	Admin
Öffentliche Werke lesen	X	X	X	X	X	X
Werkpass anlegen	—	X	—	—	X	X
Werk anlegen	—	X	—	—	X	X
Werk bearbeiten (eigenes)	—	X	—	—	K	A
Werk löschen (eigenes)	—	X	—	—	K	A
Prüfrunde starten	—	X (mit Reziprozität)	—	—	K	A
Feedback geben	—	X	—	—	K	A
Termin anlegen	—	—	—	—	K	A
Termin-Anmeldung	—	X	X	X	X	X
Bedarf anlegen (Entwurf)	—	—	X	—	K	A
Bedarf veröffentlichen	—	—	X (mit Werkstattbeitrag)	—	K	A
Werkangebot abgeben	—	X	—	—	—	A
Bedarf als „erfüllt" markieren	—	—	X (eigener)	—	K	A
Förderprofil anlegen	—	—	—	X	K	A
Förderprofil veröffentlichen	—	—	—	X (mit Verifikation)	K	A
Förderprofil verifizieren	—	—	—	—	K	A
Werkstattbeitrag verifizieren	—	—	—	—	K	A
Inhalte melden	—	X	X	X	K	A
Inhalte ausblenden	—	—	—	—	K	A
Nutzer:in sperren	—	—	—	—	K (Region)	A
Globale Einstellungen	—	—	—	—	—	A
Stadt anlegen / Kurator:in ernennen	—	—	—	—	—	A
Werkstatt-Kassen-Quartalsbericht	—	—	—	—	K	A
Stadtweite E-Mails versenden	—	—	—	—	K	A

⸻

8. Funktionsverzeichnis v1.0

Alle Funktionen unten gehören zu v1.0 (keine „Sollte"/„Später"-Ausnahmen). Reihenfolge der Implementierung steht in Section 42 Bauplan.

8.1 Konto und Authentifizierung

* Registrierung mit E-Mail (Magic-Link, keine Passwörter in v1.0)
* E-Mail-Verifizierung Pflicht für alle veröffentlichten Inhalte
* Login per Magic-Link
* Mehrere aktive Sessions möglich (Geräte)
* Abmeldung einzeln und „alle Sessions abmelden"
* Konto-Einstellungen: Name, Stadt, Rollen (mehrere wählbar), Kontakt-E-Mail (optional abweichend), Benachrichtigungs-Einstellungen
* Konto pausieren (eigene Inhalte werden ausgeblendet)
* Konto löschen (DSGVO-konform mit Bestätigungs-E-Mail und 7-Tage-Karenz)
* Datenauskunft anfordern (Self-Service, DSGVO Art. 15)
* Datenexport (JSON-Download aller eigenen Inhalte)

8.2 Werkpass (Macher:in)

* Pflichtfelder: Name, Stadt, Kurzbeschreibung, Fähigkeiten (Tags), Rollen (Mehrfachauswahl)
* Optionale Felder: Website, GitHub, LinkedIn, Mastodon, eigene Produkte, bevorzugte Treffenart (online/vor Ort/beides)
* Avatar (Upload, max 2 MB, JPG/PNG/WebP, automatisch zu 256×256 + 512×512 resized)
* Sichtbares Test-Saldo: gegebene Prüfrunden-Feedbacks, erhaltene Prüfrunden-Feedbacks, Saldo-Anzeige als Verhältnis
* Sichtbare offene Reziprozitäts-Schuld (öffentlich, mit Frist)
* Werk-Liste (alle eigenen Werke)
* Aktivitätshistorie (Schauabende, Bedarfsschauen, gegebene Feedbacks)

8.3 Werke

* Pflichtfelder: Name, Kurzbeschreibung (max 280 Zeichen), Problem-Beschreibung, Zielgruppe, Werkstand (Enum), gesuchte Hilfe (Mehrfach-Tags), Stadt (erbt von Macher:in)
* Optional: Link, bis zu 3 Screenshots (max 4 MB pro Bild)
* Werkstand-Enum: idee, prototyp, testversion, oeffentlich, wachsend, pausiert
* Hilfebedarfs-Tags: nutzerfeedback, ux_test, technisches_feedback, marketing, positionierung, erste_kundinnen, mitstreiterinnen, rechtliches_steuern_austausch
* Sichtbarkeit: oeffentlich (Standard), nur_zirkel, pausiert
* Versionierung: jede Bearbeitung erzeugt einen Snapshot (für „Werkstand-Historie" auf der Werkseite)
* Maximale Anzahl Werke pro Macher:in: 5 (für Fördermitglieder unbegrenzt, siehe 8.13)

8.4 Prüfrunden

* Pflichtfelder: Werk-Bezug, Titel, Testziel, Testaufgabe (Markdown), Zielgruppe, Zeitbedarf-Schätzung in Minuten, gesuchte Tester:innen-Anzahl (max 10), Frist (Datum), Feedback-Kategorien (Mehrfachauswahl)
* Feedback-Kategorien: erster_eindruck, verstaendlichkeit, nutzen, bedienbarkeit, fehler, positionierung, zahlungsbereitschaft, verbesserungen
* Tester:innen melden sich an (Slot-System mit Maximum)
* Feedback-Eingabe: pro Kategorie ein Textfeld, plus Gesamteindruck (Pflicht), plus „dieses Feedback bitte als hilfreich vorschlagen" (für Werkinhaber:in)
* Feedback ist initial nur für Werkinhaber:in sichtbar
* Werkinhaber:in kann Feedback als „hilfreich" markieren — markiertes Feedback wird im Werk als anonyme Kurzform sichtbar („3 Tester:innen sagten X")
* Reziprozitäts-Engine prüft Test-Saldo vor Start (siehe Section 17)
* Status: entwurf, oeffentlich, geschlossen, abgeschlossen

8.5 Bedarfe

* Pflichtfelder: Bedarfsträger:in, Organisation (Pflichttext), Titel, Problem-Beschreibung (Markdown), Nutzen-Beschreibung, Stadt (erbt), Größenordnung Zeit (Schätzung in Wochen), Größenordnung Aufwand (Schätzung in Personentagen), Frist (Datum), Werkstattbeitrag-Nachweis (Pflicht-Bezug)
* Optionale Felder: Geldrahmen Min, Geldrahmen Max (Euro), Branche (Tag), bevorzugter Werkstand (Tag)
* Status: entwurf, in_pruefung, oeffentlich, in_gespraechen, erfuellt, eingestellt
* Sichtbarkeit: nur veröffentlichte Bedarfe sind für Macher:innen sichtbar; Kurator:in prüft vor Veröffentlichung (Sprachstichprobe, Plausibilität)
* Erfüllungs-Markierung: optionaler Verweis auf das erfüllende Werk, optionale Selbstauskunft Größenordnung, optionaler Erfolgsbeitrag-Indikator

8.6 Werkangebote

* Pflichtfelder: Bedarf-Bezug, Werk-Bezug (Macher:in muss bestehendes Werk verlinken — kein leeres Bewerberprofil), konkretes Vorgehen (Markdown), ausdrücklicher Ausschluss („Was würde ich nicht tun"), erster sichtbarer Liefer-Meilenstein (max 14 Tage)
* Maximal 1 Werkangebot pro Werk und Bedarf (technisch erzwungen)
* Werkangebote sind nur für Bedarfsträger:in und Werk-Inhaber:in sichtbar
* Status: eingereicht, in_gespraechen, beauftragt, nicht_gewaehlt, zurueckgezogen
* Werkangebote sind nicht öffentlich zählbar (kein „14 Bewerbungen"-Anzeige)
* Macher:in kann ein Werkangebot zurückziehen

8.7 Förderprofile

* Pflichtfelder: Klarname, Organisationsname, Förderart (Enum), Förderrahmen pro Jahr (Bandbreite), Förderrahmen Einzelförderung Max, bevorzugte Werke (Tags + Freitext), Gegenleistung (Enum + Freitext)
* Förderart-Enum: geld, raum, mentoring, sachmittel, vertriebszugang, mischung
* Gegenleistung-Enum: keine, sichtbarkeit, berichterstattung, equity_offline, mischung
* Status: entwurf, in_verifikation, verifiziert, pausiert, abgelehnt
* Hinweistext bei „equity_offline": „Werkzirkel vermittelt keine Beteiligungen. Verhandlungen laufen ausschließlich offline."
* Verifikations-Workflow: Kurator:in prüft Klarname (Handelsregister/Vereinsregister/Stiftungsregister/Personalausweis), Mittelplausibilität, persönliches Vorstellungsgespräch
* Auto-Pause: wenn 4 Quartale lang keine Teilnahme an Bedarfsschau dokumentiert

8.8 Termine (Schauabend, Bedarfsschau, Prüfabend, Baurunde, Werkgespräch, Kennenlernrunde)

* Pflichtfelder: Stadt, Typ (Enum), Titel, Beschreibung, Ort (Text) oder Online-Link, Datum, Uhrzeit, max Teilnehmer:innen
* Optional: Werke (bei Schauabend), Bedarfe und Förderprofile (bei Bedarfsschau), Thema (bei Werkgespräch)
* Anmeldung: Slot-System, automatische Warteliste
* Erinnerung: 7 Tage vorher, 1 Tag vorher (E-Mail)
* Nach-Termin-Workflow: Kurator:in dokumentiert Anwesenheit (für Schauabend-/Bedarfsschau-Reziprozität), Notizen, dokumentierte Vermittlungen
* iCal-Export pro Termin (für Kalender-Apps)

8.9 Werkstattbeitrag (Bedarfsträger:innen-Pflicht)

* Drei Pfade: schauabend_teilnahme, geldbeitrag, sachleistung
* schauabend_teilnahme: automatisch erfasst, wenn Bedarfsträger:in als anwesend bei einem Schauabend dokumentiert wurde
* geldbeitrag: Stripe Checkout, Skala 50–150 € (Selbsteinschätzung in drei Stufen: 50/100/150)
* sachleistung: Kurator:in trägt manuell ein (Raum-Spende, Testnutzer-Recruiting, Mentor:innen-Stunde)
* Gültigkeit: ein Werkstattbeitrag deckt 4 Bedarfe ODER 6 Monate, je nachdem was zuerst eintritt; danach neuer Beitrag nötig

8.10 Erfolgsbeitrag (freiwillig)

* Wird bei Bedarf-Markierung „erfüllt" angeboten, niemals erzwungen
* Stripe Checkout (Karte, Klarna Pay Now, SOFORT/Sofortüberweisung, SEPA-Lastschrift, Apple Pay/Google Pay)
* Empfehlung: 5 % der Selbstauskunft, einstellbar (Slider) zwischen 0 % und 10 %
* Geht in die Werkstatt-Kasse der Stadt; Verwendung quartalsweise öffentlich
* Plattform stellt keine Rechnung als Vermittlung — die Zahlung gilt als Spende an den (träger:innen-organisierten) Werkstattkasse-Verein

8.11 Werkstatt-Kasse pro Stadt

* öffentliche Seite mit Quartals-Eingang/Ausgang
* Eingangs-Kategorien: werkstattbeitraege, erfolgsbeitraege, foerder_mitgliedsbeitraege, sonstige_spenden
* Ausgangs-Kategorien: raum_miete, getraenke_essen, kurator_aufwandsentschaedigung, werkzeug_hosting, sonstiges
* Quartalsbericht durch Kurator:in eingegeben, durch Admin freigegeben

8.12 Suchen, Filtern, Sortieren

Werke-Seite:
* Filter: Stadt (Pflicht-Auswahl), Werkstand (Mehrfach), Hilfebedarf (Mehrfach)
* Sortierung: zuletzt aktualisiert (Default), zuletzt angelegt, sucht aktiv Hilfe
* Kein freier Suchschlitz — bewusst, um Bedarfsträger:innen zu zwingen, kuratiert vorzugehen

Bedarfe-Seite:
* Filter: Stadt, Geldrahmen (wenn gesetzt), Frist (offen/dringend)
* Sortierung: Frist aufsteigend (Default), zuletzt angelegt
* Bedarfe sind nur Macher:innen sichtbar (nicht Gästen) — Schutz vor Sales-Scraping

Förderprofile-Seite:
* Filter: Stadt, Förderart, Gegenleistungs-Typ
* Sortierung: zuletzt aktiv (Default)

Macher:innen-Profile/Werkpässe sind nicht durch Bedarfsträger:innen aktiv suchbar (kein Suchschlitz für Personen).

8.13 Mitgliedschaftsstufen

Kostenlos:
* Werkpass, ein Werk, Teilnahme an offenen Prüfrunden, Basis-Zirkelzugang, Teilnahme an Bedarfsschauen, eine Prüfrunde gleichzeitig offen

Fördermitgliedschaft (9 €/Monat oder 90 €/Jahr):
* unbegrenzte Werke
* mehrere offene Prüfrunden gleichzeitig
* bevorzugte Anmeldung zu Schauabenden
* Zugang zu geschlossenen Baurunden
* Archiv aller Werkgespräche
* eigener Werkpass-Stil-Badge „Fördermitglied"

Werkstattbeitrag (Bedarfsträger:innen, einmalig 50/100/150 € — Selbsteinschätzung): siehe 8.9

Förder-Mitgliedschaft (Förder:innen, jährlich 240 € Privat/Stiftung, 1.200 € Organisation):
* verifiziertes Förderprofil
* regelmäßige Bedarfsschau-Slots
* Kurator:innen-Kontakt für Programmpassung

8.14 Benachrichtigungen

E-Mail-Benachrichtigungen, einstellbar pro Kategorie:
* Magic-Link (immer aktiv)
* Konto-Sicherheit (immer aktiv)
* Eigene Prüfrunde: neue Anmeldung, neues Feedback, Reziprozitäts-Frist nähert sich
* Eigenes Werk: jemand bietet Werkangebot an (für Macher:innen), neuer Bedarf passend zu deinen Tags (opt-in)
* Eigener Bedarf: neues Werkangebot, Frist nähert sich
* Termine: Anmeldung bestätigt, 7 Tage vorher, 1 Tag vorher, Absage
* Stadt-Digest: wöchentlich, was passiert im Hamburger Werkzirkel (opt-out)
* Kurator:innen-Mitteilungen: stadtweite Nachrichten (opt-in)

Keine Push-Notifications in v1.0. Keine SMS.

8.15 Hilfegesuche

* Macher:innen können kleine Hilfegesuche (kein voller Bedarf) im Zirkel posten: „Suche jemanden, der mir 30 Min UI-Feedback zu meinem Mobile-Layout gibt"
* Stadt-Filter, Tag-Filter
* Antworten als Kommentar (einziges Kommentar-Feature in v1.0 — sonst wird Werkzirkel zum Feed)
* Hilfegesuch hat Gültigkeit (max 14 Tage)
* Reziprozitäts-Zähler: jede gegebene Hilfegesuch-Antwort zählt nicht als Prüfrunden-Test (separates Kennzeichen)

8.16 Werkstatt-Konto und Identitäts-Verwaltung

* Eine Person, eine E-Mail, ein Konto
* Mehrere Rollen pro Konto möglich (Macher + Bedarfsträger, oder Macher + Förder ohne offensichtlichen Interessenkonflikt — Kurator:in prüft)
* Konto-Wechsel zwischen Rollen über UI (z.B. „als Bedarfsträger:in posten")
* Klarname-Pflicht für Bedarfsträger:innen und Förder:innen; Macher:innen dürfen unter Pseudonym, müssen aber ein Klarname-Feld für Rechnungs-/Steuerzwecke hinterlegen, das nur für Kurator:innen und Admins sichtbar ist

8.17 Mehrsprachigkeit

In v1.0: ausschließlich Deutsch. Keine i18n-Library notwendig. Aber: alle Strings in TypeScript-Konstanten zentral pflegen (z.B. `src/i18n/de.ts`), damit v1.1 oder v2 leicht Mehrsprachigkeit hinzufügen kann.

⸻

9. Schutzmechaniken (technisch durchgesetzt in v1.0)

S1 — Direktnachrichten an Bedarfsträger:innen/Förder:innen ausgeschlossen
Kein Messaging-Endpoint für diese Rollen. Im Frontend kein Kontakt-Button. Backend lehnt etwaige API-Versuche ab.

S2 — Werkangebote nicht öffentlich
DB-Constraint: `SELECT` auf `werkangebot` ist nur erlaubt für Bedarfsträger:in des Bedarfs und Macher:in des Werks. Kein Listing-Endpoint für andere. Keine Zähler nach außen.

S3 — Kein Person-Suchschlitz für Bedarfsträger:innen
Frontend zeigt Bedarfsträger:innen keine Macher-Suche. Backend gibt 403 bei `GET /api/users?role=macher` von Bedarfsträger:innen-Sessions.

S4 — Kein Bedarf-Listing für Gäste
`GET /api/bedarfe` ohne Auth gibt 401. Suchmaschinen-Indexierung der Bedarf-Detail-Seiten blockiert (`noindex`).

S5 — Werkstattbeitrag-Gate
Bedarf kann technisch nicht in Status `oeffentlich` wechseln, solange kein Werkstattbeitrag-Nachweis mit `valid_until >= NOW()` verknüpft ist.

S6 — Reziprozitäts-Gate
Prüfrunde kann nicht in Status `oeffentlich` wechseln, solange `test_saldo_gegeben < 2` UND keine offene Verpflichtung mit Frist <= 14 Tage nach Prüfrunden-Ende eingegangen wurde.

S7 — Förderprofil-Verifikations-Gate
Förderprofil kann nicht in Status `verifiziert` wechseln ohne Kurator:innen-Aktion und dokumentierte Bedarfsschau-Teilnahme.

S8 — Sprach-Stichprobe
Bedarfe und Werkangebote durchlaufen einen Sprach-Check: serverseitige Liste verbotener Begriffe (siehe Glossar). Bei Treffer wird der Inhalt in Status `in_pruefung` gehalten und Kurator:in benachrichtigt.

S9 — Equity-Hinweistext
Wenn Förderprofil `gegenleistung_typ = equity_offline` setzt, wird auf Detailseite zwingend der Hinweistext gerendert.

S10 — Spam- und Cold-Outreach-Meldung
Jeder Nutzerinhalt hat einen „Melden"-Knopf mit Kategorie „kalter Outreach" / „Sales-Sprech" / „andere Werkstatt-Verletzung". Meldungen landen im Kurator:innen-Postfach mit SLA 48h.

⸻

10. Vollständige Nutzerreisen

NR-1: Neue Macher:in tritt bei
1. Startseite → klickt „Werkpass anlegen"
2. E-Mail eingeben → Magic-Link
3. Profil ausfüllen (Pflichtfelder Section 8.2)
4. Erstes Werk anlegen (optional, „später" erlaubt)
5. Stadt-Zirkelseite Hamburg
6. erste Anmeldung zu einem Termin oder zu einer Prüfrunde
Erfolg: innerhalb 10 Minuten mindestens ein konkreter Kontaktpunkt (Termin, Prüfrunde, Werk gelesen).

NR-2: Macher:in sucht Tester:innen
1. Werkseite → „Prüfrunde starten"
2. Reziprozitäts-Engine prüft Test-Saldo
3. Wenn Saldo < 2: zwei offene Prüfrunden anderer Werke werden angezeigt
4. Wenn Saldo ≥ 2 ODER „ich verspreche es innerhalb 14 Tagen": Prüfrunde wird angelegt
5. Andere Macher:innen melden sich an
6. Feedback wird gegeben
7. Werkinhaber:in markiert hilfreiches Feedback

NR-3: Schauabend
(wie v0.2 — Termin anlegen, Werke einreichen, Auswahl, Anmeldung, Treffen, Dokumentation)

NR-4: Bedarfsträger:in postet einen Bedarf
1. Startseite → klickt „Bedarf einbringen"
2. E-Mail eingeben → Magic-Link
3. Rolle wählen: Bedarfsträger:in
4. Profil-Pflichtfelder (Klarname, Organisation)
5. Werkstattbeitrag-Pfad wählen:
   * „Ich komme zum nächsten Schauabend" → System merkt sich, dass Bedarf erst freigeschaltet werden kann nach Schauabend-Teilnahme
   * „Ich zahle einen Geldbeitrag" → Stripe Checkout (50/100/150 €)
   * „Ich biete eine Sachleistung" → Freitext → Kurator:in prüft
6. Bedarf-Entwurf anlegen
7. Beitrag erbracht → Bedarf in `in_pruefung` → Kurator:in prüft → `oeffentlich`
8. Werkangebote treffen ein (sichtbar in „Meine erhaltenen Werkangebote")
9. 1–3 Werke offline kontaktieren
10. Auftrag schließen offline
11. Bedarf als „erfüllt" markieren → optional Erfolgsbeitrag

NR-5: Förder:in stellt sich vor
1. Startseite → „Werke fördern"
2. Magic-Link, Rolle wählen: Förder:in
3. Förderprofil-Entwurf
4. Kurator:in wird benachrichtigt → Verifikations-Termin
5. Persönliche Vorstellung in einer Bedarfsschau
6. Kurator:in setzt Status `verifiziert`
7. Profil öffentlich
8. Förder:in kann Werke direkt offline ansprechen über öffentliche Werkpass-Kontaktoption

NR-6: Bedarfsschau
1. Kurator:in legt Termin Typ `bedarfsschau` an
2. Bedarfsträger:innen reichen Bedarfe ein, Förder:innen reichen Profile ein
3. Kurator:in kuratiert die Auswahl
4. Macher:innen melden sich an (Standard-Schauabend-Anmeldung)
5. Treffen: 3–5 Vorstellungen á 7–10 Minuten, anschließend offene Werkrunde
6. Nach dem Treffen: Anwesenheit dokumentieren, Bedarfsfreischaltungen aktivieren, Förderprofil-Verifikationen abschließen

NR-7: Konto löschen (DSGVO)
1. Einstellungen → „Konto löschen"
2. Bestätigungs-E-Mail mit Link
3. 7-Tage-Karenz mit Erinnerungs-E-Mail nach 5 Tagen („Konto wird in 2 Tagen gelöscht")
4. Nach 7 Tagen: harte Löschung aller personenbezogenen Daten, Pseudonymisierung von Feedback („anonyme:r Tester:in"), Werke und Bedarfe werden gelöscht
5. Nutzerin erhält Bestätigungs-E-Mail mit JSON-Export-Anhang ihrer Daten

⸻

TEIL C — Technische Architektur

⸻

11. Tech-Stack (Annahmen, dokumentiert; bei Bedarf in Section 45 anders entscheidbar)

Sprache: TypeScript 5.x

Frontend + Backend (Full-Stack): Next.js 15 mit App Router, React 19, Server Components, Server Actions. Tailwind CSS 4.x für Styling. Headless UI / Radix UI für Primitives. Kein separates SPA — Next.js liefert sowohl die UI als auch die API-Routen.

Datenbank: PostgreSQL 17 (Hetzner Managed PostgreSQL oder Neon). Postgres-Extensions: `pg_trgm` für Sucht-Ähnlichkeit, `uuid-ossp` oder Postgres-natives `gen_random_uuid()`.

ORM: Drizzle ORM (typsicher, SQL-nah, gute Migrationen). Drizzle Kit für Migrationen.

Auth: Lucia Auth oder Better-Auth (Magic-Link mit E-Mail). Sessions in der DB (`session`-Tabelle). Kein OAuth in v1.0.

E-Mail: Resend (transactional). Templates als React-Email-Komponenten.

File-Storage: Cloudflare R2 (S3-kompatibel, kein Egress-Cost). Bilder werden serverseitig per `sharp` resized.

Payments: Stripe (Checkout für Werkstattbeitrag, Fördermitgliedschaft, Erfolgsbeitrag). Webhook-Handler für `checkout.session.completed`, `customer.subscription.updated`, `invoice.payment_succeeded`.

Search: Postgres Full-Text-Search (DE-Dictionary `german`) für Werke, Bedarfe, Förderprofile. Kein Elasticsearch nötig.

Background Jobs / Cron: Vercel Cron Jobs ODER Hetzner-Cron auf eigenem Container. Jobs:
* `reziprozitaet-frist-pruefen` (täglich um 06:00)
* `werkstattbeitrag-ablauf-pruefen` (täglich)
* `foerderprofil-quartal-pruefen` (täglich)
* `termin-erinnerung-versenden` (stündlich)
* `werkstatt-kasse-quartalsreport` (1× Quartal manuell ausgelöst, Bericht in DB)
* `digest-newsletter` (wöchentlich Mittwoch 09:00)
* `konto-loeschung-frist-abgelaufen` (stündlich)

Hosting: Hetzner Cloud (CCX13 oder größer), CPX21 für DB-Replica, Coolify für Deployment-Verwaltung. Optional: Vercel für Frontend, Hetzner nur für DB. v1.0-Empfehlung: alles auf Hetzner mit Coolify, weil DSGVO-Hosting in Deutschland.

CDN/Edge: Cloudflare (DNS, WAF, Image-Caching für öffentliche Assets).

Monitoring: Sentry (Errors), Plausible (Analytics, cookie-frei), Better-Stack / Uptime-Robot (Uptime).

CI/CD: GitHub Actions. Build, Test, Type-Check, Lint, Migration-Dry-Run, Deploy.

Linting & Formatting: ESLint, Prettier, TypeScript Strict.

Tests: Vitest (Unit), Playwright (E2E), Drizzle In-Memory mit pglite oder Test-Postgres (Integration).

Designsystem: eigenes minimales Design-Token-Set in `src/design/tokens.ts`. Komponenten in `src/components/ui/`. Schriften: Inter (UI) + IBM Plex Sans (Akzent) — beides selbst gehostet (kein Google-Fonts-Tracking).

i18n: nicht in v1.0. Strings als Konstanten in `src/i18n/de.ts`. Vorbereitung für späteres `i18next`/`next-intl`, aber nicht installiert.

⸻

12. Repository- und Modul-Struktur

```
werkzirkel/
├── apps/
│   └── web/                          # Next.js App
│       ├── app/                      # App Router
│       │   ├── (marketing)/          # öffentliche Seiten
│       │   │   ├── page.tsx          # Startseite
│       │   │   ├── zirkel/[stadt]/   # Zirkel-Seite
│       │   │   ├── werke/            # Werke-Übersicht
│       │   │   ├── werke/[id]/       # Werk-Detail
│       │   │   ├── pruefrunden/      # Prüfrunden-Liste
│       │   │   ├── termine/          # Termin-Liste
│       │   │   ├── termine/[id]/     # Termin-Detail
│       │   │   ├── ueber/            # Über Werkzirkel
│       │   │   ├── regeln/           # Community-Regeln
│       │   │   ├── impressum/
│       │   │   ├── datenschutz/
│       │   │   └── agb/
│       │   ├── (app)/                # eingeloggt
│       │   │   ├── uebersicht/
│       │   │   ├── werkpass/
│       │   │   ├── werke/
│       │   │   ├── bedarfe/
│       │   │   ├── foerderprofil/
│       │   │   ├── pruefrunden/
│       │   │   ├── werkangebote/
│       │   │   ├── termine/
│       │   │   └── einstellungen/
│       │   ├── (admin)/              # Kurator + Admin
│       │   │   ├── kurator/
│       │   │   │   ├── verifikationen/
│       │   │   │   ├── bedarfe/
│       │   │   │   ├── meldungen/
│       │   │   │   └── werkstattkasse/
│       │   │   └── admin/
│       │   │       ├── nutzer/
│       │   │       ├── staedte/
│       │   │       ├── kuratoren/
│       │   │       └── konfiguration/
│       │   ├── api/                  # API-Routen
│       │   │   ├── auth/
│       │   │   ├── werke/
│       │   │   ├── pruefrunden/
│       │   │   ├── bedarfe/
│       │   │   ├── werkangebote/
│       │   │   ├── foerderprofile/
│       │   │   ├── termine/
│       │   │   ├── stripe/webhook/
│       │   │   └── cron/
│       │   └── layout.tsx
│       ├── components/
│       ├── lib/
│       │   ├── db/                   # Drizzle Schema + Migrationen
│       │   ├── auth/                 # Auth-Logik
│       │   ├── email/                # React-Email-Templates
│       │   ├── stripe/
│       │   ├── reziprozitaet/        # Reziprozitäts-Engine
│       │   ├── werkstattbeitrag/
│       │   ├── moderation/
│       │   ├── notifications/
│       │   └── jobs/                 # Cron-Job-Implementierungen
│       ├── i18n/
│       │   └── de.ts                 # alle UI-Strings
│       ├── design/
│       │   └── tokens.ts
│       └── tests/
│           ├── unit/
│           ├── integration/
│           └── e2e/
├── packages/
│   └── shared/                       # geteilte Typen / Konstanten
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── deploy.yml
├── drizzle.config.ts
├── package.json
├── tsconfig.json
├── eslint.config.js
├── tailwind.config.ts
└── README.md
```

⸻

13. Datenmodell (vollständig)

Konventionen:
* IDs: `text` (cuid2 oder ulid), nicht `serial int`
* Zeitstempel: `timestamptz`, immer UTC, Default `now()`
* Soft-Delete: nur für Nutzer:innen-Konten (`status` Enum), alle anderen Tabellen hard-delete on cascade oder set-null
* Foreign Keys mit `on delete` Verhalten dokumentiert
* Stadt-Code als ISO-ähnliches Kürzel: `hh`, `b`, `m`, später `k`, `f`, `s`, `wien`, `zrh`

13.1 `stadt`

```
id            text PRIMARY KEY               -- 'hh', 'b', 'm'
name          text NOT NULL UNIQUE           -- 'Hamburg', 'Berlin'
status        text NOT NULL                  -- 'aktiv' | 'vorbereitung' | 'inaktiv'
kurator_id    text REFERENCES nutzer(id) ON DELETE SET NULL
beschreibung  text
sortierung    int  NOT NULL DEFAULT 100
erstellt_am   timestamptz NOT NULL DEFAULT now()
aktualisiert_am timestamptz NOT NULL DEFAULT now()
```

Index: `stadt_status_idx` auf `status`.

Seed: Hamburg (`hh`, aktiv), Berlin (`b`, vorbereitung), München (`m`, vorbereitung).

13.2 `nutzer`

```
id                              text PRIMARY KEY (cuid2)
email                           text NOT NULL UNIQUE
email_verifiziert_am            timestamptz
klarname                        text NOT NULL                   -- Pflicht für Bedarfsträger/Förderer, optional für Macher
anzeigename                     text NOT NULL                   -- Pseudonym erlaubt
stadt_id                        text NOT NULL REFERENCES stadt(id)
kurzbeschreibung                text
faehigkeiten                    text[] NOT NULL DEFAULT '{}'
interessen                      text[] NOT NULL DEFAULT '{}'
rollen                          text[] NOT NULL DEFAULT '{macher}'  -- subset of {macher,bedarfstraeger,foerderer,kurator,admin}
website                         text
github                          text
linkedin                        text
mastodon                        text
avatar_url                      text
teilnahmeart                    text                            -- 'online' | 'vor_ort' | 'beides'
foerdermitglied_seit            timestamptz
foerdermitglied_bis             timestamptz
benachrichtigungs_einstellungen jsonb NOT NULL DEFAULT '{}'
status                          text NOT NULL DEFAULT 'aktiv'   -- 'aktiv' | 'pausiert' | 'gesperrt' | 'loeschung_anstehend'
loeschung_anstehend_bis         timestamptz
erstellt_am                     timestamptz NOT NULL DEFAULT now()
aktualisiert_am                 timestamptz NOT NULL DEFAULT now()
```

Indizes: `nutzer_email_idx` (UNIQUE), `nutzer_stadt_id_idx`, `nutzer_status_idx`, GIN auf `rollen`, GIN auf `faehigkeiten`.

Konsistenz-Regeln (in Anwendung erzwungen, nicht DB):
* wenn `bedarfstraeger` oder `foerderer` in `rollen`: `klarname` Pflicht (nicht NULL, nicht leer)

13.3 `session`

```
id              text PRIMARY KEY
nutzer_id       text NOT NULL REFERENCES nutzer(id) ON DELETE CASCADE
expires_at      timestamptz NOT NULL
user_agent      text
ip_adresse      text
erstellt_am     timestamptz NOT NULL DEFAULT now()
```

Index: `session_nutzer_id_idx`, `session_expires_at_idx`.

13.4 `magic_link_token`

```
id              text PRIMARY KEY
email           text NOT NULL
token_hash      text NOT NULL UNIQUE        -- nur Hash, niemals Klartext
zweck           text NOT NULL               -- 'login' | 'registrierung' | 'konto_loeschen_bestaetigung'
expires_at      timestamptz NOT NULL        -- 15 Minuten
verwendet_am    timestamptz
erstellt_am     timestamptz NOT NULL DEFAULT now()
```

Index: `magic_link_email_idx`, `magic_link_expires_at_idx`.

13.5 `werk`

```
id                  text PRIMARY KEY
nutzer_id           text NOT NULL REFERENCES nutzer(id) ON DELETE CASCADE
name                text NOT NULL
kurzbeschreibung    text NOT NULL                              -- max 280 (App-validiert)
problem             text NOT NULL
zielgruppe          text NOT NULL
werkstand           text NOT NULL                              -- siehe Section 14
hilfebedarf         text[] NOT NULL DEFAULT '{}'
link                text
screenshots         text[] NOT NULL DEFAULT '{}'               -- bis zu 3 R2-URLs
sichtbarkeit        text NOT NULL DEFAULT 'oeffentlich'        -- 'oeffentlich' | 'nur_zirkel' | 'pausiert'
status              text NOT NULL DEFAULT 'aktiv'              -- 'aktiv' | 'ausgeblendet'
fts                 tsvector GENERATED ALWAYS AS (
                      setweight(to_tsvector('german', coalesce(name, '')), 'A') ||
                      setweight(to_tsvector('german', coalesce(kurzbeschreibung, '')), 'B') ||
                      setweight(to_tsvector('german', coalesce(problem, '')), 'C')
                    ) STORED
erstellt_am         timestamptz NOT NULL DEFAULT now()
aktualisiert_am     timestamptz NOT NULL DEFAULT now()
```

Indizes: `werk_nutzer_id_idx`, `werk_werkstand_idx`, `werk_sichtbarkeit_status_idx`, GIN auf `hilfebedarf`, GIN auf `fts`.

13.6 `werk_historie`

```
id              text PRIMARY KEY
werk_id         text NOT NULL REFERENCES werk(id) ON DELETE CASCADE
werkstand_alt   text
werkstand_neu   text
geaendert_von   text NOT NULL REFERENCES nutzer(id) ON DELETE SET NULL
geaendert_am    timestamptz NOT NULL DEFAULT now()
```

13.7 `pruefrunde`

```
id                   text PRIMARY KEY
werk_id              text NOT NULL REFERENCES werk(id) ON DELETE CASCADE
titel                text NOT NULL
testziel             text NOT NULL
testaufgabe          text NOT NULL                              -- Markdown
zielgruppe           text NOT NULL
zeitbedarf_minuten   int NOT NULL
gesuchte_tester      int NOT NULL                               -- 1..10
feedback_kategorien  text[] NOT NULL                            -- subset Section 8.4
frist                timestamptz NOT NULL
status               text NOT NULL DEFAULT 'entwurf'            -- siehe Section 14
erstellt_am          timestamptz NOT NULL DEFAULT now()
aktualisiert_am      timestamptz NOT NULL DEFAULT now()
```

Indizes: `pruefrunde_werk_id_idx`, `pruefrunde_status_frist_idx`.

13.8 `pruefrunden_anmeldung`

```
id              text PRIMARY KEY
pruefrunde_id   text NOT NULL REFERENCES pruefrunde(id) ON DELETE CASCADE
tester_id       text NOT NULL REFERENCES nutzer(id) ON DELETE CASCADE
status          text NOT NULL DEFAULT 'angemeldet'  -- 'angemeldet' | 'feedback_gegeben' | 'zurueckgezogen'
erstellt_am     timestamptz NOT NULL DEFAULT now()
UNIQUE (pruefrunde_id, tester_id)
```

13.9 `feedback`

```
id                       text PRIMARY KEY
pruefrunde_id            text NOT NULL REFERENCES pruefrunde(id) ON DELETE CASCADE
tester_id                text NOT NULL REFERENCES nutzer(id) ON DELETE SET NULL
erster_eindruck          text
verstaendlichkeit        text
nutzen                   text
bedienbarkeit            text
fehler                   text
positionierung           text
zahlungsbereitschaft     text
verbesserungen           text
gesamteindruck           text NOT NULL
hilfreich_markiert       boolean NOT NULL DEFAULT false
hilfreich_markiert_am    timestamptz
erstellt_am              timestamptz NOT NULL DEFAULT now()
UNIQUE (pruefrunde_id, tester_id)
```

Indizes: `feedback_pruefrunde_id_idx`, `feedback_tester_id_idx`.

13.10 `test_saldo` (materialisiert pro Nutzer:in, gepflegt von Reziprozitäts-Engine)

```
nutzer_id                       text PRIMARY KEY REFERENCES nutzer(id) ON DELETE CASCADE
tests_gegeben                   int NOT NULL DEFAULT 0
tests_erhalten                  int NOT NULL DEFAULT 0
offene_verpflichtung_anzahl     int NOT NULL DEFAULT 0
naechste_verpflichtung_frist    timestamptz
aktualisiert_am                 timestamptz NOT NULL DEFAULT now()
```

13.11 `pruefrunden_verpflichtung`

```
id                  text PRIMARY KEY
nutzer_id           text NOT NULL REFERENCES nutzer(id) ON DELETE CASCADE
aus_pruefrunde_id   text NOT NULL REFERENCES pruefrunde(id) ON DELETE CASCADE
frist               timestamptz NOT NULL
status              text NOT NULL DEFAULT 'offen'           -- 'offen' | 'erfuellt' | 'verfallen'
erfuellt_durch_feedback_id text REFERENCES feedback(id)
erstellt_am         timestamptz NOT NULL DEFAULT now()
```

13.12 `werkstattbeitrag`

```
id                       text PRIMARY KEY
nutzer_id                text NOT NULL REFERENCES nutzer(id) ON DELETE CASCADE
art                      text NOT NULL          -- 'schauabend_teilnahme' | 'geldbeitrag' | 'sachleistung'
hoehe_euro_cent          int                    -- bei geldbeitrag
nachweis_text            text
nachweis_dokument_url    text
termin_id                text REFERENCES termin(id)   -- bei schauabend_teilnahme
stripe_session_id        text                   -- bei geldbeitrag
status                   text NOT NULL DEFAULT 'erfasst'  -- 'erfasst' | 'verifiziert' | 'abgelehnt'
verifiziert_durch        text REFERENCES nutzer(id)
verifiziert_am           timestamptz
gueltig_bis              timestamptz                    -- 6 Monate nach Verifikation
verwendet_fuer_bedarfe   int NOT NULL DEFAULT 0          -- max 4
erstellt_am              timestamptz NOT NULL DEFAULT now()
```

Indizes: `werkstattbeitrag_nutzer_id_idx`, `werkstattbeitrag_status_idx`.

13.13 `bedarf`

```
id                       text PRIMARY KEY
nutzer_id                text NOT NULL REFERENCES nutzer(id) ON DELETE CASCADE
organisation             text NOT NULL
titel                    text NOT NULL
problem                  text NOT NULL                  -- Markdown
nutzen                   text NOT NULL
stadt_id                 text NOT NULL REFERENCES stadt(id)
groessenordnung_zeit_wochen     int
groessenordnung_aufwand_tage    int
geldrahmen_min_euro_cent        int
geldrahmen_max_euro_cent        int
frist                    timestamptz NOT NULL
werkstattbeitrag_id      text REFERENCES werkstattbeitrag(id)
branche                  text
bevorzugter_werkstand    text
status                   text NOT NULL DEFAULT 'entwurf'  -- siehe Section 14
erfuellt_von_werk_id     text REFERENCES werk(id)
selbstauskunft_groesse_euro_cent_min  int
selbstauskunft_groesse_euro_cent_max  int
erfuellt_am              timestamptz
fts                      tsvector GENERATED ALWAYS AS (
                            setweight(to_tsvector('german', coalesce(titel, '')), 'A') ||
                            setweight(to_tsvector('german', coalesce(problem, '')), 'B')
                         ) STORED
erstellt_am              timestamptz NOT NULL DEFAULT now()
aktualisiert_am          timestamptz NOT NULL DEFAULT now()
```

Indizes: `bedarf_nutzer_id_idx`, `bedarf_stadt_status_idx`, `bedarf_frist_idx`, GIN auf `fts`.

13.14 `werkangebot`

```
id                              text PRIMARY KEY
bedarf_id                       text NOT NULL REFERENCES bedarf(id) ON DELETE CASCADE
werk_id                         text NOT NULL REFERENCES werk(id) ON DELETE CASCADE
macher_id                       text NOT NULL REFERENCES nutzer(id) ON DELETE CASCADE
konkretes_vorgehen              text NOT NULL                 -- Markdown
ausdruecklicher_ausschluss      text NOT NULL
erster_liefer_meilenstein       text NOT NULL
status                          text NOT NULL DEFAULT 'eingereicht'  -- siehe Section 14
erstellt_am                     timestamptz NOT NULL DEFAULT now()
aktualisiert_am                 timestamptz NOT NULL DEFAULT now()
UNIQUE (bedarf_id, werk_id)
```

Indizes: `werkangebot_bedarf_id_idx`, `werkangebot_macher_id_idx`.

Row-Level Security: nur `bedarf.nutzer_id` und `werkangebot.macher_id` dürfen lesen (durchgesetzt in API-Layer, nicht Postgres RLS).

13.15 `foerderprofil`

```
id                          text PRIMARY KEY
nutzer_id                   text NOT NULL UNIQUE REFERENCES nutzer(id) ON DELETE CASCADE
organisation                text NOT NULL
foerderart                  text NOT NULL                         -- siehe Section 8.7
foerderrahmen_jahr_min_euro_cent       int
foerderrahmen_jahr_max_euro_cent       int
foerderrahmen_einzel_max_euro_cent     int
bevorzugte_werke            text                                  -- Freitext + Tags
gegenleistung_typ           text NOT NULL
gegenleistung_text          text
verifikation_status         text NOT NULL DEFAULT 'entwurf'       -- siehe Section 14
verifizierer_id             text REFERENCES nutzer(id)
verifiziert_am              timestamptz
pausiert_seit               timestamptz
letzte_bedarfsschau_id      text REFERENCES termin(id)
letzte_bedarfsschau_am      timestamptz
erstellt_am                 timestamptz NOT NULL DEFAULT now()
aktualisiert_am             timestamptz NOT NULL DEFAULT now()
```

Indizes: `foerderprofil_status_idx`, `foerderprofil_letzte_bedarfsschau_idx`.

13.16 `termin`

```
id                  text PRIMARY KEY
stadt_id            text NOT NULL REFERENCES stadt(id)
typ                 text NOT NULL                              -- 'pruefabend' | 'schauabend' | 'bedarfsschau' | 'baurunde' | 'werkgespraech' | 'kennenlernrunde'
titel               text NOT NULL
beschreibung        text NOT NULL
ort_text            text
online_link         text
datum_uhrzeit       timestamptz NOT NULL
max_teilnehmer      int NOT NULL
erstellt_von        text NOT NULL REFERENCES nutzer(id)
status              text NOT NULL DEFAULT 'geplant'            -- 'geplant' | 'veroeffentlicht' | 'abgesagt' | 'durchgefuehrt'
notizen_nach_termin text                                       -- vom Kurator
erstellt_am         timestamptz NOT NULL DEFAULT now()
aktualisiert_am     timestamptz NOT NULL DEFAULT now()
```

Indizes: `termin_stadt_typ_idx`, `termin_datum_idx`, `termin_status_idx`.

13.17 `termin_anmeldung`

```
id              text PRIMARY KEY
termin_id       text NOT NULL REFERENCES termin(id) ON DELETE CASCADE
nutzer_id       text NOT NULL REFERENCES nutzer(id) ON DELETE CASCADE
status          text NOT NULL DEFAULT 'angemeldet'   -- 'angemeldet' | 'warteliste' | 'anwesend' | 'nicht_anwesend' | 'storniert'
notiz           text
erstellt_am     timestamptz NOT NULL DEFAULT now()
UNIQUE (termin_id, nutzer_id)
```

13.18 `termin_werk_bezug` (für Schauabende — welche Werke werden gezeigt)

```
id              text PRIMARY KEY
termin_id       text NOT NULL REFERENCES termin(id) ON DELETE CASCADE
werk_id         text NOT NULL REFERENCES werk(id) ON DELETE CASCADE
reihenfolge     int NOT NULL DEFAULT 100
notizen         text
UNIQUE (termin_id, werk_id)
```

13.19 `termin_bedarf_bezug` (für Bedarfsschauen)

```
id              text PRIMARY KEY
termin_id       text NOT NULL REFERENCES termin(id) ON DELETE CASCADE
bedarf_id       text NOT NULL REFERENCES bedarf(id) ON DELETE CASCADE
reihenfolge     int NOT NULL DEFAULT 100
notizen         text
UNIQUE (termin_id, bedarf_id)
```

13.20 `termin_foerderprofil_bezug`

```
id                  text PRIMARY KEY
termin_id           text NOT NULL REFERENCES termin(id) ON DELETE CASCADE
foerderprofil_id    text NOT NULL REFERENCES foerderprofil(id) ON DELETE CASCADE
reihenfolge         int NOT NULL DEFAULT 100
notizen             text
UNIQUE (termin_id, foerderprofil_id)
```

13.21 `hilfegesuch`

```
id              text PRIMARY KEY
nutzer_id       text NOT NULL REFERENCES nutzer(id) ON DELETE CASCADE
werk_id         text REFERENCES werk(id) ON DELETE SET NULL
stadt_id        text NOT NULL REFERENCES stadt(id)
titel           text NOT NULL
beschreibung    text NOT NULL
tags            text[] NOT NULL DEFAULT '{}'
gueltig_bis     timestamptz NOT NULL                         -- max 14 Tage
status          text NOT NULL DEFAULT 'offen'                -- 'offen' | 'beantwortet' | 'abgelaufen'
erstellt_am     timestamptz NOT NULL DEFAULT now()
```

13.22 `hilfegesuch_antwort`

```
id              text PRIMARY KEY
hilfegesuch_id  text NOT NULL REFERENCES hilfegesuch(id) ON DELETE CASCADE
nutzer_id       text NOT NULL REFERENCES nutzer(id) ON DELETE CASCADE
text            text NOT NULL
erstellt_am     timestamptz NOT NULL DEFAULT now()
```

13.23 `erfolgsbeitrag`

```
id                   text PRIMARY KEY
bedarf_id            text NOT NULL REFERENCES bedarf(id) ON DELETE SET NULL
zahler_nutzer_id     text NOT NULL REFERENCES nutzer(id) ON DELETE SET NULL
hoehe_euro_cent      int NOT NULL
prozent_satz         numeric(5,2)                            -- z.B. 5.00
stripe_session_id    text NOT NULL
status               text NOT NULL DEFAULT 'initiiert'        -- 'initiiert' | 'bezahlt' | 'fehlgeschlagen' | 'storniert'
gezahlt_am           timestamptz
erstellt_am          timestamptz NOT NULL DEFAULT now()
```

13.24 `werkstatt_kasse_eintrag`

```
id                  text PRIMARY KEY
stadt_id            text NOT NULL REFERENCES stadt(id)
typ                 text NOT NULL                           -- 'eingang' | 'ausgang'
kategorie           text NOT NULL                           -- siehe Section 8.11
hoehe_euro_cent     int NOT NULL
beschreibung        text NOT NULL
beleg_url           text
referenz_typ        text                                    -- 'werkstattbeitrag' | 'erfolgsbeitrag' | 'foerdermitgliedschaft' | 'spende' | 'rechnung'
referenz_id         text
datum               date NOT NULL
quartal             text NOT NULL                           -- '2026-Q1'
erfasst_durch       text NOT NULL REFERENCES nutzer(id)
freigegeben_durch   text REFERENCES nutzer(id)
freigegeben_am      timestamptz
erstellt_am         timestamptz NOT NULL DEFAULT now()
```

13.25 `foerdermitgliedschaft`

```
id                       text PRIMARY KEY
nutzer_id                text NOT NULL UNIQUE REFERENCES nutzer(id) ON DELETE CASCADE
stufe                    text NOT NULL                       -- 'monatlich' | 'jaehrlich' | 'foerderer_privat' | 'foerderer_organisation'
stripe_customer_id       text NOT NULL
stripe_subscription_id   text
beginn                   timestamptz NOT NULL
ende                     timestamptz
status                   text NOT NULL                       -- 'aktiv' | 'gekuendigt' | 'zahlung_fehlt'
erstellt_am              timestamptz NOT NULL DEFAULT now()
```

13.26 `meldung` (Reports)

```
id                  text PRIMARY KEY
gemeldet_von        text NOT NULL REFERENCES nutzer(id) ON DELETE SET NULL
referenz_typ        text NOT NULL                           -- 'werk' | 'bedarf' | 'werkangebot' | 'foerderprofil' | 'nutzer' | 'feedback' | 'hilfegesuch_antwort'
referenz_id         text NOT NULL
kategorie           text NOT NULL                           -- 'cold_outreach' | 'sales_sprech' | 'spam' | 'beleidigung' | 'sonstiges'
beschreibung        text
status              text NOT NULL DEFAULT 'offen'           -- 'offen' | 'in_pruefung' | 'erledigt' | 'verworfen'
bearbeiter_id       text REFERENCES nutzer(id)
ergebnis_notiz      text
erstellt_am         timestamptz NOT NULL DEFAULT now()
geschlossen_am      timestamptz
```

13.27 `audit_log`

```
id              text PRIMARY KEY
nutzer_id       text REFERENCES nutzer(id) ON DELETE SET NULL
aktion          text NOT NULL                           -- z.B. 'werk.veroeffentlicht', 'bedarf.erfuellt', 'foerderprofil.verifiziert'
referenz_typ    text
referenz_id     text
metadaten       jsonb NOT NULL DEFAULT '{}'
ip_adresse      text
user_agent      text
erstellt_am     timestamptz NOT NULL DEFAULT now()
```

Indizes: `audit_log_nutzer_id_idx`, `audit_log_aktion_idx`, `audit_log_erstellt_am_idx`.

13.28 `email_benachrichtigung_log`

```
id              text PRIMARY KEY
nutzer_id       text REFERENCES nutzer(id) ON DELETE SET NULL
email           text NOT NULL
template        text NOT NULL
betreff         text NOT NULL
status          text NOT NULL                           -- 'gesendet' | 'fehlgeschlagen' | 'bounced'
resend_id       text
fehler_meldung  text
erstellt_am     timestamptz NOT NULL DEFAULT now()
```

⸻

14. Status-Maschinen

14.1 Werk
`aktiv` ↔ `ausgeblendet` (Kurator/Admin)
Sichtbarkeit unabhängig: `oeffentlich` ↔ `nur_zirkel` ↔ `pausiert` (Inhaber:in)
Werkstand: `idee` → `prototyp` → `testversion` → `oeffentlich` → `wachsend` ↔ `pausiert` (Inhaber:in, jederzeit beliebig)

14.2 Prüfrunde
`entwurf` → (Reziprozitäts-Engine + Werk-Inhaber:in) → `oeffentlich` → (Frist erreicht ODER manuell geschlossen) → `geschlossen` → (Werk-Inhaber:in markiert mind. 1 hilfreich) → `abgeschlossen`
Rückweg: nur `entwurf` → `gelöscht`. Veröffentlichte Prüfrunden sind unwiderruflich (Datenhygiene).

14.3 Bedarf
`entwurf` → (Werkstattbeitrag verknüpft + Bedarfsträger:in reicht ein) → `in_pruefung` → (Kurator:in prüft Sprache) → `oeffentlich`
`oeffentlich` → (mindestens 1 Werkangebot in `in_gespraechen`) → `in_gespraechen`
`in_gespraechen` ODER `oeffentlich` → `erfuellt` (Bedarfsträger:in, mit oder ohne Werk-Verweis)
Jeder Zustand → `eingestellt` (Bedarfsträger:in oder Kurator:in)
`in_pruefung` → `eingestellt` (Kurator:in lehnt ab)

14.4 Werkangebot
`eingereicht` → `in_gespraechen` (Bedarfsträger:in)
`eingereicht` ODER `in_gespraechen` → `beauftragt` (Bedarfsträger:in)
`eingereicht` ODER `in_gespraechen` → `nicht_gewaehlt` (Bedarfsträger:in)
`eingereicht` → `zurueckgezogen` (Macher:in)

14.5 Förderprofil
`entwurf` → `in_verifikation` (Förder:in reicht ein)
`in_verifikation` → `verifiziert` (Kurator:in)
`in_verifikation` → `abgelehnt` (Kurator:in)
`verifiziert` → `pausiert` (Auto-Job nach 4 Quartalen ohne Bedarfsschau ODER Förder:in pausiert selbst)
`pausiert` → `in_verifikation` (Förder:in reaktiviert mit neuer Bedarfsschau-Teilnahme)

14.6 Termin
`geplant` → `veroeffentlicht` (Kurator:in)
`veroeffentlicht` → `abgesagt` (Kurator:in mit Mail-Benachrichtigung aller Angemeldeten)
`veroeffentlicht` → `durchgefuehrt` (Kurator:in nach dem Termin, mit Anwesenheitsdokumentation)

14.7 Werkstattbeitrag
`erfasst` → (bei art=geldbeitrag: Stripe Webhook bestätigt) → `verifiziert`
`erfasst` → (bei art=schauabend_teilnahme oder sachleistung: Kurator:in) → `verifiziert`
`erfasst` → `abgelehnt` (Kurator:in)

14.8 Nutzer:innen-Konto
`aktiv` → `pausiert` (selbst)
`aktiv` → `gesperrt` (Kurator:in für Stadt, Admin global)
`aktiv` → `loeschung_anstehend` (selbst, 7 Tage Karenz)
`loeschung_anstehend` → `aktiv` (selbst, Widerruf)
`loeschung_anstehend` → (Cron-Job nach 7 Tagen) → hard-delete

⸻

15. API-Spezifikation (REST, JSON, Next.js Route Handlers)

Konventionen:
* alle Endpunkte unter `/api/v1/...`
* JSON-Body Content-Type `application/json; charset=utf-8`
* Pagination: `?cursor=<id>&limit=<n>` (Default limit 20, max 100)
* Fehler: `{ "error": { "code": "...", "message": "...", "details": {...} } }` mit HTTP-Statuscode
* Auth via Session-Cookie `wz_session` (httpOnly, Secure, SameSite=Lax, Max-Age 30 Tage)
* CSRF: Server Actions verwenden Next.js eingebauten CSRF-Schutz; klassische POST-Endpunkte erfordern Origin-Header-Check

15.1 Auth

`POST /api/v1/auth/magic-link`
Body: `{ email: string, zweck: "login" | "registrierung" }`
Antwort: `204 No Content` (immer, auch wenn E-Mail nicht existiert — Aufklärungsschutz)

`GET /api/v1/auth/magic-link/verify?token=<token>`
Antwort: `302` Redirect auf `/uebersicht` mit Session-Cookie

`POST /api/v1/auth/logout`
Antwort: `204`

`POST /api/v1/auth/logout-all`
Antwort: `204`

`GET /api/v1/auth/me`
Antwort: `{ nutzer: NutzerOeffentlich, sessions: Session[] }`

15.2 Nutzer / Werkpass

`GET /api/v1/nutzer/:id` — öffentliche Profilfelder
`GET /api/v1/me` — vollständiges eigenes Profil
`PATCH /api/v1/me` — Profil-Update (validiert mit Zod)
`POST /api/v1/me/avatar` — Multipart, Bild-Upload
`DELETE /api/v1/me` — Konto-Löschung initiieren (mit Bestätigungs-E-Mail)
`POST /api/v1/me/cancel-deletion` — Widerruf in Karenz
`GET /api/v1/me/export` — JSON-Export aller eigenen Daten

15.3 Werke

`GET /api/v1/werke` — Liste (Filter: `stadt_id`, `werkstand`, `hilfebedarf`, `cursor`)
`GET /api/v1/werke/:id` — Detail
`POST /api/v1/werke` — anlegen (Auth + Macher:innen-Rolle)
`PATCH /api/v1/werke/:id` — bearbeiten (eigenes)
`DELETE /api/v1/werke/:id` — löschen (eigenes)
`POST /api/v1/werke/:id/screenshots` — Multipart Upload (max 3)
`DELETE /api/v1/werke/:id/screenshots/:url` — Screenshot löschen
`GET /api/v1/werke/:id/historie` — Werkstand-Verlauf

15.4 Prüfrunden

`GET /api/v1/pruefrunden` — Liste (Filter: `stadt_id`, `status`, `werk_id`)
`GET /api/v1/pruefrunden/:id` — Detail
`POST /api/v1/pruefrunden` — anlegen (eigene Werke, Reziprozitäts-Engine prüft)
`PATCH /api/v1/pruefrunden/:id` — bearbeiten (nur `entwurf`)
`POST /api/v1/pruefrunden/:id/veroeffentlichen` — Status-Übergang
`POST /api/v1/pruefrunden/:id/schliessen` — manuell schließen
`POST /api/v1/pruefrunden/:id/anmeldung` — Tester:in meldet sich an
`DELETE /api/v1/pruefrunden/:id/anmeldung` — Anmeldung zurückziehen
`POST /api/v1/pruefrunden/:id/feedback` — Feedback abgeben
`PATCH /api/v1/feedback/:id/hilfreich` — Werk-Inhaber:in markiert hilfreich

15.5 Bedarfe

`GET /api/v1/bedarfe` — nur eingeloggt; Filter: `stadt_id`, `status=oeffentlich`, `cursor`
`GET /api/v1/bedarfe/:id` — Detail; Werkangebote nur sichtbar wenn Bedarfsträger:in
`POST /api/v1/bedarfe` — anlegen (Bedarfsträger:innen-Rolle, mit Werkstattbeitrag-Verknüpfung Pflicht)
`PATCH /api/v1/bedarfe/:id` — bearbeiten (nur Entwurf)
`POST /api/v1/bedarfe/:id/einreichen` — `entwurf` → `in_pruefung`
`POST /api/v1/bedarfe/:id/erfuellt` — Status-Übergang mit optionalen Erfüllungsdaten
`DELETE /api/v1/bedarfe/:id` — einstellen

15.6 Werkangebote

`POST /api/v1/bedarfe/:id/werkangebote` — abgeben (Macher:in, max 1 pro Werk)
`GET /api/v1/bedarfe/:id/werkangebote` — nur Bedarfsträger:in
`GET /api/v1/me/werkangebote` — eigene
`PATCH /api/v1/werkangebote/:id` — Status-Übergänge (siehe Section 14.4)
`DELETE /api/v1/werkangebote/:id` — Macher:in zieht zurück

15.7 Förderprofile

`GET /api/v1/foerderprofile` — Liste (nur `verifiziert`)
`GET /api/v1/foerderprofile/:id` — Detail
`POST /api/v1/foerderprofile` — anlegen (Förder:innen-Rolle)
`PATCH /api/v1/foerderprofile/:id` — bearbeiten
`POST /api/v1/foerderprofile/:id/einreichen` — `entwurf` → `in_verifikation`
`POST /api/v1/foerderprofile/:id/pausieren` — selbst pausieren
`POST /api/v1/foerderprofile/:id/reaktivieren` — nach Pause

15.8 Termine

`GET /api/v1/termine` — Filter: `stadt_id`, `typ`, `ab_datum`, `bis_datum`
`GET /api/v1/termine/:id` — Detail
`GET /api/v1/termine/:id/ical` — iCalendar-Download
`POST /api/v1/termine/:id/anmeldung` — anmelden
`DELETE /api/v1/termine/:id/anmeldung` — stornieren
(Kurator-Endpunkte siehe 15.13)

15.9 Hilfegesuche

`GET /api/v1/hilfegesuche` — Filter `stadt_id`, `tags`, `status=offen`
`POST /api/v1/hilfegesuche` — anlegen
`POST /api/v1/hilfegesuche/:id/antwort` — antworten
`DELETE /api/v1/hilfegesuche/:id` — schließen (selbst)

15.10 Werkstattbeitrag

`GET /api/v1/me/werkstattbeitrag` — eigene
`POST /api/v1/werkstattbeitrag/geldbeitrag` — Stripe Checkout starten (Body: `{ hoehe: 5000 | 10000 | 15000 }` in Cent), Antwort: `{ checkoutUrl }`
`POST /api/v1/werkstattbeitrag/sachleistung` — Entwurf, danach Kurator-Verifikation

15.11 Stripe-Webhook

`POST /api/v1/stripe/webhook` — verarbeitet:
* `checkout.session.completed` für Werkstattbeitrag, Erfolgsbeitrag, Fördermitgliedschaft
* `customer.subscription.updated` für Fördermitgliedschaft
* `invoice.payment_succeeded`
* `invoice.payment_failed`
Signaturprüfung via `stripe-signature` Header zwingend.

15.12 Erfolgsbeitrag

`POST /api/v1/bedarfe/:id/erfolgsbeitrag` — Stripe Checkout starten, Body `{ hoehe_euro_cent, prozent_satz }`

15.13 Kurator-Endpunkte (`/api/v1/kurator/...`)

* `GET /api/v1/kurator/bedarfe-in-pruefung`
* `POST /api/v1/kurator/bedarfe/:id/veroeffentlichen`
* `POST /api/v1/kurator/bedarfe/:id/ablehnen` (Body: `{ grund }`)
* `GET /api/v1/kurator/foerderprofile-in-verifikation`
* `POST /api/v1/kurator/foerderprofile/:id/verifizieren`
* `POST /api/v1/kurator/foerderprofile/:id/ablehnen`
* `GET /api/v1/kurator/werkstattbeitraege-zu-verifizieren`
* `POST /api/v1/kurator/werkstattbeitraege/:id/verifizieren`
* `POST /api/v1/kurator/werkstattbeitraege/:id/ablehnen`
* `GET /api/v1/kurator/meldungen`
* `PATCH /api/v1/kurator/meldungen/:id`
* `POST /api/v1/kurator/termine` — anlegen
* `PATCH /api/v1/kurator/termine/:id`
* `POST /api/v1/kurator/termine/:id/anwesenheit` — Body: `{ nutzer_ids: [...] }`
* `GET /api/v1/kurator/werkstatt-kasse` — Eintraege
* `POST /api/v1/kurator/werkstatt-kasse` — Eintrag erfassen
* `POST /api/v1/kurator/werkstatt-kasse/quartal/:q/abschliessen`

15.14 Admin-Endpunkte (`/api/v1/admin/...`)

* `GET /api/v1/admin/nutzer` (Suche, Filter)
* `POST /api/v1/admin/nutzer/:id/sperren`
* `POST /api/v1/admin/nutzer/:id/entsperren`
* `POST /api/v1/admin/staedte` — neue Stadt anlegen
* `PATCH /api/v1/admin/staedte/:id`
* `POST /api/v1/admin/staedte/:id/kurator` — Kurator:in ernennen
* `GET /api/v1/admin/audit-log`
* `GET /api/v1/admin/email-log`

15.15 Cron / interne Endpunkte

`POST /api/v1/cron/:job_name` — geschützt mit `CRON_SECRET` Header. Jobs siehe Section 11.

⸻

16. Auth, Session, Verifikation

Magic-Link-Flow:
1. `POST /api/v1/auth/magic-link { email, zweck }`
2. Server erzeugt 32-Byte Random Token, hasht mit SHA-256, speichert Hash + Expiry (15 Min) in `magic_link_token`
3. Server schickt E-Mail mit Link `https://werkzirkel.de/api/v1/auth/magic-link/verify?token=<clear>`
4. Klick → Server verifiziert Hash, markiert verwendet, erstellt Session, Redirect mit Cookie

Session-Cookie:
* Name `wz_session`
* httpOnly, Secure, SameSite=Lax
* Max-Age 30 Tage; Sliding Window (jeder Request verlängert um 30 Tage)
* DB-backed (Session in `session`-Tabelle); kein JWT

Mehrfaktor-Auth: nicht in v1.0. Vorbereitet im DB-Schema durch erweiterbares Session-Konzept.

Rate-Limits:
* Magic-Link: 5 pro E-Mail pro Stunde, 30 pro IP pro Stunde
* Login-Verify: 10 pro Token (Token wird nach 1× verwendet entwertet)
* Generelles API-Rate-Limit: 60 Requests/Min/IP für anonym, 300/Min für eingeloggt

Konto-Löschung-Bestätigungs-E-Mail:
* Eigener Magic-Link-Zweck `konto_loeschen_bestaetigung`
* Klick startet 7-Tage-Karenz
* Cron-Job `konto_loeschung_frist_abgelaufen` führt nach Ablauf die harte Löschung aus

⸻

17. Reziprozitäts-Engine

Modul: `lib/reziprozitaet/`.

Funktion `kannPruefrundeStarten(nutzer_id)`:
1. Lade `test_saldo` für Nutzer:in
2. Wenn `tests_gegeben >= 2`: erlaubt, Rückgabe `{ ok: true, modus: "saldo_erfuellt" }`
3. Wenn `tests_gegeben < 2`:
   * Wenn `offene_verpflichtung_anzahl > 0` und `naechste_verpflichtung_frist > now() + 14d`: blockiert
   * Wenn keine offene Verpflichtung: erlaubt mit Erzeugung einer neuen Verpflichtung mit Frist `now() + Prüfrundenfrist + 14d`
4. Wenn `offene_verpflichtung_anzahl > 0` und `naechste_verpflichtung_frist < now()`: blockiert, Rückgabe `{ ok: false, grund: "frist_abgelaufen" }`

Funktion `feedbackGegeben(nutzer_id, feedback_id)`:
1. Inkrementiere `tests_gegeben`
2. Wenn `offene_verpflichtung_anzahl > 0`: schließe die älteste offene Verpflichtung (Status `erfuellt`, `erfuellt_durch_feedback_id`)
3. Dekrementiere `offene_verpflichtung_anzahl`

Cron `reziprozitaet-frist-pruefen` (täglich 06:00):
1. Finde alle `pruefrunden_verpflichtung` mit `status=offen` und `frist < now()`
2. Setze Status `verfallen`
3. Sperre die Möglichkeit für die Nutzer:in, neue Prüfrunden zu starten, bis sie zwei Feedbacks gibt
4. Sende Erinnerungs-E-Mail bei `frist - 3d` und bei `frist - 1d` (separate Pre-Check-Stelle in Cron)

⸻

18. Werkstattbeitrag-Workflow

Drei Pfade:

Pfad A — Schauabend-Teilnahme:
1. Bedarfsträger:in meldet sich zu Schauabend an
2. Kurator:in dokumentiert nach Termin Anwesenheit
3. System erzeugt `werkstattbeitrag` mit `art='schauabend_teilnahme'`, `termin_id`, `status='verifiziert'`, `gueltig_bis = now() + 6 months`
4. Bedarfsträger:in kann ab sofort 4 Bedarfe einreichen, die zur Veröffentlichung kommen

Pfad B — Geldbeitrag:
1. Bedarfsträger:in wählt Beitragstufe (50/100/150 €)
2. POST `/api/v1/werkstattbeitrag/geldbeitrag { hoehe }`
3. Server erzeugt Stripe Checkout Session mit `metadata.zweck = 'werkstattbeitrag'`, `metadata.nutzer_id`
4. Bedarfsträger:in zahlt
5. Stripe Webhook `checkout.session.completed` → erzeuge `werkstattbeitrag` mit `status='verifiziert'`, `gueltig_bis = now() + 6 months`, Eintrag in `werkstatt_kasse_eintrag` (Eingang)

Pfad C — Sachleistung:
1. Bedarfsträger:in beschreibt Sachleistung (Freitext + optional Dokument)
2. Eintrag `werkstattbeitrag` mit `status='erfasst'`
3. Kurator:in prüft und setzt `verifiziert` oder `abgelehnt`

Verbrauchszähler: bei jeder Bedarf-Veröffentlichung wird `werkstattbeitrag.verwendet_fuer_bedarfe` inkrementiert; bei 4 ODER Ablauf Gültigkeit muss ein neuer Beitrag erbracht werden.

⸻

19. Förderprofil-Verifikations-Workflow

1. Förder:in legt Profil an → `entwurf`
2. Förder:in reicht ein → `in_verifikation`, Kurator:in erhält Benachrichtigung
3. Kurator:in prüft:
   * Klarname/Organisation-Plausibilität (Handelsregister/Vereinsregister/Stiftungsregister)
   * Quelle der Mittel
   * vereinbart persönliches Vorstellungsgespräch
4. Förder:in nimmt an einer Bedarfsschau teil (oder Antrittsgespräch + Zusage der ersten Bedarfsschau)
5. Kurator:in setzt `verifiziert`, trägt `verifizierer_id` und `verifiziert_am` ein
6. Profil wird öffentlich
7. Cron `foerderprofil-quartal-pruefen` täglich:
   * Für jedes `verifiziert` Profil: prüfe `letzte_bedarfsschau_am`
   * Wenn länger als 4 Quartale her: setze `pausiert`, sende E-Mail mit Reaktivierungs-Hinweis

⸻

20. Bedarf- und Werkangebot-Workflow

Bedarf-Erstellung:
1. Bedarfsträger:in im `entwurf` → ausfüllen
2. Werkstattbeitrag verknüpfen (entweder durch Auswahl bestehender Beiträge oder durch Initiierung eines neuen Pfads)
3. Einreichen → `in_pruefung`
4. Kurator:in prüft (Sprach-Stichprobe, Plausibilität, Werkstatt-Kultur-Verstöße)
5. → `oeffentlich` ODER → `eingestellt` mit Grund

Sprach-Check beim Einreichen:
* Server matched gegen `verbotene_woerter[]` aus `lib/moderation/verbotene-woerter.ts`
* Bei Treffer wird ein Flag gesetzt, Kurator:in sieht im Backoffice die markierten Begriffe

Werkangebot:
1. Macher:in besucht Bedarf-Detail (im eingeloggten Bereich)
2. Klickt „Werkangebot abgeben"
3. Wählt eines ihrer Werke (Constraint: max 1 Werkangebot pro Werk und Bedarf)
4. Füllt Felder
5. Abgesendet → Status `eingereicht`
6. Bedarfsträger:in erhält E-Mail, kann im Backoffice Werkangebote sehen
7. Bedarfsträger:in setzt eines auf `in_gespraechen` oder mehrere
8. Offline-Gespräch
9. Bedarfsträger:in setzt das ausgewählte auf `beauftragt`, andere optional auf `nicht_gewaehlt` (oder lässt offen)
10. Macher:in erhält E-Mail
11. Bedarfsträger:in markiert irgendwann Bedarf als `erfuellt`, optional mit Verweis auf Werk und Erfolgsbeitrag

⸻

21. Erfolgsbeitrag- und Zahlungs-Flow

Erfolgsbeitrag bei Bedarf-Erfüllung:
1. Bedarfsträger:in markiert Bedarf erfüllt
2. UI fragt: „Möchtest du einen Erfolgsbeitrag spenden? Empfehlung 5 % von …"
3. Slider 0–10 %, vorausgefüllt 5 %
4. Klick auf „Spenden" → POST `/api/v1/bedarfe/:id/erfolgsbeitrag`
5. Stripe Checkout Session mit `metadata.zweck = 'erfolgsbeitrag'`, `metadata.bedarf_id`
6. Bezahlung → Webhook → `erfolgsbeitrag` Eintrag (Status `bezahlt`), Eintrag in `werkstatt_kasse_eintrag`

Fördermitgliedschaft:
* `POST /api/v1/me/foerdermitgliedschaft/start { stufe }` → Stripe Checkout Subscription
* Webhook bei `subscription.updated` / `invoice.payment_succeeded` → Status `aktiv`
* Webhook bei `subscription.deleted` → `gekuendigt`
* Auto-Sync `foerdermitglied_seit` und `foerdermitglied_bis` in `nutzer`

Stripe-Konfiguration (Hinweise, in `STRIPE_SETUP.md` zu dokumentieren):
* Werkstattbeitrag: One-time Payment, Produkte „Werkstattbeitrag 50 €/100 €/150 €"
* Fördermitgliedschaft monatlich: Recurring Subscription Produkt
* Fördermitgliedschaft jährlich: Recurring (Jahres-Intervall)
* Förder-Mitgliedschaft Privat 240 €/Jahr, Organisation 1.200 €/Jahr: separate Produkte
* Erfolgsbeitrag: One-time mit dynamic price
* Zahlungsmethoden: card, klarna, sofort, sepa_debit, apple_pay, google_pay
* Rechnungs-PDFs automatisch von Stripe; werden per E-Mail mitgesendet (mit deutschem Receipt-Template)

⸻

22. Notification-Engine

Modul: `lib/notifications/`.

API: `notify(nutzer_id, template, daten)` → erzeugt Eintrag in `email_benachrichtigung_log`, prüft Einstellungen, sendet via Resend.

Bereiche und Einstellungen (siehe Section 8.14): jeder Bereich entspricht einem Key in `nutzer.benachrichtigungs_einstellungen`. Default-Werte als JSON-Schema in `lib/notifications/defaults.ts`.

Anti-Spam: maximal 5 E-Mails pro Nutzer:in pro Tag (ausgenommen sicherheitsrelevant: Magic-Link, Konto-Löschung-Bestätigung).

Bounce-Handling: Resend-Webhook auf `email.bounced` → setze Eintrag `email_benachrichtigung_log.status = 'bounced'`, bei 3 Bounces hintereinander: pausiere alle Benachrichtigungen für diese E-Mail, kennzeichne `nutzer.status` als „E-Mail nicht erreichbar" (Banner im UI).

⸻

23. E-Mail-Templates (in `lib/email/templates/`, als React-Email)

Pflicht-Templates v1.0:

T-001 magic-link-login
Betreff: „Dein Anmelde-Link für den Werkzirkel"
Inhalt: Großer Button „Anmelden", Klein-Text mit URL für Copy-Paste, 15-Min-Hinweis

T-002 magic-link-registrierung
Betreff: „Willkommen im Werkzirkel — bestätige deine E-Mail"
Inhalt: Button „E-Mail bestätigen", kurze Erklärung was als Nächstes passiert

T-003 konto-loeschung-bestaetigung
Betreff: „Bitte bestätige die Löschung deines Werkzirkel-Kontos"
Inhalt: Button, 7-Tage-Karenz-Hinweis

T-004 konto-loeschung-erinnerung
Betreff: „Dein Konto wird in 2 Tagen gelöscht"

T-005 konto-geloescht
Betreff: „Dein Werkzirkel-Konto wurde gelöscht"
Anhang: JSON-Export

T-101 pruefrunde-neue-anmeldung
T-102 pruefrunde-neues-feedback
T-103 pruefrunde-reziprozitaet-frist-naht (3 Tage, 1 Tag)
T-104 pruefrunde-reziprozitaet-frist-abgelaufen

T-201 werkangebot-eingegangen (an Bedarfsträger:in)
T-202 werkangebot-status-geaendert (an Macher:in)

T-301 bedarf-eingereicht-bestaetigung (an Bedarfsträger:in)
T-302 bedarf-veroeffentlicht
T-303 bedarf-abgelehnt
T-304 bedarf-frist-naht

T-401 termin-anmeldung-bestaetigt
T-402 termin-erinnerung-7d
T-403 termin-erinnerung-1d
T-404 termin-abgesagt

T-501 foerderprofil-eingereicht
T-502 foerderprofil-verifiziert
T-503 foerderprofil-abgelehnt
T-504 foerderprofil-pausiert
T-505 foerderprofil-bedarfsschau-erinnerung (Quartalsende-Hinweis)

T-601 werkstattbeitrag-bezahlt
T-602 werkstattbeitrag-verifiziert
T-603 werkstattbeitrag-ablauf-warnung

T-701 foerdermitgliedschaft-aktiviert
T-702 foerdermitgliedschaft-zahlung-fehlt
T-703 foerdermitgliedschaft-gekuendigt

T-801 stadt-digest-woechentlich
T-802 kurator-mitteilung-stadtweit

T-901 meldung-eingegangen (an Kurator:in)
T-902 meldung-erledigt (an Melder:in)

Alle Templates:
* Deutsch
* einfacher Aufbau, keine Bilder als zentrale Inhalte (nur Logo)
* Plain-Text-Fallback Pflicht
* Footer mit Impressum-Link, Abmeldelink (für nicht-zwingende), Datenschutz-Link

⸻

24. Suchen, Filtern, Sortieren

Werke-Suche (öffentlich):
* Backend: SQL mit FTS `werk.fts @@ websearch_to_tsquery('german', $query)` plus Filter
* Frontend: keine freie Suchleiste auf Hauptseite (P4 Verbindlichkeit), aber Werke-Übersicht hat Filter-Sidebar
* Sortier-Default: `aktualisiert_am DESC`, sekundär `werkstand` Reihenfolge `idee < prototyp < testversion < oeffentlich < wachsend`

Bedarfe-Suche (eingeloggt):
* nur Macher:innen sehen Bedarf-Liste
* FTS auf `bedarf.fts`, Filter `stadt_id`, `frist`, `geldrahmen` (wenn gesetzt)
* Sortier-Default: `frist ASC`

Förderprofile (eingeloggt):
* Filter `stadt_id`, `foerderart`, `gegenleistung_typ`
* Sortier: `verifiziert_am DESC`

Termine:
* Filter `stadt_id`, `typ`, `datum_range`
* Sortier: `datum_uhrzeit ASC`

⸻

25. File-Uploads und Speicher

Allgemein:
* Backend Endpunkt akzeptiert Multipart, validiert MIME-Type, validiert Größe
* Bild-Pipeline: `sharp` resized auf Web-Größen (Werk-Screenshot: 1600px max width, JPEG 85 Quality; Avatar: 256×256 und 512×512 WebP)
* Upload nach R2 Bucket `werkzirkel-public` (Subfolders `avatare/`, `werke/`, `belege/`)
* Original-Datei wird nicht gespeichert (DSGVO Datenminimierung)
* URL-Struktur: `https://media.werkzirkel.de/<subfolder>/<id>-<size>.<ext>`
* Cloudflare-Caching mit langer TTL (Inhalt-Hash im Dateinamen)

Erlaubte MIME-Types: `image/jpeg`, `image/png`, `image/webp` für Bilder; `application/pdf` für Belege (Werkstattbeitrag-Sachleistungsnachweis)

Größenlimits: Bilder 5 MB raw, PDFs 10 MB. Avatar 2 MB raw.

Virus-Scan: ClamAV als optionaler Cron auf hochgeladenen PDFs (v1.0 ja, weil Belege).

⸻

26. Admin-Backoffice

Routen unter `/kurator/...` und `/admin/...` (siehe Section 12).

Kurator:innen-Dashboard:
* offene Bedarfe in Prüfung (Anzahl, Schnellzugriff)
* offene Förderprofile in Verifikation
* offene Werkstattbeiträge (Sachleistung) zu verifizieren
* offene Meldungen
* anstehende Termine
* Quartal-Werkstatt-Kasse (Entwurf-Status)

Kurator-Bedarf-Prüfung-View:
* vollständiger Bedarf-Text
* markierte verbotene Begriffe (Highlight)
* Bedarfsträger:innen-Info: Klarname, Organisation, vorherige Bedarfe, Werkstattbeitrag-Historie
* Buttons: Veröffentlichen, Ablehnen mit Grund

Kurator-Förderprofil-Verifikation-View:
* vollständiges Profil
* Klarname, Organisation, externe Links (Handelsregister o.ä.)
* Checkliste:
  - [ ] Klarname plausibel
  - [ ] Quelle Mittel plausibel
  - [ ] Persönliches Gespräch geführt
  - [ ] Bedarfsschau-Teilnahme zugesagt
* Notizfeld
* Buttons: Verifizieren, Ablehnen

Admin-Backoffice:
* Nutzer:innen-Liste mit Filter und Suche (Klarname, E-Mail, Stadt, Rolle)
* Nutzer:innen-Detailseite mit Aktionen Sperren/Entsperren
* Städte-Verwaltung: Stadt anlegen, Status setzen, Kurator:in ernennen
* Audit-Log-Browser
* E-Mail-Log-Browser
* Globale Konfiguration: Werkstattbeitrag-Skala, Fördermitgliedschaft-Preise, verbotene Wörter

⸻

27. Moderation und Reporting

Melden-Knopf an jedem Nutzerinhalt:
* Werk, Bedarf, Werkangebot (nur sichtbar für Beteiligte), Förderprofil, Nutzer:in, Feedback, Hilfegesuch-Antwort
* Kategorien siehe Glossar
* Melder:in erhält Bestätigungs-E-Mail
* Kurator:innen-Postfach mit SLA 48h

Workflow:
1. Meldung erstellt, Status `offen`
2. Kurator:in nimmt an: Status `in_pruefung`
3. Kurator:in entscheidet: `erledigt` (mit Aktion: Inhalt ausblenden / Nutzer:in sperren / Verwarnung per E-Mail / keine Aktion) ODER `verworfen`
4. Melder:in erhält Ergebnis-Mail

Audit-Logging: jede Moderations-Aktion landet in `audit_log`.

⸻

TEIL D — Qualität, Compliance, Betrieb

⸻

28. UI/UX-Spezifikation

Designprinzipien:
* viel Weißraum, klare Typografie
* nicht „Startup-modern", sondern „Werkstatt-würdig" — etwas handwerklich, ruhig
* Hauptfarbe: warmes Werkstattbraun/Holz (HSL etwa 30, 25%, 22%) für Primär-Buttons, dezentes Schiefergrau für Sekundär
* Akzentfarbe: gedämpftes Indigo für Hinweise und Links
* keine Schatten als Hauptstilmittel — stattdessen 1px Linien
* Fokus-Outlines deutlich sichtbar (Accessibility)

Layout:
* Maximalbreite 1200px für Inhaltsbereiche
* Sidebar-Navigation in `(app)`-Bereich, vertikale Liste
* Marketing-Seiten haben horizontale Top-Navigation

Kernkomponenten in `components/ui/`:
* `Button` (primary, secondary, tertiary, ghost, danger)
* `Input`, `Textarea`, `Select`, `Checkbox`, `RadioGroup`, `Switch`
* `Card`, `CardHeader`, `CardBody`
* `Tag`, `Badge`
* `Avatar` (mit Initialen-Fallback)
* `Dialog`, `Drawer`, `Toast` (für Statusmeldungen)
* `EmptyState`, `LoadingState`, `ErrorState`
* `Stepper` (Werkstattbeitrag-Pfad, Bedarf-Anlegen)
* `Markdown` (Rendering für Markdown-Felder, mit DOMPurify + remark)

Formulare:
* clientseitig validiert mit Zod + react-hook-form
* serverseitig validiert nochmal mit Zod (gleiche Schemas in `lib/validators/`)
* Fehlermeldungen unterhalb der Felder, in deutscher Klartext-Sprache
* Pflichtfelder mit kleinem „·" Marker
* Längen-Limits live angezeigt (z.B. „125/280")

Loading-Verhalten:
* Server Components für reine Listen
* Server Actions mit Optimistic UI für Statusänderungen
* Skeleton-Loader bei längeren Ladezeiten (>300ms)

Empty-States:
* Werk-Liste leer: „Hier zeigen die Hamburger Werkzirkler:innen, was sie bauen. Sei die Erste."
* Bedarfe leer: „Noch keine Bedarfe in Hamburg. Bringe deinen Bedarf in den Kreis."
* Termine leer: „Der nächste Schauabend steht noch nicht. Schreib unserem Hamburger Kurator."

Sprachregeln in UI (Tonalität):
* du-Anrede durchgängig
* Verben aktiv: „Werk anlegen", nicht „Werk wird angelegt"
* Bestätigungen: „Werk angelegt." statt „Werk wurde erfolgreich angelegt!"

⸻

29. Accessibility (BITV/WCAG 2.1 AA)

* semantisches HTML (header, nav, main, section, article, footer)
* ARIA nur wo nativ HTML nicht ausreicht
* alle interaktiven Elemente Tastatur-bedienbar
* Fokus-Reihenfolge sinnvoll
* Fokus-Outline: 2px solid currentColor, 2px Offset
* Farbkontraste: Text mindestens 4.5:1, große Texte 3:1, UI-Elemente 3:1
* Alt-Texte für alle Bilder (auto-vorausgefüllt mit Werk-Name, editierbar)
* Formular-Labels immer mit `htmlFor`
* Status-Änderungen via Live-Region
* Skip-Link „Zum Hauptinhalt"
* Audit mit `axe-core` in CI
* Lighthouse-Score Accessibility ≥ 95

⸻

30. Mobile Verhalten und Responsive Design

* Mobile-first CSS
* Breakpoints: 640 (sm), 768 (md), 1024 (lg), 1280 (xl)
* Sidebar in App-Bereich wird mobile zu Bottom-Tab-Bar (5 Tabs: Übersicht, Werke, Bedarfe, Termine, Mehr)
* Formulare: native HTML5-Eingabetypen (date, time, email, tel) für mobile Keyboards
* Touch-Targets mindestens 44×44 px
* keine Hover-only-Interaktionen

⸻

31. SEO, Meta, OpenGraph

öffentliche Seiten haben:
* `<title>`-Pattern: `[Werk-Name] — Werkzirkel Hamburg` bzw. `[Seitenname] — Werkzirkel`
* Meta-Description aus Kurzbeschreibung
* OpenGraph: og:title, og:description, og:image (für Werke: Screenshot wenn vorhanden, sonst generisches Werkzirkel-Bild), og:type=article für Werke
* Twitter-Cards (auch wenn Twitter weniger relevant)
* `noindex` für: Bedarf-Detailseiten, Werkangebote, Konto-Seiten, Admin-Seiten
* `index` für: Startseite, Zirkel-Seiten, Werke-Übersicht und Detailseiten, Termin-Übersicht, Über, Regeln, Impressum, Datenschutz
* sitemap.xml dynamisch generiert
* robots.txt erlaubt Crawl der öffentlichen Bereiche, verbietet alles unter `/api/`, `/admin/`, `/kurator/`

JSON-LD Schema.org:
* `Organization` auf der Startseite
* `Event` für jeden öffentlichen Termin
* `Person` (limited) für öffentliche Werkpässe
* `CreativeWork` für Werke

⸻

32. Performance-Anforderungen

* Largest Contentful Paint (LCP) < 2.5s auf 3G-Verbindung
* Cumulative Layout Shift (CLS) < 0.1
* First Input Delay (FID) < 100ms
* DB-Query-Zeit p95 < 100ms
* API-Response-Zeit p95 < 300ms
* Time to Interactive (TTI) < 3.5s
* Bilder via Cloudflare Image Resizing + WebP/AVIF
* JS-Bundle Initial Load < 200kb gzipped
* Server Components als Default — Client Components nur wo Interaktivität nötig

⸻

33. Security-Anforderungen

* HTTPS only (HSTS, max-age 1 Jahr)
* Content-Security-Policy: strict (script-src 'self', style-src 'self' 'unsafe-inline' für Tailwind, img-src 'self' media.werkzirkel.de)
* X-Frame-Options DENY
* X-Content-Type-Options nosniff
* Referrer-Policy strict-origin-when-cross-origin
* Permissions-Policy: camera=(), microphone=(), geolocation=()
* Eingaben überall mit Zod validiert
* Markdown-Render mit DOMPurify gefiltert (keine `<script>`, `<iframe>`, `<form>`)
* SQL ausschließlich über Drizzle Query Builder (keine Raw-SQL ohne Prepared Statements)
* Passwords: keine in v1.0 (Magic-Link only)
* Secrets im Env: nur `.env.local` (lokal), in Prod via Coolify/Hetzner-Secrets
* Stripe-Signaturen pflicht
* Magic-Link-Tokens nur als SHA-256-Hash in DB
* Rate-Limits siehe Section 16
* Dependency-Updates: Renovate Bot oder Dependabot wöchentlich
* CodeQL oder Snyk-Scan in CI
* Audit-Log für sicherheitsrelevante Aktionen (Section 13.27)
* DDoS: Cloudflare WAF

Einbruchstest vor v1.0-Launch: ein externer Pentest-Lauf empfohlen (extern beauftragen, ca. 1.500–3.000 €). Ergebnis dokumentieren.

⸻

34. DSGVO und Datenschutz

Personenbezogene Daten:
* E-Mail (Klartext in DB, weil für Versand nötig — DB-Verschlüsselung at-rest)
* Klarname (Pflicht für Bedarfsträger/Förderer)
* Anzeigename (kann Pseudonym sein)
* IP-Adressen in Session und Audit-Log: nach 30 Tagen gekürzt (letztes Oktett genullt)
* User-Agent: gespeichert für Sicherheits-Audit, nach 90 Tagen gelöscht

Rechtsgrundlagen pro Verarbeitungs-Zweck dokumentiert (DSGVO Art. 6):
* Vertragserfüllung (Art. 6 Abs. 1 lit. b): Konto, Werke, Bedarfe, Termine
* Berechtigtes Interesse (Art. 6 Abs. 1 lit. f): Sicherheits-Logs, Audit-Log
* Einwilligung (Art. 6 Abs. 1 lit. a): Newsletter, Stadt-Digest
* Rechtliche Pflicht (Art. 6 Abs. 1 lit. c): Aufbewahrung von Rechnungen (Stripe-Beleg) 10 Jahre

Betroffenenrechte (Self-Service):
* Auskunft: `GET /api/v1/me/export` liefert vollständigen JSON-Dump
* Berichtigung: über `PATCH /api/v1/me` und alle Inhalts-Patches
* Löschung: `DELETE /api/v1/me` mit 7-Tage-Karenz
* Einschränkung: Konto pausieren
* Datenübertragbarkeit: JSON-Export ist DSGVO-konform
* Widerspruch: Newsletter-Abmeldung One-Click

Datenminimierung:
* keine Geburtsdaten, keine Adressen (außer Stadt-Auswahl), keine Telefonnummern
* keine Tracking-Cookies (Plausible ist cookie-frei)

Cookie-Banner:
* nur funktional notwendige Cookies (`wz_session`) — kein Banner nötig
* falls späterhin externe Skripte: Banner-Implementierung via Klaro o.ä.

Auftragsverarbeitungsverträge (AVV):
* Resend (E-Mail)
* Stripe (Zahlung)
* Cloudflare (R2 + CDN + DNS)
* Hetzner (Hosting)
* Sentry (Errors)
* Plausible (Analytics, kein AVV nötig wenn EU-Hosted und ohne PII)

Datenschutzerklärung als statische MDX-Seite, generiert aus Bausteinen.

⸻

35. Logging, Monitoring, Observability

Levels: ERROR, WARN, INFO, DEBUG.

Logger: pino oder native console mit strukturiertem JSON. Output nach stdout, Coolify sammelt.

Sentry für Errors mit:
* `release` Tag pro Deploy
* User-Context (nutzer_id, Klarname maskiert)
* Breadcrumbs für API-Requests

Uptime: Better-Stack oder Uptime-Robot Checks alle 60s auf:
* Startseite
* Login-Seite
* `/api/v1/health` (eigener Endpoint, Returns DB-Connectivity + Migration-Status)

Plausible auf eigener Subdomain `analytics.werkzirkel.de` (selbst gehostet, cookie-frei).

Dashboards:
* Anmeldungen pro Tag
* Bedarfe veröffentlicht pro Woche
* Werkangebote eingereicht pro Bedarf (Durchschnitt)
* Schauabend-Anmeldungen
* Werkstattkasse-Eingang/-Ausgang

⸻

36. Hosting und Deployment

Empfohlene Konfiguration:
* Hetzner Cloud CCX23 (4 vCPU, 16 GB RAM) für App-Server
* Hetzner Cloud CPX21 (3 vCPU, 4 GB RAM) für Postgres
* Hetzner Storage Box als Backup-Ziel
* Cloudflare R2 für Uploads
* Cloudflare DNS + WAF

Container:
* Dockerfile basierend auf `node:22-alpine`
* Multi-Stage Build
* Image-Größe Ziel < 200MB

Coolify:
* App-Server-Deployment via Coolify (Auto-Deploy on `main`-Branch-Push)
* Postgres als verwaltete Coolify-Datenbank ODER Hetzner Managed PostgreSQL
* Backups: tägliche Snapshots, 14-Tage-Retention

Domains:
* `werkzirkel.de` (Produktion)
* `staging.werkzirkel.de` (Staging-Umgebung)
* `media.werkzirkel.de` (R2-Bucket)
* `analytics.werkzirkel.de` (Plausible)

Umgebungs-Variablen (in `.env.example` dokumentiert):
```
DATABASE_URL=postgresql://...
RESEND_API_KEY=...
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
R2_ACCESS_KEY=...
R2_SECRET_KEY=...
R2_BUCKET=werkzirkel-public
R2_PUBLIC_URL=https://media.werkzirkel.de
SENTRY_DSN=...
PLAUSIBLE_URL=https://analytics.werkzirkel.de
APP_URL=https://werkzirkel.de
CRON_SECRET=...
SESSION_COOKIE_SECRET=...
```

⸻

37. CI/CD

GitHub Actions Workflow `ci.yml`:
1. Checkout
2. Setup Node 22, pnpm
3. `pnpm install --frozen-lockfile`
4. `pnpm typecheck`
5. `pnpm lint`
6. `pnpm format:check`
7. `pnpm test:unit`
8. `pnpm test:integration` (gegen pglite oder Test-Postgres)
9. `pnpm build`
10. Bundle-Size-Check
11. Lighthouse-CI gegen Build

`deploy.yml` (auf `main`-Branch-Push):
1. CI-Workflow muss grün sein
2. Build Docker-Image
3. Push zu Hetzner Container Registry
4. Coolify-Webhook löst Deployment aus
5. Post-Deploy: Migration-Run (`pnpm db:migrate`)
6. Smoke-Test gegen Produktion (`/api/v1/health`)
7. Slack/Discord-Notification

Branch-Strategie:
* `main` = Produktion
* `develop` = Staging
* Feature-Branches → PR gegen `develop`
* `develop` → PR gegen `main` mit Release-Notes

⸻

38. Test-Strategie

Unit-Tests (Vitest):
* alle Validatoren in `lib/validators/`
* Reziprozitäts-Engine (`lib/reziprozitaet/`)
* Notification-Engine
* Sprach-Check
* Status-Maschinen-Transitions

Integration-Tests (Vitest + Test-DB):
* alle API-Endpunkte
* alle Permissions-Checks
* Stripe-Webhook-Verarbeitung (mit Stripe-Test-Modus + Fixtures)
* E-Mail-Versand (Mock Resend)

E2E (Playwright):
* Happy Path: Macher:in registriert → Werk anlegt → Prüfrunde startet → andere Macher:in gibt Feedback
* Happy Path: Bedarfsträger:in registriert → Werkstattbeitrag zahlt → Bedarf anlegt → Veröffentlichung
* Happy Path: Förder:in legt Profil an → Kurator:in verifiziert → Profil öffentlich
* Reziprozitäts-Block: Prüfrunde-Start ohne Saldo wird verhindert
* Werkstattbeitrag-Gate: Bedarf-Veröffentlichung ohne Beitrag wird verhindert
* Konto-Löschung-Flow inkl. 7-Tage-Karenz

Lasttest (vor v1.0-Launch):
* k6 gegen Staging mit 200 RPS für 5 Min
* Zielwerte: p95 < 500ms, Fehlerquote < 0.5%

Sicherheits-Tests:
* OWASP ZAP gegen Staging vor Launch
* Manueller Pentest (extern)

⸻

39. Migrations- und Seeding-Strategie

Drizzle Kit:
* Migrations in `lib/db/migrations/` als `.sql`-Dateien mit Zeitstempel-Prefix
* Generierung via `pnpm db:generate`
* Anwendung via `pnpm db:migrate`
* in CI: `db:migrate-check` (Dry-Run, prüft ob alle Migrations applizierbar)

Seed-Daten in `lib/db/seed.ts`:
* drei Städte (Hamburg aktiv, Berlin und München vorbereitung)
* eine Admin-Nutzer:in (E-Mail aus Env)
* eine Beispiel-Kurator:in für Hamburg (E-Mail aus Env)
* Default-Benachrichtigungs-Einstellungen

Fixtures für Tests in `tests/fixtures/`:
* `nutzer.json` (3 Macher:innen, 2 Bedarfsträger:innen, 1 Förder:in, 1 Kurator:in, 1 Admin)
* `werke.json` (5 Werke in verschiedenen Werkständen)
* `bedarfe.json` (3 Bedarfe in verschiedenen Stadien)
* `foerderprofile.json` (2 Profile, 1 verifiziert, 1 in Verifikation)

⸻

40. Rechtliche Seiten

40.1 Impressum (`/impressum`)
* Diensteanbieter, Adresse, vertretungsberechtigte Person, Kontakt, Umsatzsteuer-ID (sobald vorhanden), Verantwortliche:r für Inhalte nach § 18 Abs. 2 MStV

40.2 Datenschutzerklärung (`/datenschutz`)
* Verantwortliche:r, DPO falls anwendbar
* Verarbeitungen pro Zweck mit Rechtsgrundlage
* Empfänger:innen (Liste der Auftragsverarbeiter)
* Speicherdauern
* Betroffenenrechte mit Wegbeschreibung (Self-Service-Endpoints)
* Beschwerderecht bei Aufsichtsbehörde (Hamburgischer Beauftragte:r für Datenschutz)

40.3 AGB / Nutzungsbedingungen (`/agb`)
* Geltungsbereich
* Vertragsschluss (mit Anmeldung)
* Pflichten der Nutzer:innen (Werkstatt-Regeln verlinkt)
* keine Provision, keine Vermittlung, keine Vertragsabwicklung (explizit)
* Förderprofile: keine Equity-Vermittlung über Plattform
* Werkstattbeitrag: Spende, keine Gegenleistung
* Erfolgsbeitrag: Spende an Werkstatt-Kasse
* Haftungsausschluss für Inhalte Dritter (siehe DSA)
* Kündigung
* Salvatorische Klausel, anwendbares Recht (deutsches Recht), Gerichtsstand Hamburg

40.4 Werkstatt-Regeln (`/regeln`)
* siehe v0.2 Section 9 + erweiterte Bedarfsseiten-Regeln aus v0.3

40.5 Streitschlichtung (`/streitschlichtung`)
* Verbraucherschlichtungsstelle-Hinweis nach VSBG

40.6 Cookies (`/cookies` oder integriert in Datenschutz)
* nur funktional notwendige Cookies, kein Banner nötig

Vor v1.0-Launch: anwaltliche Prüfung aller rechtlichen Seiten (Hamburg, Plattform-/Medienrecht), Budget ~1.500–3.000 €.

⸻

41. Markenidentität und Designsystem

Logo: Wortmarke „Werkzirkel" in Custom-Typografie (initial: IBM Plex Sans Bold), darunter Ortsangabe als kleinere Zeile bei lokalen Auftritten („Werkzirkel Hamburg").

Farbpalette (Design-Tokens in `src/design/tokens.ts`):
```
--werk-holz-50:  hsl(30 30% 96%)
--werk-holz-100: hsl(30 25% 90%)
--werk-holz-300: hsl(30 25% 70%)
--werk-holz-500: hsl(30 25% 45%)
--werk-holz-700: hsl(30 30% 28%)
--werk-holz-900: hsl(30 35% 18%)
--werk-schiefer-50:  hsl(220 10% 96%)
--werk-schiefer-300: hsl(220 10% 70%)
--werk-schiefer-500: hsl(220 10% 45%)
--werk-schiefer-700: hsl(220 10% 28%)
--werk-schiefer-900: hsl(220 10% 14%)
--werk-akzent:       hsl(230 40% 45%)   /* gedämpftes Indigo */
--werk-warn:         hsl(35 80% 50%)
--werk-fehler:       hsl(0 65% 45%)
--werk-erfolg:       hsl(140 35% 38%)
```

Typografie:
* UI: Inter (Variable Font, selbst gehostet)
* Akzent (Headlines): IBM Plex Sans (selbst gehostet)
* Mono: IBM Plex Mono (für Code, falls in Werkbeschreibungen verwendet)

Spacing-Skala (rem):
0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 6, 8, 12

Border-Radius:
0, 4px, 8px, 12px, 16px, voll-rund

Ikonografie:
* Lucide Icons als Default
* keine custom-gezeichneten Icons in v1.0

Spätere Erweiterung: ein vollständiges DESIGN.md im Repo-Root als Designsystem-Spezifikation (siehe global Konvention).

⸻

TEIL E — Plan und Risiken

⸻

42. Bauplan v1.0

Nicht-Phasen. Eine vollständige v1.0 wird am Stück gebaut. Zwischen-Releases nur intern. Erst zum Launch wird öffentlich freigeschaltet.

Reihenfolge der Bau-Sprints (interne Sprints, jeweils ca. eine Woche bei Vollzeit-KI-Bau):

Sprint 1 — Fundament
* Repository, Tooling (TypeScript, ESLint, Prettier, Tailwind)
* Next.js-App-Skelett
* Drizzle + Postgres-Anbindung
* Auth-Skelett (Magic-Link)
* Konto-CRUD (Registrierung, Login, Konto-Einstellungen, Konto-Löschung)
* DSGVO-Self-Service-Endpoints
* Rechtliche Seiten (Impressum, Datenschutz, AGB, Regeln) mit Platzhaltern
* Design-Tokens, Kernkomponenten
* CI Pipeline grün

Sprint 2 — Werke und Werkpass
* Werkpass-CRUD (UI + API)
* Werk-CRUD inkl. Screenshots, Werkstand-Historie
* Werke-Übersicht mit Filtern
* Werk-Detailseite öffentlich
* Stadt-Zirkelseite Grundgerüst (Hamburg aktiv)

Sprint 3 — Prüfrunden und Reziprozität
* Prüfrunde-CRUD
* Tester:innen-Anmeldung
* Feedback-Eingabe
* Test-Saldo + Reziprozitäts-Engine
* Verpflichtungs-Tracking + Cron-Job
* E-Mail-Templates T-001 bis T-004, T-101 bis T-104

Sprint 4 — Termine
* Termin-CRUD durch Kurator:innen
* Anmeldung mit Slot-System und Warteliste
* iCal-Export
* Erinnerungs-Mails T-401 bis T-404
* Cron `termin-erinnerung-versenden`

Sprint 5 — Bedarfe und Werkstattbeitrag
* Bedarfsträger:innen-Rolle in Auth
* Werkstattbeitrag-Pfade (3) inkl. Stripe-Integration für Geldbeitrag
* Bedarf-CRUD mit Status-Maschine
* Sprach-Check beim Einreichen
* Kurator:innen-View für Bedarfs-Prüfung
* E-Mail-Templates T-301 bis T-304, T-601 bis T-603

Sprint 6 — Werkangebote
* Werkangebot-CRUD
* RLS-/Permissions-Check im API-Layer
* Bedarfsträger:innen-View für eingegangene Werkangebote
* Macher:innen-View für eigene Werkangebote
* E-Mail-Templates T-201, T-202

Sprint 7 — Förderprofile
* Förder:innen-Rolle
* Förderprofil-CRUD
* Kurator:innen-Verifikations-Workflow
* Auto-Pause-Cron
* E-Mail-Templates T-501 bis T-505

Sprint 8 — Erfolgsbeitrag und Werkstatt-Kasse
* Erfolgsbeitrag-Flow via Stripe
* Werkstatt-Kasse-Eintraege
* Quartalsabschluss
* öffentliche Werkstatt-Kasse-Seite pro Stadt

Sprint 9 — Fördermitgliedschaft
* Subscription via Stripe
* Mitgliedschaftsstufen
* Limits (mehrere Werke etc.)
* E-Mail-Templates T-701 bis T-703

Sprint 10 — Hilfegesuche
* CRUD
* Antworten als Kommentare
* Stadt-/Tag-Filter

Sprint 11 — Moderation und Admin
* Melden-Knopf an allen Inhalten
* Kurator:innen-Postfach
* Admin-Backoffice (Nutzer:innen, Städte, Audit-Log)
* Sperren/Entsperren-Flows

Sprint 12 — Polish, Mobile, Accessibility
* Mobile-Layout-Review
* Bottom-Tab-Bar
* Accessibility-Audit (axe-core, Lighthouse)
* Performance-Optimierung
* Bildoptimierung
* leere States, Fehler-States

Sprint 13 — SEO, Marketing-Seiten, Newsletter
* Startseite final
* Über, Regeln, Häufige Fragen
* Stadt-Digest E-Mail-Template T-801
* Cron `digest-newsletter`
* JSON-LD, sitemap.xml

Sprint 14 — Pre-Launch
* End-to-End-Tests vollständig
* Lasttest k6
* Sicherheits-Scan ZAP
* Externer Pentest
* Anwaltliche Prüfung Rechtstexte
* Seed-Daten finalisieren
* Backup-/Restore-Test
* Notfall-Runbook in `OPS.md`

Sprint 15 — Soft-Launch Hamburg
* Plattform live, aber initial nur per Direktansprache
* erster Schauabend zur Plattform-Vorstellung
* Bug-Fixing-Sprint nach Soft-Launch

Sprint 16 — Public Launch Hamburg
* offizielle Launch-Kommunikation
* Akquise gemäß Section 23 v0.3 (Hamburg)

Parallel-Strukturen ab Sprint 5:
* Hamburger Schauabend-Akquise startet (Phase 0 aus v0.3)
* IHK, IFB, Stiftungen werden für Bedarfsschau angesprochen
* Erste Bedarfe und Förderprofile werden manuell von der Kurator:in vorbereitet

⸻

43. Erfolgskennzahlen v1.0

Erste 16 Wochen nach Public Launch Hamburg:

Aktivierung
* Registrierte Nutzer:innen: 200
* Werkpässe vollständig: 80 %
* Werke angelegt: 80
* Mindestens ein eigenes Werk: 50 %

Austausch
* Prüfrunden gestartet: 40
* Feedback gegeben: 150
* Reziprozitäts-Quote (gegeben ≥ erhalten): 80 %

Lokale Treffen
* Schauabende: 4
* Teilnehmer:innen pro Schauabend: 15–30
* Wiederkehrer-Quote: 50 %
* Bedarfsschauen: 2
* Teilnehmer:innen pro Bedarfsschau: 15–30

Nachfrageseite
* Registrierte Bedarfsträger:innen: 30
* Aktive Bedarfe: 20
* Werkstattbeiträge verifiziert: 30 (gemischt Pfade A/B/C)
* Werkangebote im Durchschnitt pro Bedarf: 2–4
* Dokumentierte Vermittlungen: 8
* Erfolgsbeiträge gezahlt: 4
* Registrierte Förder:innen: 8
* Verifizierte Förderprofile: 5
* Dokumentierte Förderungen: 2

Wirtschaftlich
* Fördermitgliedschaften: 30
* Werkstattbeiträge (Geld): 1.500–3.000 € kumuliert
* Erfolgsbeiträge: 500–1.500 €
* Werkstatt-Kasse Hamburg: 4.000–8.000 € im Jahr 1

Qualität
* Spam-/Moderationsfälle: < 20 / Quartal
* Cold-Outreach-Meldungen: < 10 / Quartal
* Bedarfsträger:innen mit persönlicher Anwesenheit (Schauabend oder Bedarfsschau): ≥ 80 %
* Sprach-Check-Auslösungen (verbotene Begriffe): protokolliert und analysiert

Skalierungs-Gate für Berlin- und München-Aktivierung:
* Hamburg muss mindestens 60 % der oben genannten Werte erreichen, plus stabile Kurator:in vor Ort
* Berlin und München werden mit eigenem Kurator:innen-Onboarding aktiviert (Stadt-Status `aktiv`)

⸻

44. Risiken und Gegenmaßnahmen

R1 — Werkstatt-Kultur kippt zur Akquise-Logik
Gegenmaßnahme: Schutzmechaniken S1–S10, Sprachdisziplin, Kurator:innen-Schulung, Werkstattbeitrag-Pflicht

R2 — Drei-Rollen-System verwirrt Nutzer:innen
Gegenmaßnahme: rollenklare UI, klar getrennte Onboarding-Pfade auf Startseite, drei Kacheln-Konzept

R3 — Bedarfsträger:innen-Akquise scheitert (zu wenige Bedarfe)
Gegenmaßnahme: Akquise via IHK, IFB, Stiftungen ab Sprint 5 parallel betreiben; manuelle Vorbereitung von 5–8 Bedarfen vor Public Launch

R4 — Plattform wird rechtlich als Vermittlerin eingestuft
Gegenmaßnahme: AGB-Klarheit, anwaltliche Vor-Prüfung, dokumentierte Werkstatt-Kasse-Spendenstruktur, kein Stripe-Connect, keine Provision

R5 — Pentest findet kritische Lücken
Gegenmaßnahme: Pentest 2 Wochen vor Launch, Pufferzeit eingeplant; Code-Reviews durchgehend

R6 — Stripe-Integration in Deutschland bei Spenden-Status unklar
Gegenmaßnahme: rechtliche Klärung in Sprint 14; Backup-Plan: Werkstatt-Kasse als gemeinnütziger Trägerverein, Stripe für reguläre Mitgliedschaft, separates SEPA-Lastschrift-Mandat für Spenden

R7 — Reziprozitäts-Engine zu strikt, Macher:innen blockiert
Gegenmaßnahme: 14-Tage-Schuld-Mechanismus, Kurator:innen-Override-Option, Telemetrie sammelt Blockade-Fälle

R8 — Bedarfsschau scheitert mangels Interesse von Förder:innen
Gegenmaßnahme: in Sprint 5–7 mindestens 3 Förder:innen vorab manuell anwerben; Bedarfsschau-Termin erst ansetzen wenn 2 Förderprofile zugesagt

R9 — Auto-Pause von Förderprofilen frustriert
Gegenmaßnahme: 4-Quartals-Karenz ist großzügig; Reaktivierung 1-Klick

R10 — Plattform-Komplexität überfordert Kurator:in
Gegenmaßnahme: Kurator:innen-Dashboard mit SLA-Kästen; Admin kann global eingreifen; im Notfall werden Bedarfs-Prüfungen für eine Woche pausiert ohne Datenverlust

⸻

45. Offene strategische Annahmen (aus v0.3 übernommen, müssen vor/während Sprint 14–16 validiert werden)

A1 — Werkstattbeitrag wird angenommen
Test: erste 5 Bedarfsträger:innen erfolgreich durch einen der drei Pfade führen

A2 — Erfolgsbeitrag bleibt freiwillig tragbar
Test: erste 3–5 Vermittlungen; Spendenquote messen; bei < 20 % alternativen Tragfähigkeits-Pfad aktivieren

A3 — Plattform bleibt rechtlich keine Vermittlerin
Test: anwaltliche Prüfung in Sprint 14; bei Risiko: Bedarfs-Feature in Soft-Launch zurückhalten, vorerst nur Notion-/Telefonat-Pfad

A4 — Sprache (deutsch-only, Werkstatt-Tonalität) wird angenommen
Test: Schauabend-Feedback, A/B-Vergleich von Subjects, Nutzungs-Telemetrie

A5 — Tech-Stack-Entscheidungen tragen (Next.js 15, Drizzle, Hetzner, Stripe)
Test: Lasttest, Cost-Analyse nach Sprint 14

⸻

46. Was v1.0 ausdrücklich NICHT ist

v1.0 ist nicht:
* eine Jobbörse
* eine Freelancer-Plattform
* eine Investoren-Plattform
* ein Marktplatz
* eine Vertragsabwicklungs-Plattform
* eine Equity-Vermittlung
* ein Pitch-Wettbewerb
* eine Social-Network-Plattform
* eine Direkt-Messaging-Plattform
* ein Newsletter-Tool

v1.0 erlaubt nicht:
* Direktnachrichten an Bedarfsträger:innen oder Förder:innen
* Cold-Outreach
* Equity-Verträge über die Plattform
* Provisionen
* Bewertungen mit Sternen
* anonyme Förderung

v1.0 verspricht nicht:
* dass jeder Bedarf erfüllt wird
* dass jedes Förderprofil zu einer Förderung führt
* dass Vermittlungen rechtlich durch Werkzirkel gesichert sind
* dass Erfolgsbeiträge steuerlich abzugsfähige Spenden sind (offene Frage A3; je nach Lösung als Spende an gemeinnützigen Trägerverein möglich)

Wenn auch nur einer dieser Punkte aufweicht — durch Feature, Sprache oder Marketing — ist das ein Verstoß gegen v1.0 und muss zurückgenommen werden. Die Werkstatt-Kultur ist Vorbedingung. Bedarfsseite und Förderseite kommen obendrauf, nicht stattdessen.

⸻

ENDE PRD v1.0

Bau-Status: spezifiziert. Bereit für Sprint 1.

Verantwortlich für nächste Konkretisierungs-Schritte (nicht Teil dieses Dokuments, gehört in `BUILD.md` oder Project-Office):
* Tech-Stack-Entscheidungen final bestätigen (Section 11)
* Repository-Skelett anlegen
* Hetzner und Cloudflare-Konten einrichten
* Stripe-Test-Konto einrichten
* Resend-Konto einrichten
* Anwaltliche Prüfung Rechtstexte beauftragen
* Externer Pentest-Anbieter auswählen
