---
acceptance_criteria:
  - "Erfuellt PRD §15.1 vollstaendig: 5 Endpunkte (POST magic-link, GET verify, POST logout, POST logout-all, GET me)"
  - POST `/api/v1/auth/magic-link` antwortet immer 204 (Aufklaerungsschutz), auch bei unbekannter E-Mail
  - "Rate-Limit aus PRD §16 durchgesetzt: 5 Magic-Links pro E-Mail pro Stunde, 30 pro IP pro Stunde — getestet mit Integration-Test (sechster Aufruf gibt 429)"
  - GET `/api/v1/auth/magic-link/verify` setzt `wz_session`-Cookie und 302-redirect nach `/uebersicht`
  - Token in `magic_link_token.token_hash` ist SHA-256-Hash, niemals Klartext (`pnpm test` deckt das mit einem Unit-Test ab)
created_at: 2026-05-13T09:58:44.227Z
created_by: human
edges:
  blocks:
    - id: task-konto-crud-settings
    - id: task-dsgvo-export
  composed_of:
    - id: wp-auth
  depends_on:
    - id: task-auth-config
    - id: task-email-templates-auth
effort: S
id: task-magic-link-endpoints
is_root: false
open_questions: []
owner: null
parent: wp-auth
private: false
risks: []
status: draft
summary: "Alle Auth-Endpunkte aus PRD §15.1 implementieren: POST /api/v1/auth/magic-link, GET .../verify, POST .../logout, POST .../logout-all, GET .../me. Plus Rate-Limits (5 Mails/E-Mail/Std, 30 Mails/IP/Std, 10 Verifications/Token)."
tags: []
title: Magic-Link API-Endpunkte mit Rate-Limits
type: task
updated_at: 2026-05-13T09:58:44.227Z
---

## Approach

Alle Endpunkte unter `apps/web/app/api/v1/auth/`. Better-Auth's Handler deckt magic-link-send und magic-link-verify ab — wir wrappen sie mit Rate-Limit-Middleware und einer Zod-validierten Request-Shape.

Rate-Limits werden Postgres-basiert (kein Redis): kleine Tabelle `rate_limit_bucket` mit `key` (email|ip), `endpoint`, `count`, `window_start`. Wird sliding-window-mässig zurueckgesetzt.

Alternativ: in-memory Map mit setInterval-Eviction (reicht fuer Single-Instance-Hetzner-VM; spaeter Postgres-basiert bei Skalierung).

Magic-Link-Mail ist deutsch (Template T-001 fuer Login, T-002 fuer Registrierung) — gehoert aber zu task-email-templates-auth. Hier nur den Aufruf an die Versand-Funktion verdrahten.

## Pitfalls

- POST /api/v1/auth/magic-link gibt IMMER 204 zurueck (auch wenn E-Mail nicht existiert) — Aufklaerungsschutz gegen User-Enumeration.
- Token-Hash: vor Speicherung SHA-256, niemals Klartext in der DB.
- Verify-Endpoint dekrementiert max-uses, markiert verwendet_am, erstellt Session via auth.api.signIn.email.
- Origin-Header-Check fuer alle POST-Routen ausser dem Stripe-Webhook (kommt spaeter).