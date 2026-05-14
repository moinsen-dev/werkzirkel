---
acceptance_criteria:
  - Erfuellt PRD §F-402 (Anmeldung zu Terminen) und §F-404 (max-Teilnehmer-Limit) vollstaendig
  - "Slot-System mit automatischer Warteliste: bei voll werden Anmeldungen mit status='warteliste' angelegt"
  - Bei DELETE einer Angemeldeten-Row rueckt der aelteste Warteliste-Eintrag automatisch nach (status='angemeldet'), T-401 mit Hochrueck-Hinweis wird verschickt (Integration-Test verifiziert)
  - "Race-Test mit 4 parallelen POSTs auf max_teilnehmer=2-Termin: genau 2 angemeldet, 2 warteliste"
  - T-401 wird beim Anmelden versendet (Mock-Mode via email_benachrichtigung_log)
created_at: 2026-05-13T16:04:07.186Z
created_by: human
edges:
  blocks:
    - id: task-termin-anwesenheit-api
    - id: task-termin-cron-erinnerungen
  composed_of:
    - id: wp-termine
  depends_on:
    - id: task-termin-crud-api
    - id: task-email-templates-termine
effort: S
id: task-termin-anmeldung-api
is_root: false
open_questions: []
owner: null
parent: wp-termine
private: false
risks: []
status: done
summary: POST /api/v1/termine/:id/anmeldung mit Slot- und Warteliste-Logik. DELETE storniert + rueckt naechste:n Wartelisten-Person automatisch vor. T-401 wird bei Anmeldung und beim Hochruecken versendet.
tags: []
title: "Termin-Anmeldung: Slot-System mit automatischer Warteliste"
type: task
updated_at: 2026-05-13T16:36:48.909Z
---

## Approach

Drei Endpunkte unter `apps/web/app/api/v1/termine/[id]/anmeldung/`:

### POST /api/v1/termine/:id/anmeldung
- Auth.
- Termin muss status='veroeffentlicht' sein.
- Transaktion mit FOR UPDATE auf termin:
  - Doppel-Anmeldung-Check: UNIQUE (termin_id, nutzer_id) catched via ON CONFLICT.
  - Count current 'angemeldet'-Status.
  - Wenn count < max_teilnehmer: INSERT status='angemeldet'. Send T-401 mit slotPosition='angemeldet'.
  - Sonst: INSERT status='warteliste'. Send T-401 mit slotPosition='warteliste'.
- Audit-log.
- Returns 201.

### DELETE /api/v1/termine/:id/anmeldung
- Auth.
- Eigene Anmeldung loeschen (status='angemeldet' oder 'warteliste').
- Transaktion:
  - DELETE eigene Row.
  - Wenn vorher status='angemeldet': naechste:r Wartelisten-Person SELECT FOR UPDATE WHERE termin_id AND status='warteliste' ORDER BY erstellt_am ASC LIMIT 1.
  - Wenn vorhanden: UPDATE diese Row SET status='angemeldet'. Send T-401 an die Person mit slotPosition='angemeldet' und Hinweistext 'Du bist jetzt fest angemeldet (von der Warteliste hochgerueckt)'.
- Returns 204.

### GET /api/v1/termine/:id/anmeldungen
- Auth + istKuratorVon(stadt) ODER Admin.
- Liste aller anmeldungen mit nutzer-public-data + status (angemeldet/warteliste/anwesend/nicht_anwesend/storniert).
- Returns 200.

### Tests

`apps/web/tests/integration/termin-anmeldung.test.ts`:
- POST → 201, status='angemeldet', T-401 versendet (Mock).
- POST wenn voll → 201 mit status='warteliste'.
- POST duplicate → 422.
- POST gegen 'geplant'-Termin → 422.
- DELETE eigene Anmeldung → 204.
- DELETE wenn jemand auf Warteliste: naechste Person wird automatisch hochgerueckt, status='angemeldet', T-401 verschickt mit hoch-rueck-Hinweis.
- GET als fremder Nutzer → 403.
- GET als Kurator:in → 200 mit Liste.

`apps/web/tests/integration/termin-slot-race.test.ts`:
- Seed Termin mit max_teilnehmer=2.
- 4 parallele POST-Anmeldungen.
- Genau 2 → status='angemeldet', 2 → status='warteliste'.
- DELETE einen Angemeldeten → wartelisten-Erster wird automatisch angemeldet.

### Quality gate

```
cd /Users/udi/work/moinsen/ideas/werkzirkel/apps/web && rm -rf .next && pnpm exec vitest run
cd .. && pnpm typecheck && NODE_ENV=production pnpm build
```

DO NOT touch:
- Termin-CRUD-API.
- Anwesenheits-API (separater Task).
- Cron-Erinnerungen.
- UI.

Started 2026-05-13T16:29:10.232Z: autobuild termine iter 4

Done 2026-05-13T16:36:48.909Z: Termin-Anmeldung: Slot-System + Race-Schutz + automatisches Hochrücken aus Warteliste + T-401-Versand (Tests: green via `cd /Users/udi/work/moinsen/ideas/werkzirkel/apps/web && pnpm exec vitest run`)
