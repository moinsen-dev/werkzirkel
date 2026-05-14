---
acceptance_criteria:
  - Erfuellt PRD §8.8 (Bedarfsschau-Format) und §13.19, §13.20 (termin_bedarf_bezug, termin_foerderprofil_bezug Schema) vollstaendig
  - POST /api/v1/termine/:id/bedarfe und /foerderprofile (Kurator-only, termin.typ='bedarfsschau') persistieren Bezuege
  - GET /api/v1/termine/:id mit typ='bedarfsschau' liefert verknuepfte Bedarfe und Foerderprofile in der Response
  - Anwesenheits-Hook reaktiviert pausierte Foerderprofile bei Bedarfsschau-Anwesenheit (Integration-Test verifiziert pausiert → verifiziert)
  - /kurator/termine/[id]/bearbeiten zeigt Mehrfach-Auswahl-Listen fuer Bedarfe und Foerderprofile, wenn termin.typ='bedarfsschau'
created_at: 2026-05-14T06:03:26.098Z
created_by: human
edges:
  blocks:
    - id: task-bedarfsseite-pages
  composed_of:
    - id: bedarfsseite
  depends_on:
    - id: task-foerderprofil-api
effort: S
id: task-bedarfsschau-integration
is_root: false
open_questions: []
owner: null
parent: bedarfsseite
private: false
risks: []
status: done
summary: termin_bedarf_bezug und termin_foerderprofil_bezug fuer Bedarfsschau-Termine. UI auf /termine/[id] und /kurator/termine/[id]/bearbeiten erweitert um Bedarf-Foerderprofil-Selektion. PRD §8.8 Bedarfsschau-Format.
tags: []
title: "Bedarfsschau-Termin-Typ: Bedarf+Foerderprofil-Verknuepfung + UI auf Termin-Detail"
type: task
updated_at: 2026-05-14T06:50:12.924Z
---

## Approach

Die Bedarfsschau-Termine sollen Bedarfe und Foerderprofile als Vorzeige-Inhalte verknuepfen. Schema-Tabellen termin_bedarf_bezug und termin_foerderprofil_bezug existieren bereits.

### A) APIs

#### POST /api/v1/termine/:id/bedarfe (Kurator)
- istKuratorVon(stadt).
- termin.typ muss 'bedarfsschau' sein.
- Body: `{ bedarf_ids: string[], reihenfolge?: Record<bedarf_id, number> }`.
- TRANSACTION: DELETE bestehende termin_bedarf_bezug, INSERT new bezuege.
- Returns 200.

#### POST /api/v1/termine/:id/foerderprofile (Kurator)
- Analog fuer foerderprofile-Bezuege.

#### GET /api/v1/termine/:id (existing endpoint erweitern)
- Bei termin.typ='bedarfsschau': returne auch verknuepfte bedarfe und foerderprofile (mit public-fields).

### B) UI Update

#### `/termine/[id]` (existing termin-detail-page)
- Bei termin.typ='bedarfsschau': zwei zusaetzliche Sektionen 'Bedarfe in dieser Schau' und 'Foerderprofile in dieser Schau' (Cards mit Links).

#### `/kurator/termine/[id]/bearbeiten` (existing termin-bearbeiten-page)
- Bei termin.typ='bedarfsschau': zwei Mehrfach-Auswahl-Listen (Bedarfe mit status='oeffentlich' der Stadt + Foerderprofile mit status='verifiziert' der Stadt). Kurator wählt aus, welche auf der Bedarfsschau vorgestellt werden.
- Server Action persistiert die Bezuege.

### C) Foerderprofil-Anwesenheits-Hook

Der Hook im termin-anwesenheit-Endpoint (aus foerderprofil-api-Task) verkettet sich hier:
- Wenn termin.typ='bedarfsschau' UND nutzer anwesend UND nutzer hat foerderer-Rolle UND foerderprofil existiert:
  - UPDATE foerderprofil SET letzte_bedarfsschau_id=termin.id, letzte_bedarfsschau_am=termin.datum_uhrzeit.
  - Wenn vorher 'pausiert' → 'verifiziert' (Reaktivierung).

Dieser Hook ist die Verbindungs-Logik zwischen Termin-Anwesenheit und Foerderprofil-Lebensdauer (PRD §11A Schutz Kulturverlust 4).

### Tests

`apps/web/tests/integration/bedarfsschau-termin.test.ts`:
- Termin mit typ='bedarfsschau' anlegen.
- POST bedarfe → termin_bedarf_bezug rows.
- POST foerderprofile → termin_foerderprofil_bezug rows.
- GET /termine/:id → returne bedarfe und foerderprofile in Response.
- Foerder:in als 'anwesend' bei dieser bedarfsschau → letzte_bedarfsschau_am aktualisiert auf termin.datum_uhrzeit.

`apps/web/tests/integration/bedarfsschau-foerderprofil-reaktivierung.test.ts`:
- Foerderprofil status='pausiert'.
- Foerder:in als anwesend bei bedarfsschau-Termin markiert.
- Foerderprofil status='verifiziert' (reaktiviert).

## Quality gate

```
cd /Users/udi/work/moinsen/ideas/werkzirkel/apps/web && rm -rf .next && pnpm exec vitest run
cd .. && pnpm typecheck && NODE_ENV=production pnpm build
```

DO NOT touch:
- Pages (eigener Task).
- Foerderprofil-Auto-Pause-Cron (schon im foerderprofil-api task).

Started 2026-05-14T06:38:46.103Z: autobuild bedarf iter 3

Done 2026-05-14T06:50:12.924Z: Bedarfsschau-Termin-Integration: bedarf+foerderprofil-Verknüpfung + UI (Tests: green via `cd /Users/udi/work/moinsen/ideas/werkzirkel/apps/web && pnpm exec vitest run`)
