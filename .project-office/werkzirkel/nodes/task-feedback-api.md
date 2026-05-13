---
acceptance_criteria:
  - Erfuellt PRD §F-204 (strukturiertes Feedback) und §F-205 (Sichtbarkeit nur fuer Werkinhaber) vollstaendig
  - Erfuellt PRD §F-206 (hilfreich-Markierung) vollstaendig
  - feedbackGegeben + feedbackErhalten aus task-reziprozitaet-engine werden in der Feedback-Abgabe-Transaktion aufgerufen — Integration-Test zeigt test_saldo-Wechsel bei Tester:in (gegeben++) und Werkinhaber:in (erhalten++)
  - GET /api/v1/werke/:id/feedbacks-hilfreich gibt feedbacks OHNE tester_id zurueck (Unit-Test prueft JSON-Schema)
  - T-102 wird beim Feedback-Submit an Werkinhaber:in versendet (Mock-Mode via email_benachrichtigung_log nachweisbar)
created_at: 2026-05-13T14:42:36.765Z
created_by: human
edges:
  blocks:
    - id: task-pruefrunde-pages
  composed_of:
    - id: wp-pruefrunden
  depends_on:
    - id: task-pruefrunden-anmeldung-api
    - id: task-email-templates-pruefrunden
effort: S
id: task-feedback-api
is_root: false
open_questions: []
owner: null
parent: wp-pruefrunden
private: false
risks: []
status: done
summary: POST /api/v1/pruefrunden/:id/feedback fuer Tester:innen-Feedback. PATCH /api/v1/feedback/:id/hilfreich fuer Werkinhaber:in-Markierung. Feedback ist initial nur fuer Werkinhaber:in sichtbar. Verzahnung mit Reziprozitaets-Engine (feedbackGegeben + feedbackErhalten).
tags: []
title: "Feedback-API: Abgabe + hilfreich-Markierung + Privacy-Layer"
type: task
updated_at: 2026-05-13T15:28:37.534Z
---

## Approach

Drei Endpunkte:

### POST /api/v1/pruefrunden/:id/feedback

- Auth: Session, muss als Tester:in angemeldet sein (pruefrunden_anmeldung mit status='angemeldet').
- Body via `feedbackAbgebenSchema` (lib/validators/feedback.ts):
  - Optional: erster_eindruck, verstaendlichkeit, nutzen, bedienbarkeit, fehler, positionierung, zahlungsbereitschaft, verbesserungen
  - Pflicht: gesamteindruck (min 1)
- TRANSAKTION:
  - INSERT feedback (UNIQUE pruefrunde_id + tester_id constraint catches duplicates → 422).
  - UPDATE pruefrunden_anmeldung SET status='feedback_gegeben'.
  - **`feedbackGegeben(tester_id, neue_feedback_id)` aus Reziprozitaets-Engine** rufen (inkrementiert tests_gegeben, schliesst Verpflichtung).
  - **`feedbackErhalten(werk_inhaber_id, 1)`** rufen (inkrementiert tests_erhalten beim Werkinhaber:in).
- sendMail T-102 an Werk-Inhaber:in.
- Audit-Log.
- Returns 201.

### GET /api/v1/pruefrunden/:id/feedbacks (nur Werk-Inhaber:in vor 'hilfreich')

- Auth + Inhaber-Check.
- Liste eigener feedbacks mit tester-Anzeigename + Inhalt.
- Returns 200.

### PATCH /api/v1/feedback/:id/hilfreich

- Auth + Werkinhaber:innen-Check (via pruefrunde.werk.nutzer_id == current.id).
- Body: `{ hilfreich: boolean }`.
- UPDATE feedback SET hilfreich_markiert = ..., hilfreich_markiert_am = now() (oder NULL bei false).
- Returns 200.

### GET /api/v1/werke/:id/feedbacks-hilfreich (oeffentlich)

- Public.
- Liste der als hilfreich markierten Feedbacks zu allen Pruefrunden dieses Werks, **anonymisiert**: tester wird zu 'Anonyme:r Tester:in', keine tester-ID/Namen.
- Nur die Felder hilfreich_markiert=true.
- Returns 200.
- Wird auf der oeffentlichen Werk-Detail-Seite genutzt (PRD §8.4: 'markiertes Feedback wird im Werk als anonyme Kurzform sichtbar').

### Privacy-Layer

Unit-Test gegen Leak: feedback-GET als anonymer User darf NICHT funktionieren. Nur Werk-Inhaber:in sieht eigenes Feedback. Nach hilfreich-Markierung erscheint es in der oeffentlichen Liste — aber ohne tester-ID.

### Tests

`apps/web/tests/integration/feedback-abgabe.test.ts`:
- Angemeldete:r Tester:in gibt Feedback ab → 201.
- Nach feedback: pruefrunden_anmeldung.status='feedback_gegeben'.
- test_saldo.tests_gegeben fuer Tester:in inkrementiert.
- test_saldo.tests_erhalten fuer Werkinhaber:in inkrementiert.
- T-102 versendet (Mock-Log).
- Doppel-Feedback (gleicher tester, gleiche pruefrunde) → 422 'bereits_feedback_gegeben'.
- Feedback ohne vorherige Anmeldung → 422 'nicht_angemeldet'.
- Feedback an fremde Pruefrunde von Werkinhaber:in selbst → 422 ('eigenes_werk').

`apps/web/tests/integration/feedback-hilfreich.test.ts`:
- Werk-Inhaber:in markiert Feedback hilfreich → 200, DB-Update.
- Fremder Nutzer versucht zu markieren → 403.
- Nach hilfreich=true wird Feedback in GET /api/v1/werke/:id/feedbacks-hilfreich sichtbar (anonymisiert).
- Demarkieren (hilfreich: false) → 200, verschwindet wieder aus public.

`apps/web/tests/integration/feedback-privacy.test.ts`:
- Anonymer GET /api/v1/pruefrunden/:id/feedbacks → 401.
- Tester:in GET /api/v1/pruefrunden/:id/feedbacks → 403 (sieht eigene NICHT — nur Werkinhaber).
- Werkinhaber:in GET → 200 mit allen feedbacks.
- Public-feedbacks-hilfreich enthaelt KEINE tester_id im JSON-Response.

### Quality gate

```
cd /Users/udi/work/moinsen/ideas/werkzirkel/apps/web && rm -rf .next && pnpm exec vitest run
cd .. && pnpm typecheck && NODE_ENV=production pnpm build
```

DO NOT touch:
- UI-Pages (eigener Task).

Started 2026-05-13T15:20:35.471Z: autobuild pruefrunden iter 5

Done 2026-05-13T15:28:37.534Z: Feedback-API: POST/GET/PATCH + public hilfreich-Endpoint anonymisiert + Reziprozitäts-Verzahnung (Tests: green via `cd /Users/udi/work/moinsen/ideas/werkzirkel/apps/web && pnpm exec vitest run`)
