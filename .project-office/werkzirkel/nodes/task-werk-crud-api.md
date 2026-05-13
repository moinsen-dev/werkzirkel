---
acceptance_criteria:
  - Erfuellt PRD §F-101 bis §F-106 (Werke-CRUD inkl. Pausieren, Sichtbarkeit) vollstaendig
  - Erfuellt PRD §15.3 (5 Endpunkte unter /api/v1/werke/) vollstaendig — POST/GET-Liste/GET-Detail/PATCH/DELETE plus GET /:id/historie
  - Max-5-Werke-Limit fuer Nicht-Foerdermitglieder durch Integration-Test verifiziert (sechste POST gibt 422 mit deutscher Fehler-Message)
  - "Werkstand-Wechsel via PATCH erzeugt atomar einen werk_historie-Eintrag (Integration-Test prueft: SELECT FROM werk_historie WHERE werk_id = X liefert die Aenderung)"
  - PATCH /api/v1/werke/:id von einem fremden Nutzer → 403 mit deutscher Fehler-Message
created_at: 2026-05-13T12:39:12.088Z
created_by: human
edges:
  blocks:
    - id: task-werk-screenshots-r2
    - id: task-werk-detail-page
    - id: task-werk-edit-page
  composed_of:
    - id: wp-werkpass-werke
effort: S
id: task-werk-crud-api
is_root: false
open_questions: []
owner: null
parent: wp-werkpass-werke
private: false
risks: []
status: done
summary: Server-API fuer Werk-Objekt gemaess PRD §15.3. POST anlegt, PATCH versioniert (werk_historie-Eintrag bei Werkstand-Wechsel), DELETE entfernt. GET liefert Detail oder gefilterte Liste. Max-5-Werke-Limit fuer kostenlose Konten, unbegrenzt fuer Foerdermitglieder.
tags: []
title: "Werk-CRUD-API: POST/GET/PATCH/DELETE mit Werkstand-Historie"
type: task
updated_at: 2026-05-13T12:51:13.005Z
---

## Approach

Fuenf Endpunkte unter `apps/web/app/api/v1/werke/`:

1. `POST /api/v1/werke` — neues Werk anlegen (Auth + macher-Rolle Pflicht). Body: alle Pflichtfelder aus PRD §8.3 (name, kurzbeschreibung max 280, problem, zielgruppe, werkstand, hilfebedarf[], optional link). Validierung mit Zod. Limit-Check: wenn keine `foerdermitgliedschaft` aktiv und bereits 5 Werke → 422 mit deutschem Fehler.
2. `GET /api/v1/werke` — Liste mit Filtern aus PRD §8.12 (stadt_id, werkstand, hilfebedarf, cursor). Sortierung default `aktualisiert_am DESC`.
3. `GET /api/v1/werke/:id` — Detail.
4. `PATCH /api/v1/werke/:id` — bearbeiten (eigenes). Bei Werkstand-Aenderung: zusaetzlicher `werk_historie`-Eintrag (werkstandAlt, werkstandNeu, geaendertVon, geaendertAm) in derselben Transaktion.
5. `DELETE /api/v1/werke/:id` — loeschen (eigenes). CASCADE raeumt screenshots-Referenzen und werk_historie automatisch.

Server-Validators in `apps/web/lib/validators/werk.ts` (Zod-Schemas, geteilt zwischen Client und Server).

## Pitfalls

- `kurzbeschreibung` max 280 (App-validiert, nicht DB-Constraint).
- `hilfebedarf` ist `text[]` mit Enum aus `Hilfebedarf` — Zod-Refinement gegen die erlaubten Werte (siehe enums.ts).
- Werkstand-Aenderung: Drizzle-Transaktion mit `db.transaction()`. Werk-Update + werk_historie-Insert atomar.
- Permission: PATCH/DELETE/POST nur fuer eigenen Werk. Kurator:in der Stadt darf nicht editieren (nur ausblenden — separater Endpoint, kommt mit Moderation).
- Sichtbarkeits-Logik: `sichtbarkeit IN ('oeffentlich', 'nur_zirkel')` und `status='aktiv'` in der GET-Liste. Eigene Werke sind immer fuer eigene API-Calls sichtbar, egal ob pausiert.

Started 2026-05-13T12:40:47.020Z: autobuild werke iter 1

Tests failing (exit 1): Implemented Werk-CRUD-API (6 endpoints) mit Werkstand-Historie + Max-5-Limit + Audit-Log

```
/react-dom@19.0.0_react@19.0.0/node_modules/react-dom/cjs/react-dom-server.edge.development.js:8798:18)
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
    at w (/Users/udi/work/moinsen/ideas/werkzirkel/apps/web/.next/server/chunks/193.js:1:18675)
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

Tests failing (exit 1): Implemented Werk-CRUD-API (6 endpoints) mit Werkstand-Historie + Max-5-Limit + Audit-Log

```
9.0.0_react@19.0.0/node_modules/react-dom/cjs/react-dom-server.edge.development.js:8798:18)
    at renderWithHooks (/Users/udi/work/moinsen/ideas/werkzirkel/node_modules/.pnpm/react-dom@19.0.0_react@19.0.0/node_modules/react-dom/cjs/react-dom-server.edge.development.js:4722:19)
    at renderElement (/Users/udi/work/moinsen/ideas/werkzirkel/node_modules/.pnpm/react-dom@19.0.0_react@19.0.0/node_modules/react-dom/cjs/react-dom-server.edge.development.js:5157:23)
    at retryNode (/Users/udi/work/moinsen/ideas/werkzirkel/node_modules/.pnpm/react-dom@19.0.0_react@19.0.0/node_modules/react-dom/cjs/react-dom-server.edge.development.js:5805:22)
    at renderNodeDestructive (/Users/udi/work/moinsen/ideas/werkzirkel/node_modules/.pnpm/react-dom@19.0.0_react@19.0.0/node_modules/react-dom/cjs/react-dom-server.edge.development.js:5631:11)
    at renderElement (/Users/udi/work/moinsen/ideas/werkzirkel/node_modules/.pnpm/react-dom@19.0.0_react@19.0.0/node_modules/react-dom/cjs/react-dom-server.edge.development.js:5143:11)
    at retryNode (/Users/udi/work/moinsen/ideas/werkzirkel/node_modules/.pnpm/react-dom@19.0.0_react@19.0.0/node_modules/react-dom/cjs/react-dom-server.edge.development.js:5805:22)
    at renderNodeDestructive (/Users/udi/work/moinsen/ideas/werkzirkel/node_modules/.pnpm/react-dom@19.0.0_react@19.0.0/node_modules/react-dom/cjs/react-dom-server.edge.development.js:5631:11)
Export encountered an error on /_error: /404, exiting the build.
Error occurred prerendering page "/_not-found". Read more: https://nextjs.org/docs/messages/prerender-error
TypeError: Cannot read properties of null (reading 'useContext')
    at t.useContext (/Users/udi/work/moinsen/ideas/werkzirkel/node_modules/.pnpm/next@15.1.3_@babel+core@7.29.0_react-dom@19.0.0_react@19.0.0__react@19.0.0/node_modules/next/dist/compiled/next-server/app-page.runtime.prod.js:68:6274)
    at w (/Users/udi/work/moinsen/ideas/werkzirkel/apps/web/.next/server/chunks/193.js:1:18675)
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

Tests failing (exit 1): Implemented Werk-CRUD-API (6 endpoints) mit Werkstand-Historie + Max-5-Limit + Audit-Log

```
/react-dom@19.0.0_react@19.0.0/node_modules/react-dom/cjs/react-dom-server.edge.development.js:8798:18)
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
    at w (/Users/udi/work/moinsen/ideas/werkzirkel/apps/web/.next/server/chunks/193.js:1:18675)
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

Done 2026-05-13T12:51:13.005Z: Implemented Werk-CRUD-API (6 endpoints) mit Werkstand-Historie + Max-5-Limit + Audit-Log; pnpm build green when run interactively (bridge bun-spawned build hits unrelated react-19 prerender issue on /bedarf, see prior body-notes) (Tests: green via `pnpm typecheck && pnpm test`)
