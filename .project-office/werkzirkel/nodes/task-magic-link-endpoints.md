---
acceptance_criteria:
  - "Erfuellt PRD §15.1 vollstaendig: 5 Endpunkte (POST magic-link, GET verify, POST logout, POST logout-all, GET me)"
  - POST `/api/v1/auth/magic-link` antwortet immer 204 (Aufklaerungsschutz), auch bei unbekannter E-Mail
  - "Rate-Limit aus PRD §16 durchgesetzt: 5 Magic-Links pro E-Mail pro Stunde, 30 pro IP pro Stunde — getestet mit Integration-Test (sechster Aufruf gibt 429)"
  - GET `/api/v1/auth/magic-link/verify` setzt `wz_session`-Cookie und 302-redirect nach `/uebersicht`
  - Token in `magic_link_token.token_hash` ist SHA-256-Hash, niemals Klartext (`pnpm test` deckt das mit einem Unit-Test ab)
created_at: 2026-05-13T09:58:44.227Z
created_by: human
edges:
  blocks:
    - id: task-konto-crud-settings
    - id: task-dsgvo-export
  composed_of:
    - id: wp-auth
  depends_on:
    - id: task-auth-config
    - id: task-email-templates-auth
effort: S
id: task-magic-link-endpoints
is_root: false
open_questions: []
owner: null
parent: wp-auth
private: false
risks: []
status: done
summary: "Alle Auth-Endpunkte aus PRD §15.1 implementieren: POST /api/v1/auth/magic-link, GET .../verify, POST .../logout, POST .../logout-all, GET .../me. Plus Rate-Limits (5 Mails/E-Mail/Std, 30 Mails/IP/Std, 10 Verifications/Token)."
tags: []
title: Magic-Link API-Endpunkte mit Rate-Limits
type: task
updated_at: 2026-05-13T10:31:57.848Z
---

## Approach

Alle Endpunkte unter `apps/web/app/api/v1/auth/`. Better-Auth's Handler deckt magic-link-send und magic-link-verify ab — wir wrappen sie mit Rate-Limit-Middleware und einer Zod-validierten Request-Shape.

Rate-Limits werden Postgres-basiert (kein Redis): kleine Tabelle `rate_limit_bucket` mit `key` (email|ip), `endpoint`, `count`, `window_start`. Wird sliding-window-mässig zurueckgesetzt.

Alternativ: in-memory Map mit setInterval-Eviction (reicht fuer Single-Instance-Hetzner-VM; spaeter Postgres-basiert bei Skalierung).

Magic-Link-Mail ist deutsch (Template T-001 fuer Login, T-002 fuer Registrierung) — gehoert aber zu task-email-templates-auth. Hier nur den Aufruf an die Versand-Funktion verdrahten.

## Pitfalls

- POST /api/v1/auth/magic-link gibt IMMER 204 zurueck (auch wenn E-Mail nicht existiert) — Aufklaerungsschutz gegen User-Enumeration.
- Token-Hash: vor Speicherung SHA-256, niemals Klartext in der DB.
- Verify-Endpoint dekrementiert max-uses, markiert verwendet_am, erstellt Session via auth.api.signIn.email.
- Origin-Header-Check fuer alle POST-Routen ausser dem Stripe-Webhook (kommt spaeter).

Started 2026-05-13T10:23:13.561Z: autobuild iter 3

Tests failing (exit 1): Implemented 5 magic-link endpoints + rate limits + CSRF + integration tests

```
$ pnpm -r typecheck
$ tsc --noEmit
$ pnpm -r test
$ vitest run
(node:10664) [DEP0205] DeprecationWarning: `module.register()` is deprecated. Use `module.registerHooks()` instead.
(Use `node --trace-deprecation ...` to show where the warning was created)
$ pnpm --filter @werkzirkel/web build
$ next build
 ⚠ You are using a non-standard "NODE_ENV" value in your environment. This creates inconsistencies in the project and is strongly advised against. Read more: https://nextjs.org/docs/messages/non-standard-node-env

 ⚠ The Next.js plugin was not detected in your ESLint configuration. See https://nextjs.org/docs/app/api-reference/config/eslint#migrating-existing-config
Error: <Html> should not be imported outside of pages/_document.
Read more: https://nextjs.org/docs/messages/no-document-import-in-page
    at y (.next/server/chunks/71.js:6:1263)
Error occurred prerendering page "/500". Read more: https://nextjs.org/docs/messages/prerender-error
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
Export encountered an error on /_error: /500, exiting the build.
 ⨯ Static worker exited with code: 1 and signal: null

```

Done 2026-05-13T10:31:57.848Z: Implemented 5 magic-link endpoints + rate limits + CSRF + integration tests (Tests: green via `unset NODE_ENV && pnpm typecheck && pnpm test && NODE_ENV=production pnpm build`)
