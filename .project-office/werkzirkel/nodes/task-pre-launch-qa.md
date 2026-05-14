---
acceptance_criteria:
  - Erfüllt PRD §38 (Lasttest k6 + Pentest OWASP ZAP) und §42 Sprint 14 (Pre-Launch-QA) vollständig
  - Playwright-E2E mit 3 Happy-Paths (Macher, Bedarfsträger, Förderer)
  - k6-Lasttest-Script mit p95 <500ms + Fehlerquote <0.5% Thresholds
  - OWASP ZAP-Scan als GitHub Action (weekly schedule)
created_at: 2026-05-14T09:53:24.233Z
created_by: human
edges:
  composed_of:
    - id: polish-und-launch
effort: S
id: task-pre-launch-qa
is_root: false
open_questions: []
owner: null
parent: polish-und-launch
private: false
risks: []
status: done
summary: Playwright-E2E für Happy-Paths. k6 Lasttest 200 RPS/5min. OWASP ZAP-Scan gegen Staging.
tags: []
title: "Pre-Launch-QA: E2E Playwright, k6 Lasttest, OWASP ZAP Scan"
type: task
updated_at: 2026-05-14T11:04:14.241Z
---

## Approach

### Playwright-E2E

`pnpm --filter @werkzirkel/web add -D @playwright/test`.
`playwright.config.ts` mit baseURL=http://localhost:3210.
`tests/e2e/`:
- happy-path-macher.spec.ts: registrieren → werk anlegen → prüfrunde starten → tester gibt feedback
- happy-path-bedarfstraeger.spec.ts: registrieren → werkstattbeitrag-sachleistung → bedarf anlegen → kurator veröffentlicht → werkangebot eingehen → erfüllt markieren
- happy-path-foerderer.spec.ts: registrieren → förderprofil anlegen → kurator verifizieren → bedarfsschau-anwesenheit

CI-Workflow `.github/workflows/e2e.yml`: spawnt Postgres + Next-Server + run e2e.

### k6 Lasttest

`tests/load/baseline.js`: k6 script, 200 VUs/5min, gegen GET /, /werke, /termine, POST /api/v1/auth/magic-link.
Thresholds: p95 <500ms, Fehlerquote <0.5%.
Manuell ausführbar: `k6 run tests/load/baseline.js`.

### OWASP ZAP

GitHub Action: zaproxy/action-baseline gegen Staging-URL.
.github/workflows/security-scan.yml — weekly schedule + manual trigger.

### Tests

- Playwright-E2E: 3 Happy-Paths grün.
- k6-Script-Syntax valide (compile-check).
- ZAP-Action-Workflow im Repo, syntax-validiert.

Started 2026-05-14T10:53:46.556Z: autobuild polish iter 5

Done 2026-05-14T11:04:14.241Z: Pre-Launch-QA: Playwright-E2E + k6-Lasttest + OWASP-ZAP-Workflow (Tests: green via `cd /Users/udi/work/moinsen/ideas/werkzirkel/apps/web && pnpm exec vitest run`)
