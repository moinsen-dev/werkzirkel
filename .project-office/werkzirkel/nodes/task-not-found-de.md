---
acceptance_criteria:
  - "`apps/web/app/not-found.tsx` existiert und exportiert default-Komponente"
  - Aufruf einer nicht-existierenden Route (z.B. `/diese-seite-gibt-es-nicht`) rendert die deutsche Seite mit Status 404
  - Headline `Diese Seite gibt es nicht.` ist im HTML-Output sichtbar (Integration-Test)
  - "Sprach-Check: keine englischen Strings wie 'Page not found' oder '404 Not Found'"
  - "`<title>Nicht gefunden — Werkzirkel</title>` im Head"
created_at: 2026-05-13T11:32:03.048Z
created_by: human
edges:
  composed_of:
    - id: wp-glue-pages
effort: S
id: task-not-found-de
is_root: false
open_questions: []
owner: null
parent: wp-glue-pages
private: false
risks: []
status: done
summary: Globale not-found.tsx auf Deutsch mit Werkzirkel-Branding. Ersetzt das englische Next.js-Default. Plus separate not-found.tsx pro Route-Group nur falls noetig.
tags: []
title: Deutsche 404-Seite
type: task
updated_at: 2026-05-13T11:53:15.167Z
---

## Approach

`apps/web/app/not-found.tsx` als Server Component. Globaler Fallback, greift fuer alle nicht-existierenden Routen.

Layout: Hero-Style, single Column. Werkzirkel-Logo (gleicher .brand-mark wie auf der LP), Headline 'Diese Seite gibt es nicht.', Text 'Vielleicht haben wir sie noch nicht gebaut, oder der Link ist veraltet.' und ein Button-Link zurueck zur Startseite.

Metadata setzen: `title: 'Nicht gefunden'` (das `template` aus dem RootLayout haengt automatisch ' — Werkzirkel' an).

Kein Bild-Asset noetig — die LP-CSS-Klassen reichen fuer Layout.

## Pitfalls

- Next.js' not-found.tsx wird automatisch fuer `notFound()`-Aufrufe und unbekannte Routen verwendet. Es muss `default export` ohne `params` sein.
- Das `_not-found`-Build-Pfad ist Next.js intern; wir muessen nichts anderes konfigurieren.
- Vorsicht: bei statischen Pages wird die not-found.tsx auch statisch gerendert. Server Components OK.

Started 2026-05-13T11:48:24.287Z: autobuild glue iter 2

Tests failing (exit 1): German not-found.tsx with brand mark + three navigation buttons

```
$ pnpm -r typecheck
$ tsc --noEmit
$ pnpm -r test
$ vitest run
(node:31605) [DEP0205] DeprecationWarning: `module.register()` is deprecated. Use `module.registerHooks()` instead.
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

Tests failing (exit 1): German not-found.tsx with brand mark + three navigation buttons

```
$ pnpm -r typecheck
$ tsc --noEmit
$ pnpm -r test
$ vitest run
(node:32925) [DEP0205] DeprecationWarning: `module.register()` is deprecated. Use `module.registerHooks()` instead.
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

Tests failing (exit 1): German not-found.tsx with brand mark + three navigation buttons

```
$ pnpm -r typecheck
$ tsc --noEmit
$ pnpm -r test
$ vitest run
(node:33736) [DEP0205] DeprecationWarning: `module.register()` is deprecated. Use `module.registerHooks()` instead.
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

Tests failing (exit 1): German not-found.tsx with brand mark + three navigation buttons

```
$ pnpm -r typecheck
$ tsc --noEmit
$ pnpm -r test
$ vitest run
(node:34898) [DEP0205] DeprecationWarning: `module.register()` is deprecated. Use `module.registerHooks()` instead.
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

Done 2026-05-13T11:53:15.167Z: German not-found.tsx with brand mark + three navigation buttons (Tests: green via `pnpm typecheck && pnpm test && NODE_ENV=production pnpm build`)
