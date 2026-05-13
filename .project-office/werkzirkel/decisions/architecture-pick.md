---
affects:
  - architecture-decision
alternatives: []
decided_at: 2026-05-13T09:44:56.259Z
decided_by: human
foundation_scope: architecture
id: architecture-pick
status: accepted
supersedes: null
tags: []
title: Next.js 15 Full-Stack-Monolith mit Server Components
---

# Next.js 15 Full-Stack-Monolith mit Server Components

## Decision

Eine Codebasis, kein separates SPA. Server Components als Default — Client Components nur wo Interaktivität nötig. Server Actions für Mutationen. API-Routen unter /api/v1 für externe Konsumenten und Webhooks. Reduziert Komplexität gegenüber Frontend+Backend-Split und passt zum kleinen Team. Skaliert über Hetzner-VMs horizontal, sobald Hamburg trägt. Entschieden in PRD §11.
