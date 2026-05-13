---
acceptance_criteria: []
created_at: 2026-05-13T09:45:23.249Z
created_by: human
edges:
  decision_affects:
    - id: cross-cutting-decision
id: cross-cutting-pick
is_root: false
open_questions: []
owner: null
private: false
risks: []
status: done
summary: Magic-Link-Auth, Sentry-Logging, deutsche E-Mail-Templates, DSGVO-Self-Service
tags: []
title: Magic-Link-Auth, Sentry-Logging, deutsche E-Mail-Templates, DSGVO-Self-Service
type: decision
updated_at: 2026-05-13T09:45:23.249Z
---

Auth: Better-Auth Magic-Link, keine Passwörter, Sessions DB-backed im wz_session-Cookie, 30 Tage Sliding-Window. Logging: pino strukturiert, Sentry für Errors mit release/user-context. Monitoring: Plausible cookie-frei, Uptime via Better-Stack auf /api/v1/health. E-Mail: Resend mit React-Email-Templates, alle auf Deutsch. i18n: zentrale de.ts-Strings, keine i18n-Library in v1.0. Errors: typsicher mit Zod-Validierung am Edge, Server-Returns als { error: { code, message } }. DSGVO: Self-Service-Export, 7-Tage-Karenz beim Konto-Löschen, IP-Adressen nach 30 Tagen gekürzt. Audit-Log für sicherheitsrelevante Aktionen. Entschieden in PRD §11, §16, §34.