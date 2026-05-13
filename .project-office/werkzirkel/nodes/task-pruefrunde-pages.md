---
acceptance_criteria:
  - "Fuenf neue Pages: /pruefrunden, /pruefrunden/[id], /pruefrunden/neu, /pruefrunden/[id]/bearbeiten, /pruefrunden/[id]/feedback, /uebersicht/pruefrunden"
  - Erfuellt PRD §F-201..§F-209 im UI-Pfad (Anlegen, Bearbeiten, Veroeffentlichen mit Reziprozitaets-Check, Tester-Anmeldung, Feedback-Abgabe, hilfreich-Markierung, Test-Saldo-Anzeige)
  - "Werk-Detail-Page /werke/[id] hat den 'Pruefrunde anbieten'-Button nicht mehr als Stub, sondern aktiv: Inhaber → /pruefrunden/neu?werk=<id>, anonym → /anmelden?next=/werke/[id]"
  - /uebersicht zeigt eigene Test-Saldo-Zahlen aus test_saldo (gegeben/erhalten/offen) mit echten Daten
  - Reziprozitaets-Block beim Veroeffentlichen zeigt deutsches Erklaer-Banner (Frist + Werkstatt-Kultur-Hinweis), nicht nur eine technische Fehlermeldung
  - "Sprach-Check: kein englischer String in den 5 neuen Pages"
created_at: 2026-05-13T14:42:36.765Z
created_by: human
edges:
  blocks:
    - id: task-test-saldo-integration
  composed_of:
    - id: wp-pruefrunden
  depends_on:
    - id: task-feedback-api
effort: S
id: task-pruefrunde-pages
is_root: false
open_questions: []
owner: null
parent: wp-pruefrunden
private: false
risks: []
status: done
summary: "Komplette UI-Schicht: /pruefrunden Liste, /pruefrunden/[id] Detail mit Anmelden-Button, /pruefrunden/neu Anlege-Form (vom Werk-Detail-Button verlinkt), /pruefrunden/[id]/feedback Feedback-Form, /uebersicht/pruefrunden eigene gegebene+erhaltene."
tags: []
title: "Pruefrunde-UI: Liste, Detail, Anlegen, Feedback-Form, eigene Uebersicht"
type: task
updated_at: 2026-05-13T15:46:39.083Z
---

## Approach

Fuenf Pages, alle Server Components mit Server Actions wo noetig:

### A) /pruefrunden — Liste

`apps/web/app/pruefrunden/page.tsx`. Public.
- Filter: stadt, status (default 'oeffentlich'+'geschlossen'), werk_id (optional)
- Werk-Cards mit Pruefrunde-Titel als Headline + Werk-Name als Subline + Werkstand-Pill + 'Frist: <datum>' + Tester-Counter ('<n>/<m> angemeldet')
- Kein Suchschlitz
- Empty-State: 'Noch keine offenen Pruefrunden in <stadt>. Schau bald wieder vorbei.'

### B) /pruefrunden/[id] — Detail

`apps/web/app/pruefrunden/[id]/page.tsx`. Public.
- 404 wenn Pruefrunde nicht existiert oder status='entwurf' und nicht Inhaber.
- Hero: Pruefrunde-Titel, Werk-Link, Werkstand-Pill, Inhaber-Mini, 'Frist: <datum>', Status-Pill.
- Sektion 'Was getestet werden soll': testziel + testaufgabe (als rendered Markdown via remark, DOMPurify gefiltert).
- Sektion 'Was wir wissen wollen': feedback_kategorien als Tag-Liste mit deutschen Labels.
- Sektion 'Zeitaufwand': zeitbedarf_minuten + 'Zeit fuer einen sauberen Durchlauf'.
- Action-Box (rechts):
  - Wenn anonym: 'Anmelden, um Tester:in zu werden' → /anmelden?next=/pruefrunden/[id].
  - Wenn eingeloggt als Macher:in, nicht angemeldet, slot frei: 'Als Tester:in anmelden'-Button (Server Action POST /api/v1/pruefrunden/:id/anmeldung).
  - Wenn schon angemeldet: 'Du bist angemeldet. Frist: <datum>.' + 'Feedback abgeben'-Link → /pruefrunden/[id]/feedback.
  - Wenn voll: 'Plaetze voll. Tester:innen: <n>/<m>'.
  - Wenn Inhaber: Sektion 'Deine Pruefrunde verwalten' mit Liste angemeldeter Tester:innen + 'Schliessen'-Button (wenn status='oeffentlich' und mind. 1 Feedback) + 'Abschliessen'-Button (wenn status='geschlossen' und mind. 1 hilfreich-Markierung).

### C) /pruefrunden/neu — Anlege-Form

`apps/web/app/pruefrunden/neu/page.tsx`. Auth required, Macher:in-Rolle, Werk-Inhaber.
- Query-Param `?werk=<id>` aus dem Werk-Detail-Button (PRD §8.4).
- Server Component mit Server Action `pruefrundeAnlegen(formData)`:
  - Validiert via Zod.
  - Permission-Check: Werk muss dem User gehoeren.
  - INSERT pruefrunde mit status='entwurf'.
  - redirect zu /pruefrunden/[neue-id]/bearbeiten (Bearbeiten-Page; siehe D).
- Form-Felder: Werk-Auswahl (wenn ?werk-Param vorhanden: vorgewaehlt), Titel, Testziel, Testaufgabe (Markdown-Textarea), Zielgruppe, Zeitbedarf-Slider (5-120 Min), Tester-Anzahl-Slider (1-10), Feedback-Kategorien-Checkboxen, Frist-Datumspicker.

### D) /pruefrunden/[id]/bearbeiten — Edit + Veroeffentlichen

`apps/web/app/pruefrunden/[id]/bearbeiten/page.tsx`. Auth + Inhaber.
- Form vorgefuellt mit aktuellen Werten.
- 'Speichern'-Button → Server Action PATCH.
- 'Veroeffentlichen'-Button → Server Action POST /veroeffentlichen.
  - Bei Reziprozitaets-Block: deutscher Warning-Banner mit Hinweis 'Du hast eine offene Reziprozitaets-Verpflichtung. Bitte zuerst zwei Werke testen.'
  - Bei Erfolg + neue Verpflichtung: Erklaerungs-Banner 'Diese Pruefrunde wird veroeffentlicht. Im Gegenzug verpflichtest du dich, bis zum <frist> zwei Werke anderer zu testen. Test-Saldo: <saldo>'.

### E) /pruefrunden/[id]/feedback — Feedback-Form

`apps/web/app/pruefrunden/[id]/feedback/page.tsx`. Auth, muss als Tester:in angemeldet sein.
- 404 wenn nicht angemeldet oder schon Feedback gegeben.
- Form mit 8 optionalen Kategorie-Textareas (nur die, die in feedback_kategorien der Pruefrunde stehen) + Pflicht-Gesamteindruck.
- 'Feedback abgeben'-Button → Server Action POST /feedback.
- Nach Submit: redirect zu /uebersicht/pruefrunden mit Erfolg-Banner.

### F) /uebersicht/pruefrunden — Eigene

`apps/web/app/uebersicht/pruefrunden/page.tsx`. Auth.
- Zwei Tabs:
  - 'Gestartet' — eigene Pruefrunden (alle Status), mit Schnellzugriff zu Inhaber-Aktionen.
  - 'Als Tester:in' — Pruefrunden, an denen ich angemeldet bin/war, mit Feedback-Status.
- Plus offene Reziprozitaets-Verpflichtungen ganz oben als rotes Banner wenn vorhanden.

### G) Update /uebersicht

Der Stub-Link 'Meine Pruefrunden (in Vorbereitung)' wird zu 'Meine Pruefrunden' → /uebersicht/pruefrunden.

### H) Update /werke/[id]

Der 'Pruefrunde anbieten'-Stub-Link wird aktiv. Wenn User eingeloggt + Werk-Inhaber: → /pruefrunden/neu?werk=<id>. Sonst: → /anmelden?next=/werke/[id].

### Tests

Mehrere Integration-Tests pro Page (Render, Auth-Redirect, Server-Action-Side-Effects).
Sprach-Check pro Page (keine englischen Strings).
Leak-Tests fuer Feedback-Page (Werkinhaber-Email nicht im Tester:innen-HTML).

### Quality gate

```
cd /Users/udi/work/moinsen/ideas/werkzirkel/apps/web && rm -rf .next && pnpm exec vitest run
cd .. && pnpm typecheck && NODE_ENV=production pnpm build
```

All three green.

Started 2026-05-13T15:30:01.942Z: autobuild pruefrunden iter 6

Done 2026-05-13T15:46:39.083Z: 6 Pruefrunde-Pages (Liste, Detail, Neu, Bearbeiten, Feedback, Uebersicht) + Werk-Detail-Link aufgeloest (Tests: green via `cd /Users/udi/work/moinsen/ideas/werkzirkel/apps/web && pnpm exec vitest run`)
