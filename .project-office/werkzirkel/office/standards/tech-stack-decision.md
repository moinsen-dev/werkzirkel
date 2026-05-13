# Tech Stack Decision

_(Foundation-phase pillar 3 of 5. PRD §13.)_

## Stack at a glance

| Layer | Choice | Reason |
|---|---|---|
| Language(s) | _e.g., TypeScript 5.5 + Python 3.12_ | _ecosystem fit, team expertise_ |
| Backend framework | _e.g., FastAPI / Hono / Fastify_ | _async-first, lightweight_ |
| Frontend framework | _e.g., Astro + vanilla JS_ | _content-heavy + low complexity_ |
| Database | _e.g., Postgres 16_ | _matches data-model decision_ |
| Build / bundler | _e.g., Bun, Vite, esbuild_ | _speed_ |
| Test runner | _e.g., bun:test, vitest, pytest_ | _matches language_ |
| Linter / formatter | _e.g., biome, ruff_ | _zero-config, fast_ |
| Package manager | _e.g., bun, pnpm, uv_ | _fast, lockfile-deterministic_ |

## Constraints

- _e.g., must run on macOS + Linux; Windows not required_
- _e.g., no Docker for local dev; production uses containers_
- _e.g., must support existing CI infrastructure_

## Decision

_(One paragraph: what's the philosophical thread connecting these
picks? Why this combination, not another? Acknowledge the tradeoffs.)_

## Consequences

- _Hiring impact: …_
- _Onboarding time: …_
- _Long-term maintenance cost: …_
- _What this stack does NOT support gracefully: …_

## Review

_(When the stack should be revisited — e.g., "if monthly DAU exceeds
N," or "if a new language version brings X capability we're missing.")_
