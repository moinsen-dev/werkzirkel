---
acceptance_criteria:
  - POST /api/v1/termine/:id/anwesenheit setzt die nicht in anmeldung_ids_anwesend gelisteten Anmeldungen auf 'nicht_anwesend' und die gelisteten auf 'anwesend'
  - PATCH /api/v1/termin-anmeldungen/:id/status erlaubt Einzel-Aenderung durch Kurator:in der jeweiligen Stadt
  - "Hook: Bedarfstraeger:in bei Schauabend-Anwesenheit erzeugt werkstattbeitrag-Row mit art='schauabend_teilnahme' und gueltig_bis=now()+6 Monate (idempotent: zweites Mal markieren erzeugt KEINE Doppel-Row)"
  - "Permission-Check: fremder Kurator:in (andere Stadt) → 403"
  - Erfuellt PRD §8.8 (Anwesenheits-Dokumentation durch Kurator:in nach dem Termin) vollstaendig
created_at: 2026-05-13T16:04:07.186Z
created_by: human
edges:
  blocks:
    - id: task-termin-pages
  composed_of:
    - id: wp-termine
  depends_on:
    - id: task-termin-anmeldung-api
effort: S
id: task-termin-anwesenheit-api
is_root: false
open_questions: []
owner: null
parent: wp-termine
private: false
risks: []
status: done
summary: "POST /api/v1/termine/:id/anwesenheit mit Body { anmeldung_ids: [...] } setzt diese auf status='anwesend', den Rest auf 'nicht_anwesend'. PATCH /api/v1/termin-anmeldungen/:id/status fuer Einzel-Aenderungen. Plus notizen_nach_termin auf dem Termin-Objekt."
tags: []
title: "Anwesenheits-Dokumentation: Kurator:in markiert nach dem Termin"
type: task
updated_at: 2026-05-13T16:44:45.065Z
---

## Approach

Die Anwesenheits-Dokumentation ist die Grundlage fuer:
- Werkstattbeitrag bei Bedarfstraeger:innen-Schauabend-Teilnahme (kommt mit wp-bedarfsseite)
- Foerderprofil-Quartal-Pruefung (Anwesenheit an Bedarfsschau)
- Schauabend-Teilnehmer-Counter fuer Hamburg-Erfolgskennzahlen

### Endpunkte

#### POST /api/v1/termine/:id/anwesenheit
- Auth + Permission (Kurator:in der Stadt).
- Termin muss status='durchgefuehrt' (oder zumindest in der Vergangenheit) sein.
- Body: `{ anmeldung_ids_anwesend: string[], notizen_nach_termin?: string }`.
- Transaktion:
  - SELECT alle anmeldungen WHERE termin_id.
  - UPDATE alle: status='nicht_anwesend' DEFAULT.
  - UPDATE die in anmeldung_ids_anwesend: status='anwesend'.
  - UPDATE termin SET notizen_nach_termin (wenn gesetzt).
- Audit-log.
- Returns 200 mit Counts.

#### PATCH /api/v1/termin-anmeldungen/:id/status
- Auth + Permission (Kurator:in der Stadt des termin der anmeldung).
- Body: `{ status: 'anwesend' | 'nicht_anwesend' }`.
- UPDATE termin_anmeldung SET status.
- Audit-log.
- Returns 200.

### Werkstattbeitrag-Hook (Stub fuer wp-bedarfsseite)

Wenn ein User mit Rolle 'bedarfstraeger' an einem Schauabend (typ='schauabend') als 'anwesend' markiert wird:
- Wenn werkstattbeitrag-Tabelle existiert und der User noch keinen gueltigen Beitrag hat:
- INSERT werkstattbeitrag mit art='schauabend_teilnahme', termin_id, status='verifiziert', gueltig_bis=now()+6 Monate.

Dieser Hook ist defensiv — er funktioniert auch ohne Bedarfsträger:innen-Aktivität, einfach kein no-op wenn der User die Rolle nicht hat. Die werkstattbeitrag-Tabelle existiert bereits aus dem Schema.

### Tests

`apps/web/tests/integration/termin-anwesenheit.test.ts`:
- POST anwesenheit als Kurator:in: 3 angemeldete, 2 in anwesend_ids → 2 'anwesend', 1 'nicht_anwesend'.
- POST von fremdem Kurator (andere Stadt) → 403.
- POST mit notizen_nach_termin → in DB persistiert.
- PATCH einzelne anmeldung → 200, DB-Update.
- Werkstattbeitrag-Hook: User mit Rolle 'bedarfstraeger' angemeldet zu Schauabend, dann als anwesend markiert → werkstattbeitrag-Row in DB mit art='schauabend_teilnahme'.
- Hook ist idempotent: zweites Mal markieren fuer denselben User+termin erzeugt KEINEN zweiten werkstattbeitrag.

### Quality gate

```
cd /Users/udi/work/moinsen/ideas/werkzirkel/apps/web && rm -rf .next && pnpm exec vitest run
cd .. && pnpm typecheck && NODE_ENV=production pnpm build
```

DO NOT touch:
- Termin-CRUD/Anmeldung/iCal — schon done.
- UI (kommt im letzten Task).
- Vollstaendige Werkstattbeitrag-API — die kommt in wp-bedarfsseite. Hier nur der Hook bei Anwesenheits-Markierung.

Started 2026-05-13T16:38:03.684Z: autobuild termine iter 5

Done 2026-05-13T16:44:45.065Z: Anwesenheits-API + Werkstattbeitrag-Hook für Bedarfsträger:in-Schauabend-Teilnahme (Tests: green via `cd /Users/udi/work/moinsen/ideas/werkzirkel/apps/web && pnpm exec vitest run`)
