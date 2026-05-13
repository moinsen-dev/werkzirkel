---
acceptance_criteria: []
created_at: 2026-05-13T09:45:04.934Z
created_by: human
edges:
  decision_affects:
    - id: data-model-decision
id: data-model-pick
is_root: false
open_questions: []
owner: null
private: false
risks: []
status: done
summary: Drizzle ORM + Postgres 17, 28 Tabellen, cuid2-IDs, snake_case
tags: []
title: Drizzle ORM + Postgres 17, 28 Tabellen, cuid2-IDs, snake_case
type: decision
updated_at: 2026-05-13T09:45:04.934Z
---

Drizzle wegen TypeScript-First-API, SQL-Nähe und sauberer Migrations-Story (drizzle-kit). Postgres 17 für FTS, JSONB und Generated Columns. IDs als cuid2 (24 Zeichen, URL-sicher, lexikografisch sortierbar) — keine Auto-Increment-Integers. Stadt-IDs als kurze Kürzel (hh/b/m). Status-Enums als text-Spalten mit App-validierten Werten (kein PG-ENUM, damit Wertänderungen ohne Migration möglich). 28 Tabellen liegen unter apps/web/lib/db/schema/, gruppiert nach Domain. Erste Migration ist erfolgreich angewendet. Entschieden in PRD §13.