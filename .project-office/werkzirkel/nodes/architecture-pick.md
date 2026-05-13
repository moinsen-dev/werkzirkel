---
acceptance_criteria: []
created_at: 2026-05-13T09:44:56.259Z
created_by: human
edges:
  decision_affects:
    - id: architecture-decision
id: architecture-pick
is_root: false
open_questions: []
owner: null
private: false
risks: []
status: done
summary: Next.js 15 Full-Stack-Monolith mit Server Components
tags: []
title: Next.js 15 Full-Stack-Monolith mit Server Components
type: decision
updated_at: 2026-05-13T09:44:56.259Z
---

Eine Codebasis, kein separates SPA. Server Components als Default — Client Components nur wo Interaktivität nötig. Server Actions für Mutationen. API-Routen unter /api/v1 für externe Konsumenten und Webhooks. Reduziert Komplexität gegenüber Frontend+Backend-Split und passt zum kleinen Team. Skaliert über Hetzner-VMs horizontal, sobald Hamburg trägt. Entschieden in PRD §11.