---
acceptance_criteria:
  - Erfuellt PRD §F-201 bis §F-209 vollstaendig (Pruefrunde-CRUD, Anmeldung, strukturiertes Feedback, Reziprozitaets-Block, Test-Saldo sichtbar)
  - Erfuellt PRD §17 (Reziprozitaets-Engine) vollstaendig — `kannPruefrundeStarten` und `feedbackGegeben` als pure Functions in `lib/reziprozitaet/` mit Unit-Tests
  - Cron-Job `reziprozitaet-frist-pruefen` setzt `pruefrunden_verpflichtung.status='verfallen'` fuer abgelaufene Fristen und blockiert weitere Pruefrunden-Starts
  - Permission-Check verhindert, dass Tester:innen ihr eigenes Feedback nach Abgabe noch sehen koennen, bis es als `hilfreich_markiert` ist
  - E-Mail-Templates T-101 bis T-104 implementiert (Neue Anmeldung, Neues Feedback, Frist 3d/1d) und durch Integration-Test verifiziert
created_at: 2026-05-13T09:49:33.795Z
created_by: human
edges:
  composed_of:
    - id: plattform-kern
id: wp-pruefrunden
is_root: false
open_questions: []
owner: null
parent: plattform-kern
private: false
risks: []
status: draft
summary: Kernmechanik von Werkzirkel. Pruefrunde-CRUD, Tester:innen-Anmeldung mit Slot-System, strukturiertes Feedback mit 8 Kategorien, hilfreich-Markierung, Reziprozitaets-Engine in lib/reziprozitaet/ mit Verpflichtungs-Tracking und Cron-Job.
tags: []
title: Pruefrunden mit Reziprozitaets-Engine
type: workpackage
updated_at: 2026-05-13T09:49:33.795Z
---

## Approach

Die Reziprozitaets-Engine ist die identitaetsbildende Mechanik von Werkzirkel (Prinzip P5). Sie hat zwei Modi:

1. `kannPruefrundeStarten(nutzer_id)`: Prueft Test-Saldo. Wenn `tests_gegeben >= 2` → erlaubt. Sonst neue `pruefrunden_verpflichtung` mit Frist `now() + Pruefrundenfrist + 14d`.
2. `feedbackGegeben(nutzer_id, feedback_id)`: Inkrementiert `tests_gegeben`, schliesst aelteste offene Verpflichtung.

Cron `reziprozitaet-frist-pruefen` laeuft taeglich 06:00 und setzt verfallene Verpflichtungen auf `verfallen`. Erinnerungs-Mails T-103/T-104 bei `frist - 3d` und `frist - 1d`.

## Pitfalls

- Race-Conditions: zwei gleichzeitige Pruefrunden-Starts duerfen nicht beide das Saldo aufzehren. Postgres-Transaktion mit FOR UPDATE.
- Test-Saldo-Materialisierung: `test_saldo`-Tabelle wird vom Engine gepflegt, NICHT durch CRUD. Drizzle-Trigger oder explizit im Engine-Service.
- Verpflichtungs-Frist: nicht `now() + 14d`, sondern `pruefrunde.frist + 14d`. Wenn Pruefrunde 7 Tage Frist hat, ist Verpflichtungs-Frist 21d ab jetzt.
- Feedback nur fuer Werkinhaber:in sichtbar bis sie als `hilfreich_markiert` werden — Permission-Check im API-Layer.