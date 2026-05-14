---
acceptance_criteria:
  - Erfüllt PRD §F-501..§F-504 (Moderation + Melden + Inhalt ausblenden + Nutzer sperren) und §27 (Workflow + SLA) vollständig
  - POST /api/v1/meldungen erlaubt auch anonyme Meldungen (gemeldet_von=null) — keine Auth-Pflicht
  - Kurator-PATCH mit Aktion 'inhalt_ausgeblendet' setzt referenzierten Inhalt auf status='ausgeblendet' (Werk-, Bedarf-, Förderprofil-Test)
  - "Melden-Knopf in mind. 6 Page-Typen eingebaut: /werke/[id], /bedarfe/[id], /foerderprofile/[id], /werkpass/[id], /pruefrunden/[id], /hilfegesuche/[id]"
  - /kurator/meldungen-Page mit Status-Filter (offen|in_pruefung|erledigt|verworfen) + Resolution-Form
created_at: 2026-05-14T08:44:55.341Z
created_by: human
edges:
  blocks:
    - id: task-admin-backoffice
  composed_of:
    - id: moderation-admin-hilfegesuche
  depends_on:
    - id: task-hilfegesuche-api-und-pages
effort: S
id: task-meldungen-system
is_root: false
open_questions: []
owner: null
parent: moderation-admin-hilfegesuche
private: false
risks: []
status: done
summary: Melden-Knopf an jedem Nutzerinhalt (Werk, Bedarf, Werkangebot, Förderprofil, Nutzer:in, Feedback, Hilfegesuch-Antwort). Kurator-Postfach mit SLA 48h. PRD §27.
tags: []
title: "Melde-System: POST /meldungen + Kurator-Postfach + Resolution-Workflow"
type: task
updated_at: 2026-05-14T09:26:07.560Z
---

## Approach

Das Melde-System verbindet alle Nutzerinhalte mit einem Governance-Layer.

### Validators

meldungAnlegenSchema: referenz_typ (Enum), referenz_id, kategorie (cold_outreach/sales_sprech/spam/beleidigung/sonstiges), beschreibung (optional).

### Endpoints

- POST /api/v1/meldungen — anonym ODER eingeloggt melden. (Anonyme Meldungen sind erlaubt — gemeldet_von=null.)
- GET /api/v1/kurator/meldungen — Kurator-Postfach (Status-Filter).
- PATCH /api/v1/kurator/meldungen/[id] — Status setzen (in_pruefung/erledigt/verworfen) + Ergebnis-Notiz.
  Bei status='erledigt' mit ergebnis-Aktion 'inhalt_ausgeblendet': automatisch UPDATE referenz-Tabelle SET status='ausgeblendet' (für werke). Bei 'nutzer_gesperrt': UPDATE nutzer.status='gesperrt'.

### UI

- Melden-Knopf-Komponente in components/ui/melden-button.tsx (Client Component mit Modal).
- Einbau in alle relevanten Pages: /werke/[id], /bedarfe/[id], /foerderprofile/[id], /werkpass/[id], /pruefrunden/[id] (für Feedback), /hilfegesuche/[id].
- /kurator/meldungen-Page mit Liste + Filter + Resolution-Form.

### Tests

- Anonymer POST mit beschreibung → 201, gemeldet_von=null.
- Eingeloggter POST → 201, gemeldet_von=user.id.
- Kurator PATCH auf 'erledigt' mit Aktion 'inhalt_ausgeblendet' → werk.status='ausgeblendet'.
- Kurator PATCH 'nutzer_gesperrt' → nutzer.status='gesperrt'.
- Audit-log pro Resolution.

Started 2026-05-14T09:08:49.700Z: autobuild moderation iter 2

Done 2026-05-14T09:26:07.560Z: Melde-System: Anonyme Meldungen + Kurator-Postfach + Resolution-Workflow + Melden-Button in 6 Pages (Tests: green via `cd /Users/udi/work/moinsen/ideas/werkzirkel/apps/web && pnpm exec vitest run`)
