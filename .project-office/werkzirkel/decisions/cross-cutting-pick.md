---
affects:
  - cross-cutting-decision
alternatives: []
decided_at: 2026-05-13T09:45:23.249Z
decided_by: human
foundation_scope: cross-cutting
id: cross-cutting-pick
status: accepted
supersedes: null
tags: []
title: Magic-Link-Auth, Sentry-Logging, deutsche E-Mail-Templates, DSGVO-Self-Service
---

# Magic-Link-Auth, Sentry-Logging, deutsche E-Mail-Templates, DSGVO-Self-Service

## Decision

Auth: Better-Auth Magic-Link, keine Passwörter, Sessions DB-backed im wz_session-Cookie, 30 Tage Sliding-Window. Logging: pino strukturiert, Sentry für Errors mit release/user-context. Monitoring: Plausible cookie-frei, Uptime via Better-Stack auf /api/v1/health. E-Mail: Resend mit React-Email-Templates, alle auf Deutsch. i18n: zentrale de.ts-Strings, keine i18n-Library in v1.0. Errors: typsicher mit Zod-Validierung am Edge, Server-Returns als { error: { code, message } }. DSGVO: Self-Service-Export, 7-Tage-Karenz beim Konto-Löschen, IP-Adressen nach 30 Tagen gekürzt. Audit-Log für sicherheitsrelevante Aktionen. Entschieden in PRD §11, §16, §34.
