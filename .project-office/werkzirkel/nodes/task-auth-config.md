---
acceptance_criteria:
  - "`apps/web/lib/auth/index.ts` exportiert `auth`-Instance vom Typ ReturnType<typeof betterAuth>"
  - "`auth.handler` ist lauffaehig in `apps/web/app/api/auth/[...all]/route.ts`"
  - Session-Cookie heisst `wz_session` mit `httpOnly` + `secure` + `sameSite=lax` + Max-Age 30 Tage gemaess PRD §16
  - Magic-Link-Token wird in der `magic_link_token`-Tabelle persistiert, nicht in einer Better-Auth-Default-Tabelle (Schema-Mapping in der Adapter-Config sichtbar)
  - "`pnpm typecheck` und `pnpm build` weiterhin gruen"
created_at: 2026-05-13T09:58:44.226Z
created_by: human
edges:
  blocks:
    - id: task-magic-link-endpoints
  composed_of:
    - id: wp-auth
effort: S
id: task-auth-config
is_root: false
open_questions: []
owner: null
parent: wp-auth
private: false
risks: []
status: done
summary: Better-Auth-Instance in lib/auth/index.ts initialisieren, Drizzle-Adapter gegen die existierenden Tabellen nutzer/session/magic_link_token, Magic-Link-Plugin aktivieren, wz_session-Cookie mit Sliding-Window. Foundation fuer alle weiteren Auth-Tasks.
tags: []
title: Better-Auth konfigurieren mit Drizzle-Adapter und Magic-Link-Plugin
type: task
updated_at: 2026-05-13T10:16:35.484Z
---

## Approach

Better-Auth (Paket bereits installiert) wird in `apps/web/lib/auth/index.ts` instanziiert mit:
- `drizzleAdapter(db, { provider: 'pg', schema })` aus `@better-auth/utils`
- `magicLink` Plugin mit `expiresIn: 15 * 60` (15 Min)
- Session-Cookie-Optionen gemaess PRD §16: `name: 'wz_session'`, `httpOnly: true`, `secure: true`, `sameSite: 'lax'`, `maxAge: 30 * 24 * 60 * 60` (30 Tage), `updateAge: 30d` (Sliding-Window)
- `BETTER_AUTH_SECRET` aus `lib/env.ts`

Session-Tabellen-Mapping: better-auth erwartet `user`/`session`-Konventionen — wir mappen auf unsere deutschen Spalten `nutzer`/`session` via Drizzle-Adapter-Config.

## Pitfalls

- Better-Auth wuenscht standardmaessig eine `user`-Tabelle mit `id/email/emailVerified/name/image`. Wir mappen `nutzer.email`, `nutzer.email_verifiziert_am`, `nutzer.anzeigename`, `nutzer.avatar_url`. Spaltennamen-Mapping muss explizit konfiguriert sein.
- Magic-Link-Token-Speicherung in `magic_link_token` (nicht in Better-Auths Default-Tabelle).
- HMR im Dev-Modus: Auth-Instance an `globalThis` haengen, sonst doppelte Initialisierung.

Started 2026-05-13T10:07:10.543Z: autobuild iter 1

Tests failing (exit 1): Implemented Better-Auth config in apps/web/lib/auth/index.ts + handler route

```
$ pnpm -r typecheck
$ tsc --noEmit
$ pnpm -r test
$ vitest run
(node:78062) [DEP0205] DeprecationWarning: `module.register()` is deprecated. Use `module.registerHooks()` instead.
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

Tests failing (exit 1): Implemented Better-Auth config in apps/web/lib/auth/index.ts + handler route

```
$ pnpm -r typecheck
$ tsc --noEmit
$ pnpm -r test
$ vitest run
(node:80081) [DEP0205] DeprecationWarning: `module.register()` is deprecated. Use `module.registerHooks()` instead.
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

Done 2026-05-13T10:16:35.484Z: Implemented Better-Auth config in apps/web/lib/auth/index.ts + handler route (Tests: green via `unset NODE_ENV && pnpm typecheck && pnpm test && NODE_ENV=production pnpm build`)
