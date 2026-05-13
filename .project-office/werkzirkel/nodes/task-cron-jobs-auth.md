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
status: done
summary: "Drei stuendliche/taegliche Cron-Endpunkte unter /api/v1/cron/ mit CRON_SECRET-Header: konto-loeschung-frist (hard-delete nach 7 Tagen), ip-kuerzung (Session+Audit-Log nach 30 Tagen), magic-link-cleanup (abgelaufene Tokens loeschen)."
tags: []
title: "Cron-Jobs Auth: Konto-Loeschung + IP-Kuerzung + Token-Cleanup"
type: task
updated_at: 2026-05-13T11:11:31.773Z
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

Started 2026-05-13T11:02:51.928Z: autobuild iter 7

Tests failing (exit 1): Implemented 3 cron endpoints + extracted DSGVO export helper + T-004 reminder logic

```
$ pnpm -r typecheck
$ tsc --noEmit
$ pnpm -r test
$ vitest run
(node:79312) [DEP0205] DeprecationWarning: `module.register()` is deprecated. Use `module.registerHooks()` instead.
(Use `node --trace-deprecation ...` to show where the warning was created)
$ pnpm --filter @werkzirkel/web build
$ next build
 ⚠ You are using a non-standard "NODE_ENV" value in your environment. This creates inconsistencies in the project and is strongly advised against. Read more: https://nextjs.org/docs/messages/non-standard-node-env

 ⚠ The Next.js plugin was not detected in your ESLint configuration. See https://nextjs.org/docs/app/api-reference/config/eslint#migrating-existing-config
Error: <Html> should not be imported outside of pages/_document.
Read more: https://nextjs.org/docs/messages/no-document-import-in-page
    at y (.next/server/chunks/71.js:6:1263)
Error occurred prerendering page "/404". Read more: https://nextjs.org/docs/messages/prerender-error
Error: <Html> should not be imported outside of pages/_document.
Read more: https://nextjs.org/docs/messages/no-document-import-in-page
    at Y (/Users/udi/work/moinsen/ideas/werkzirkel/node_modules/.pnpm/next@15.1.3_@babel+core@7.29.0_react-dom@19.0.0_react@19.0.0__react@19.0.0/node_modules/next/dist/compiled/next-server/pages.runtime.prod.js:16:5469)
    at y (/Users/udi/work/moinsen/ideas/werkzirkel/apps/web/.next/server/chunks/71.js:6:1263)
    at react-stack-bottom-frame (/Users/udi/work/moinsen/ideas/werkzirkel/node_modules/.pnpm/react-dom@19.0.0_react@19.0.0/node_modules/react-dom/cjs/react-dom-server.edge.development.js:8798:18)
    at renderWithHooks (/Users/udi/work/moinsen/ideas/werkzirkel/node_modules/.pnpm/react-dom@19.0.0_react@19.0.0/node_modules/react-dom/cjs/react-dom-server.edge.development.js:4722:19)
    at renderElement (/Users/udi/work/moinsen/ideas/werkzirkel/node_modules/.pnpm/react-dom@19.0.0_react@19.0.0/node_modules/react-dom/cjs/react-dom-server.edge.development.js:5157:23)
    at retryNode (/Users/udi/work/moinsen/ideas/werkzirkel/node_modules/.pnpm/react-dom@19.0.0_react@19.0.0/node_modules/react-dom/cjs/react-dom-server.edge.development.js:5805:22)
    at renderNodeDestructive (/Users/udi/work/moinsen/ideas/werkzirkel/node_modules/.pnpm/react-dom@19.0.0_react@19.0.0/node_modules/react-dom/cjs/react-dom-server.edge.development.js:5631:11)
    at renderElement (/Users/udi/work/moinsen/ideas/werkzirkel/node_modules/.pnpm/react-dom@19.0.0_react@19.0.0/node_modules/react-dom/cjs/react-dom-server.edge.development.js:5143:11)
    at retryNode (/Users/udi/work/moinsen/ideas/werkzirkel/node_modules/.pnpm/react-dom@19.0.0_react@19.0.0/node_modules/react-dom/cjs/react-dom-server.edge.development.js:5805:22)
    at renderNodeDestructive (/Users/udi/work/moinsen/ideas/werkzirkel/node_modules/.pnpm/react-dom@19.0.0_react@19.0.0/node_modules/react-dom/cjs/react-dom-server.edge.development.js:5631:11)
Export encountered an error on /_error: /404, exiting the build.
 ⨯ Static worker exited with code: 1 and signal: null

```

Done 2026-05-13T11:11:31.773Z: Implemented 3 cron endpoints + extracted DSGVO export helper + T-004 reminder logic (Tests: green via `unset NODE_ENV && pnpm typecheck && pnpm test && NODE_ENV=production pnpm build`)
