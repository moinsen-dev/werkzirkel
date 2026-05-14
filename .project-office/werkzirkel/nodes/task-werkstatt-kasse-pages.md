---
acceptance_criteria:
  - Erfüllt PRD §8.11 (Werkstatt-Kasse pro Stadt + Quartalsbericht) vollständig
  - Kurator-Endpoint für Eintrag-Anlegen + Admin-Endpoint für Freigabe
  - Public-Endpoint /api/v1/werkstatt-kasse/:stadt zeigt NUR freigegebene Einträge (Integration-Test verifiziert)
  - /kasse/[stadt]-Page rendert Quartalsübersicht mit Eingang/Ausgang/Saldo auf Deutsch
  - Webhook-Einträge aus werkstattbeitrag, erfolgsbeitrag, foerdermitgliedschaft sind im Kasse-Listing sichtbar
created_at: 2026-05-14T08:00:10.626Z
created_by: human
edges:
  composed_of:
    - id: geld-und-mitgliedschaft
  depends_on:
    - id: task-foerdermitgliedschaft-subscription
effort: S
id: task-werkstatt-kasse-pages
is_root: false
open_questions: []
owner: null
parent: geld-und-mitgliedschaft
private: false
risks: []
status: done
summary: Pro Stadt /kasse/[stadt]-Page mit Quartals-Eingang/Ausgang. Kurator legt Einträge an, Admin gibt frei. PRD §8.11.
tags: []
title: "Werkstatt-Kasse: öffentliche Quartalsübersicht + Kurator-CRUD + Cron-Reports"
type: task
updated_at: 2026-05-14T08:43:08.483Z
---

## Approach

Die Werkstatt-Kasse ist die Transparenz-Achse. Quartalsweise öffentlich.

### Validator

`lib/validators/kasse.ts`: Eintrag-Schema mit typ, kategorie, hoehe_euro_cent, beschreibung, datum, quartal.

### Endpoints

- POST /api/v1/kurator/werkstatt-kasse — Kurator legt Eintrag an (Typ ausgang oder manueller eingang).
- GET /api/v1/kurator/werkstatt-kasse — Kurator-Übersicht eigener Stadt (alle Einträge inkl. unfreigegebene).
- POST /api/v1/admin/werkstatt-kasse/:id/freigeben — Admin gibt frei (setzt freigegeben_durch, freigegeben_am).
- POST /api/v1/kurator/werkstatt-kasse/quartal/:q/abschliessen — Snapshot des Quartals.
- GET /api/v1/werkstatt-kasse/:stadt — public, nur freigegebene Einträge.

### Pages

- /kasse/[stadt] — public Server Component. Quartals-Filter (default aktuelles Quartal). Eingang-/Ausgang-Tabellen. Gesamtsumme.
- /kurator/werkstatt-kasse — Kurator-Übersicht eigener Stadt + 'Neuer Eintrag'-Form.
- /admin/werkstatt-kasse — Admin-Übersicht aller Städte + Freigabe-Buttons.

### Auto-Befüllung

Werkstattbeitrag-Webhook (existing) und Erfolgsbeitrag-Webhook (existing) und Fördermitgliedschaft-Webhook (existing) erstellen schon Kasse-Einträge.
Dieser Task verifiziert die Verkettung + ergänzt manuelle Ausgangs-Einträge.

### Tests

- Kurator-Eintrag anlegen → status=unfreigegeben, in DB.
- Admin freigibt → freigegeben_am, sichtbar in public GET.
- Public-Endpoint zeigt NUR freigegebene Einträge.
- Quartal-Summe stimmt mit Test-Daten.

Quality gate, mark done.

Started 2026-05-14T08:25:58.922Z: autobuild geld iter 3

Done 2026-05-14T08:43:08.483Z: Werkstatt-Kasse: Kurator-CRUD + Admin-Freigabe + öffentliche /kasse/[stadt] Quartalsübersicht (Tests: green via `cd /Users/udi/work/moinsen/ideas/werkzirkel/apps/web && pnpm exec vitest run`)
