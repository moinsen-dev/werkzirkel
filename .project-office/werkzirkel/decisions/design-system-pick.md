---
affects:
  - design-system-decision
alternatives: []
decided_at: 2026-05-13T09:45:23.143Z
decided_by: human
foundation_scope: design-system
id: design-system-pick
status: accepted
supersedes: null
tags: []
title: Custom OKLCH-Tokens + Tailwind 4 @theme, keine externe UI-Library
---

# Custom OKLCH-Tokens + Tailwind 4 @theme, keine externe UI-Library

## Decision

Design-Tokens in apps/web/design/tokens.ts (TS) und @theme-Block in app/globals.css (CSS) als Single Source of Truth. Farben als OKLCH (perzeptuell linear). Werkstatt-Optik statt Startup-Modern: viel Weißraum, Haarlinien-Borders, dezente Schatten nur an Hero und CTA-Box. Schriften via System-Stack (-apple-system/SF Pro), Inter+IBM Plex Sans als Production-Default geplant. Lucide Icons. Komponenten unter apps/web/components/ui/ (eigenständig, keine UI-Library-Abhängigkeit). DESIGN.md im Repo-Root als verbindlicher Anker. Entschieden in PRD §41 und DESIGN.md.
