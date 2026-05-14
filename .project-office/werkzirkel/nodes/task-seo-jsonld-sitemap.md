---
acceptance_criteria:
  - Erfüllt PRD §31 (SEO + JSON-LD + sitemap + robots + OpenGraph) vollständig
  - GET /sitemap.xml liefert alle public-Routen dynamisch (Werke, Werkpässe, Termine, Zirkel-Städte) + Cache-Header
  - GET /robots.txt verbietet /api/*, /admin/*, /kurator/*, /uebersicht/*, /einstellungen/*, /bedarfe/*, /werkangebote/* (auth-protected) und erlaubt public Routen
  - JSON-LD Schema.org-Block in jeder public-Route mit korrektem @type
  - T-801 stadt-digest-woechentlich Template + Cron /api/v1/cron/digest-newsletter implementiert
created_at: 2026-05-14T09:53:24.233Z
created_by: human
edges:
  composed_of:
    - id: polish-und-launch
effort: S
id: task-seo-jsonld-sitemap
is_root: false
open_questions: []
owner: null
parent: polish-und-launch
private: false
risks: []
status: done
summary: JSON-LD Schema.org (Organization, Event, Person, CreativeWork), dynamische sitemap.xml, robots.txt, OpenGraph-Meta, Stadt-Digest-Newsletter mit Cron Mittwoch 09:00.
tags: []
title: "SEO: JSON-LD, sitemap.xml, robots.txt, OpenGraph"
type: task
updated_at: 2026-05-14T10:16:28.840Z
---

## Approach

### SEO-Files

- app/sitemap.ts (Next-native): listet alle public-Routen + Werke + Werkpässe + Termine.
- app/robots.ts: erlaubt /werke, /termine, /zirkel, /; verbietet /api/, /admin/, /kurator/, /uebersicht/, /einstellungen/, /bedarfe/, /werkangebote/.
- Globales OpenGraph in RootLayout (image-Default).

### JSON-LD

- /: Organization-Schema (werkzirkel.de + sameAs)
- /werke/[id]: CreativeWork (existing — verifizieren)
- /werkpass/[id]: Person (limited)
- /termine/[id]: Event
- /zirkel/[stadt]: Place + organisierende Org

### Stadt-Digest-Newsletter

- Email-Template T-801 stadt-digest-woechentlich (in lib/email/templates/)
- Cron /api/v1/cron/digest-newsletter wöchentlich (Mittwoch 09:00) sendet an alle nutzer mit benachrichtigungs_einstellungen.stadt_digest=true (default true)
- Digest-Inhalte: 3 neueste Werke der Stadt, 2 nächste Termine, 2 offene Hilfegesuche

### Tests

- sitemap.xml-GET → 200 mit allen Routen.
- robots.txt-GET → expected directives.
- JSON-LD validates (mind. 1 Schema.org-Type pro Route).
- T-801 rendert und versendet (Mock-Mode).

Started 2026-05-14T10:01:38.636Z: autobuild polish iter 2

Done 2026-05-14T10:16:28.840Z: SEO: sitemap + robots + JSON-LD + Stadt-Digest-Newsletter T-801 (Tests: green via `cd /Users/udi/work/moinsen/ideas/werkzirkel/apps/web && pnpm exec vitest run`)
