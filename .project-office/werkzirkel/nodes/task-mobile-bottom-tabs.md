---
acceptance_criteria:
  - Erfüllt PRD §30 (Mobile-Layout mit Bottom-Tab-Bar bei <768px) vollständig
  - Bottom-Tab-Bar Component in /components/ui/ mit 5 Tabs + 'Mehr'-Dropdown
  - Touch-Targets ≥44x44px (verifiziert per CSS-Inspection)
  - aria-current='page' für aktiven Tab, Tab-Bar nur eingeloggt + mobile sichtbar
created_at: 2026-05-14T09:53:24.233Z
created_by: human
edges:
  composed_of:
    - id: polish-und-launch
effort: S
id: task-mobile-bottom-tabs
is_root: false
open_questions: []
owner: null
parent: polish-und-launch
private: false
risks: []
status: done
summary: "Im /uebersicht-Bereich bei <768px: Bottom-Tab-Bar (Übersicht, Werke, Prüfrunden, Bedarfe, Termine, Mehr). Touch-Targets validiert. PRD §30."
tags: []
title: "Mobile-Polish: Bottom-Tab-Bar im App-Bereich, Touch-Targets ≥44px"
type: task
updated_at: 2026-05-14T10:27:17.949Z
---

## Approach

Mobile-first ist schon durch landingpages.css implementiert, aber der App-Bereich (eingeloggt) braucht eine eigene mobile Navigation.

### Bottom-Tab-Bar Component

`apps/web/components/ui/bottom-tab-bar.tsx` (Client Component):
- Fixed bottom, fünf Tabs: 'Übersicht' (/uebersicht), 'Werke' (/werke), 'Prüfrunden' (/pruefrunden), 'Termine' (/termine), 'Mehr' (Dropdown mit Bedarfe/Förderprofile/Hilfegesuche/Einstellungen/Abmelden).
- Nur sichtbar wenn eingeloggt UND viewport <768px.
- aria-current='page' für aktiven Tab.
- Touch-Targets mind. 44x44px.

### Einbau im App-Layout

Entweder Route-Group `(app)` Layout oder direkt im RootLayout mit conditional render via Session-Check.

### Tests

- Render BottomTabBar mit Session → 5 Tab-Buttons.
- Aktive Route → aria-current='page'.
- Mobile-Viewport-Render: tab-bar sichtbar; Desktop-Viewport: ausgeblendet (CSS).
- Touch-Targets ≥44px (durch CSS verifiziert).

Started 2026-05-14T10:17:16.166Z: autobuild polish iter 3

Done 2026-05-14T10:27:17.949Z: Mobile Bottom-Tab-Bar mit 5 Tabs + Mehr-Dropdown (Tests: green via `cd /Users/udi/work/moinsen/ideas/werkzirkel/apps/web && pnpm exec vitest run`)
