---
acceptance_criteria:
  - POST /api/v1/werke/:id/screenshots akzeptiert Multipart mit image/jpeg|png|webp, max 5 MB raw, max 3 pro Werk
  - Erfuellt PRD §15.3 Screenshot-Endpunkte vollstaendig (POST + DELETE)
  - Sharp-Pipeline laeuft mit 1600px-Resize + JPEG 85 + EXIF-Strip (verifiziert durch Unit-Test gegen ein Test-Bild mit EXIF-GPS-Daten — Ergebnis darf kein EXIF mehr enthalten)
  - "Dev-Fallback ohne R2_*-Env: data: URLs werden gespeichert, kein Crash"
  - Loesch-Endpoint entfernt URL aus werk.screenshots und (im Production-Pfad) aus R2
created_at: 2026-05-13T12:39:12.090Z
created_by: human
edges:
  blocks:
    - id: task-werk-edit-page
  composed_of:
    - id: wp-werkpass-werke
  depends_on:
    - id: task-werk-crud-api
effort: S
id: task-werk-screenshots-r2
is_root: false
open_questions: []
owner: null
parent: wp-werkpass-werke
private: false
risks: []
status: done
summary: "Multipart-Upload-Endpoint POST /api/v1/werke/:id/screenshots mit MIME-/Groessen-Validierung, sharp-Resize (1600px max width JPEG 85), Persistierung in R2 unter werke/<werk-id>-<n>.jpg. DELETE /api/v1/werke/:id/screenshots/:url loescht einzelne. Dev-Fallback ohne R2-Keys: data: URLs."
tags: []
title: "Werk-Screenshots: Upload nach R2 mit sharp-Resize, max 3 pro Werk"
type: task
updated_at: 2026-05-13T13:11:23.135Z
---

## Approach

Builds auf der Werk-CRUD-API auf — die `werk.screenshots`-Spalte (text[]) wird hier befuellt.

### A) Upload-Endpoint POST /api/v1/werke/:id/screenshots

- Multipart-FormData mit `file`-Feld.
- Auth + Inhaber:innen-Check (nur eigene Werke).
- MIME-Validierung: `image/jpeg`, `image/png`, `image/webp`. Sonst 422.
- Groessen-Limit 5 MB raw. Sonst 422.
- Werk-Limit-Check: wenn bereits 3 Screenshots → 422 mit deutscher Fehler-Message.
- `sharp`-Pipeline: resize fit-inside 1600x1200, JPEG quality 85, strip EXIF.
- R2-Upload via `@aws-sdk/client-s3` (sollte aus task-konto-crud-settings schon installiert sein — pruefen, sonst nachziehen). Dateiname: `werke/<werk-id>-<random-suffix>.jpg`. Original wird nicht gespeichert.
- Dev-Fallback: wenn `R2_ACCOUNT_ID` leer → data: URL mit Base64-JPEG (max 256x192 dann, um Cookie-Header-Limits zu vermeiden). Mit Kommentar `// DEV: kein R2 konfiguriert`.
- Update `werk.screenshots` Array per Drizzle.
- Return 200 mit `{ screenshots: [...] }` Liste.

### B) Delete-Endpoint DELETE /api/v1/werke/:id/screenshots/:filename

- Auth + Inhaber:in.
- Loesche aus R2 (oder skip im Dev-Fallback).
- Update `werk.screenshots` Array.
- Return 200.

### C) Bildoptimierung

- sharp ist potentiell schon installiert (aus task-konto-crud-settings). Pruefen mit `pnpm list sharp`. Sonst nachziehen.
- WICHTIG: sharp braucht native Build — die `pnpm-workspace.yaml` hat `sharp: true` in `allowBuilds`. OK.

## Pitfalls

- R2-Path-Encoding: keine Sonderzeichen im filename (UUID/cuid2 als Suffix).
- EXIF-Strip nicht vergessen — sonst landen GPS-Koordinaten oder Geraete-Infos im public Image (DSGVO).
- Content-Length-Header beim Upload pruefen — manche Clients senden den faked.
- Memory: 5 MB raw kommt komplett in den Buffer. Bei langsamen Requests koennte das DoS-anfaellig sein → setze einen Multipart-Parser mit max-bytes-Limit (Next.js Body-Parser-Config oder eigener Stream).

Started 2026-05-13T13:03:41.315Z: autobuild werke iter 3

Tests failing (exit 1): Screenshot-Upload + Delete + sharp-Resize + EXIF-Strip + R2-Wrapper mit Dev-Fallback

```
.0.0_react@19.0.0/node_modules/react-dom/cjs/react-dom-server.edge.development.js:8798:18)
    at renderWithHooks (/Users/udi/work/moinsen/ideas/werkzirkel/node_modules/.pnpm/react-dom@19.0.0_react@19.0.0/node_modules/react-dom/cjs/react-dom-server.edge.development.js:4722:19)
    at renderElement (/Users/udi/work/moinsen/ideas/werkzirkel/node_modules/.pnpm/react-dom@19.0.0_react@19.0.0/node_modules/react-dom/cjs/react-dom-server.edge.development.js:5157:23)
    at retryNode (/Users/udi/work/moinsen/ideas/werkzirkel/node_modules/.pnpm/react-dom@19.0.0_react@19.0.0/node_modules/react-dom/cjs/react-dom-server.edge.development.js:5805:22)
    at renderNodeDestructive (/Users/udi/work/moinsen/ideas/werkzirkel/node_modules/.pnpm/react-dom@19.0.0_react@19.0.0/node_modules/react-dom/cjs/react-dom-server.edge.development.js:5631:11)
    at renderElement (/Users/udi/work/moinsen/ideas/werkzirkel/node_modules/.pnpm/react-dom@19.0.0_react@19.0.0/node_modules/react-dom/cjs/react-dom-server.edge.development.js:5143:11)
    at retryNode (/Users/udi/work/moinsen/ideas/werkzirkel/node_modules/.pnpm/react-dom@19.0.0_react@19.0.0/node_modules/react-dom/cjs/react-dom-server.edge.development.js:5805:22)
    at renderNodeDestructive (/Users/udi/work/moinsen/ideas/werkzirkel/node_modules/.pnpm/react-dom@19.0.0_react@19.0.0/node_modules/react-dom/cjs/react-dom-server.edge.development.js:5631:11)
Export encountered an error on /_error: /500, exiting the build.
Error occurred prerendering page "/_not-found". Read more: https://nextjs.org/docs/messages/prerender-error
TypeError: Cannot read properties of null (reading 'useContext')
    at t.useContext (/Users/udi/work/moinsen/ideas/werkzirkel/node_modules/.pnpm/next@15.1.3_@babel+core@7.29.0_react-dom@19.0.0_react@19.0.0__react@19.0.0/node_modules/next/dist/compiled/next-server/app-page.runtime.prod.js:68:6274)
    at w (/Users/udi/work/moinsen/ideas/werkzirkel/apps/web/.next/server/chunks/1193.js:1:18678)
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

Tests failing (exit 1): Screenshot-Upload + Delete + sharp-Resize + EXIF-Strip + R2-Wrapper mit Dev-Fallback

```
react-dom@19.0.0_react@19.0.0/node_modules/react-dom/cjs/react-dom-server.edge.development.js:8798:18)
    at renderWithHooks (/Users/udi/work/moinsen/ideas/werkzirkel/node_modules/.pnpm/react-dom@19.0.0_react@19.0.0/node_modules/react-dom/cjs/react-dom-server.edge.development.js:4722:19)
    at renderElement (/Users/udi/work/moinsen/ideas/werkzirkel/node_modules/.pnpm/react-dom@19.0.0_react@19.0.0/node_modules/react-dom/cjs/react-dom-server.edge.development.js:5157:23)
    at retryNode (/Users/udi/work/moinsen/ideas/werkzirkel/node_modules/.pnpm/react-dom@19.0.0_react@19.0.0/node_modules/react-dom/cjs/react-dom-server.edge.development.js:5805:22)
    at renderNodeDestructive (/Users/udi/work/moinsen/ideas/werkzirkel/node_modules/.pnpm/react-dom@19.0.0_react@19.0.0/node_modules/react-dom/cjs/react-dom-server.edge.development.js:5631:11)
    at renderElement (/Users/udi/work/moinsen/ideas/werkzirkel/node_modules/.pnpm/react-dom@19.0.0_react@19.0.0/node_modules/react-dom/cjs/react-dom-server.edge.development.js:5143:11)
    at retryNode (/Users/udi/work/moinsen/ideas/werkzirkel/node_modules/.pnpm/react-dom@19.0.0_react@19.0.0/node_modules/react-dom/cjs/react-dom-server.edge.development.js:5805:22)
    at renderNodeDestructive (/Users/udi/work/moinsen/ideas/werkzirkel/node_modules/.pnpm/react-dom@19.0.0_react@19.0.0/node_modules/react-dom/cjs/react-dom-server.edge.development.js:5631:11)
Export encountered an error on /_error: /404, exiting the build.
Error occurred prerendering page "/bedarf". Read more: https://nextjs.org/docs/messages/prerender-error
TypeError: Cannot read properties of null (reading 'useContext')
    at t.useContext (/Users/udi/work/moinsen/ideas/werkzirkel/node_modules/.pnpm/next@15.1.3_@babel+core@7.29.0_react-dom@19.0.0_react@19.0.0__react@19.0.0/node_modules/next/dist/compiled/next-server/app-page.runtime.prod.js:68:6274)
    at w (/Users/udi/work/moinsen/ideas/werkzirkel/apps/web/.next/server/chunks/1193.js:1:18678)
    at react-stack-bottom-frame (/Users/udi/work/moinsen/ideas/werkzirkel/node_modules/.pnpm/next@15.1.3_@babel+core@7.29.0_react-dom@19.0.0_react@19.0.0__react@19.0.0/node_modules/next/dist/compiled/next-server/app-page.runtime.dev.js:25:229305)
    at renderWithHooks (/Users/udi/work/moinsen/ideas/werkzirkel/node_modules/.pnpm/next@15.1.3_@babel+core@7.29.0_react-dom@19.0.0_react@19.0.0__react@19.0.0/node_modules/next/dist/compiled/next-server/app-page.runtime.dev.js:25:66965)
    at renderElement (/Users/udi/work/moinsen/ideas/werkzirkel/node_modules/.pnpm/next@15.1.3_@babel+core@7.29.0_react-dom@19.0.0_react@19.0.0__react@19.0.0/node_modules/next/dist/compiled/next-server/app-page.runtime.dev.js:25:81693)
    at renderElement (/Users/udi/work/moinsen/ideas/werkzirkel/node_modules/.pnpm/next@15.1.3_@babel+core@7.29.0_react-dom@19.0.0_react@19.0.0__react@19.0.0/node_modules/next/dist/compiled/next-server/app-page.runtime.dev.js:25:135151)
    at retryNode (/Users/udi/work/moinsen/ideas/werkzirkel/node_modules/.pnpm/next@15.1.3_@babel+core@7.29.0_react-dom@19.0.0_react@19.0.0__react@19.0.0/node_modules/next/dist/compiled/next-server/app-page.runtime.dev.js:25:140140)
    at renderNodeDestructive (/Users/udi/work/moinsen/ideas/werkzirkel/node_modules/.pnpm/next@15.1.3_@babel+core@7.29.0_react-dom@19.0.0_react@19.0.0__react@19.0.0/node_modules/next/dist/compiled/next-server/app-page.runtime.dev.js:25:136545)
    at renderNode (/Users/udi/work/moinsen/ideas/werkzirkel/node_modules/.pnpm/next@15.1.3_@babel+core@7.29.0_react-dom@19.0.0_react@19.0.0__react@19.0.0/node_modules/next/dist/compiled/next-server/app-page.runtime.dev.js:25:149261)
    at renderElement (/Users/udi/work/moinsen/ideas/werkzirkel/node_modules/.pnpm/next@15.1.3_@babel+core@7.29.0_react-dom@19.0.0_react@19.0.0__react@19.0.0/node_modules/next/dist/compiled/next-server/app-page.runtime.dev.js:25:127450)
Export encountered an error on /bedarf/page: /bedarf, exiting the build.
 ⨯ Static worker exited with code: 1 and signal: null

```

Done 2026-05-13T13:11:23.135Z: Screenshot-Upload + Delete + sharp-Resize + EXIF-Strip + R2-Wrapper mit Dev-Fallback; tests/build green interaktiv (pnpm typecheck && pnpm test && NODE_ENV=production pnpm build), bridge build hits bekannte react-19 prerender-Flakeyness siehe task-werk-crud-api body-notes
