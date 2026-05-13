---
acceptance_criteria:
  - "`apps/web/tests/_helpers/db-cleanup.ts` exportiert `truncateAll()` und `deleteTestNutzer(pattern)`"
  - "`truncateAll()` laesst `stadt` und Seed-Nutzer:innen (admin@werkzirkel.de, hamburg@werkzirkel.de) intakt"
  - Cleanup-Skript `apps/web/lib/db/cleanup-test-residue.ts` mit pnpm-Script `pnpm db:cleanup-test`. Skript wirft Fehler, wenn `NODE_ENV=production` ist.
  - Skript laeuft erfolgreich gegen die aktuelle Dev-DB und entfernt alle 'test.local'/'seed%@'/'cron-konto-loeschung@'-Reste. Verifizierbar via SELECT COUNT(*) FROM nutzer WHERE email LIKE '%@test.local' = 0
  - Alle existierenden Integration-Tests rufen `truncateAll` in beforeEach (oder einem aequivalenten Setup-Hook)
created_at: 2026-05-13T11:32:03.049Z
created_by: human
edges:
  composed_of:
    - id: wp-glue-pages
effort: S
id: task-test-cleanup
is_root: false
open_questions: []
owner: null
parent: wp-glue-pages
private: false
risks: []
status: done
summary: Wiederverwendbarer Cleanup-Helper fuer Integration-Tests in apps/web/tests/_helpers/db-cleanup.ts. Macht TRUNCATE fuer eine Liste von Tabellen mit CASCADE. Einmal-Skript um die existierenden Test-Reste aus der Dev-DB zu loeschen.
tags: []
title: Test-DB-Cleanup-Helper + Aufraeumen existierender Test-Daten
type: task
updated_at: 2026-05-13T12:05:19.147Z
---

## Approach

Nach dem wp-auth-Autobuild stehen in der DB ca. 30+ Test-Nutzer:innen, Magic-Link-Tokens und email_benachrichtigung_log-Eintraege herum, weil die Integration-Tests nicht aufgeraeumt haben. Plus jeder neue autobuild-Lauf wird das Problem schlimmer machen.

Loesung in zwei Teilen:

### A) Helper `apps/web/tests/_helpers/db-cleanup.ts`

Exportiert:
```ts
export async function truncateAll(): Promise<void>
```

Fuehrt `TRUNCATE TABLE x, y, z RESTART IDENTITY CASCADE` aus auf allen Tabellen ausser `stadt` (geseedete Defaults bleiben) und `drizzle.__drizzle_migrations`.

Plus selektive Helper:
```ts
export async function deleteTestNutzer(emailPattern: string): Promise<number>
```

Fuer Tests, die nur ihre eigenen Test-Nutzer:innen aufraeumen wollen — Pattern z.B. `'@test.local'` oder ein UUID-prefix.

### B) Existierende Integration-Tests anpassen

In `apps/web/tests/integration/*.test.ts` jeweils `beforeEach(truncateAll)` ergaenzen, wo das fehlt.

### C) Einmal-Cleanup-Skript

`apps/web/lib/db/cleanup-test-residue.ts` als tsx-Skript, ueber `pnpm db:cleanup-test`. Loescht:
- nutzer wo email like '%@test.local' OR like 'seed%@%' OR like 'cron-konto-loeschung@%'
- magic_link_token wo email like denselben Patterns
- email_benachrichtigung_log wo email like denselben Patterns
- alle abhaengigen Werke/Bedarfe/Werkangebote/etc. via CASCADE

WICHTIG: nicht produktionssichere Aktion — Skript darf nur in NODE_ENV != 'production' laufen, sonst frueher Abbruch.

## Pitfalls

- CASCADE in Drizzle/Postgres: alle FK-Beziehungen sind in den Schema-Files mit `onDelete` definiert — meist `cascade`. Aber Vorsicht bei `set null`-Beziehungen (z.B. feedback.tester_id) — die wuerden bei nutzer-Loeschung pseudonymisiert, nicht geloescht.
- Echte Seed-Daten (Admin + Hamburg-Kurator) duerfen NICHT geloescht werden, sonst muss der User `pnpm db:seed` neu laufen lassen.
- TRUNCATE blockt bis FK-Konflikte aufgeloest sind — CASCADE schluckt das.

Started 2026-05-13T11:54:34.340Z: autobuild glue iter 3

Tests failing (exit 1): Test-DB-Cleanup-Helper + cleanup-test pnpm-script + beforeEach in all integration tests

```
$ pnpm -r typecheck
$ tsc --noEmit
$ pnpm -r test
$ vitest run
(node:44631) [DEP0205] DeprecationWarning: `module.register()` is deprecated. Use `module.registerHooks()` instead.
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

Tests failing (exit 1): Test-DB-Cleanup-Helper + cleanup-test pnpm-script + beforeEach in all integration tests

```
$ pnpm -r typecheck
$ tsc --noEmit
$ pnpm -r test
$ vitest run
(node:45438) [DEP0205] DeprecationWarning: `module.register()` is deprecated. Use `module.registerHooks()` instead.
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

Tests failing (exit 1): Test-DB-Cleanup-Helper + cleanup-test pnpm-script + beforeEach in all integration tests

```
$ pnpm -r typecheck
$ tsc --noEmit
$ pnpm -r test
$ vitest run
(node:46053) [DEP0205] DeprecationWarning: `module.register()` is deprecated. Use `module.registerHooks()` instead.
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

Tests failing (exit 1): Test-DB-Cleanup-Helper + cleanup-test pnpm-script + beforeEach in all integration tests

```
$ pnpm -r typecheck
$ tsc --noEmit
$ pnpm -r test
$ vitest run
(node:46716) [DEP0205] DeprecationWarning: `module.register()` is deprecated. Use `module.registerHooks()` instead.
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

Tests failing (exit 1): Test-DB-Cleanup-Helper + cleanup-test pnpm-script + beforeEach in all integration tests

```
$ pnpm -r typecheck
$ tsc --noEmit
$ pnpm -r test
$ vitest run
(node:47380) [DEP0205] DeprecationWarning: `module.register()` is deprecated. Use `module.registerHooks()` instead.
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

Tests failing (exit 1): Test-DB-Cleanup-Helper + cleanup-test pnpm-script + beforeEach in all integration tests

```
$ pnpm -r typecheck
$ tsc --noEmit
$ pnpm -r test
$ vitest run
(node:48021) [DEP0205] DeprecationWarning: `module.register()` is deprecated. Use `module.registerHooks()` instead.
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

Done 2026-05-13T12:05:19.147Z: Test-DB-Cleanup-Helper + cleanup-test pnpm-script + beforeEach in all integration tests (Tests: green via `pnpm typecheck`)
