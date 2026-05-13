---
acceptance_criteria:
  - "Drei Cron-Endpunkte unter `/api/v1/cron/`: konto-loeschung-frist-abgelaufen, ip-kuerzung, magic-link-cleanup — jeweils mit `X-Cron-Secret`-Header-Check"
  - "`konto-loeschung-frist-abgelaufen` fuehrt Hard-Delete nach 7 Tagen aus, pseudonymisiert Feedback (`tester_id=NULL`), versendet T-005 mit JSON-Export-Anhang"
  - "`ip-kuerzung` nullt das letzte IP-Oktett in `session` und `audit_log` fuer Eintraege aelter als 30 Tage (PRD §34)"
  - "`magic-link-cleanup` loescht abgelaufene `magic_link_token`-Eintraege; idempotent (Doppelaufruf erzeugt kein Fehlverhalten)"
  - Alle drei Cron-Jobs haben Integration-Tests, die ihre Idempotenz pruefen (zweite Ausfuehrung = Noop)
created_at: 2026-05-13T09:58:44.228Z
created_by: human
edges:
  composed_of:
    - id: wp-auth
  depends_on:
    - id: task-konto-loeschung
    - id: task-dsgvo-export
effort: S
id: task-cron-jobs-auth
is_root: false
open_questions: []
owner: null
parent: wp-auth
private: false
risks: []
status: draft
summary: "Drei stuendliche/taegliche Cron-Endpunkte unter /api/v1/cron/ mit CRON_SECRET-Header: konto-loeschung-frist (hard-delete nach 7 Tagen), ip-kuerzung (Session+Audit-Log nach 30 Tagen), magic-link-cleanup (abgelaufene Tokens loeschen)."
tags: []
title: "Cron-Jobs Auth: Konto-Loeschung + IP-Kuerzung + Token-Cleanup"
type: task
updated_at: 2026-05-13T09:58:44.228Z
---

## Approach

Drei Cron-Job-Endpunkte unter `apps/web/app/api/v1/cron/`:

1. **`konto-loeschung-frist-abgelaufen`** (stuendlich):
   - Findet alle `nutzer` mit `status='loeschung_anstehend'` und `loeschung_anstehend_bis < now()`
   - Pseudonymisiert deren Feedback (`testerId = NULL`, gesamteindruck-Body bleibt)
   - Loescht Werke, Bedarfe, Werkangebote (CASCADE)
   - Loescht `nutzer`-Row
   - Sendet T-005 mit JSON-Export-Anhang an die hinterlegte E-Mail
   - Logged Aktion in `audit_log`

2. **`ip-kuerzung`** (taeglich):
   - In `session` und `audit_log`: bei `erstellt_am < now() - 30d` setze IP-Adresse auf 'X.X.X.0' (letztes Oktett genullt)
   - Bei `erstellt_am < now() - 90d`: setze `user_agent = NULL`

3. **`magic-link-cleanup`** (stuendlich):
   - Loescht `magic_link_token` mit `expires_at < now() - 1d` (1-Tag-Karenz fuer Telemetrie)

Alle Endpunkte erwarten Header `X-Cron-Secret` mit Wert `CRON_SECRET` aus env. Aufruf via Vercel-Cron oder externe systemd-Timer/cronjob auf Hetzner-VM.

## Pitfalls

- Pseudonymisierung statt Loeschung beim Feedback: gibt nach DSGVO einen 'berechtigten Interessen-Konflikt' (Werk-Inhaber hat ein Recht auf das Feedback zu seinem Werk). Loesung: tester_id wird NULL, gesamteindruck bleibt — Feedback wirkt anonym, aber Inhalt bleibt.
- T-005 mit Anhang: JSON-Export muss VOR dem Hard-Delete generiert werden, sonst sind die Daten weg.
- Idempotenz: alle drei Cron-Jobs muessen mehrfach hintereinander ausfuehrbar sein ohne Schaden (z.B. wenn der Cron mal zweimal triggert).