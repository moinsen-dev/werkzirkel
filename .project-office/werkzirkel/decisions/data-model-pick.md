---
affects:
  - data-model-decision
alternatives: []
decided_at: 2026-05-13T09:45:04.934Z
decided_by: human
foundation_scope: data-model
id: data-model-pick
status: accepted
supersedes: null
tags: []
title: Drizzle ORM + Postgres 17, 28 Tabellen, cuid2-IDs, snake_case
---

# Drizzle ORM + Postgres 17, 28 Tabellen, cuid2-IDs, snake_case

## Decision

Drizzle wegen TypeScript-First-API, SQL-Nähe und sauberer Migrations-Story (drizzle-kit). Postgres 17 für FTS, JSONB und Generated Columns. IDs als cuid2 (24 Zeichen, URL-sicher, lexikografisch sortierbar) — keine Auto-Increment-Integers. Stadt-IDs als kurze Kürzel (hh/b/m). Status-Enums als text-Spalten mit App-validierten Werten (kein PG-ENUM, damit Wertänderungen ohne Migration möglich). 28 Tabellen liegen unter apps/web/lib/db/schema/, gruppiert nach Domain. Erste Migration ist erfolgreich angewendet. Entschieden in PRD §13.
