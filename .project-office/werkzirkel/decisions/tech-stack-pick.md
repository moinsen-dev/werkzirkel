---
affects:
  - tech-stack-decision
alternatives: []
decided_at: 2026-05-13T09:45:23.055Z
decided_by: human
foundation_scope: tech-stack
id: tech-stack-pick
status: accepted
supersedes: null
tags: []
title: "TS-First-Stack: Next.js + Drizzle + Better-Auth + Stripe + Resend, Docker auf Hetzner"
---

# TS-First-Stack: Next.js + Drizzle + Better-Auth + Stripe + Resend, Docker auf Hetzner

## Decision

TypeScript 5 strict durchgehend. Next.js 15.1 + React 19. Tailwind 4 mit CSS-First-@theme (kein tailwind.config.ts). Drizzle ORM + postgres-js. Better-Auth (Magic-Link, kein Passwort) ersetzt das deprecated Lucia. Stripe für Werkstattbeitrag/Fördermitgliedschaft/Erfolgsbeitrag. Resend für transactional Mail (React-Email-Templates). Cloudflare R2 für Uploads. Hetzner Cloud + eigenes Docker-Setup (kein Coolify, auf Wunsch). Vitest + Playwright für Tests. pnpm-Workspace. Entschieden in PRD §11.
