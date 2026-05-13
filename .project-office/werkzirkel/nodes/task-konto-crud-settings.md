---
acceptance_criteria:
  - Erfuellt PRD §F-001 bis §F-005 vollstaendig (Konto-Registrierung, Stadt, Werkpass, Teilnahmeart, Deaktivierung)
  - "`GET /api/v1/me` gibt vollstaendiges eigenes Profil zurueck; `PATCH /api/v1/me` aktualisiert mit Zod-validiertem Body"
  - Avatar-Upload `POST /api/v1/me/avatar` validiert MIME (jpeg|png|webp), max 2MB, persistiert resized 256+512 WebP in R2
  - "App-Validierung erzwingt: wenn `rollen` `bedarfstraeger` oder `foerderer` enthaelt, ist `klarname` Pflicht (Test deckt diesen Fehlerpfad ab)"
  - UI-Seite `/einstellungen` rendert die drei Tabs (Profil, Benachrichtigungen, Datenschutz) als Server Components mit Server Actions
created_at: 2026-05-13T09:58:44.228Z
created_by: human
edges:
  blocks:
    - id: task-konto-loeschung
  composed_of:
    - id: wp-auth
  depends_on:
    - id: task-magic-link-endpoints
effort: S
id: task-konto-crud-settings
is_root: false
open_questions: []
owner: null
parent: wp-auth
private: false
risks: []
status: done
summary: GET/PATCH /api/v1/me (Profil-Lese/Update), POST /api/v1/me/avatar (R2-Upload mit sharp-Resize), Pause-Konto-Aktion, UI unter /einstellungen mit drei Tabs (Profil, Benachrichtigungen, Datenschutz).
tags: []
title: "Konto-Einstellungen: Profil-Edit, Avatar-Upload, Pause, Benachrichtigungen"
type: task
updated_at: 2026-05-13T10:49:28.645Z
---

## Approach

Server-Component-basierte UI in `apps/web/app/einstellungen/page.tsx` mit drei Tabs:
1. Profil: Klarname, Anzeigename, Stadt, Rollen (Mehrfachauswahl), Faehigkeiten, Avatar
2. Benachrichtigungen: `nutzer.benachrichtigungs_einstellungen` JSONB-Felder als Checkbox-Liste
3. Datenschutz: DSGVO-Self-Service-Buttons (kommt in task-dsgvo-export)

Server Actions fuer Updates. Validierung mit Zod-Schemas in `lib/validators/nutzer.ts` — gleichzeitig im Client (react-hook-form) und Server (POST/PATCH-Handler).

Avatar-Upload: Multipart-FormData → sharp resized zu 256x256 + 512x512 WebP → R2-Upload nach `avatare/<nutzer-id>-<size>.webp` → URL in `nutzer.avatar_url` speichern.

Konto-Pause: `nutzer.status='pausiert'`. Alle eigenen Werke werden via Sichtbarkeit weiterhin oeffentlich gezeigt (Pause bezieht sich nur auf neue Aktivitaet, nicht auf bisherige Inhalte).

## Pitfalls

- Klarname-Pflicht: wenn `rollen` `bedarfstraeger` oder `foerderer` enthaelt, muss `klarname` nicht-leer sein (App-Validierung in Zod).
- Avatar-Original wird NICHT gespeichert (DSGVO-Datenminimierung). Nur die zwei resized-Varianten.
- Benachrichtigungs-Einstellungen-Defaults: zentral in `lib/notifications/defaults.ts`, nicht hardcoded.

Started 2026-05-13T10:42:32.323Z: autobuild iter 5

Tests failing (exit 1): Implemented /api/v1/me CRUD + avatar + pause + /einstellungen UI with 3 tabs

```
$ pnpm -r typecheck
$ tsc --noEmit
$ pnpm -r test
$ vitest run
(node:44008) [DEP0205] DeprecationWarning: `module.register()` is deprecated. Use `module.registerHooks()` instead.
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

Done 2026-05-13T10:49:28.645Z: Implemented /api/v1/me CRUD + avatar + pause + /einstellungen UI with 3 tabs (Tests: green via `unset NODE_ENV && pnpm typecheck && pnpm test && NODE_ENV=production pnpm build`)
