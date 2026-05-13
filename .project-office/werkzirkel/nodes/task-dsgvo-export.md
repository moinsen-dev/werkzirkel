---
acceptance_criteria:
  - "`GET /api/v1/me/export` liefert Content-Type application/json mit Content-Disposition attachment und Dateinamen werkzirkel-export-<iso-datum>.json"
  - "JSON-Dump enthaelt alle in PRD §34 Betroffenenrechte aufgefuehrten Datenkategorien: profil, werke, pruefrunden (eigene + gegebene), bedarfe, werkangebote, foerderprofil, termine, werkstattbeitraege, audit"
  - Als-Tester-gegebene Feedbacks enthalten den Werk-Titel, aber NICHT die E-Mail oder den Klarnamen des Werk-Inhabers (Unit-Test deckt dies ab)
  - Rate-Limit `/api/v1/me/export` ist 1 Aufruf pro Stunde pro Nutzer:in
  - Settings-Tab Datenschutz hat einen Button 'Meine Daten exportieren', der den Endpoint per `<a download>` aufruft
created_at: 2026-05-13T09:58:44.228Z
created_by: human
edges:
  blocks:
    - id: task-cron-jobs-auth
  composed_of:
    - id: wp-auth
  depends_on:
    - id: task-magic-link-endpoints
effort: S
id: task-dsgvo-export
is_root: false
open_questions: []
owner: null
parent: wp-auth
private: false
risks: []
status: draft
summary: GET /api/v1/me/export liefert vollstaendigen JSON-Dump aller personenbezogenen Daten des eingeloggten Users (Nutzer-Eintrag, Werke, Pruefrunden, Feedbacks gegeben+erhalten, Bedarfe, Werkangebote, Foerderprofil, Termin-Anmeldungen, Werkstattbeitraege). UI-Button im Settings-Tab Datenschutz.
tags: []
title: "DSGVO-Self-Service: JSON-Export aller eigenen Daten"
type: task
updated_at: 2026-05-13T09:58:44.228Z
---

## Approach

Server-Endpoint `/api/v1/me/export` aggregiert via Drizzle alle Tabellen, die `nutzer_id` referenzieren. Gibt JSON mit pretty-print und Content-Disposition `attachment; filename=werkzirkel-export-<datum>.json`.

Export-Inhalte (PRD §34):
- `profil`: nutzer-Row + benachrichtigungs_einstellungen + foerdermitgliedschaft falls vorhanden
- `werke`: alle eigenen werke + werk_historie
- `pruefrunden_eigene`: alle gestarteten Pruefrunden + erhaltene Feedbacks
- `pruefrunden_gegebene`: alle als Tester gegebenen Feedbacks (anonymisiert: ohne Werkinhaber-Identitaet)
- `bedarfe`: alle eigenen Bedarfe
- `werkangebote`: alle eigenen Werkangebote
- `foerderprofil`: eigenes Foerderprofil (falls vorhanden)
- `termine`: alle Termin-Anmeldungen
- `werkstattbeitraege`: alle eigenen Beitraege
- `audit`: Audit-Log-Eintraege wo `nutzer_id` matcht (begrenzt auf letzte 12 Monate)

Kein Format-Standard wie XML — JSON ist DSGVO-konform fuer Datenuebertragbarkeit.

## Pitfalls

- Feedbacks ALS TESTER duerfen nicht den Werkinhaber-Namen exposen (Privacy-Cross-Cut). Werk-Titel ja, aber `werk.nutzer.email/klarname` nein.
- Rate-Limit auf den Export-Endpoint: max 1 Export pro Stunde, um Storage-Loadattacks zu verhindern.
- Stream-Response statt In-Memory-Aggregation bei vielen Werken/Feedbacks (>1MB) — Pflicht nur falls noetig, sonst JSON.stringify reicht.