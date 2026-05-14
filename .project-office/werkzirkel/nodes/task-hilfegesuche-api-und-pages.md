---
acceptance_criteria:
  - Erfüllt PRD §8.15 (Hilfegesuche mit max 14 Tagen Gültigkeit + Antworten als Kommentare) vollständig
  - POST /api/v1/hilfegesuche mit gueltig_bis > now+14d → 422 mit deutscher Fehler-Message
  - Cron /api/v1/cron/hilfegesuche-ablaufen mit X-Cron-Secret setzt abgelaufene Hilfegesuche auf status='abgelaufen'
  - "4 Pages: /hilfegesuche, /hilfegesuche/[id], /hilfegesuche/neu, /uebersicht/hilfegesuche"
  - Antworten als Kommentare sichtbar im Detail-View, mit Anzeigename des Antwortenden
created_at: 2026-05-14T08:44:55.340Z
created_by: human
edges:
  blocks:
    - id: task-meldungen-system
  composed_of:
    - id: moderation-admin-hilfegesuche
effort: S
id: task-hilfegesuche-api-und-pages
is_root: false
open_questions: []
owner: null
parent: moderation-admin-hilfegesuche
private: false
risks: []
status: done
summary: POST/GET/DELETE /api/v1/hilfegesuche + POST /:id/antwort. Max 14 Tage Gültigkeit. Stadt/Tag-Filter. PRD §8.15. Plus UI /hilfegesuche-Liste + Detail + Anlege-Form.
tags: []
title: "Hilfegesuche: CRUD + Antworten als Kommentare + UI"
type: task
updated_at: 2026-05-14T09:08:08.860Z
---

## Approach

Kleines Mini-Forum-Feature. Hilfegesuche sind das einzige Kommentar-Feature in v1.0 (PRD §8.15).

### Validators in `lib/validators/hilfegesuch.ts`

hilfegesuchAnlegenSchema mit titel, beschreibung, tags (string[]), werk_id (optional), gueltig_bis (Date, max now+14d).
hilfegesuchAntwortSchema mit text (min 10).

### Endpoints

- POST /api/v1/hilfegesuche — Macher legt Hilfegesuch an (stadt erbt von nutzer). Auto-Gueltigkeit max now+14d.
- GET /api/v1/hilfegesuche — Liste, Filter stadt/tags/status, Sort 'erstellt_am DESC'.
- GET /api/v1/hilfegesuche/[id] — Detail mit Antworten.
- POST /api/v1/hilfegesuche/[id]/antwort — Antwort als Kommentar (auth required).
- DELETE /api/v1/hilfegesuche/[id] — eigenes löschen.
- DELETE /api/v1/hilfegesuch-antworten/[id] — eigene Antwort löschen.

### Cron: hilfegesuche-ablaufen

Täglicher Cron-Endpoint /api/v1/cron/hilfegesuche-ablaufen: setze status='abgelaufen' für Hilfegesuche mit gueltig_bis < now AND status='offen'.

### Pages

- /hilfegesuche (Liste, eingeloggt)
- /hilfegesuche/[id] (Detail + Antwort-Form)
- /hilfegesuche/neu (Form)
- /uebersicht/hilfegesuche (eigene)

### Tests

- POST mit gueltig_bis > now+14d → 422.
- POST → 201, erstellt_am, gueltig_bis.
- POST Antwort → 201.
- Cron-Lauf → abgelaufene Hilfegesuche → status='abgelaufen'.
- Hilfegesuch löschen kaskadiert Antworten.

Started 2026-05-14T08:45:23.300Z: autobuild moderation iter 1

Done 2026-05-14T09:08:08.860Z: Hilfegesuche-API + Pages + Antworten + Ablauf-Cron (Tests: green via `cd /Users/udi/work/moinsen/ideas/werkzirkel/apps/web && pnpm exec vitest run`)
