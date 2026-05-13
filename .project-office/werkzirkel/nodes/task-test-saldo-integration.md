---
acceptance_criteria:
  - /uebersicht zeigt test_saldo.tests_gegeben/tests_erhalten/offene_verpflichtung_anzahl mit echten Werten aus der DB (nicht hardcoded 0/0/0)
  - /werkpass/[id] zeigt dieselben echten Werte fuer den oeffentlichen Macher:innen-Pass
  - "Wenn offene_verpflichtung_anzahl > 0 und Frist < 3 Tage: rotes Top-Banner auf /uebersicht mit deutscher Erklaerung + Pruefrunden-Link"
  - Erfuellt PRD §F-209 (Werkpass zeigt sichtbar gegebene und erhaltene Pruefrunden-Tests) vollstaendig — sowohl auf /uebersicht als auch auf /werkpass/[id]
  - Stub 'Meine Pruefrunden (in Vorbereitung)' auf /uebersicht ist aufgeloest
created_at: 2026-05-13T14:42:36.765Z
created_by: human
edges:
  composed_of:
    - id: wp-pruefrunden
  depends_on:
    - id: task-pruefrunde-pages
effort: S
id: task-test-saldo-integration
is_root: false
open_questions: []
owner: null
parent: wp-pruefrunden
private: false
risks: []
status: done
summary: "Die echten test_saldo-Werte werden jetzt von der Reziprozitaets-Engine gepflegt. Diese Task verdrahtet sie ueberall, wo sie sichtbar sein sollen: /uebersicht-Begruessungs-Karte, /werkpass/[id]-Public-Anzeige, und ergaenzt die Anzeige der naechsten Verpflichtungs-Frist."
tags: []
title: "Test-Saldo-Integration: echte Daten auf /uebersicht, /werkpass/[id], Hilfegesuche-Stub"
type: task
updated_at: 2026-05-13T15:53:44.889Z
---

## Approach

Der Test-Saldo wurde in vorigen Tasks schon visuell auf /uebersicht und /werkpass/[id] gerendert — aber mit 0/0/0-Default-Werten, da kein test_saldo-Datensatz existierte. Jetzt fliessen echte Werte ein.

### A) /uebersicht — Test-Saldo-Karte echte Werte

Wenn Reziprozitaets-Engine die Werte pflegt: `getSaldoForUser(id)` aus `lib/reziprozitaet/saldo.ts` (oder bestehende Engine-Helper-Funktion) → JOIN auf test_saldo.
- Wenn `offene_verpflichtung_anzahl > 0`: roter Hinweis mit `naechste_verpflichtung_frist` deutsch formatiert ('Du hast N offene Verpflichtungen bis <datum>.')
- Wenn alles 0/0/0: Erklaerungstext bleibt wie er ist.

### B) /werkpass/[id] — Public-Saldo

Identisch.

### C) /uebersicht — Naechste Verpflichtung als Top-Banner

Auf der eingeloggten /uebersicht-Page: wenn offene Verpflichtung existiert UND Frist in < 3 Tagen: ROTES Top-Banner direkt unter der Begruessung:
- 'Du hast eine offene Reziprozitaets-Verpflichtung. Frist endet am <datum>.'
- Link 'Jetzt eine Pruefrunde testen' → /pruefrunden?stadt=hh

### D) E-Mail-Test-Saldo-Integration

Die T-103/T-104-Templates aus task-email-templates-pruefrunden brauchen `pruefrundenSucheUrl` — verdrahten gegen /pruefrunden?stadt=<user-stadt>.

### E) Hilfegesuche-Stub aufloesen (optional, nur wenn /pruefrunden steht)

Auf /uebersicht der Stub 'Termine in Hamburg (in Vorbereitung)' bleibt — gehoert zu wp-termine. Aber 'Meine Pruefrunden (in Vorbereitung)' wird zu 'Meine Pruefrunden' (sollte schon aus task-pruefrunde-pages erledigt sein — pruefen, sonst hier finalisieren).

### Tests

`apps/web/tests/integration/test-saldo-integration.test.ts`:
- Seed Nutzer:in + 2 feedbacks von ihr gegeben.
- GET /uebersicht zeigt 'Gegeben: 2'.
- GET /werkpass/[id] zeigt 'Test-Saldo: 2 gegeben'.
- Erzeuge offene Verpflichtung mit frist=in 2 Tagen.
- GET /uebersicht zeigt das ROTE Top-Banner mit Frist-Datum.
- Erzeuge feedback (via API) → test_saldo wird automatisch aktualisiert (kontert die Engine-Integration).

### Quality gate

```
cd /Users/udi/work/moinsen/ideas/werkzirkel/apps/web && rm -rf .next && pnpm exec vitest run
cd .. && pnpm typecheck && NODE_ENV=production pnpm build
```

DO NOT touch:
- Reziprozitaets-Engine selbst (schon done).
- Pruefrunde-CRUD/Anmeldung/Feedback-APIs (schon done).

Started 2026-05-13T15:47:55.773Z: autobuild pruefrunden iter 7

Done 2026-05-13T15:53:44.889Z: Test-Saldo-Anzeige auf /uebersicht und /werkpass/[id] mit echten Reziprozitäts-Engine-Daten + Verpflichtungs-Banner (Tests: green via `cd /Users/udi/work/moinsen/ideas/werkzirkel/apps/web && pnpm exec vitest run`)
