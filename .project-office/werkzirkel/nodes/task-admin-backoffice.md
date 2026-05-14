---
acceptance_criteria:
  - Erfüllt PRD §15.14 (Admin-Endpunkte) und §26 (Admin-Backoffice) vollständig
  - Nutzer-Sperren-Endpoint invalidiert alle aktiven Sessions des gesperrten Users (Integration-Test verifiziert)
  - Stadt-Kurator-Ernennen setzt sowohl stadt.kurator_id als auch nutzer.rollen += 'kurator' (atomar in Transaktion)
  - Audit-Log-Browser mit Filter aktion/nutzer_id/datum + paginierter Anzeige
  - Alle /admin/*-Routes 403 für Nicht-Admins
created_at: 2026-05-14T08:44:55.342Z
created_by: human
edges:
  composed_of:
    - id: moderation-admin-hilfegesuche
  depends_on:
    - id: task-meldungen-system
effort: S
id: task-admin-backoffice
is_root: false
open_questions: []
owner: null
parent: moderation-admin-hilfegesuche
private: false
risks: []
status: done
summary: "Vollständiges Admin-Tool: /admin/nutzer mit Suche+Sperren+Entsperren. /admin/staedte mit Anlegen+Kurator-Ernennen. /admin/audit-log. /admin/email-log. PRD §15.14 + §26."
tags: []
title: "Admin-Backoffice: Nutzer-Suche/Sperren + Städte-Verwaltung + Audit-Log-Browser + E-Mail-Log"
type: task
updated_at: 2026-05-14T09:50:31.002Z
---

## Approach

Das Admin-Backoffice ist die Drehscheibe für Plattform-Betrieb.

### Endpoints

- GET /api/v1/admin/nutzer — Liste mit Suche (email, klarname, anzeigename, stadt, rolle, status).
- GET /api/v1/admin/nutzer/[id] — Detail.
- POST /api/v1/admin/nutzer/[id]/sperren
- POST /api/v1/admin/nutzer/[id]/entsperren
- POST /api/v1/admin/staedte — neue Stadt anlegen (für DACH-Erweiterung)
- PATCH /api/v1/admin/staedte/[id] — Stadt aktivieren/deaktivieren
- POST /api/v1/admin/staedte/[id]/kurator — Kurator ernennen (setzt stadt.kurator_id + nutzer.rollen += kurator)
- GET /api/v1/admin/audit-log — paginierte Liste mit Filter (aktion, nutzer_id, datum)
- GET /api/v1/admin/email-log — paginierte E-Mail-Log-Anzeige

### Pages

- /admin (Dashboard mit Counts)
- /admin/nutzer + /admin/nutzer/[id]
- /admin/staedte
- /admin/audit-log
- /admin/email-log
- /admin/konfiguration (Stub: Werkstattbeitrag-Skala, Fördermitgliedschaft-Preise, verbotene Wörter)

All routes auth + Admin-Rolle (sonst 403).

### Tests

- Nutzer-Suche mit Patterns.
- Sperren → status='gesperrt', Sessions invalidiert.
- Stadt anlegen + Kurator ernennen.
- Audit-Log-Filter funktional.
- Admin-Permission durchgesetzt (403 für Nicht-Admins).

Started 2026-05-14T09:27:00.441Z: autobuild moderation iter 3

Done 2026-05-14T09:50:31.002Z: Admin-Backoffice: Nutzer-/Städte-Verwaltung + Audit-/E-Mail-Log-Browser (Tests: green via `cd /Users/udi/work/moinsen/ideas/werkzirkel/apps/web && pnpm exec vitest run`)
