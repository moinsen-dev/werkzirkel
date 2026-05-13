---
acceptance_criteria: []
created_at: 2026-05-13T09:45:23.143Z
created_by: human
edges:
  decision_affects:
    - id: design-system-decision
id: design-system-pick
is_root: false
open_questions: []
owner: null
private: false
risks: []
status: done
summary: Custom OKLCH-Tokens + Tailwind 4 @theme, keine externe UI-Library
tags: []
title: Custom OKLCH-Tokens + Tailwind 4 @theme, keine externe UI-Library
type: decision
updated_at: 2026-05-13T09:45:23.143Z
---

Design-Tokens in apps/web/design/tokens.ts (TS) und @theme-Block in app/globals.css (CSS) als Single Source of Truth. Farben als OKLCH (perzeptuell linear). Werkstatt-Optik statt Startup-Modern: viel Weißraum, Haarlinien-Borders, dezente Schatten nur an Hero und CTA-Box. Schriften via System-Stack (-apple-system/SF Pro), Inter+IBM Plex Sans als Production-Default geplant. Lucide Icons. Komponenten unter apps/web/components/ui/ (eigenständig, keine UI-Library-Abhängigkeit). DESIGN.md im Repo-Root als verbindlicher Anker. Entschieden in PRD §41 und DESIGN.md.