---
acceptance_criteria:
  - "`apps/web/app/uebersicht/page.tsx` existiert und rendert fuer eingeloggte Nutzer:innen (status 200 mit gueltigem `wz_session`-Cookie)"
  - "Ohne Session: redirect (302/307) zu `/anmelden?next=/uebersicht`"
  - Server liest `test_saldo`-Werte und rendert sie; wenn kein Eintrag fuer den Nutzer existiert, werden 0/0/0 angezeigt (nicht 'undefined')
  - "Abmelden-Button: POST auf `/api/v1/auth/logout` + Redirect zu `/` (Integration-Test verifiziert: Cookie weg, naechster Request zu `/uebersicht` redirected zu `/anmelden`)"
  - "Sprach-Check: kein englischer String im HTML-Output"
created_at: 2026-05-13T11:32:03.048Z
created_by: human
edges:
  composed_of:
    - id: wp-glue-pages
  depends_on:
    - id: task-anmelden-page
effort: S
id: task-uebersicht-page
is_root: false
open_questions: []
owner: null
parent: wp-glue-pages
private: false
risks: []
status: done
summary: Server-Component-Seite unter /uebersicht fuer eingeloggte Nutzer:innen. Begruessung mit anzeigename, Test-Saldo-Anzeige (gegeben/erhalten/offen), Werkpass-Link, Abmelden-Button. Redirect zu /anmelden wenn keine Session.
tags: []
title: Uebersicht-Seite (Landing-Pad nach Login)
type: task
updated_at: 2026-05-13T12:15:14.449Z
---

## Approach

`apps/web/app/uebersicht/page.tsx` als Server Component. Liest Session via `getSession()` aus `lib/auth/session.ts`. Ohne Session → redirect zu `/anmelden?next=/uebersicht`.

Layout: schmale Spalte (max 720px), oben Begruessung 'Hallo, <anzeigename>', darunter drei Karten:
1. **Werkpass** — Avatar (oder Initialen), Klarname, Stadt, Link 'Werkpass bearbeiten' → `/einstellungen?tab=profil`.
2. **Test-Saldo** — gegeben N · erhalten M · offen K (mit Frist falls K>0). Liest aus `test_saldo`-Tabelle. Wenn kein Eintrag → '0 · 0 · 0' anzeigen.
3. **Schnellzugriff** — Liste mit drei Links: 'Meine Werke' (→ /werke fehlt noch, Stub OK), 'Meine Pruefrunden', 'Termine in Hamburg'. Diese Routen existieren noch nicht — wir verlinken mit einem `(in Vorbereitung)` Hinweis.

Unten ein 'Abmelden'-Button (Form POST an `/api/v1/auth/logout`, danach window.location.href = '/').

## Pitfalls

- Test-Saldo: die Tabelle wird erst gepflegt, wenn jemand wirklich Feedback gibt. Initial fehlt der Eintrag → coalesce(saldo.tests_gegeben, 0) usw.
- Stub-Links zu nicht existierenden Routen: deutlich als '(in Vorbereitung)' kennzeichnen, sonst wirkt's wie tote Links.
- Server Component + Form-POST: braucht ein Client-Component-Wrapper oder Server Action. Server Action ist sauberer.

Started 2026-05-13T12:07:00.234Z: autobuild glue iter 4

Tests failing (exit 1): Uebersicht-Page als Landing-Pad nach Login mit Werkpass/Test-Saldo/Schnellzugriff/Abmelden

```
-dom@19.0.0_react@19.0.0/node_modules/react-dom/cjs/react-dom-server.edge.development.js:8798:18)
    at renderWithHooks (/Users/udi/work/moinsen/ideas/werkzirkel/node_modules/.pnpm/react-dom@19.0.0_react@19.0.0/node_modules/react-dom/cjs/react-dom-server.edge.development.js:4722:19)
    at renderElement (/Users/udi/work/moinsen/ideas/werkzirkel/node_modules/.pnpm/react-dom@19.0.0_react@19.0.0/node_modules/react-dom/cjs/react-dom-server.edge.development.js:5157:23)
    at retryNode (/Users/udi/work/moinsen/ideas/werkzirkel/node_modules/.pnpm/react-dom@19.0.0_react@19.0.0/node_modules/react-dom/cjs/react-dom-server.edge.development.js:5805:22)
    at renderNodeDestructive (/Users/udi/work/moinsen/ideas/werkzirkel/node_modules/.pnpm/react-dom@19.0.0_react@19.0.0/node_modules/react-dom/cjs/react-dom-server.edge.development.js:5631:11)
    at renderElement (/Users/udi/work/moinsen/ideas/werkzirkel/node_modules/.pnpm/react-dom@19.0.0_react@19.0.0/node_modules/react-dom/cjs/react-dom-server.edge.development.js:5143:11)
    at retryNode (/Users/udi/work/moinsen/ideas/werkzirkel/node_modules/.pnpm/react-dom@19.0.0_react@19.0.0/node_modules/react-dom/cjs/react-dom-server.edge.development.js:5805:22)
    at renderNodeDestructive (/Users/udi/work/moinsen/ideas/werkzirkel/node_modules/.pnpm/react-dom@19.0.0_react@19.0.0/node_modules/react-dom/cjs/react-dom-server.edge.development.js:5631:11)
Export encountered an error on /_error: /500, exiting the build.
Error occurred prerendering page "/anmelden". Read more: https://nextjs.org/docs/messages/prerender-error
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
Export encountered an error on /anmelden/page: /anmelden, exiting the build.
 ⨯ Static worker exited with code: 1 and signal: null

```

Tests failing (exit 1): Uebersicht-Page als Landing-Pad nach Login mit Werkpass/Test-Saldo/Schnellzugriff/Abmelden

```
/react-dom@19.0.0_react@19.0.0/node_modules/react-dom/cjs/react-dom-server.edge.development.js:8798:18)
    at renderWithHooks (/Users/udi/work/moinsen/ideas/werkzirkel/node_modules/.pnpm/react-dom@19.0.0_react@19.0.0/node_modules/react-dom/cjs/react-dom-server.edge.development.js:4722:19)
    at renderElement (/Users/udi/work/moinsen/ideas/werkzirkel/node_modules/.pnpm/react-dom@19.0.0_react@19.0.0/node_modules/react-dom/cjs/react-dom-server.edge.development.js:5157:23)
    at retryNode (/Users/udi/work/moinsen/ideas/werkzirkel/node_modules/.pnpm/react-dom@19.0.0_react@19.0.0/node_modules/react-dom/cjs/react-dom-server.edge.development.js:5805:22)
    at renderNodeDestructive (/Users/udi/work/moinsen/ideas/werkzirkel/node_modules/.pnpm/react-dom@19.0.0_react@19.0.0/node_modules/react-dom/cjs/react-dom-server.edge.development.js:5631:11)
    at renderElement (/Users/udi/work/moinsen/ideas/werkzirkel/node_modules/.pnpm/react-dom@19.0.0_react@19.0.0/node_modules/react-dom/cjs/react-dom-server.edge.development.js:5143:11)
    at retryNode (/Users/udi/work/moinsen/ideas/werkzirkel/node_modules/.pnpm/react-dom@19.0.0_react@19.0.0/node_modules/react-dom/cjs/react-dom-server.edge.development.js:5805:22)
    at renderNodeDestructive (/Users/udi/work/moinsen/ideas/werkzirkel/node_modules/.pnpm/react-dom@19.0.0_react@19.0.0/node_modules/react-dom/cjs/react-dom-server.edge.development.js:5631:11)
Export encountered an error on /_error: /500, exiting the build.
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

Done 2026-05-13T12:15:14.449Z: Uebersicht-Page als Landing-Pad nach Login mit Werkpass/Test-Saldo/Schnellzugriff/Abmelden (Tests: green via `pnpm typecheck && pnpm test && NODE_ENV=production pnpm build`)
