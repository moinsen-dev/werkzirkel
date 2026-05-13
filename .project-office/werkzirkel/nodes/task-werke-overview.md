---
acceptance_criteria:
  - "`apps/web/app/werke/page.tsx` rendert oeffentlich die Werke-Liste mit Filter-Sidebar"
  - "KEIN Suchschlitz im Markup (Integration-Test verifiziert: keine `<input type=\"search\">` im HTML-Output, kein Input mit name='q' oder Aehnlichem)"
  - Filter Stadt + Werkstand + Hilfebedarf wirken als kombinierter URL-State (alle in searchParams), Server-Query berücksichtigt sie
  - Erfuellt PRD §F-103 (Werke-Filter nach Stand und Hilfebedarf, Stadtfilter implizit) vollstaendig
  - Cursor-basierte Pagination mit 20 pro Seite (`?cursor=<werk-id>`)
  - Inhaber:innen-Daten in der Liste enthalten KEINE email/klarname (Unit-Test prueft das gerenderte HTML)
created_at: 2026-05-13T12:39:12.091Z
created_by: human
edges:
  blocks:
    - id: task-zirkel-stadt-seite
  composed_of:
    - id: wp-werkpass-werke
  depends_on:
    - id: task-werk-detail-page
effort: S
id: task-werke-overview
is_root: false
open_questions: []
owner: null
parent: wp-werkpass-werke
private: false
risks: []
status: done
summary: Oeffentliche Seite /werke listet alle oeffentlichen Werke. Filter-Sidebar links (Stadt-Dropdown, Werkstand-Mehrfach-Checkbox, Hilfebedarf-Mehrfach-Checkbox), Sortier-Default aktualisiert_am DESC. KEIN Suchschlitz (P4 — Verbindlichkeit statt Rauschen). Pagination via Cursor.
tags: []
title: Werke-Uebersicht mit Filter-Sidebar (Stadt, Werkstand, Hilfebedarf)
type: task
updated_at: 2026-05-13T13:55:09.590Z
---

## Approach

`apps/web/app/werke/page.tsx` als Server Component. Liest searchParams:
- `stadt` (default 'hh' = Hamburg)
- `werkstand[]` (Mehrfach, default leer = alle)
- `hilfebedarf[]` (Mehrfach, default leer = alle)
- `sort` (default 'aktualisiert_am_desc'; weitere Optionen: 'erstellt_am_desc', 'sucht_aktiv_hilfe')
- `cursor` (default leer, pagination)

Server-Query via Drizzle: `db.select().from(werk).innerJoin(nutzer, ...).where(filter-conditions).orderBy(...).limit(20)`. Filter:
- `nutzer.stadt_id = stadt`
- werk.werkstand IN (werkstand_filter) wenn werkstand non-empty
- werk.hilfebedarf overlaps mit hilfebedarf_filter wenn hilfebedarf non-empty (Drizzle: `arrayOverlaps`)
- werk.sichtbarkeit = 'oeffentlich' AND werk.status = 'aktiv'

### Layout

- Nav-Bar oben
- Hero-Section minimal: H1 'Werke im Hamburger Zirkel' (basierend auf stadt-Filter), Subline 'N Werke gerade aktiv'
- Zwei Spalten:
  - Links (Sidebar): Filter
    - Stadt-Dropdown mit Hamburg/Berlin (in Vorbereitung disabled)/Muenchen (disabled). Werte aus stadt-Tabelle.
    - Werkstand-Checkbox-Gruppe (alle 6 Werkstand-Werte)
    - Hilfebedarf-Checkbox-Gruppe (alle 8 Hilfebedarf-Werte)
    - Sortierung-Dropdown
    - 'Filter anwenden'-Button (Form-Submit, alle Filter via URL-Params)
  - Rechts (Liste): Werk-Cards mit Name, Werkstand-Pill, Kurzbeschreibung, Hilfebedarf-Tags, 'Werk ansehen'-Link
- Wenn Liste leer: Empty-State mit ermutigendem deutschen Text ('Noch keine Werke fuer diese Filter-Kombination. Probier weniger restriktive Filter.')
- Pagination: 'Naechste 20 Werke' Link mit cursor-Param am Ende.

### Hard rules

- KEIN Suchschlitz, KEIN Such-Input. Nur Filter via Checkbox/Dropdown.
- Inhaber:innen-Daten nur public Felder (anzeigename, avatar, stadt — NICHT email/klarname).

## Pitfalls

- Drizzle `arrayOverlaps` exists für PG-array-Spalten: `arrayOverlaps(werk.hilfebedarf, [hb1, hb2])`. Pruefen ob's `@@` Operator-Mapping ist.
- Cursor-Pagination: cursor = letzte werk.id der vorherigen Seite. Where: `werk.id < cursor`. Konstant-Time aber muss `werk.id` indexiert sein.
- searchParams in App Router: Server Component bekommt sie als Promise.
- Wenn stadt='b' (Berlin, vorbereitung) gewaehlt wird: weiterhin laufen lassen, aber Empty-State zeigt 'Berlin startet, sobald Hamburg traegt. Aktuell noch keine Werke.'

Started 2026-05-13T13:46:38.245Z: autobuild werke iter 5

Done 2026-05-13T13:55:09.590Z: Werke-Übersicht /werke mit Filter-Sidebar (kein Suchschlitz), Cursor-Pagination, Werkstand-/Hilfebedarf-Multifilter, Berlin/München Empty-State (Tests: green via `pnpm exec vitest run`)
