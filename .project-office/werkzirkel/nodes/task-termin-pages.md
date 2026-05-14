---
acceptance_criteria:
  - "Sechs neue Pages plus eine Page-Update: /termine, /termine/[id], /kurator/termine/neu, /kurator/termine/[id]/bearbeiten, /kurator/termine/[id]/anwesenheit, /uebersicht/termine, Update /uebersicht-Stubs"
  - Erfuellt PRD §F-401..§F-405 im UI-Pfad (Termin-CRUD-UI, Anmeldung, Erinnerungen-Link, Anwesenheits-Dokumentation)
  - Termin-Detail-Page hat iCal-Download-Link 'In Kalender uebernehmen' fuer angemeldete Nutzer:innen
  - Permission-basierte Action-Box-Varianten gemaess Plan (anonym/eingeloggt-frei/eingeloggt-angemeldet/voll/Kurator:in)
  - /zirkel/[stadt] zeigt echte Termine aus der DB
  - "Sprach-Check: kein englischer String in den neuen Pages"
created_at: 2026-05-13T16:04:07.186Z
created_by: human
edges:
  composed_of:
    - id: wp-termine
  depends_on:
    - id: task-termin-anwesenheit-api
    - id: task-ical-export
effort: S
id: task-termin-pages
is_root: false
open_questions: []
owner: null
parent: wp-termine
private: false
risks: []
status: done
summary: "Sieben Pages: /termine Liste, /termine/[id] Detail mit Anmelde-Button und iCal-Download, /kurator/termine/neu, /kurator/termine/[id]/bearbeiten, /kurator/termine/[id]/anwesenheit, /uebersicht/termine eigene Anmeldungen. Plus /zirkel/[stadt] mit echten Termin-Daten verdrahten."
tags: []
title: "Termin-UI: Liste, Detail, Kurator-Anlegen, Anwesenheits-Form, eigene Uebersicht, Zirkel-Stadt-Update"
type: task
updated_at: 2026-05-14T05:26:42.172Z
---

## Approach

Folge dem Layout-Pattern aus wp-pruefrunden-Pages. Server Components mit Server Actions wo noetig.

### A) /termine — Liste (Server Component, public)

`apps/web/app/termine/page.tsx`.
- Filter via searchParams: stadt (default 'hh'), typ (mehrfach), ab_datum (default heute), bis_datum (optional).
- Hero: 'Termine im Werkzirkel <Stadt>', Counter.
- Filter-Sidebar: Stadt-Dropdown, Typ-Checkboxen (alle 6 Termin-Typen), Datums-Range.
- Liste mit Termin-Cards: Datum + Uhrzeit (deutsche Formatierung), Typ-Pill, Titel, Ort (oder 'Online'), Teilnehmer-Counter, Link 'Details'.
- Empty-State auf Deutsch.

### B) /termine/[id] — Detail (Server Component, public fuer non-'geplant')

`apps/web/app/termine/[id]/page.tsx`.
- 404 bei nicht-existent oder ('geplant' und nicht Kurator:in).
- Hero mit Typ-Pill, Titel, Datum + Uhrzeit (deutsche Formatierung), Status-Pill (status='abgesagt' rotgefaerbt).
- Sektion 'Was passiert': beschreibung als Markdown via lib/pruefrunde/markdown.ts (re-use).
- Sektion 'Ort': ort_text + online_link wenn beides; Karte (optional Stub).
- Action-Box rechts:
  - **Anonym:** Button 'Anmelden, um teilzunehmen' → /anmelden?next=/termine/[id]
  - **Eingeloggt, nicht angemeldet, Plaetze frei:** Form mit Server Action `terminAnmelden` → POST /anmeldung
  - **Eingeloggt, nicht angemeldet, voll:** Form mit Server Action → 'Auf Warteliste' (POST endet trotzdem mit status='warteliste')
  - **Eingeloggt, angemeldet:** 'Du bist angemeldet.' + iCal-Download-Link 'In Kalender uebernehmen' → /api/v1/termine/[id]/ical
  - **Eingeloggt, warteliste:** 'Du stehst auf der Warteliste.' + 'Stornieren'-Button.
  - **Kurator:in der Stadt:** Sektion 'Verwalten' mit Buttons: 'Bearbeiten' → /kurator/termine/[id]/bearbeiten, 'Anwesenheit dokumentieren' (wenn datum < now) → /kurator/termine/[id]/anwesenheit, 'Termin absagen', '... als durchgefuehrt markieren' (wenn datum < now).
- Status='abgesagt' Banner: rotes Banner 'Dieser Termin wurde abgesagt: <Grund>'.

### C) /kurator/termine/neu — Anlegen (auth + Kurator)

`apps/web/app/kurator/termine/neu/page.tsx`.
- 403 wenn nicht Kurator:in.
- Form mit Termin-Typ-Dropdown (alle 6), Titel, Beschreibung-Textarea, Datum-Picker, Uhrzeit-Picker, Ort-Input, Online-Link-Input, max-Teilnehmer-Slider.
- Server Action `terminAnlegen` → POST /api/v1/termine → redirect zu /termine/[neue-id].

### D) /kurator/termine/[id]/bearbeiten

Analoge Form, vorgefuellt. PATCH-Server Action. Plus 'Veroeffentlichen'-Button (wenn geplant) + 'Absagen'-Button (wenn veroeffentlicht).

### E) /kurator/termine/[id]/anwesenheit (auth + Kurator)

`apps/web/app/kurator/termine/[id]/anwesenheit/page.tsx`.
- Liste aller anmeldungen mit Checkbox pro Person (default unchecked).
- Server Action `anwesenheitSpeichern` → POST /api/v1/termine/:id/anwesenheit mit den angekreuzten IDs.
- Notizen-Textarea fuer notizen_nach_termin.
- Nach Submit: redirect zu /termine/[id] mit Erfolgs-Banner.

### F) /uebersicht/termine — Eigene Anmeldungen (auth)

`apps/web/app/uebersicht/termine/page.tsx`.
- Zwei Sektionen:
  - Kommende Termine (datum > now) mit status angemeldet/warteliste.
  - Vergangene Termine (datum < now) mit status anwesend/nicht_anwesend/storniert.
- Pro Termin: Card mit Datum + Titel + Status-Pill + Link zu /termine/[id] + 'Stornieren'-Button (wenn kommend).

### G) Update /uebersicht

Der Stub-Link 'Termine in Hamburg (in Vorbereitung)' wird zu 'Termine in Hamburg' → /termine?stadt=hh ODER /uebersicht/termine, je nach User-Wahl. Empfehlung: 'Termine in Hamburg' zur Stadt-Liste, 'Meine Termine' separat zu /uebersicht/termine.

### H) Update /zirkel/[stadt]

Die Termine-Sektion auf der Zirkel-Stadt-Seite hat schon Drizzle-Queries fuer kommende Termine. Diese sollten weiterhin funktionieren, aber jetzt mit echten Daten: prufen ob die Termine-Liste aus der DB wirklich aktuelle veroeffentlichte Termine zeigt. Plus den Empty-State-Text 'Der naechste Schauabend steht noch nicht.' belassen.

### Tests

Pro Page: Render, Auth-Redirect, Sprach-Check.
Plus end-to-end-Anmeldung + iCal-Download.

### Quality gate

```
cd /Users/udi/work/moinsen/ideas/werkzirkel/apps/web && rm -rf .next && pnpm exec vitest run
cd .. && pnpm typecheck && NODE_ENV=production pnpm build
```

DO NOT touch:
- APIs (schon done).
- Cron (schon done).
- iCal-Endpoint (schon done).

Started 2026-05-13T16:51:57.401Z: autobuild termine iter 7
