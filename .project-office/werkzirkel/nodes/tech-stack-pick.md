---
acceptance_criteria: []
created_at: 2026-05-13T09:45:23.055Z
created_by: human
edges:
  decision_affects:
    - id: tech-stack-decision
id: tech-stack-pick
is_root: false
open_questions: []
owner: null
private: false
risks: []
status: done
summary: "TS-First-Stack: Next.js + Drizzle + Better-Auth + Stripe + Resend, Docker auf Hetzner"
tags: []
title: "TS-First-Stack: Next.js + Drizzle + Better-Auth + Stripe + Resend, Docker auf Hetzner"
type: decision
updated_at: 2026-05-13T09:45:23.055Z
---

TypeScript 5 strict durchgehend. Next.js 15.1 + React 19. Tailwind 4 mit CSS-First-@theme (kein tailwind.config.ts). Drizzle ORM + postgres-js. Better-Auth (Magic-Link, kein Passwort) ersetzt das deprecated Lucia. Stripe für Werkstattbeitrag/Fördermitgliedschaft/Erfolgsbeitrag. Resend für transactional Mail (React-Email-Templates). Cloudflare R2 für Uploads. Hetzner Cloud + eigenes Docker-Setup (kein Coolify, auf Wunsch). Vitest + Playwright für Tests. pnpm-Workspace. Entschieden in PRD §11.