---
acceptance_criteria:
  - "`DELETE /api/v1/me` erzeugt `magic_link_token` mit `zweck='konto_loeschen_bestaetigung'` und versendet T-003 — getestet mit Integration-Test"
  - Magic-Link-Klick setzt `nutzer.status='loeschung_anstehend'` und `nutzer.loeschung_anstehend_bis = now() + interval '7 days'`
  - "`POST /api/v1/me/cancel-deletion` setzt Status zurueck auf `aktiv` und nullt `loeschung_anstehend_bis`"
  - Erfuellt PRD §10 (Konto-Loeschung-Flow mit 7-Tage-Karenz und Erinnerung nach 5 Tagen) vollstaendig
  - Magic-Link-Zweck-Validierung verhindert, dass ein Login-Token versehentlich die Loeschung bestaetigt (Unit-Test)
created_at: 2026-05-13T09:58:44.228Z
created_by: human
edges:
  blocks:
    - id: task-cron-jobs-auth
  composed_of:
    - id: wp-auth
  depends_on:
    - id: task-konto-crud-settings
    - id: task-email-templates-auth
effort: S
id: task-konto-loeschung
is_root: false
open_questions: []
owner: null
parent: wp-auth
private: false
risks: []
status: draft
summary: DELETE /api/v1/me startet Loeschung mit T-003 Bestaetigungs-Mail. Bestaetigungs-Klick startet 7-Tage-Karenz. POST /api/v1/me/cancel-deletion fuer Widerruf. T-004 Erinnerung nach 5 Tagen.
tags: []
title: Konto-Loeschung mit 7-Tage-Karenz und Bestaetigungs-Magic-Link
type: task
updated_at: 2026-05-13T09:58:44.228Z
---

## Approach

Drei-Schritte-Flow:
1. User klickt 'Konto loeschen' im Settings-UI → POST /api/v1/me/delete-request → erzeugt magic_link_token mit zweck='konto_loeschen_bestaetigung' (15 Min Expiry) und versendet T-003.
2. User klickt Link in der Mail → GET /api/v1/auth/magic-link/verify mit zweck-Check → setzt `nutzer.status='loeschung_anstehend'` und `nutzer.loeschung_anstehend_bis = now() + 7d`. Versendet Bestaetigungsmail.
3. Cron-Job (separater Task) faehrt nach 7 Tagen die harte Loeschung durch.

Widerruf: POST /api/v1/me/cancel-deletion (eingeloggter User) setzt `status='aktiv'`, loescht `loeschung_anstehend_bis`.

Erinnerung: separater Cron, der bei `loeschung_anstehend_bis - 2d` T-004 versendet.

## Pitfalls

- Magic-Link-Zweck muss validiert sein — ein Login-Magic-Link darf nicht versehentlich die Loeschung bestaetigen.
- Idempotenz: zweimal 'Loeschung anfordern' soll nur EINEN gueltigen Token erzeugen (oder alle alten invalidieren).
- Nach Loeschung darf der User nicht versehentlich noch eingeloggt sein — Sessions werden in der Karenz aktiv bleiben (Widerruf moeglich), aber im Loeschungs-Cron alle Sessions des Users invalidiert.