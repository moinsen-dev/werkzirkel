---
acceptance_criteria:
  - "10 neue Pages: /bedarfe, /bedarfe/[id], /bedarfe/neu, /bedarfe/[id]/werkangebot-neu, /foerderprofile, /foerderprofile/[id], /foerderprofile/neu, /uebersicht/{bedarfe,werkangebote,foerderprofil,werkstattbeitrag}"
  - Erfuellt PRD §F-601..§F-706 im UI-Pfad (alle Bedarf+Werkangebot+Foerderprofil-Flows durchklick-bar)
  - Equity-Hinweistext wird auf /foerderprofile/[id] gerendert wenn gegenleistung_typ='equity_offline'
  - "/bedarfe/neu hat 3-Schritt-Flow: Werkstattbeitrag-Auswahl → Bedarf-Form → Bestaetigung+Submit"
  - /uebersicht zeigt rollenspezifische Schnellzugriff-Karten ohne 'in Vorbereitung'-Stubs
  - "Sprach-Check: keine englischen Strings in den 10 neuen Pages"
created_at: 2026-05-14T06:03:26.098Z
created_by: human
edges:
  composed_of:
    - id: bedarfsseite
  depends_on:
    - id: task-werkangebot-api
    - id: task-foerderprofil-api
    - id: task-bedarfsschau-integration
effort: S
id: task-bedarfsseite-pages
is_root: false
open_questions: []
owner: null
parent: bedarfsseite
private: false
risks: []
status: done
summary: "Komplette UI-Schicht: /bedarfe Liste, /bedarfe/[id] Detail, /bedarfe/neu Anlege-Flow mit Werkstattbeitrag, /foerderprofile Liste, /foerderprofile/[id] Detail, /foerderprofile/neu, /uebersicht/bedarfe, /uebersicht/werkangebote, /uebersicht/foerderprofil, /uebersicht/werkstattbeitrag."
tags: []
title: "Bedarfsseite-UI: 10 Pages fuer Bedarfstraeger:innen, Foerder:innen, Macher:innen-Werkangebote"
type: task
updated_at: 2026-05-14T07:56:06.992Z
---

## Approach

Groesster UI-Task in Werkzirkel. Folge Pattern aus pruefrunde-pages und termin-pages.

### Pages

#### A) /bedarfe — Liste (Server Component, eingeloggt-only)
- Auth required (anonym → /anmelden).
- Filter: stadt, geldrahmen-range (wenn gesetzt), frist.
- Cards mit Titel, Organisation, Frist, Groessenordnung, Geldrahmen wenn gesetzt, Werkstand-Bevorzugung.
- KEIN Suchschlitz (S5).
- Empty-State auf Deutsch.

#### B) /bedarfe/[id] — Detail (Server Component, eingeloggt-only)
- Auth required.
- Werk-Beschreibung als Markdown.
- Action-Box rechts:
  - **Macher:in:** Form 'Werkangebot abgeben' (Server Action) — leitet zu /bedarfe/[id]/werkangebot-neu wenn noch keins.
  - **Bedarfstraeger:in (Eigentuemer):** Liste eigener Werkangebote mit Status, Buttons 'Status setzen' (in_gespraechen/beauftragt/nicht_gewaehlt), 'Erfuellt markieren'.
  - **Anderer Bedarfstraeger:** kein Action-Button (kein 'Anbieten').

#### C) /bedarfe/neu — Anlegen-Flow (3 Schritte)
- Auth + Bedarfstraeger:innen-Rolle (sonst Hinweis 'Du musst Bedarfstraeger:in werden — Klick hier').
- Schritt 1: Werkstattbeitrag-Auswahl
  - Lade existing werkstattbeitrag-Rows. Wenn gueltige vorhanden: Auswahl.
  - Sonst: drei Optionen:
    - 'Komme zum naechsten Schauabend' → /termine?stadt=hh&typ=schauabend (Empfehlung).
    - 'Geldbeitrag zahlen' → /api/v1/werkstattbeitrag/geldbeitrag (Stripe Checkout).
    - 'Sachleistung anbieten' → /bedarfe/neu?schritt=sachleistung (Form).
- Schritt 2: Bedarf-Form (Felder gemaess Validator).
- Schritt 3: Bestaetigung + Submit → INSERT bedarf + automatisch einreichen.

#### D) /bedarfe/[id]/werkangebot-neu — Werkangebot-Form (Macher:in)
- Auth + Macher:innen-Rolle.
- Form: Werk-Dropdown (eigene Werke), konkretes_vorgehen-Textarea, ausschluss-Textarea, erster_liefer_meilenstein-Textarea.
- Server Action POST werkangebot → 201, redirect zu /uebersicht/werkangebote.

#### E) /foerderprofile — Liste (Server Component, eingeloggt-only)
- Filter: stadt, foerderart, gegenleistung_typ.
- Nur status='verifiziert'.
- Cards mit Organisation, Foerderart, Foerderrahmen, Gegenleistung.
- Equity-Hinweis-Badge wenn gegenleistung_typ='equity_offline'.

#### F) /foerderprofile/[id] — Detail
- Auth.
- Volle Foerderprofil-Daten.
- Equity-Hinweistext wenn 'equity_offline' (Werkzirkel-Disclaimer).
- Kontaktinfo: Foerder:in-anzeigename + Werkpass-Link (falls Foerder:in auch macher-Rolle hat).
- Anonymen User: 'Anmelden, um Foerder:in zu kontaktieren'.

#### G) /foerderprofile/neu — Anlegen
- Auth + Foerder:innen-Rolle.
- Form mit allen Foerderprofil-Pflichtfeldern.
- Server Action: anlegen mit verifikation_status='entwurf', dann einreichen mit Hinweis 'Kurator:in wird sich melden'.

#### H) /uebersicht/bedarfe — eigene Bedarfe
- Auth + Bedarfstraeger:innen-Rolle.
- Liste eigener Bedarfe nach Status gruppiert.
- Werkstattbeitrag-Status-Anzeige (welche sind aktiv, wann laufen sie ab).

#### I) /uebersicht/werkangebote — eigene Werkangebote (Macher:in)
- Auth + Macher:innen-Rolle.
- Liste eigener werkangebote mit Bedarf-Mini + Status.

#### J) /uebersicht/foerderprofil — eigenes Foerderprofil
- Auth + Foerder:innen-Rolle.
- Wenn Foerderprofil existiert: Detail mit Status + Letzte-Bedarfsschau-Datum + 'Bearbeiten'.
- Sonst: 'Foerderprofil anlegen' → /foerderprofile/neu.

#### K) /uebersicht/werkstattbeitrag — eigene Werkstattbeitraege
- Auth.
- Liste mit Stripe-Checkout-Erfolg-Status (Pfad B), Sachleistungen mit Verifikations-Status (Pfad C), Schauabend-Teilnahmen (Pfad A).

### /uebersicht Update

- Stub 'Meine Bedarfe', 'Mein Foerderprofil', 'Werkstattbeitrag' aufloesen mit Links.

### Tests

Pro Page: Render + Auth-Redirect + Sprach-Check.
Server-Action-Tests fuer Bedarf-Anlegen-Flow.
End-to-End-Test: Bedarfstraeger:in registriert → Schritt-1-Werkstattbeitrag-Sachleistung → Schritt-2-Bedarf-anlegen → Kurator veroeffentlicht → Macher:in macht Werkangebot → Bedarfstraeger:in markiert erfuellt.

## Quality gate

```
cd /Users/udi/work/moinsen/ideas/werkzirkel/apps/web && rm -rf .next && pnpm exec vitest run
cd .. && pnpm typecheck && NODE_ENV=production pnpm build
```

DO NOT touch:
- APIs (alle done).

Started 2026-05-14T07:34:28.794Z: autobuild bedarf iter 7

Done 2026-05-14T07:56:06.992Z: 10 Bedarfsseite-Pages + 3-Schritt-Bedarf-Flow + Equity-Hinweis + Uebersicht-Stubs aufgeloest (Tests: green via `cd /Users/udi/work/moinsen/ideas/werkzirkel/apps/web && pnpm exec vitest run`)
