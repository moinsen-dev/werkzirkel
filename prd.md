Product Requirement Document v0.2

Arbeitstitel: Werkzirkel

Produkt: Deutschsprachige lokale Community-Plattform für unabhängige digitale Produktmacher:innen im DACH-Raum
MVP-Fokus: Hamburg zuerst (eine Stadt richtig zünden), danach Berlin und München als Replikation
Sprache: ausschließlich Deutsch
Ziel: Menschen, die digitale Produkte bauen, lokal vernetzen, gegenseitig testen lassen, sichtbar machen und in reale Treffen bringen.

Änderungen gegenüber v0.1 (kompakt)

* Sequenzierung umgestellt: Erst lokale Treffen mit existierenden Tools (Eventbrite/Luma + Notion), dann Plattform. Die Plattform folgt der Aktivität, nicht umgekehrt.
* Hamburg-First statt drei Städte parallel. Replikation in Berlin und München erst nach drei tragenden Schauabenden in Hamburg.
* Reziprozität („Teste 2, erhalte 1") ins MVP gezogen — sie ist der Kernmechanismus, nicht ein „Später"-Feature.
* Neue Section 23: Akquisestrategie Hamburg. Konkrete Kanäle, nicht „20–30 Gespräche".
* Datenmodell entschlackt: Werk.stadt entfernt (erbt von Nutzer.stadt).
* Geschäftsmodell mit ehrlichem Tragfähigkeitspfad ergänzt.
* Sprachmuster ergänzt.
* Section 28 „Nächster Schritt" umgeschrieben: erstes Schauabend in Hamburg, nicht Landingpage.

⸻

1. Harte Grundentscheidung

Wir bauen kein weiteres soziales Netzwerk.

Wir bauen:

Eine deutschsprachige lokale Arbeitsgemeinschaft für Menschen, die digitale Produkte bauen.

Das Produkt soll nicht primär „Networking" verkaufen, sondern Fortschritt.

Der zentrale Satz lautet:

Baue digitale Produkte nicht allein.

Oder stärker als Produktversprechen:

Werkzirkel bringt unabhängige digitale Macher:innen in deiner Stadt zusammen – zum Austauschen, Testen, Lernen und Vorankommen.

Wichtige Zusatzentscheidung (neu in v0.2):

Wir bauen keine Plattform, bevor lokale Treffen funktionieren. Die ersten drei Schauabende in Hamburg laufen mit Eventbrite/Luma und einer öffentlichen Notion-Seite. Erst danach beginnt Plattformentwicklung.

⸻

2. Namensentscheidung

Empfohlener Arbeitstitel: Werkzirkel

Warum?

Kriterium	Bewertung
Deutsch	Ja
Lokal gedacht	Ja, „Zirkel" passt zu regionalen Gruppen
Produktiv statt sozial	Ja, „Werk" impliziert Machen
Nicht zu startupig	Ja
Nicht zu generisch wie „Community"	Ja
Erweiterbar	Ja: Hamburger Werkzirkel, Berliner Werkzirkel, Münchner Werkzirkel
Markenfähig	Vorprüfung nötig

Warum nicht „Werkraum" als Hauptname?

„Werkraum" klingt gut, ist aber als Begriff bereits in mehreren nahen Kontexten belegt: als Community-/Werkstattformat, als Digitalagentur und als städtisches/öffentliches Raumformat. Das macht ihn als Hauptmarke riskanter.

Warum nicht „Macherkreis"?

„Macherkreis" ist inhaltlich sehr nah, aber bereits als Website mit dem Claim „Kreative Projekte aus der Community" sichtbar. Das ist zu nah an unserer Stoßrichtung.

Warum nicht „Macherschaft"?

„MacherSchaft" existiert bereits als offene Werkstatt-/Community-Kontext in Basel. Für ein DACH-Produkt wäre das zu konfliktträchtig oder zumindest erklärungsbedürftig.

Entscheidung für PRD v0.2

Produktname: Werkzirkel
Untertitel: Gemeinsam digitale Produkte bauen.
Regionale Namen:

* Werkzirkel Hamburg (Start)
* Werkzirkel Berlin (Replikation)
* Werkzirkel München (Replikation)
* Werkzirkel Wien (später)
* Werkzirkel Zürich (später)

Begriffe im Produkt:

Plattformbegriff	Bedeutung
Zirkel	regionale Gruppe
Werk	ein Projekt, Produkt, App, Tool oder digitales Vorhaben
Prüfrunde	strukturierte Test- und Feedbackrunde
Schauabend	lokaler Demo-Abend
Baurunde	gemeinsames Arbeiten, online oder vor Ort
Werkpass	Profil einer Person
Werkstand	Status eines Projekts
Hilfegesuch	konkrete Bitte um Unterstützung

⸻

3. Zielgruppe

Primäre Zielgruppe

Unabhängige digitale Produktmacher:innen im deutschsprachigen Raum.

Das sind Menschen, die alleine oder in kleinen Teams digitale Produkte entwickeln, aber nicht zwingend klassische Startups gründen wollen.

Dazu gehören:

* Indie-Developer
* App-Entwickler:innen
* SaaS-Bootstrapper
* Freelancer mit eigenen Produkten
* Solo-Founder
* KI-Automatisierer:innen
* No-Code-/Low-Code-Macher:innen
* UX-/UI-Designer:innen mit eigenen Ideen
* technische Creator
* digitale Handwerker:innen
* kleine Agenturmenschen mit Nebenprodukten

Sekundäre Zielgruppe

* Produktmanager:innen mit Nebenprojekten
* Studierende mit echten digitalen Projekten
* Entwickler:innen, die aus Angestelltenrollen heraus eigene Produkte bauen
* Marketing- und Vertriebsleute, die Indie-Produkte unterstützen wollen
* lokale Coworking-Spaces, die relevante Community-Formate suchen

⸻

4. Für wen ist das Produkt ausdrücklich NICHT?

Werkzirkel ist nicht für:

* reine Jobvermittlung
* klassische Freelancer-Projektbörse
* VC-getriebene Startup-Pitchkultur
* LinkedIn-Selbstdarstellung
* Agenturen, die nur Leads abgreifen wollen
* rein englischsprachige Indie-Hacker
* Krypto-, Hype- oder Schneeballsystem-Communities
* Menschen ohne konkretes Projektinteresse

Das ist wichtig. Sonst verwässert das Produkt sofort.

⸻

5. Problemdefinition

Hauptproblem

Menschen bauen digitale Produkte im DACH-Raum oft allein, unsichtbar und ohne belastbare Rückkopplung.

Es fehlt nicht nur Wissen.
Es fehlt ein lokales, vertrauenswürdiges, deutschsprachiges Umfeld, in dem man unfertige Produkte zeigen, testen lassen und weiterentwickeln kann.

Teilprobleme

1. Isolation

Viele Indie-Developer und Freelancer arbeiten allein. Sie haben keine regelmäßigen Sparringspartner und verlieren Momentum.

2. Fehlendes ehrliches Feedback

Online-Feedback ist oft oberflächlich, anonym oder nicht verbindlich. Lokales Feedback ist wertvoller, weil daraus echte Beziehungen entstehen können.

3. Zu wenig Sichtbarkeit

Viele gute Projekte bleiben unsichtbar, weil ihre Erbauer:innen weder Vertrieb noch Marketing als Kernkompetenz haben.

4. Fehlende Testpersonen

Apps, SaaS-Produkte und digitale Tools brauchen echte Nutzer:innen. Gerade frühe Versionen brauchen Menschen, die konstruktiv testen.

5. Deutschsprachige Lücke

Viele Indie-Hacker-Communities sind englischsprachig. Das funktioniert für globale Tech-Szenen, aber nicht optimal für Menschen, die im DACH-Markt, mit deutschen Kund:innen, deutschen Rechtsfragen und deutscher Kommunikation arbeiten.

6. Lokale Treffen fehlen

Discord, Slack und Reddit lösen nicht das Bedürfnis nach realer Nähe. Wer sich persönlich trifft, baut schneller Vertrauen auf.

⸻

6. Produktvision

Vision

Werkzirkel wird das deutschsprachige Zuhause für unabhängige digitale Produktmacher:innen im DACH-Raum.

Nicht als Großplattform.
Sondern als Netzwerk lokaler Kreise.

Mission

Wir helfen unabhängigen digitalen Macher:innen, ihre Produkte schneller zu verbessern, sichtbarer zu werden und nicht allein zu bauen.

Leitsatz

Erst zeigen. Dann testen. Dann verbessern. Dann sichtbar machen.

⸻

7. Kernnutzen

Werkzirkel liefert fünf konkrete Nutzenversprechen:

1. Lokale Verbindung

Nutzer:innen finden Menschen in ihrer Stadt oder Region, die ebenfalls digitale Produkte bauen.

2. Strukturierter Austausch

Nicht nur „mal quatschen", sondern konkrete Formate: Prüfrunden, Schauabende, Baurunden, Hilfegesuche.

3. Gegenseitiges Testen

Wer Feedback will, gibt auch Feedback. Das schafft Gegenseitigkeit.

4. Sichtbarkeit für Projekte

Jedes Werk bekommt eine einfache Projektseite mit Status, Bedarf und Fortschritt.

5. Reale Treffen

Werkzirkel wird erst richtig wertvoll, wenn aus digitalen Kontakten echte Begegnungen werden.

⸻

8. Produktprinzipien

Prinzip 1: Deutsch-only

Die Plattform, die Oberfläche, die Systemtexte, die Community-Regeln, die Eventnamen und die Kommunikation sind auf Deutsch.

Erlaubte Ausnahmen:

* Produktnamen
* technische Begriffe, wenn unvermeidbar
* Code
* Markennamen
* Links zu externen Ressourcen

Nicht gewünscht:

* „Launch"
* „Founder"
* „Demo Day"
* „Build Night"
* „Networking"
* „Pitch"

Stattdessen:

Englisch vermeiden	Deutscher Begriff
Launch	Start
Founder	Gründer:in / Macher:in
Demo Day	Schauabend
Build Night	Baurunde
Feedback Session	Prüfrunde
Networking	Austausch
Community	Gemeinschaft / Kreis
Project	Werk / Vorhaben
Profile	Werkpass

Prinzip 2: Lokal vor global

Die Plattform ist DACH-weit gedacht, aber der Einstieg erfolgt immer über regionale Kreise. Im MVP gibt es nur einen: Hamburg.

Prinzip 3: Projekte statt Profile

Nicht die Person steht zuerst im Mittelpunkt, sondern:

Was baust du gerade?

Profile sind wichtig, aber Projektseiten sind der Kern.

Prinzip 4: Verbindlichkeit statt Rauschen

Keine endlosen Feeds. Keine Like-Jagd. Keine Follower-Mechanik.

Stattdessen:

* konkrete Hilfegesuche
* begrenzte Prüfrunden
* regionale Termine
* sichtbarer Projektfortschritt

Prinzip 5: Gegenseitigkeit (verbindlich)

Wer Hilfe bekommt, hilft auch anderen. Im MVP gilt: Wer eine Prüfrunde startet, hat zuvor mindestens zwei andere Werke getestet ODER verpflichtet sich, dies innerhalb von 14 Tagen nach Abschluss der eigenen Prüfrunde zu tun. Die Plattform zeigt die Test-Bilanz im Werkpass öffentlich.

Prinzip 6 (neu in v0.2): Treffen vor Tooling

Bevor wir eine Funktion bauen, muss sie in einem realen Schauabend in Hamburg gefehlt haben. Keine Spekulationsfeatures.

⸻

9. MVP-Ziel

Ziel des MVP

Innerhalb der ersten Version soll Werkzirkel beweisen:

Gibt es in Hamburg genug deutschsprachige digitale Macher:innen, die regelmäßig zu lokalen Treffen kommen, ihre Werke zeigen und ehrlich gegenseitig testen?

MVP-Erfolgskriterium (Hamburg-First)

Das MVP ist erfolgreich, wenn in Hamburg innerhalb von 12 Wochen:

* drei Schauabende stattgefunden haben mit jeweils mindestens 8 anwesenden Macher:innen
* mindestens 15 Werke öffentlich gezeigt wurden
* mindestens 10 abgeschlossene Prüfrunden mit jeweils mindestens 3 Rückmeldungen entstanden sind
* mindestens 50 Prozent der Teilnehmer:innen mindestens zu einem zweiten Termin wiedergekommen sind
* mindestens 5 dokumentierte Fälle existieren, in denen ein Werk durch das Feedback nachweislich verbessert oder neu ausgerichtet wurde

Wenn diese Schwelle in Hamburg nicht erreicht wird, starten wir Berlin und München nicht. Das Format wird stattdessen iteriert oder eingestellt.

Replikations-Kriterium

Berlin und München starten erst, wenn Hamburg drei Schauabende mit jeweils mindestens 15 Teilnehmer:innen und stabilem Kern erreicht hat.

⸻

10. MVP-Funktionsumfang

Anmerkung v0.2: Der hier beschriebene Funktionsumfang gilt ab Phase 2 (Plattform). In Phase 0 und Phase 1 nutzen wir Eventbrite/Luma, Notion und E-Mail. Die Plattform-Funktionen unten sind Soll-Zustand nach Plattformbau.

Muss-Funktionen (Plattform Phase 2)

1. Startseite

Die Startseite erklärt in deutscher Sprache:

* Was ist Werkzirkel?
* Für wen ist es?
* Wie funktioniert es?
* Welche Städte gibt es?
* Wie kann man mitmachen?

Primärer Aufruf:

Tritt deinem Werkzirkel bei

Sekundärer Aufruf:

Zeig dein Werk

⸻

2. Registrierung

Nutzer:innen können sich registrieren mit:

* Name
* E-Mail
* Stadt/Region
* Rolle
* Interessen
* aktuelles Werk, optional
* Bereitschaft zu Treffen vor Ort
* Bereitschaft, andere Werke zu testen

Rollenbeispiele:

* Entwickler:in
* Designer:in
* Produktmacher:in
* Freelancer
* Gründer:in
* KI-Automatisierer:in
* Marketing/Vertrieb
* Noch offen

⸻

3. Werkpass

Der Werkpass ist das persönliche Profil.

Pflichtfelder:

* Name
* Stadt/Region
* Kurzbeschreibung
* Fähigkeiten
* Interessen
* Kontaktoption intern

Sichtbare Test-Bilanz (neu in v0.2):

* Anzahl gegebener Prüfrunden-Feedbacks
* Anzahl gestarteter Prüfrunden
* Verhältnis als Sichtbarkeitssignal („Test-Saldo")

Optionale Felder:

* Website
* GitHub
* LinkedIn
* Mastodon
* eigene Produkte
* bevorzugte Treffen: online, vor Ort, beides

⸻

4. Werkseite

Jedes digitale Projekt bekommt eine Werkseite.

Pflichtfelder:

* Name des Werks
* Kurzbeschreibung
* Problem, das gelöst wird
* Zielgruppe
* aktueller Stand
* Link, falls vorhanden
* Screenshot, optional
* gesuchte Hilfe

Werkstand:

* Idee
* Prototyp
* Testversion
* Öffentlich
* Wachsend
* Pausiert

Gesuchte Hilfe:

* Nutzerfeedback
* UX-Test
* technisches Feedback
* Marketing
* Positionierung
* erste Kund:innen
* Mitstreiter:innen
* Rechtliches/Steuern, nur als Austausch, keine Beratung

⸻

5. Regionale Zirkel

Jede Stadt/Region bekommt eine eigene Seite.

Im MVP existiert nur: Werkzirkel Hamburg.

Inhalte:

* Beschreibung des lokalen Kreises
* Mitglieder aus der Region
* Werke aus der Region
* kommende Termine
* offene Prüfrunden
* lokale Ansprechpartner:innen

MVP-Stadt:

* Hamburg

Replikations-Städte (nach Hamburg-Validierung):

* Berlin
* München

Spätere Städte:

* Köln/Düsseldorf/Rhein-Ruhr
* Frankfurt/Rhein-Main
* Stuttgart
* Wien
* Zürich
* Leipzig
* Hannover
* Nürnberg/Erlangen

⸻

6. Prüfrunden

Die Prüfrunde ist das wichtigste MVP-Feature.

Ein:e Nutzer:in kann für ein Werk eine Prüfrunde starten:

Pflichtangaben:

* Was soll getestet werden?
* Wer ist die Zielgruppe?
* Was ist der Link?
* Wie viel Zeit braucht der Test?
* Welche Art Feedback wird gesucht?
* Bis wann soll getestet werden?
* Wie viele Tester:innen werden gesucht?

Feedbackkategorien:

* erster Eindruck
* Verständlichkeit
* Nutzen
* Bedienbarkeit
* Fehler/Bugs
* Positionierung
* Zahlungsbereitschaft
* Verbesserungsvorschläge

Reziprozitäts-Regel (Muss-Feature im MVP, vorher „Später"):

Wer eine Prüfrunde startet, muss zuvor zwei Werke getestet haben oder verpflichtet sich, dies innerhalb von 14 Tagen nach Ende der eigenen Prüfrunde zu tun. Wird die Verpflichtung nicht eingelöst, kann keine neue Prüfrunde gestartet werden. Die Plattform setzt das technisch durch.

Das ist der Kernmechanismus gegen Konsumhaltung — er gehört in die erste lauffähige Plattformversion, nicht in eine Erweiterung.

⸻

7. Termine

Termine sind lokal oder online.

MVP-Terminarten:

Terminart	Zweck
Prüfabend	3–5 Werke werden gemeinsam getestet
Schauabend	Mitglieder zeigen, was sie bauen
Baurunde	gemeinsames Arbeiten, ohne großes Programm
Werkgespräch	ein Thema, ein Impuls, offene Diskussion
Kennenlernrunde	neue Mitglieder treffen sich

Jeder Termin hat:

* Titel
* Stadt
* Ort oder Online-Link
* Datum
* Uhrzeit
* Beschreibung
* maximale Teilnehmerzahl
* Anmeldung

⸻

8. Einfache Benachrichtigungen

MVP reicht mit E-Mail.

Benachrichtigungen bei:

* neuer Prüfrunde in meiner Stadt
* Feedback zu meinem Werk
* neuer Termin in meiner Stadt
* Anmeldung zu meinem Termin
* Erinnerung vor Termin
* Erinnerung an offene Reziprozitäts-Schuld

Keine Push-Notifications im MVP.

⸻

9. Moderation und Regeln

Es braucht von Anfang an klare Regeln.

Kurzfassung:

* Deutsch schreiben
* ehrlich, aber respektvoll feedbacken
* keine Akquise-Spamerei
* keine verdeckten Sales-Pitches
* keine Diskriminierung
* keine politischen Grabenkämpfe
* keine Krypto-/MLM-/Schnell-reich-Angebote
* keine Veröffentlichung fremder unfertiger Projekte ohne Zustimmung

⸻

11. Nicht im MVP

Bewusst nicht enthalten:

* Chat
* Gruppenchat
* Direktnachrichten mit komplexem Postfach
* Zahlungsfunktion
* Jobbörse
* Freelancer-Marktplatz
* Bewertungen mit Sternen
* öffentlicher Algorithmus-Feed
* mobile App
* umfangreiche Gamification
* Video-Hosting
* komplexes Rechte-/Rollenmanagement
* KI-Funktionen
* mehrere Städte parallel (nur Hamburg im MVP)

Begründung:

Das MVP muss lokale Aktivität und gegenseitiges Testen in einer Stadt beweisen, nicht eine vollwertige Plattform simulieren.

⸻

12. Hauptnutzerreisen

Nutzerreise 1: Neue Person tritt bei

1. Person kommt auf Startseite.
2. Sie versteht: Werkzirkel ist für digitale Produktmacher:innen in Hamburg.
3. Sie registriert sich.
4. Sie erstellt einen Werkpass.
5. Sie gibt an, ob sie ein eigenes Werk hat.
6. Sie sieht Werke und Termine aus Hamburg.
7. Sie meldet sich zu einer Prüfrunde oder einem Schauabend an.

Erfolg:

Die Person findet innerhalb von zehn Minuten mindestens einen relevanten Kontakt, ein Werk oder einen Termin.

⸻

Nutzerreise 2: Person sucht Tester:innen

1. Person legt ein Werk an.
2. Person hat ihre Reziprozitäts-Pflicht erfüllt (zwei Tests gegeben) — sonst sieht sie statt „Prüfrunde starten" zuerst „Diese zwei Werke suchen Tester:innen".
3. Sie startet eine Prüfrunde.
4. Sie beschreibt, was getestet werden soll.
5. Andere Mitglieder melden sich als Tester:innen.
6. Tester:innen geben strukturiertes Feedback.
7. Die Person bedankt sich und markiert Feedback als hilfreich.

Erfolg:

Ein Werk erhält innerhalb von sieben Tagen mindestens drei brauchbare Rückmeldungen.

⸻

Nutzerreise 3: Lokaler Schauabend

1. Kurator:in erstellt Termin „Schauabend Hamburg".
2. Mitglieder reichen Werke ein.
3. Drei bis fünf Werke werden ausgewählt.
4. Teilnehmer:innen melden sich an.
5. Beim Treffen werden Werke gezeigt und getestet.
6. Nach dem Treffen werden Feedback und nächste Schritte dokumentiert.

Erfolg:

Aus einem Treffen entstehen konkrete Verbesserungen, neue Kontakte oder weitere Prüfrunden.

⸻

13. Funktionale Anforderungen

Registrierung und Mitgliedschaft

ID	Anforderung	Priorität
F-001	Nutzer:innen können sich mit E-Mail registrieren.	Muss
F-002	Nutzer:innen wählen eine primäre Stadt/Region.	Muss
F-003	Nutzer:innen können ihren Werkpass erstellen und bearbeiten.	Muss
F-004	Nutzer:innen können angeben, ob sie vor Ort, online oder beides teilnehmen wollen.	Muss
F-005	Nutzer:innen können ihr Konto deaktivieren.	Muss

⸻

Werke

ID	Anforderung	Priorität
F-101	Nutzer:innen können ein Werk anlegen.	Muss
F-102	Ein Werk hat Name, Beschreibung, Stand, Zielgruppe und Hilfebedarf.	Muss
F-103	Werke können nach Stand und Hilfebedarf gefiltert werden. Stadtfilter ergibt sich aus der Stadt der Werkinhaber:in.	Muss
F-104	Werke können als „pausiert" markiert werden.	Sollte
F-105	Werke können Screenshots enthalten.	Sollte
F-106	Werke können privat oder öffentlich sichtbar sein.	Später

⸻

Prüfrunden

ID	Anforderung	Priorität
F-201	Nutzer:innen können für ein Werk eine Prüfrunde starten.	Muss
F-202	Prüfrunden enthalten Ziel, Testaufgabe, Zeitbedarf und Frist.	Muss
F-203	Andere Nutzer:innen können sich als Tester:innen melden.	Muss
F-204	Tester:innen können strukturiertes Feedback abgeben.	Muss
F-205	Feedback ist zunächst nur für Werkinhaber:in sichtbar.	Muss
F-206	Werkinhaber:in kann Feedback als hilfreich markieren.	Sollte
F-207	Wer eine Prüfrunde starten will, sieht den eigenen Test-Saldo und ggf. einen Block, bis zwei Tests gegeben oder zugesagt sind.	Muss
F-208	Reziprozität wird technisch durchgesetzt: keine neue Prüfrunde bei offener Schuld älter als 14 Tage.	Muss
F-209	Werkpass zeigt sichtbar gegebene und erhaltene Prüfrunden-Tests („Test-Saldo").	Muss

⸻

Regionale Zirkel

ID	Anforderung	Priorität
F-301	Hamburg hat eine Zirkel-Seite.	Muss
F-302	Zirkel-Seite zeigt Mitglieder, Werke, Termine und Prüfrunden der Region.	Muss
F-303	Nutzer:innen können später weiteren Städten folgen.	Später
F-304	Kurator:innen können lokale Inhalte hervorheben.	Sollte

⸻

Termine

ID	Anforderung	Priorität
F-401	Kurator:innen/Admins können Termine erstellen.	Muss
F-402	Nutzer:innen können sich zu Terminen anmelden.	Muss
F-403	Termine können lokal oder online sein.	Muss
F-404	Termine haben maximale Teilnehmerzahl.	Sollte
F-405	Angemeldete Nutzer:innen erhalten E-Mail-Erinnerung.	Sollte

⸻

Moderation

ID	Anforderung	Priorität
F-501	Admins können Nutzer:innen sperren.	Muss
F-502	Admins können Werke ausblenden.	Muss
F-503	Nutzer:innen können Inhalte melden.	Sollte
F-504	Kurator:innen können regionale Inhalte moderieren.	Sollte

⸻

14. Nicht-funktionale Anforderungen

Sprache

ID	Anforderung	Priorität
NF-001	Alle UI-Texte sind auf Deutsch.	Muss
NF-002	System-E-Mails sind auf Deutsch.	Muss
NF-003	Community-Regeln sind auf Deutsch.	Muss
NF-004	Eventformate haben deutsche Namen.	Muss

Datenschutz

ID	Anforderung	Priorität
NF-101	DSGVO-konforme Datenschutzerklärung.	Muss
NF-102	Impressum für DACH-Betrieb, initial Deutschland.	Muss
NF-103	Nutzer:innen können Datenlöschung anfragen.	Muss
NF-104	E-Mail-Einwilligungen sind getrennt erfassbar.	Muss

Bedienbarkeit

ID	Anforderung	Priorität
NF-201	Mobile Nutzung muss gut funktionieren.	Muss
NF-202	Werk anlegen dauert maximal fünf Minuten.	Muss
NF-203	Prüfrunde anlegen dauert maximal fünf Minuten.	Muss
NF-204	Startseite erklärt Produkt innerhalb von 30 Sekunden.	Muss

⸻

15. Informationsarchitektur

Hauptnavigation

* Start
* Zirkel
* Werke
* Prüfrunden
* Termine
* Mitmachen

Eingeloggt

* Übersicht
* Mein Werkpass
* Meine Werke
* Meine Prüfrunden (mit Test-Saldo)
* Meine Termine
* Einstellungen

Admin/Kuration

* Mitglieder
* Werke
* Prüfrunden
* Termine
* Meldungen
* Städte/Zirkel

⸻

16. Datenmodell v0.2

Anmerkung: Stadt wird nur auf Nutzer:in geführt. Werk, Prüfrunde und Termin erben die Stadt aus der Werkinhaber:in bzw. dem Anlegenden. Das vermeidet Drift und vereinfacht Filter.

Nutzer:in

* id
* name
* email
* stadt
* region
* rolle
* kurzbeschreibung
* fähigkeiten
* interessen
* teilnahmeart
* test_saldo_gegeben
* test_saldo_erhalten
* offene_reziprozitaets_schuld_bis (Datum oder null)
* erstellt_am
* status

Werk

* id
* nutzer_id (Stadt ergibt sich daraus)
* name
* beschreibung
* problem
* zielgruppe
* werkstand
* hilfebedarf
* link
* screenshot_url
* erstellt_am
* aktualisiert_am
* status

Prüfrunde

* id
* werk_id
* titel
* testziel
* testaufgabe
* zielgruppe
* zeitbedarf
* gesuchte_tester
* frist
* status
* erstellt_am

Feedback

* id
* pruefrunde_id
* tester_id
* erster_eindruck
* verstaendlichkeit
* nutzen
* bedienbarkeit
* fehler
* verbesserung
* zahlungsbereitschaft
* sonstiges
* hilfreich_markiert
* erstellt_am

Termin

* id
* stadt
* typ
* titel
* beschreibung
* ort
* online_link
* datum
* uhrzeit
* max_teilnehmer
* erstellt_von
* status

Anmeldung

* id
* termin_id
* nutzer_id
* status
* erstellt_am

⸻

17. Startseiten-Konzept

Hero

Headline:

Baue digitale Produkte nicht allein.

Subline:

Werkzirkel verbindet unabhängige digitale Macher:innen in Hamburg – zum Austauschen, Testen, Lernen und Vorankommen. Berlin und München folgen.

Primärer Button:

Zum Hamburger Werkzirkel

Sekundärer Button:

Eigenes Werk zeigen

⸻

Abschnitt: Für wen?

Für Menschen, die Apps, SaaS-Produkte, KI-Werkzeuge, Automationen, digitale Dienste oder Nebenprojekte bauen – allein, nebenbei, freiberuflich oder im kleinen Team.

⸻

Abschnitt: Was passiert im Werkzirkel?

Drei Kacheln:

1. Zeig dein Werk

Lege eine einfache Projektseite an und zeige, woran du arbeitest.

2. Starte eine Prüfrunde

Lass dein Produkt von anderen Macher:innen testen und erhalte strukturiertes Feedback. Voraussetzung: du hast selbst zwei Werke getestet.

3. Triff deinen Zirkel

Nimm an lokalen Prüfabenden, Baurunden und Schauabenden in Hamburg teil.

⸻

Abschnitt: Erste Zirkel

* Hamburg (aktiv)
* Berlin (folgt, wenn Hamburg trägt)
* München (folgt, wenn Hamburg trägt)

Text:

Wir starten bewusst mit einer Stadt. Erst wenn Hamburg lebt, replizieren wir.

⸻

Abschnitt: Grundregeln

* Deutschsprachig
* Lokal verankert
* Hilfreich statt laut
* Projekte statt Selbstdarstellung
* Wer Hilfe bekommt, hilft auch anderen — verbindlich

⸻

18. Community-Betriebsmodell

Rollen

Mitglied

Kann:

* Werkpass erstellen
* Werke anlegen
* Prüfrunden starten (nach erfüllter Reziprozität)
* Feedback geben
* Termine besuchen

Kurator:in

Kann zusätzlich:

* lokale Termine erstellen
* Mitglieder begrüßen
* Werke für Schauabende auswählen
* lokale Regeln durchsetzen
* neue Mitglieder aktivieren

Im MVP: eine Kurator:in für Hamburg. Initial möglicherweise der Gründer selbst.

Admin

Kann:

* alle Inhalte moderieren
* Städte/Zirkel anlegen
* Kurator:innen ernennen
* Nutzer:innen sperren
* Plattformtexte bearbeiten

⸻

19. Lokale Formate

1. Prüfabend

Zweck: konkrete Produkte testen
Dauer: 90–120 Minuten
Format: 3 Werke, je 20 Minuten Feedback
Teilnehmer:innen: 8–20
Ergebnis: jedes Werk erhält dokumentiertes Feedback

2. Schauabend

Zweck: Sichtbarkeit und Motivation
Dauer: 2 Stunden
Format: 5 Kurzvorstellungen à 7 Minuten
Teilnehmer:innen: 15–40
Ergebnis: Kontakte, Feedback, Folgeprüfrunden

3. Baurunde

Zweck: gemeinsam arbeiten
Dauer: 2–4 Stunden
Format: ruhiges Arbeiten, kurze Anfangsrunde, kurze Abschlussrunde
Teilnehmer:innen: 5–20
Ergebnis: Fortschritt und Verbindlichkeit

4. Werkgespräch

Zweck: Wissen teilen
Themenbeispiele:

* Wie finde ich erste Nutzer:innen?
* Wie teste ich eine App sauber?
* Wie formuliere ich ein Nutzenversprechen?
* Wie nutze ich KI beim Entwickeln?
* Wie baue ich eine einfache Startseite?
* Wie kalkuliere ich Preise?

5. Kennenlernrunde

Zweck: Einstieg erleichtern
Format: niedrigschwellig, ohne Pitchdruck
Ergebnis: neue Mitglieder verstehen, wie Werkzirkel funktioniert

⸻

20. Geschäftsmodell

Grundsatz

Werkzirkel sollte nicht als Jobbörse starten. Das würde sofort die Kultur verändern.

Besser:

Mitgliedschaft + lokale Formate + Partner, aber keine aggressive Lead-Verwertung.

Realismus-Hinweis (neu in v0.2)

Das wirtschaftliche Ziel des MVP ist nicht Selbsttragfähigkeit, sondern Validierung. Bei 50 zahlenden Fördermitgliedern × 12 €/Monat sind das ca. 600 €/Monat — das deckt Hosting und kleine Auslagen, nicht eine Stelle. Werkzirkel wird in Phase 1–3 entweder als Hobby- und Missionsprojekt geführt oder durch externe Quellen co-finanziert (siehe „Pfade zur Tragfähigkeit").

Modell v1

Kostenlos

* Werkpass
* ein Werk
* Teilnahme an offenen Prüfrunden
* Basis-Zirkelzugang

Fördermitgliedschaft

Möglicher Preisbereich: 9–19 € pro Monat

Enthält:

* mehrere Werke
* bevorzugte Prüfrunden
* Teilnahme an geschlossenen Baurunden
* Archiv von Werkgesprächen
* Ermäßigungen für lokale Termine

Lokale Partner

Mögliche Partner:

* Coworking-Spaces
* Hochschulen
* Gründungszentren
* Softwarehäuser
* Stadtinitiativen
* lokale Tech-Unternehmen

Aber: Partner dürfen nicht dominieren.

Regel:

Partner unterstützen den Kreis, sie besitzen ihn nicht.

Pfade zur Tragfähigkeit (frühestens Phase 3)

* Fördermitgliedschaften skaliert auf 300+ über drei Städte
* Coworking-Partnerschaften mit fixem Quartalsbeitrag (z.B. 200–500 €/Quartal je Standort) gegen Nutzungslizenz und Sichtbarkeit
* bezahlte Werkgespräche / kuratierte Workshops (50–150 € pro Sitzplatz)
* Optional: Sponsorship einzelner Schauabende durch lokale Tech-Unternehmen, transparent und unaufdringlich

Bewusst nicht: Stellenanzeigen, Provisionen auf gefundene Kund:innen, Werbung im Feed.

⸻

21. Erfolgskennzahlen

Hinweis v0.2: Kennzahlen beziehen sich auf Hamburg. Berlin/München kommen erst dazu, wenn Hamburg trägt.

Aktivierung Hamburg

Kennzahl	Ziel MVP
Registrierte Nutzer:innen	60
Angelegte Werke	20
Nutzer:innen mit Werkpass	80 Prozent
Nutzer:innen mit mindestens einem Werk	50 Prozent

Austausch

Kennzahl	Ziel MVP
Gestartete Prüfrunden	10
Abgeschlossene Feedbacks	40
Feedbacks pro Prüfrunde	mindestens 3
Anteil aktiver Feedbackgeber:innen	mindestens 50 Prozent
Reziprozitäts-Quote (Tests gegeben ≥ Tests erhalten)	mindestens 80 Prozent

Lokalität

Kennzahl	Ziel MVP
Aktive Schauabende	3
Teilnehmer:innen pro Schauabend	8–15 (Schauabend 1), 12–25 (Schauabend 3)
Wiederkehrende Teilnehmer:innen	mindestens 50 Prozent

Qualität

Kennzahl	Ziel MVP
Nutzerzufriedenheit nach Prüfrunde	mindestens 4 von 5
Anteil „hilfreiches Feedback"	mindestens 60 Prozent
Dokumentierte Werk-Verbesserungen durch Feedback	mindestens 5
Spam-/Moderationsfälle	sehr niedrig halten

⸻

22. MVP-Roadmap (Hamburg-First, komplett neu in v0.2)

Phase 0: Hypothesen-Test ohne Software (Wochen 1–4)

Ziel: Beweisen, dass in Hamburg überhaupt 8+ digitale Macher:innen an einem Abend zusammenkommen wollen.

Bauen: keine Plattform. Nur:

* eine einseitige Landingpage (statisch, Tally-Formular für Warteliste)
* Eventbrite/Luma-Seite für ersten Schauabend
* öffentliche Notion-Seite mit Konzept, Regeln, Format
* eine E-Mail-Adresse: hamburg@werkzirkel.de

Tun:

* Akquise gemäß Section 23 starten
* Ort sichern (Coworking-Space-Anfragen, drei Optionen)
* ersten Schauabend ankündigen
* parallel 10–15 Einzelgespräche mit potenziellen Erstmitgliedern

Ergebnis:

Anmeldungen für Schauabend 1 ≥ 12 Personen, sonst Konzept überprüfen.

⸻

Phase 1: Drei Schauabende ohne Plattform (Wochen 5–12)

Ziel: Format iterieren, Stammgäste gewinnen, Bedarf für Plattformfunktionen aus realen Treffen ableiten.

Tun:

* Schauabend 1: Format probieren, Feedback einsammeln
* zwischen Schauabenden: Werke in Notion sammeln, Prüfrunden manuell per E-Mail organisieren
* Schauabend 2: Format anpassen
* Schauabend 3: stabiles Format, mindestens 15 Teilnehmer:innen, 50 Prozent Wiederkehrer
* nach jedem Schauabend: kurze Retro, Pain Points dokumentieren

Bauen:

* nichts. Wirklich nichts.

Ergebnis-Gate für Phase 2:

Drei Schauabende mit mindestens 8/12/15 Teilnehmer:innen, mindestens 5 dokumentierte Werk-Verbesserungen, mindestens 50 Prozent Wiederkehrer. Sonst: weiter iterieren in Phase 1, keine Plattform.

⸻

Phase 2: Schlanke Plattform (Wochen 13–18)

Bauen (nur was in Phase 1 nachweislich gefehlt hat, plus die Reziprozitäts-Mechanik):

* Registrierung
* Werkpass mit Test-Saldo
* Werkseiten
* Hamburg-Zirkelseite
* Prüfrunden mit Reziprozitäts-Durchsetzung (F-201 bis F-209)
* Terminseiten
* E-Mail-Benachrichtigung
* Adminbereich minimal

Ergebnis:

Hamburger Werkzirkel hat eine funktionierende Plattform, die das ersetzt, was bisher Notion/E-Mail/Eventbrite gemacht haben.

⸻

Phase 3: Replikation Berlin und München (Monat 5–8)

Voraussetzung: Hamburg hat drei tragende Schauabende mit ≥15 Teilnehmer:innen und stabilem Kern.

Start je Stadt:

* 1 lokale Kurator:in identifizieren und ausbilden
* Akquisekanäle aus Hamburg adaptieren (Section 23)
* erster Schauabend nach Hamburg-Playbook
* Plattform öffnet Stadt erst, wenn lokale Kurator:in steht

Bewusst NICHT: beide Städte gleichzeitig starten. Berlin zuerst, München mit ca. 4 Wochen Versatz.

Ergebnis:

Pro Stadt: 30–50 Mitglieder, 10–15 Werke, erste zwei Schauabende.

⸻

Phase 4: Bezahlmodell testen (ab Monat 8)

Testen:

* Fördermitgliedschaft
* kostenpflichtige Werkgespräche
* Partnerpakete für lokale Unterstützer
* Coworking-Kooperationen

Nicht testen:

* Jobbörse
* Provisionen
* aggressive Werbung

⸻

23. Akquisestrategie Hamburg (neu in v0.2)

Die kritische Frage „woher kommen die ersten 30 Macher:innen" wird nicht durch eine Landingpage gelöst. Es ist Handarbeit.

Kanal 1: Persönliche Direktansprache (höchste Priorität)

* eigenes Netzwerk in Hamburg systematisch durchgehen (LinkedIn, Telefonbuch, alte Kontakte)
* Ziel: 30 persönliche Nachrichten in Woche 1, davon 10 Termine, davon 5 Erstmitglieder

Kanal 2: Bestehende Hamburger Communities anhängen, nicht ersetzen

* SaaS Hamburg, Hamburg Startups, Bytes & Beer, Hamburg Indie Hackers
* Code & Comedy, Hamburg.dev, Hamburg JS, Webmontag Hamburg
* Strategie: bei einem Treffen jeder relevanten Gruppe persönlich erscheinen, vorstellen, einladen — nicht Posts in Chats abladen

Kanal 3: Coworking-Spaces als Multiplikatoren

* betahaus Hamburg, Mindspace, WeWork, Nido, kleinere lokale Spaces
* Ziel: pro Space 1 Gespräch, ggf. Aushang oder kurze Vorstellung
* Schauabend-Kooperation: Space stellt Raum, Werkzirkel bringt Menschen

Kanal 4: Hochschulen und Gründungszentren

* HAW Hamburg, Universität Hamburg, HSBA, Tutech, Beyond1435
* Ansprechpartner:innen für studentische Gründer:innen direkt kontaktieren

Kanal 5: Themennahe lokale Newsletter und Mastodon-DE

* Hamburg-spezifische Tech-Newsletter (sofern existent)
* hh.social und chaos.social mit lokalem Hashtag

Was nicht funktionieren wird (Erfahrungswerte):

* Cold-Posts auf LinkedIn ohne persönliche Ansprache
* Reddit (zu wenig DACH-Tech-Aktivität)
* breite SEO-Strategie (Werkzirkel hat keinen Suchverkehr-Bedarf, sondern Beziehungs-Bedarf)
* bezahlte Anzeigen (zu früh, falsche Mechanik)

Erfolgsmesser Phase 0:

* 30 Direktansprachen
* 10 Einzelgespräche geführt
* 20 Anmeldungen für Schauabend 1
* 12 erschienen

⸻

24. Risiken

Risiko 1: Zu breit

Wenn Werkzirkel „für alle Kreativen" wird, verliert es Fokus.

Gegenmaßnahme:

Fokus bleibt digitale Produkte.

⸻

Risiko 2: Zu viel Networking, zu wenig Machen

Viele Communities reden nur.

Gegenmaßnahme:

Jedes Format braucht ein Ergebnis: Feedback, Fortschritt, Kontakte, nächste Schritte. Reziprozitäts-Pflicht.

⸻

Risiko 3: Zu viel Sales

Freelancer und Agenturen könnten die Plattform als Akquise-Kanal missbrauchen.

Gegenmaßnahme:

Keine Kaltakquise. Hilfe zuerst. Sichtbarkeit über Beiträge, nicht über Werbung.

⸻

Risiko 4: Zu wenig lokale Dichte

Wenn eine Stadt zu wenige aktive Mitglieder hat, entsteht kein Kreisgefühl.

Gegenmaßnahme:

Eine Stadt zuerst (Hamburg). Replikation erst nach Validierung.

⸻

Risiko 5: Deutsch-only wird unterschätzt

Viele Tech-Leute rutschen automatisch ins Englische.

Gegenmaßnahme:

Deutsch ist Produktregel. Auch Begriffe, Buttons, E-Mails und Events bleiben deutsch.

⸻

Risiko 6 (neu in v0.2): Plattform-Falle

Versuchung, früh eine schöne Plattform zu bauen, statt Menschen zusammenzubringen.

Gegenmaßnahme:

Phase-1-Verbot: in den ersten 12 Wochen keine Plattformentwicklung. Werkzeuge: Eventbrite, Notion, E-Mail.

⸻

Risiko 7 (neu in v0.2): Gründer-Burnout-Stadt-Stapelung

Drei Städte parallel kurz nach Hamburg-Erfolg überfordert eine Solo-Person.

Gegenmaßnahme:

Berlin und München gestaffelt starten (4 Wochen Versatz), je mit eigener Kurator:in vor Ort, nicht ferngesteuert.

⸻

25. Tonalität

Werkzirkel sollte nicht klingen wie ein Startup-Hypeprodukt.

Nicht so:

„Join the leading founder community for indie builders."

Sondern so:

„Triff Menschen in Hamburg, die digitale Produkte bauen. Zeig dein Werk, teste andere Werke und komm gemeinsam weiter."

Ton

* klar
* direkt
* produktiv
* unprätentiös
* deutsch
* kollegial
* nicht anbiedernd

Verbotene Sprachmuster

* Hustle
* Unicorn
* Scale
* Disrupt
* Founder Energy
* 10x
* Bro-Marketing
* „Crush it"
* „Next big thing"
* Stack (in nutzergerichteten Texten)
* Pipeline (in nutzergerichteten Texten)
* Roadmap (in nutzergerichteten Texten — intern erlaubt)
* Game-Changer
* Synergie
* MVP (extern; intern erlaubt)
* Onboarding (sag „Einstieg")
* Touchpoint (sag „Kontaktpunkt")

⸻

26. Erste Version der Positionierung

Ein-Satz-Positionierung

Werkzirkel ist die deutschsprachige Plattform für unabhängige digitale Macher:innen, die lokal zusammenkommen, ihre Produkte testen und gemeinsam vorankommen.

Kurzversion

Gemeinsam digitale Produkte bauen.

Langversion

Werkzirkel verbindet Indie-Developer, Freelancer, Solo-Gründer:innen und digitale Produktmacher:innen im DACH-Raum. In lokalen Zirkeln zeigen Mitglieder ihre Werke, starten Prüfrunden, geben Feedback und treffen sich vor Ort. Deutschsprachig, verbindlich und ohne Startup-Theater. Wir starten in Hamburg.

⸻

27. Konkrete MVP-Spezifikation in einem Satz

Wir machen zuerst:

Drei Schauabende in Hamburg, organisiert mit Eventbrite und Notion. Erst danach bauen wir eine schlanke Plattform für Hamburger Werke, Prüfrunden mit Reziprozitäts-Pflicht und lokale Termine.

Nicht mehr.
Nicht weniger.

⸻

28. Meine klare Empfehlung

Wir starten mit folgender Konfiguration:

Bereich	Entscheidung
Name	Werkzirkel
Untertitel	Gemeinsam digitale Produkte bauen.
Sprache	ausschließlich Deutsch
Region	Deutschland, Start Hamburg
Erste Stadt	Hamburg (alleine)
Replikation	Berlin, dann München — erst nach Hamburg-Validierung
Kernfeature	Reale Schauabende (Phase 1)
Zweites Kernfeature	Prüfrunden mit Reziprozitäts-Pflicht (Phase 2)
Zentrale Objekte	Werke, Werkpässe, Zirkel
MVP-Ziel	drei tragende Schauabende in Hamburg
Kein MVP-Fokus	mehrere Städte parallel, Plattform vor Treffen, Chat, Jobbörse, App

⸻

29. Nächste konkrete Schritte (komplett umgeschrieben in v0.2)

In dieser Reihenfolge:

1. Schauabend 1 datieren: Termin in ca. 5–6 Wochen, Wochentag und Uhrzeit festlegen (Empfehlung: Mittwoch- oder Donnerstagabend, 19:00).
2. Drei Raum-Optionen sichern: betahaus Hamburg, Mindspace, ein weiterer Coworking-Space anfragen.
3. Eventbrite/Luma-Seite anlegen mit Format, Regeln, Anmeldelink.
4. Statische Landingpage mit Tally-Warteliste (kein eigenes Backend).
5. Notion-Seite öffentlich: Konzept, Regeln, Werke der ersten Mitglieder.
6. 30 persönliche Direktansprachen in Hamburg starten (Section 23).
7. Drei bestehende Hamburger Tech-Treffen besuchen und persönlich einladen.
8. Schauabend 1 durchführen mit mindestens 8 Anwesenden.
9. Retro: was hat gefehlt? Erst daraus folgt Phase-2-Funktionsumfang.
10. Schauabende 2 und 3 in 3- bis 4-Wochen-Abstand.

Erst wenn 1–10 erledigt sind und das Erfolgsgate aus Phase 1 erreicht ist, beginnt Plattformbau.

Was wir bewusst NICHT als nächstes tun:

* Plattform bauen
* drei Städte parallel anschieben
* Final-Texte für die volle Plattform-Landingpage schreiben
* Datenbank-Schema implementieren
