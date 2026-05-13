---
acceptance_criteria:
  - "Fuenf Templates existieren als .tsx-Komponenten in `apps/web/lib/email/templates/`: t-001-magic-link-login, t-002-magic-link-registrierung, t-003-konto-loeschung-bestaetigung, t-004-konto-loeschung-erinnerung, t-005-konto-geloescht"
  - "`sendMail(template, props)` Helper in `apps/web/lib/email/send.ts` exportiert; protokolliert jeden Versand in `email_benachrichtigung_log`"
  - Alle Templates haben Plain-Text-Fallback und deutschen Footer (Impressum/Datenschutz/Abmelde-Link)
  - Templates rendern mit deutschen Strings — kein englischer String darf im Snapshot-Test auftauchen (`pnpm test` deckt das mit einer Stichprobenliste verbotener englischer Begriffe ab)
created_at: 2026-05-13T09:58:44.228Z
created_by: human
edges:
  blocks:
    - id: task-magic-link-endpoints
    - id: task-konto-loeschung
  composed_of:
    - id: wp-auth
effort: S
id: task-email-templates-auth
is_root: false
open_questions: []
owner: null
parent: wp-auth
private: false
risks: []
status: done
summary: "Fuenf React-Email-Templates fuer Auth-Lifecycle: T-001 Magic-Link Login, T-002 Magic-Link Registrierung, T-003 Konto-Loeschung-Bestaetigung, T-004 Loeschung-Erinnerung (2 Tage), T-005 Konto-Geloescht (mit JSON-Anhang). Resend-Versand-Helper in lib/email/."
tags: []
title: E-Mail-Templates T-001 bis T-005 (Auth + Konto-Loeschung) auf Deutsch
type: task
updated_at: 2026-05-13T10:21:54.507Z
---

## Approach

Alle Templates in `apps/web/lib/email/templates/` als React-Email-Komponenten (.tsx). Versand-Helper `sendMail(template, props)` in `lib/email/send.ts` ruft Resend-API auf und protokolliert in `email_benachrichtigung_log`.

Gemeinsamer Layout-Wrapper mit Logo-Header, Footer mit Impressum/Abmelde-Link/Datenschutz-Link.

Plain-Text-Fallback pflicht (auto-generiert von react-email).

Deutsche Sprache durchgaengig. Kein Englisch. Tonalitaet gemaess PRD §6 (klar, direkt, kein Sales-Sprech).

## Pitfalls

- Resend-API-Key kann in Tests fehlen — mock the Resend-Client in lib/email/send.ts (z.B. via DI: factory-Pattern).
- React-Email rendert Server-Side. Imports muessen `react-email/components` sein, nicht `@react-email/...` (oder umgekehrt, je nach Version).
- E-Mail-Validierung: Bouncing-Adressen werden im Resend-Webhook gehandelt — separater Task spaeter.

Started 2026-05-13T10:17:55.841Z: autobuild iter 2

Done 2026-05-13T10:21:54.507Z: Implemented 5 React-Email templates (T-001..T-005) + sendMail helper (Tests: green via `unset NODE_ENV && pnpm typecheck && pnpm test && NODE_ENV=production pnpm build`)
