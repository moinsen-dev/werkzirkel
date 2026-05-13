# Data Model Decision

_(Foundation-phase pillar 2 of 5. PRD §13.)_

## Context

_(What entities does the system touch? Which are owned by this
project, which come from upstream? Which need migrations?)_

## Entities (top-level)

| Entity | Owner | Persistence | Notes |
|---|---|---|---|
| _e.g., User_ | this project | postgres | Email is unique; soft-delete |
| _e.g., Order_ | this project | postgres + event log | Append-only |

## Schema-evolution policy

- **Additive changes:** _(rule for forward-compat — e.g., new optional
  columns OK without coordination)_
- **Breaking changes:** _(rule — e.g., requires a migration RFC + 2-week
  deprecation window)_
- **Versioning approach:** _(e.g., schema_version field, dual-write
  during transitions, blue/green deploys for storage-tier changes)_

## Persistence layer

- _Database choice + reason._
- _Migration tool._
- _Backup / restore policy._
- _Query patterns the schema must support efficiently._

## Decision

_(The non-obvious calls in the data model — e.g., "we use a single
denormalised orders table because read-heavy access dominates," or
"we use UUIDv7 for primary keys to keep insertion locality.")_

## Consequences

- _Schema-change cost going forward: …_
- _Read/write pattern this commits us to: …_
- _Storage cost trajectory: …_

## Review

_(When/why this might be revisited.)_
