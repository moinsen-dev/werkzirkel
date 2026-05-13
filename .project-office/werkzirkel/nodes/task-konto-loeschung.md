---
acceptance_criteria:
  - "`DELETE /api/v1/me` erzeugt `magic_link_token` mit `zweck='konto_loeschen_bestaetigung'` und versendet T-003 — getestet mit Integration-Test"
  - Magic-Link-Klick setzt `nutzer.status='loeschung_anstehend'` und `nutzer.loeschung_anstehend_bis = now() + interval '7 days'`
  - "`POST /api/v1/me/cancel-deletion` setzt Status zurueck auf `aktiv` und nullt `loeschung_anstehend_bis`"
  - Erfuellt PRD §10 (Konto-Loeschung-Flow mit 7-Tage-Karenz und Erinnerung nach 5 Tagen) vollstaendig
  - Magic-Link-Zweck-Validierung verhindert, dass ein Login-Token versehentlich die Loeschung bestaetigt (Unit-Test)
created_at: 2026-05-13T09:58:44.228Z
created_by: human
edges:
  blocks:
    - id: task-cron-jobs-auth
  composed_of:
    - id: wp-auth
  depends_on:
    - id: task-konto-crud-settings
    - id: task-email-templates-auth
effort: S
id: task-konto-loeschung
is_root: false
open_questions: []
owner: null
parent: wp-auth
private: false
risks: []
status: done
summary: DELETE /api/v1/me startet Loeschung mit T-003 Bestaetigungs-Mail. Bestaetigungs-Klick startet 7-Tage-Karenz. POST /api/v1/me/cancel-deletion fuer Widerruf. T-004 Erinnerung nach 5 Tagen.
tags: []
title: Konto-Loeschung mit 7-Tage-Karenz und Bestaetigungs-Magic-Link
type: task
updated_at: 2026-05-13T11:01:46.404Z
---

## Approach

Drei-Schritte-Flow:
1. User klickt 'Konto loeschen' im Settings-UI → POST /api/v1/me/delete-request → erzeugt magic_link_token mit zweck='konto_loeschen_bestaetigung' (15 Min Expiry) und versendet T-003.
2. User klickt Link in der Mail → GET /api/v1/auth/magic-link/verify mit zweck-Check → setzt `nutzer.status='loeschung_anstehend'` und `nutzer.loeschung_anstehend_bis = now() + 7d`. Versendet Bestaetigungsmail.
3. Cron-Job (separater Task) faehrt nach 7 Tagen die harte Loeschung durch.

Widerruf: POST /api/v1/me/cancel-deletion (eingeloggter User) setzt `status='aktiv'`, loescht `loeschung_anstehend_bis`.

Erinnerung: separater Cron, der bei `loeschung_anstehend_bis - 2d` T-004 versendet.

## Pitfalls

- Magic-Link-Zweck muss validiert sein — ein Login-Magic-Link darf nicht versehentlich die Loeschung bestaetigen.
- Idempotenz: zweimal 'Loeschung anfordern' soll nur EINEN gueltigen Token erzeugen (oder alle alten invalidieren).
- Nach Loeschung darf der User nicht versehentlich noch eingeloggt sein — Sessions werden in der Karenz aktiv bleiben (Widerruf moeglich), aber im Loeschungs-Cron alle Sessions des Users invalidiert.

Started 2026-05-13T10:51:54.241Z: autobuild iter 6

Tests failing (exit 1): Implemented 3-step konto-loeschung flow with 7-day karenz + T-003 confirmation

```
$ pnpm -r typecheck
$ tsc --noEmit
$ pnpm -r test
$ vitest run
(node:60251) [DEP0205] DeprecationWarning: `module.register()` is deprecated. Use `module.registerHooks()` instead.
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

Tests failing (exit 1): Implemented 3-step konto-loeschung flow with 7-day karenz + T-003 confirmation

```
$ pnpm -r typecheck
$ tsc --noEmit
$ pnpm -r test
$ vitest run
(node:62427) [DEP0205] DeprecationWarning: `module.register()` is deprecated. Use `module.registerHooks()` instead.
(Use `node --trace-deprecation ...` to show where the warning was created)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  tests/integration/me-deletion.test.ts > Konto-Loeschungs-Flow > POST /api/v1/me/delete-request → 204 + Magic-Link-Row + Hash
AssertionError: expected +0 to be 1 // Object.is equality

- Expected
+ Received

- 1
+ 0

 ❯ tests/integration/me-deletion.test.ts:114:25
    112|         ),
    113|       );
    114|     expect(rows.length).toBe(1);
       |                         ^
    115|     const row = rows[0]!;
    116|     expect(row.tokenHash).toMatch(/^[a-f0-9]{64}$/);

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯


```

Tests failing (exit 1): Implemented 3-step konto-loeschung flow with 7-day karenz + T-003 confirmation

```
$ pnpm -r typecheck
$ tsc --noEmit
$ pnpm -r test
$ vitest run
(node:64277) [DEP0205] DeprecationWarning: `module.register()` is deprecated. Use `module.registerHooks()` instead.
(Use `node --trace-deprecation ...` to show where the warning was created)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  tests/integration/me-deletion.test.ts > Konto-Loeschungs-Flow > zweimaliger POST delete-request → erster Token ist invalidiert
AssertionError: expected +0 to be 2 // Object.is equality

- Expected
+ Received

- 2
+ 0

 ❯ tests/integration/me-deletion.test.ts:141:25
    139|       )
    140|       .orderBy(desc(magicLinkToken.erstelltAm));
    141|     expect(rows.length).toBe(2);
       |                         ^
    142|     const [neuer, alter] = rows;
    143|     expect(alter!.verwendetAm).not.toBeNull();

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯


```

Tests failing (exit 1): Implemented 3-step konto-loeschung flow with 7-day karenz + T-003 confirmation

```
$ pnpm -r typecheck
$ tsc --noEmit
$ pnpm -r test
$ vitest run
(node:64813) [DEP0205] DeprecationWarning: `module.register()` is deprecated. Use `module.registerHooks()` instead.
(Use `node --trace-deprecation ...` to show where the warning was created)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  tests/integration/me-deletion.test.ts > Konto-Loeschungs-Flow > zweimaliger POST delete-request → erster Token ist invalidiert
AssertionError: expected +0 to be 2 // Object.is equality

- Expected
+ Received

- 2
+ 0

 ❯ tests/integration/me-deletion.test.ts:141:25
    139|       )
    140|       .orderBy(desc(magicLinkToken.erstelltAm));
    141|     expect(rows.length).toBe(2);
       |                         ^
    142|     const [neuer, alter] = rows;
    143|     expect(alter!.verwendetAm).not.toBeNull();

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯


```

Tests failing (exit 1): Implemented 3-step konto-loeschung flow with 7-day karenz + T-003 confirmation

```
$ pnpm -r typecheck
$ tsc --noEmit
$ pnpm -r test
$ vitest run
(node:65541) [DEP0205] DeprecationWarning: `module.register()` is deprecated. Use `module.registerHooks()` instead.
(Use `node --trace-deprecation ...` to show where the warning was created)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  tests/integration/me-deletion.test.ts > Konto-Loeschungs-Flow > zweimaliger POST delete-request → erster Token ist invalidiert
AssertionError: expected +0 to be 2 // Object.is equality

- Expected
+ Received

- 2
+ 0

 ❯ tests/integration/me-deletion.test.ts:141:25
    139|       )
    140|       .orderBy(desc(magicLinkToken.erstelltAm));
    141|     expect(rows.length).toBe(2);
       |                         ^
    142|     const [neuer, alter] = rows;
    143|     expect(alter!.verwendetAm).not.toBeNull();

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯


```

Tests failing (exit 1): Implemented 3-step konto-loeschung flow with 7-day karenz + T-003 confirmation

```
$ pnpm -r typecheck
$ tsc --noEmit
$ pnpm -r test
$ vitest run
(node:69640) [DEP0205] DeprecationWarning: `module.register()` is deprecated. Use `module.registerHooks()` instead.
(Use `node --trace-deprecation ...` to show where the warning was created)
$ pnpm --filter @werkzirkel/web build
$ next build
 ⚠ You are using a non-standard "NODE_ENV" value in your environment. This creates inconsistencies in the project and is strongly advised against. Read more: https://nextjs.org/docs/messages/non-standard-node-env
(node:70088) [DEP0205] DeprecationWarning: `module.register()` is deprecated. Use `module.registerHooks()` instead.
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

Done 2026-05-13T11:01:46.404Z: Implemented 3-step konto-loeschung flow with 7-day karenz + T-003 confirmation (Tests: green via `unset NODE_ENV && pnpm typecheck && pnpm test && NODE_ENV=production pnpm build`)
