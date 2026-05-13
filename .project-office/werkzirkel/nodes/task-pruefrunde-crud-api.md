---
acceptance_criteria:
  - Erfuellt PRD §F-201 (Pruefrunde anlegen) und §F-202 (Pflichtfelder) vollstaendig
  - Erfuellt PRD §15.4 (Pruefrunden-Endpunkte) vollstaendig — alle 7 Endpunkte (POST list, POST veroeffentlichen, GET list, GET detail, PATCH, schliessen, abschliessen, DELETE)
  - "Erfuellt PRD §14.2 (Pruefrunde-Statusmaschine: entwurf → oeffentlich → geschlossen → abgeschlossen, mit den definierten Uebergaengen)"
  - Veroeffentlichen ruft `kannPruefrundeStarten` aus task-reziprozitaet-engine auf und blockt bei abgelaufener Verpflichtung mit deutscher Fehler-Message
  - Veroeffentlichen ohne Test-Saldo erzeugt eine pruefrunden_verpflichtung mit frist = pruefrunde.frist + 14 Tage (Integration-Test verifiziert via DB-Assertion)
created_at: 2026-05-13T14:42:36.764Z
created_by: human
edges:
  blocks:
    - id: task-pruefrunden-anmeldung-api
  composed_of:
    - id: wp-pruefrunden
  depends_on:
    - id: task-reziprozitaet-engine
effort: S
id: task-pruefrunde-crud-api
is_root: false
open_questions: []
owner: null
parent: wp-pruefrunden
private: false
risks: []
status: done
summary: Server-API fuer Pruefrunde-Objekt gemaess PRD §15.4. POST anlegt nach Reziprozitaets-Check. Status-Maschine entwurf → oeffentlich → geschlossen → abgeschlossen. PATCH erlaubt Status-Uebergaenge nach Regeln aus §14.2.
tags: []
title: "Pruefrunde-CRUD-API: POST/GET/PATCH/DELETE mit Reziprozitaets-Verzahnung"
type: task
updated_at: 2026-05-13T15:10:38.969Z
---

## Approach

Sechs Endpunkte unter `apps/web/app/api/v1/pruefrunden/`:

### 1. POST /api/v1/pruefrunden

- Auth: Session, Rolle 'macher'.
- Body Zod-validiert via `pruefrundeAnlegenSchema` (lib/validators/pruefrunde.ts):
  - werk_id (Werk muss dem User gehoeren — Permission-Check)
  - titel (min 1, max 200)
  - testziel (min 1)
  - testaufgabe (min 1, Markdown erlaubt)
  - zielgruppe (min 1)
  - zeitbedarf_minuten (5..120)
  - gesuchte_tester (1..10)
  - feedback_kategorien (subset von enums.feedbackKategorie, min 1)
  - frist (Date, must be > now() + 1 day, < now() + 60 days)
- INSERT pruefrunde mit status='entwurf'.
- Returns 201.

### 2. POST /api/v1/pruefrunden/:id/veroeffentlichen

- Auth + Inhaber:innen-Check.
- Status muss 'entwurf' sein, sonst 422.
- **Reziprozitaets-Check aus task-reziprozitaet-engine**: `kannPruefrundeStarten(nutzer_id, pruefrunde.frist)`.
  - Wenn `ok: false`: 422 mit deutscher Fehler-Message + JSON `{ error: { code: 'reziprozitaet_blockiert', grund } }`.
  - Wenn `ok: true, modus: 'neue_verpflichtung'`: Verpflichtung wird in der Engine erzeugt. Antwort enthaelt Frist-Hinweis.
- UPDATE pruefrunde SET status='oeffentlich'.
- Audit-Log.
- Returns 200.

### 3. GET /api/v1/pruefrunden

- Public (anonym OK fuer status='oeffentlich'+'geschlossen'+'abgeschlossen'; nur eingeloggte + Inhaber sehen 'entwurf').
- Filter: stadt_id (via JOIN werk + nutzer), status (default 'oeffentlich'), werk_id (optional).
- Sortierung: frist ASC (laufende zuerst), dann erstellt_am DESC.
- Cursor-Pagination.
- Returns 200 mit list + nextCursor.

### 4. GET /api/v1/pruefrunden/:id

- Public fuer alle Status ausser 'entwurf' (entwurf nur fuer Inhaber).
- Returns 200 mit Pruefrunde + Werk-Public-Daten + Inhaber-anzeigename + Tester-Anzahl (count anmeldungen).
- Inhaber-Sicht enthaelt zusaetzlich angemeldete Tester:innen (Liste).

### 5. PATCH /api/v1/pruefrunden/:id

- Auth + Inhaber.
- Nur in status='entwurf' aenderbar (PRD §14.2).
- Body via `pruefrundePatchSchema`.
- Returns 200.

### 6. POST /api/v1/pruefrunden/:id/schliessen

- Auth + Inhaber.
- Status muss 'oeffentlich' sein.
- UPDATE status='geschlossen'.
- Tester:innen, die noch nicht Feedback gegeben haben, werden via E-Mail benachrichtigt (out of scope hier — die Anmeldung-API macht das).
- Returns 200.

### 7. POST /api/v1/pruefrunden/:id/abschliessen

- Auth + Inhaber.
- Nur wenn mindestens 1 Feedback als hilfreich markiert wurde (PRD §14.2).
- UPDATE status='abgeschlossen'.
- Returns 200.

### 8. DELETE /api/v1/pruefrunden/:id

- Auth + Inhaber.
- Nur in status='entwurf' loeschbar. Veroeffentlichte sind unwiderruflich (Datenhygiene PRD §14.2).
- CASCADE raeumt feedbacks weg.
- Returns 204.

### Tests

`apps/web/tests/integration/pruefrunde-crud.test.ts`:
- POST mit valid data → 201, status='entwurf'.
- POST gegen Werk eines anderen Nutzers → 403.
- POST veroeffentlichen ohne Reziprozitaet (tests_gegeben=0, gesperrt via abgelaufene Verpflichtung) → 422.
- POST veroeffentlichen mit 2 tests gegeben → 200.
- POST veroeffentlichen ohne Saldo → 200 mit neue-verpflichtung, pruefrunden_verpflichtung-Row in DB.
- PATCH nach Veroeffentlichung → 422 (nur Entwurf editable).
- DELETE Entwurf → 204.
- DELETE oeffentlich → 422.
- Abschliessen ohne hilfreiches Feedback → 422.
- Abschliessen mit 1 hilfreichem Feedback → 200.

`apps/web/tests/integration/pruefrunden-list.test.ts`:
- Seed 5 Pruefrunden in verschiedenen Status und Staedten.
- GET ohne Auth → nur oeffentliche/geschlossene/abgeschlossene.
- GET als Inhaber → eigene Entwuerfe auch sichtbar.
- Filter werk_id → nur diese.

### Quality gate

```
cd /Users/udi/work/moinsen/ideas/werkzirkel/apps/web && rm -rf .next && pnpm exec vitest run
cd .. && pnpm typecheck && NODE_ENV=production pnpm build
```

All three green.

DO NOT touch:
- Anmeldung-API (eigener Task).
- Feedback-API (eigener Task).
- UI-Pages (eigener Task).
- Reziprozitaets-Engine (schon done; nur konsumieren).

Started 2026-05-13T15:01:18.468Z: autobuild pruefrunden iter 3

Done 2026-05-13T15:10:38.969Z: Pruefrunde-CRUD-API: 7 Endpunkte + Statusmaschine + Reziprozitaets-Gate beim Veroeffentlichen (Tests: green via `cd /Users/udi/work/moinsen/ideas/werkzirkel/apps/web && pnpm exec vitest run`)
