---
acceptance_criteria:
  - Erfuellt PRD §F-203 (Andere Nutzer koennen sich als Tester:innen melden) vollstaendig
  - "Slot-Limit via Race-safe SQL FOR UPDATE durchgesetzt (Unit-Test mit 5 parallelen Calls auf 3-Slot-Pruefrunde verifiziert: genau 3 success, 2 422)"
  - Doppel-Anmeldung wird via UNIQUE-Constraint + ON CONFLICT geblockt (422 'bereits_angemeldet')
  - T-101 wird beim erfolgreichen Anmelden an Werk-Inhaber:in versendet (im Mock-Mode via email_benachrichtigung_log nachweisbar)
  - Werk-Inhaber:in kann sich NICHT als Tester:in fuer eigene Pruefrunde anmelden (422)
created_at: 2026-05-13T14:42:36.765Z
created_by: human
edges:
  blocks:
    - id: task-feedback-api
  composed_of:
    - id: wp-pruefrunden
  depends_on:
    - id: task-pruefrunde-crud-api
    - id: task-email-templates-pruefrunden
effort: S
id: task-pruefrunden-anmeldung-api
is_root: false
open_questions: []
owner: null
parent: wp-pruefrunden
private: false
risks: []
status: done
summary: POST /api/v1/pruefrunden/:id/anmeldung fuer Tester:innen-Anmeldung. DELETE fuer Ruecknahme. Slot-Limit aus pruefrunde.gesuchte_tester. T-101 an Werk-Inhaber:in versenden bei neuer Anmeldung.
tags: []
title: "Tester:innen-Anmeldung: Slot-System mit Limit-Check"
type: task
updated_at: 2026-05-13T15:19:20.232Z
---

## Approach

Zwei Endpunkte unter `apps/web/app/api/v1/pruefrunden/[id]/anmeldung/`:

### POST /api/v1/pruefrunden/:id/anmeldung

- Auth: Session, Rolle 'macher'.
- Pruefrunde laden, status='oeffentlich' erforderlich (sonst 422).
- Permission-Check: Tester:in darf nicht Werk-Inhaber sein (eigene Pruefrunde testen ist sinnfrei).
- Race-safe Slot-Check (FOR UPDATE):
  - SELECT COUNT FROM pruefrunden_anmeldung WHERE pruefrunde_id = :id AND status IN ('angemeldet', 'feedback_gegeben') FOR UPDATE.
  - Wenn count >= pruefrunde.gesuchte_tester → 422 'pruefrunde_voll'.
- Doppel-Anmeldung-Check: UNIQUE (pruefrunde_id, tester_id) Constraint vorhanden — INSERT mit ON CONFLICT DO NOTHING; wenn 0 rows: 422 'bereits_angemeldet'.
- INSERT pruefrunden_anmeldung mit status='angemeldet'.
- **sendMail T-101** an Werk-Inhaber:in mit Anzahl-Update.
- Audit-Log.
- Returns 201.

### DELETE /api/v1/pruefrunden/:id/anmeldung

- Auth.
- DELETE pruefrunden_anmeldung WHERE pruefrunde_id AND tester_id = current.id AND status='angemeldet'.
- Wenn status='feedback_gegeben' → 422 (nach Feedback-Abgabe kann man die Anmeldung nicht mehr zuruecknehmen).
- Returns 204.

### GET /api/v1/pruefrunden/:id/anmeldungen (nur Werk-Inhaber)

- Auth + Inhaber:innen-Check.
- Liste der Anmeldungen mit tester-Public-Daten (anzeigename, avatar_url) und status.
- Returns 200.

### Tests

`apps/web/tests/integration/pruefrunden-anmeldung.test.ts`:
- Tester:in meldet sich an → 201, Row in DB.
- T-101 wird im Mock-Mode an Werk-Inhaber:in versendet (assert email_benachrichtigung_log-Eintrag).
- Zweite Anmeldung gleicher Tester:in → 422 ('bereits_angemeldet').
- Werk-Inhaber:in versucht eigene Pruefrunde zu testen → 422.
- Slot voll (gesuchte_tester=2, 2 angemeldet) → naechste Anmeldung 422 ('pruefrunde_voll').
- DELETE-Anmeldung in status='angemeldet' → 204.
- DELETE-Anmeldung in status='feedback_gegeben' → 422.
- GET Anmeldungen als fremder Nutzer → 403.
- GET als Werk-Inhaber:in → 200 mit Liste.

`apps/web/tests/unit/pruefrunden-slot-race.test.ts`:
- Simuliere 5 parallele Anmeldungen bei gesuchte_tester=3.
- Genau 3 sollen erfolgreich anlegen, 2 mit 422 abgewiesen werden.
- Verifiziert via Drizzle-Transaktion + FOR UPDATE.

### Quality gate

```
cd /Users/udi/work/moinsen/ideas/werkzirkel/apps/web && rm -rf .next && pnpm exec vitest run
cd .. && pnpm typecheck && NODE_ENV=production pnpm build
```

DO NOT touch:
- Feedback-API (eigener Task).
- UI (eigener Task).
- Pruefrunde-CRUD-API (schon done; nur status='oeffentlich'-Check).
- Reziprozitaets-Engine.

Started 2026-05-13T15:11:48.251Z: autobuild pruefrunden iter 4

Done 2026-05-13T15:19:20.232Z: Tester:innen-Anmeldung mit Slot-System + Race-Schutz + T-101 (Tests: green via `cd /Users/udi/work/moinsen/ideas/werkzirkel/apps/web && pnpm exec vitest run`)
