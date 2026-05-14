---
acceptance_criteria:
  - Erfüllt PRD §32 (Performance-Budgets LCP <2.5s, CLS <0.1, JS <200kb) — Lighthouse-CI in GitHub Actions verifiziert pro PR
  - .lighthouserc.json mit allen Budget-Asserts
  - Bundle-Size-Check als pnpm-Script + im CI-Workflow
  - "Image-Optimization: alle Avatar/Screenshot via next/image Komponente"
created_at: 2026-05-14T09:53:24.233Z
created_by: human
edges:
  composed_of:
    - id: polish-und-launch
effort: S
id: task-performance-budget-monitoring
is_root: false
open_questions: []
owner: null
parent: polish-und-launch
private: false
risks: []
status: done
summary: Lighthouse-CI mit Performance-Budgets in PRD §32. Bundle-Size-Check. Image-Optimization. Server-Component-Konsolidierung wo möglich.
tags: []
title: "Performance: LCP <2.5s, CLS <0.1, JS-Bundle <200kb, p95 API <300ms — CI-Check"
type: task
updated_at: 2026-05-14T10:52:47.867Z
---

## Approach

Lighthouse-CI bringt automatische Performance-Budgets.

### CI-Setup

.github/workflows/lighthouse.yml erweitert: nicht nur Accessibility, auch Performance-Budget:
```yml
- name: Lighthouse-CI
  run: npx lighthouse-ci --config .lighthouserc.json
```

.lighthouserc.json mit Budget:
```json
{
  "ci": {
    "assert": {
      "assertions": {
        "largest-contentful-paint": ["error", {"maxNumericValue": 2500}],
        "cumulative-layout-shift": ["error", {"maxNumericValue": 0.1}],
        "total-byte-weight": ["error", {"maxNumericValue": 1000000}],
        "unused-javascript": ["warn", {"maxNumericValue": 50000}]
      }
    }
  }
}
```

### Bundle-Size-Check

New script `pnpm bundle-size`: parsed Next-Build-Output, fails wenn Initial-Load-JS >200kb.

### Image-Optimization

Next-Image-Komponente für alle Avatar- und Screenshot-Renderings (statt <img>). Auto-AVIF/WebP.

### Server-Component-Pass

Review alle 'use client'-Komponenten: nur halten wenn Interaktivität wirklich nötig (z.B. melden-button, screenshot-uploader, bottom-tab-bar). Rest auf Server konsolidieren.

### Tests

- bundle-size-check script funktional (test-mode mit Mock-Build-Output).
- Lighthouse-CI in GitHub Actions liefert Performance-Budget-Asserts.

Started 2026-05-14T10:38:00.868Z: autobuild polish iter 4

Done 2026-05-14T10:52:47.867Z: Performance-Budgets in Lighthouse-CI + Bundle-Size-Check + next/image (Tests: green via `cd /Users/udi/work/moinsen/ideas/werkzirkel/apps/web && pnpm exec vitest run`)
