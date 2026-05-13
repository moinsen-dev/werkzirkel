---
acceptance_criteria:
  - "`apps/web/app/anmelden/page.tsx` existiert und rendert die Magic-Link-Seite ohne Login (status 200)"
  - Eingabe einer E-Mail + Klick auf 'Anmelden' triggert den Magic-Link-Pfad (verifiziert durch ein neues Magic-Link-Token in der DB nach dem Submit)
  - "`?fehler=token-ungueltig` Parameter rendert einen deutschen Fehler-Banner"
  - "`?next=/uebersicht` wird durchgereicht (nach erfolgreichem Login-Verify landet der User in `/uebersicht`, nicht in `/`) — implementiert in der Magic-Link-Verify-Route durch Auswertung des next-Params"
  - "Sprach-Check: kein englischer String im HTML-Output (Snapshot-Test gegen verbotene Begriffe 'Sign in', 'Login', 'Submit')"
created_at: 2026-05-13T11:32:03.047Z
created_by: human
edges:
  blocks:
    - id: task-uebersicht-page
  composed_of:
    - id: wp-glue-pages
effort: S
id: task-anmelden-page
is_root: false
open_questions: []
owner: null
parent: wp-glue-pages
private: false
risks: []
status: done
summary: Server-Component-Seite unter /anmelden mit Magic-Link-Eingabeformular. Bestaetigungs-State 'Wir haben dir eine Mail geschickt'. Fehler-Banner fuer ?fehler=token-ungueltig|loeschung-token-ungueltig. Optional ?next=Pfad-Parameter durchschleifen.
tags: []
title: Anmelden-Seite mit Magic-Link-Formular
type: task
updated_at: 2026-05-13T11:47:13.284Z
---

## Approach

`apps/web/app/anmelden/page.tsx` als Server Component. Lese `searchParams` fuer `?next`, `?fehler`, `?gesendet`. 

Form posted an existierenden `POST /api/v1/auth/magic-link` (auth-Endpoint aus iter 3). Bei Erfolg redirect zu `?gesendet=1` (selbe Seite, anderer State) — der Endpoint gibt 204, also brauchen wir clientseitig ein form-onSubmit + fetch + push to `?gesendet=1`, oder server action.

Empfohlen: Server Action statt fetch — passt zur restlichen Architektur. Die Server Action ruft den existierenden Magic-Link-Endpoint server-side auf (oder dupliziert die Logik, was schlechter ist). Saubere Variante: Server Action ruft die zugrundeliegende Funktion aus `lib/auth/magic-link.ts` direkt auf.

UI sollte sich an die Marketing-LP einpassen: Hero-Style, single-Spalten-Layout, klare deutsche Texte. Status-Pills fuer Erfolg/Fehler aus `landingpages.css` wiederverwenden.

Zweck-Wahl: User auf der Seite entscheidet 'Anmelden' (zweck=login) ODER 'Werkpass anlegen' (zweck=registrierung) via zwei Buttons oder Radio. Default 'Anmelden'.

## Pitfalls

- Origin-CSRF: Die Server Action laeuft im Next-Server, nicht im Browser → ruft direkt die Magic-Link-Funktion (nicht den HTTP-Endpoint) → keine Origin-Header-Probleme.
- Rate-Limit: derselbe Rate-Limit-Check muss greifen (5 pro E-Mail/h, 30 pro IP/h). Falls die Server Action den HTTP-Endpoint aufruft, geht der Limit-Check natuerlich; bei Direktaufruf der Funktion muss man die Rate-Limit-Wrapper neu durchlaufen.
- Fehler-Anzeige aus `?fehler=`: deutsche Klartext-Mapping in einem kleinen Lookup. `token-ungueltig` → 'Der Link ist abgelaufen oder bereits benutzt. Bitte fordere einen neuen an.'. `loeschung-token-ungueltig` → 'Der Bestaetigungs-Link fuer die Konto-Loeschung ist abgelaufen.'

Started 2026-05-13T11:33:15.638Z: autobuild glue iter 1

Tests failing (exit 1): Implemented /anmelden page + server action + next-path through magic-link flow

```
$ pnpm -r typecheck
$ tsc --noEmit
$ pnpm -r test
$ vitest run
(node:14855) [DEP0205] DeprecationWarning: `module.register()` is deprecated. Use `module.registerHooks()` instead.
(Use `node --trace-deprecation ...` to show where the warning was created)
$ pnpm --filter @werkzirkel/web build
$ next build
 ⚠ You are using a non-standard "NODE_ENV" value in your environment. This creates inconsistencies in the project and is strongly advised against. Read more: https://nextjs.org/docs/messages/non-standard-node-env

 ⚠ The Next.js plugin was not detected in your ESLint configuration. See https://nextjs.org/docs/app/api-reference/config/eslint#migrating-existing-config
Error occurred prerendering page "/_not-found". Read more: https://nextjs.org/docs/messages/prerender-error
TypeError: Cannot read properties of null (reading 'useContext')
    at t.useContext (/Users/udi/work/moinsen/ideas/werkzirkel/node_modules/.pnpm/next@15.1.3_@babel+core@7.29.0_react-dom@19.0.0_react@19.0.0__react@19.0.0/node_modules/next/dist/compiled/next-server/app-page.runtime.prod.js:68:6274)
    at w (/Users/udi/work/moinsen/ideas/werkzirkel/apps/web/.next/server/chunks/676.js:1:15801)
    at react-stack-bottom-frame (/Users/udi/work/moinsen/ideas/werkzirkel/node_modules/.pnpm/next@15.1.3_@babel+core@7.29.0_react-dom@19.0.0_react@19.0.0__react@19.0.0/node_modules/next/dist/compiled/next-server/app-page.runtime.dev.js:25:229305)
    at renderWithHooks (/Users/udi/work/moinsen/ideas/werkzirkel/node_modules/.pnpm/next@15.1.3_@babel+core@7.29.0_react-dom@19.0.0_react@19.0.0__react@19.0.0/node_modules/next/dist/compiled/next-server/app-page.runtime.dev.js:25:66965)
    at renderElement (/Users/udi/work/moinsen/ideas/werkzirkel/node_modules/.pnpm/next@15.1.3_@babel+core@7.29.0_react-dom@19.0.0_react@19.0.0__react@19.0.0/node_modules/next/dist/compiled/next-server/app-page.runtime.dev.js:25:81693)
    at renderElement (/Users/udi/work/moinsen/ideas/werkzirkel/node_modules/.pnpm/next@15.1.3_@babel+core@7.29.0_react-dom@19.0.0_react@19.0.0__react@19.0.0/node_modules/next/dist/compiled/next-server/app-page.runtime.dev.js:25:135151)
    at retryNode (/Users/udi/work/moinsen/ideas/werkzirkel/node_modules/.pnpm/next@15.1.3_@babel+core@7.29.0_react-dom@19.0.0_react@19.0.0__react@19.0.0/node_modules/next/dist/compiled/next-server/app-page.runtime.dev.js:25:140140)
    at renderNodeDestructive (/Users/udi/work/moinsen/ideas/werkzirkel/node_modules/.pnpm/next@15.1.3_@babel+core@7.29.0_react-dom@19.0.0_react@19.0.0__react@19.0.0/node_modules/next/dist/compiled/next-server/app-page.runtime.dev.js:25:136545)
    at renderNode (/Users/udi/work/moinsen/ideas/werkzirkel/node_modules/.pnpm/next@15.1.3_@babel+core@7.29.0_react-dom@19.0.0_react@19.0.0__react@19.0.0/node_modules/next/dist/compiled/next-server/app-page.runtime.dev.js:25:149261)
    at renderElement (/Users/udi/work/moinsen/ideas/werkzirkel/node_modules/.pnpm/next@15.1.3_@babel+core@7.29.0_react-dom@19.0.0_react@19.0.0__react@19.0.0/node_modules/next/dist/compiled/next-server/app-page.runtime.dev.js:25:127450)
Export encountered an error on /_not-found/page: /_not-found, exiting the build.
 ⨯ Static worker exited with code: 1 and signal: null

```

Tests failing (exit 1): Implemented /anmelden page + server action + next-path through magic-link flow

```
$ pnpm -r typecheck
$ tsc --noEmit
$ pnpm -r test
$ vitest run
(node:20302) [DEP0205] DeprecationWarning: `module.register()` is deprecated. Use `module.registerHooks()` instead.
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

Tests failing (exit 1): Implemented /anmelden page + server action + next-path through magic-link flow

```
$ pnpm -r typecheck
$ tsc --noEmit
$ pnpm -r test
$ vitest run
(node:23042) [DEP0205] DeprecationWarning: `module.register()` is deprecated. Use `module.registerHooks()` instead.
(Use `node --trace-deprecation ...` to show where the warning was created)
$ pnpm --filter @werkzirkel/web build
$ next build
 ⚠ You are using a non-standard "NODE_ENV" value in your environment. This creates inconsistencies in the project and is strongly advised against. Read more: https://nextjs.org/docs/messages/non-standard-node-env
(node:23301) [DEP0205] DeprecationWarning: `module.register()` is deprecated. Use `module.registerHooks()` instead.
(Use `node --trace-deprecation ...` to show where the warning was created)

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

Tests failing (exit 1): Implemented /anmelden page + server action + next-path through magic-link flow

```
$ pnpm -r typecheck
$ tsc --noEmit
$ pnpm -r test
$ vitest run
(node:23701) [DEP0205] DeprecationWarning: `module.register()` is deprecated. Use `module.registerHooks()` instead.
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

Done 2026-05-13T11:47:13.284Z: Implemented /anmelden page + server action + next-path through magic-link flow (Tests: green via `pnpm typecheck && pnpm test && NODE_ENV=production pnpm build`)
