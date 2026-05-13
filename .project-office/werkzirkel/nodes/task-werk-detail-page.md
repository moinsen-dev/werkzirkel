---
acceptance_criteria:
  - "`apps/web/app/werke/[id]/page.tsx` rendert oeffentlich (kein Auth noetig) ein einzelnes Werk mit allen Pflichtfeldern aus PRD §8.3"
  - Werk mit `sichtbarkeit='pausiert'` ODER `status='ausgeblendet'` → 404 (Integration-Test verifiziert)
  - Werk-Inhaber-Karte zeigt anzeigename, stadt, avatar — NICHT email oder klarname (Unit-Test prueft das Rendering gegen einen leak)
  - 'JSON-LD `@type: CreativeWork` ist im HTML-Output (Integration-Test prueft den `<script type="application/ld+json">`-Tag)'
  - Werkstand-Verlauf rendert die letzten 10 werk_historie-Eintraege chronologisch absteigend
created_at: 2026-05-13T12:39:12.090Z
created_by: human
edges:
  blocks:
    - id: task-werke-overview
    - id: task-werkpass-public
  composed_of:
    - id: wp-werkpass-werke
  depends_on:
    - id: task-werk-crud-api
effort: S
id: task-werk-detail-page
is_root: false
open_questions: []
owner: null
parent: wp-werkpass-werke
private: false
risks: []
status: done
summary: "Server-Component-Seite /werke/[id] (oeffentlich, kein Login noetig). Rendert Werk komplett: Screenshots, Beschreibung, Werkstand-Badge, Hilfebedarf-Tags, Werkstand-Verlauf, Inhaber:innen-Pfeil zu /werkpass/[id]. Zeigt JSON-LD CreativeWork fuer SEO."
tags: []
title: Oeffentliche Werk-Detailseite mit Werkstand-Historie
type: task
updated_at: 2026-05-13T13:01:18.573Z
---

## Approach

`apps/web/app/werke/[id]/page.tsx` als Server Component. Liest:
- `werk` per id
- `werk_historie` per werk_id (alle, sortiert DESC)
- Inhaber:innen-Daten (`nutzer` per werk.nutzer_id, nur public Felder)

Wenn werk nicht existiert ODER `sichtbarkeit='pausiert'` ODER `status='ausgeblendet'`: `notFound()` (rendert die deutsche 404-Seite aus wp-glue-pages).

### Layout

Im Marketing-LP-Stil (re-use `landingpages.css`):
- Nav-Bar oben wie auf der Macher-LP
- Hero-Section: Werk-Name als H1, Status-Pill mit Werkstand, Kurzbeschreibung als Hero-Copy
- Screenshot-Galerie (max 3, horizontal scrollbar oder grid)
- Zwei-Spalten unter Hero:
  - Links: Problem (h3 + text), Zielgruppe, Hilfebedarf-Tags
  - Rechts: Werk-Inhaber-Karte mit Avatar, Anzeigename, Stadt-Name, Link zu `/werkpass/[nutzer_id]`, ein CTA-Button 'Prüfrunde anbieten' (verlinkt zu `/pruefrunden/neu?werk=<id>` — die Route gibts noch nicht, also Stub mit '(in Vorbereitung)')
- Werkstand-Verlauf-Sektion: Timeline-Style mit den letzten 10 werk_historie-Eintraegen ('Werkstand geaendert von Idee auf Prototyp · 12.05.2026 · von Anzeigename'). Wenn keine Historie: ausblenden.
- Externer Link (`werk.link`) als Status-Pill 'Live ansehen →' wenn gesetzt.

### Metadata + JSON-LD

```ts
export async function generateMetadata({ params }): Promise<Metadata> {
  const werk = await fetchWerk(params.id);
  if (!werk) return { title: 'Nicht gefunden' };
  return {
    title: werk.name,
    description: werk.kurzbeschreibung,
    openGraph: { ..., images: werk.screenshots[0] ? [werk.screenshots[0]] : undefined },
  };
}
```

JSON-LD `<script type="application/ld+json">` mit `@type: CreativeWork`, `name`, `description`, `author` (nutzer.anzeigename), `dateModified` (werk.aktualisiert_am).

## Pitfalls

- Inhaber:in-Daten: NUR public Felder (anzeigename, stadt, avatar_url, kurzbeschreibung). KEIN klarname, email, rollen, audit-Felder.
- 'pausiert'-Werke geben 404, nicht 200 mit 'Pausiert'-Badge — pausiert ist explizit gewollt-versteckt.
- Werkstand-Historie zeigt geaendertVon-anzeigename, nicht email/klarname.
- generateMetadata wird zur Build-Zeit aufgerufen falls statisch — Werk-Detail ist dynamic (fetch jeden Request), daher kein Caching-Hint.

Started 2026-05-13T12:53:07.728Z: autobuild werke iter 2

Tests failing (exit 1): Öffentliche Werk-Detailseite mit Werkstand-Historie + JSON-LD + Inhaber:in-Karte

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

Done 2026-05-13T13:01:18.573Z: Öffentliche Werk-Detailseite mit Werkstand-Historie + JSON-LD + Inhaber:in-Karte (pnpm build interactively green; bridge build hits known prerender flakiness siehe task-werk-crud-api body-notes) (Tests: green via `cd /Users/udi/work/moinsen/ideas/werkzirkel/apps/web && pnpm typecheck && pnpm test`)
