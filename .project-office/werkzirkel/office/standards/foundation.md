# Foundation Standards

This file is the **gateway document** for the Foundation-phase of this
project (project-office v2.0, PRD §13). The Foundation-phase establishes
the shared baseline that every subteam works against — IBM
System/360-style: the Architecture Manual is written first, every
subteam follows the same Common Interfaces, integration is cheap.

## Why a Foundation-phase exists

Without a baseline, sibling subprojects drift: each picks its own
architecture, its own data shape, its own UI tokens, its own logging
conventions. Integration becomes more expensive than the build.
Foundation-phase prevents the drift by forcing five accepted decisions
**before** any sibling build-subproject is allowed to start.

## The five pillars

Every Goal must seed a Foundation-subproject (`foundation: true`) with
five direct children, one per pillar. Each pillar is satisfied when at
least one accepted decision exists for it.

1. **Architecture** — system decomposition, service split, component
   ownership. Template: `architecture-decision.md`.
2. **Data Model** — entity schemas, persistence layer, migration
   policy. Template: `data-model-decision.md`.
3. **Tech Stack** — language, framework, build, test setup. Template:
   `tech-stack-decision.md`.
4. **Design System / UI Language** — tokens, component library, voice
   & tone, layout grid. Required when a UI surface exists; can be
   skipped via explicit `bypass-foundation:design-system` decision for
   pure-CLI / pure-backend projects. Template:
   `design-system-decision.md`.
5. **Cross-cutting Concerns** — auth & identity, logging &
   observability, error handling, i18n. Materialised as a
   sub-subproject with one decision per concern. Template:
   `cross-cutting.md`.

## How the gate works

- The Foundation-subproject is `ready` once all five pillars have ≥1
  accepted decision (or an explicit bypass-decision for that pillar).
- Sibling build-subprojects (`foundation: false`) cannot transition
  `ready → in-progress` until the Foundation-subproject is `done`.
- Bypass for the whole Foundation is possible via
  `po decide bypass-foundation --affects <build-id> --rationale ...`.
  This is logged in `lifecycle.log` as a `foundation-bypassed` event
  and surfaces as a high-severity bottleneck.

## When to bypass (and when not to)

Bypass is appropriate for:

- One-shot bug-fix projects with no architectural surface area.
- Documentation-only projects.
- Spikes / research projects whose output is a decision, not code.

Bypass is NOT appropriate for:

- New product builds.
- Significant refactors that change the public shape of a system.
- Projects with multiple subprojects whose coordination matters.

If you find yourself wanting to bypass because "we don't know yet" —
that's the signal that you need to go through Foundation. Use the
five pillar templates as the framework; an answer of "we deliberately
defer this" is itself a valid decision.
