---
acceptance_criteria:
  - Erfüllt PRD §29 (BITV/WCAG 2.1 AA + axe-core in CI + Lighthouse Accessibility ≥95) vollständig
  - axe-core läuft als Integration-Test gegen alle public-Routen — 0 violations als Akzeptanz
  - Skip-Link 'Zum Hauptinhalt' im RootLayout, Fokus-Outlines konsistent über alle Pages
  - .github/workflows/lighthouse.yml in CI integriert, blockiert PR wenn Accessibility <95
created_at: 2026-05-14T09:53:24.232Z
created_by: human
edges:
  composed_of:
    - id: polish-und-launch
effort: S
id: task-a11y-bitv-wcag
is_root: false
open_questions: []
owner: null
parent: polish-und-launch
private: false
risks: []
status: done
summary: Alle public-Routen auf BITV/WCAG 2.1 AA bringen. axe-core in CI integriert. Lighthouse-Score Accessibility ≥95. Fokus-Outlines, Skip-Links, ARIA-Live-Regions, alt-Texte.
tags: []
title: "Accessibility-Audit: BITV/WCAG 2.1 AA, axe-core in CI, Lighthouse ≥95"
type: task
updated_at: 2026-05-14T10:00:47.231Z
---

## Approach

Die BITV (Barrierefreie-Informationstechnik-Verordnung) ist für Werkzirkel relevant — staatliche Förderung (PRD §43) erwartet WCAG AA.

### Schritte

1. axe-core als devDependency installieren: `pnpm --filter @werkzirkel/web add -D @axe-core/playwright axe-core`.
2. Vitest-Integration-Test pro public-Route mit `axe.run(html)`-Assertion (oder Stub via happy-dom).
3. Manuelle Audits:
   - Skip-Link 'Zum Hauptinhalt' in RootLayout
   - Fokus-Outlines konsistent (2px solid accent, 2px Offset) — globals.css verifizieren
   - aria-current='page' auf Nav-Links
   - aria-live-Regionen für Status-Toasts
   - alt-Texte für alle <img> (Auto-Fallback aus werk.name etc.)
   - Form-Labels mit htmlFor
   - role + aria-describedby für Fehler-Banner
4. Lighthouse-CI-Workflow (.github/workflows/lighthouse.yml) der bei jedem Push Lighthouse Accessibility-Score gegen die 5 Hauptrouten misst und failt wenn <95.
5. Bessere Kontraste: globals.css → ggf. --color-muted oder --color-border anpassen wenn axe Kontrast-Issues meldet.

### Tests

- `tests/integration/a11y-axe.test.ts`: pro public-Route (/, /werke, /bedarfe, /foerderprofile, /termine, /hilfegesuche, /anmelden) → axe.run() ohne violations.
- CI .github/workflows/lighthouse.yml falsifies wenn Accessibility <95.

Started 2026-05-14T09:53:51.714Z: autobuild polish iter 1

Done 2026-05-14T10:00:47.231Z: BITV/WCAG 2.1 AA: axe-core in CI, Skip-Link, Fokus-Outlines (Tests: green via `cd /Users/udi/work/moinsen/ideas/werkzirkel/apps/web && pnpm exec vitest run`)
