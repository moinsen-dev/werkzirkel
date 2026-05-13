---
acceptance_criteria:
  - "`apps/web/lib/auth/index.ts` exportiert `auth`-Instance vom Typ ReturnType<typeof betterAuth>"
  - "`auth.handler` ist lauffaehig in `apps/web/app/api/auth/[...all]/route.ts`"
  - Session-Cookie heisst `wz_session` mit `httpOnly` + `secure` + `sameSite=lax` + Max-Age 30 Tage gemaess PRD §16
  - Magic-Link-Token wird in der `magic_link_token`-Tabelle persistiert, nicht in einer Better-Auth-Default-Tabelle (Schema-Mapping in der Adapter-Config sichtbar)
  - "`pnpm typecheck` und `pnpm build` weiterhin gruen"
created_at: 2026-05-13T09:58:44.226Z
created_by: human
edges:
  blocks:
    - id: task-magic-link-endpoints
  composed_of:
    - id: wp-auth
effort: S
id: task-auth-config
is_root: false
open_questions: []
owner: null
parent: wp-auth
private: false
risks: []
status: draft
summary: Better-Auth-Instance in lib/auth/index.ts initialisieren, Drizzle-Adapter gegen die existierenden Tabellen nutzer/session/magic_link_token, Magic-Link-Plugin aktivieren, wz_session-Cookie mit Sliding-Window. Foundation fuer alle weiteren Auth-Tasks.
tags: []
title: Better-Auth konfigurieren mit Drizzle-Adapter und Magic-Link-Plugin
type: task
updated_at: 2026-05-13T09:58:44.226Z
---

## Approach

Better-Auth (Paket bereits installiert) wird in `apps/web/lib/auth/index.ts` instanziiert mit:
- `drizzleAdapter(db, { provider: 'pg', schema })` aus `@better-auth/utils`
- `magicLink` Plugin mit `expiresIn: 15 * 60` (15 Min)
- Session-Cookie-Optionen gemaess PRD §16: `name: 'wz_session'`, `httpOnly: true`, `secure: true`, `sameSite: 'lax'`, `maxAge: 30 * 24 * 60 * 60` (30 Tage), `updateAge: 30d` (Sliding-Window)
- `BETTER_AUTH_SECRET` aus `lib/env.ts`

Session-Tabellen-Mapping: better-auth erwartet `user`/`session`-Konventionen — wir mappen auf unsere deutschen Spalten `nutzer`/`session` via Drizzle-Adapter-Config.

## Pitfalls

- Better-Auth wuenscht standardmaessig eine `user`-Tabelle mit `id/email/emailVerified/name/image`. Wir mappen `nutzer.email`, `nutzer.email_verifiziert_am`, `nutzer.anzeigename`, `nutzer.avatar_url`. Spaltennamen-Mapping muss explizit konfiguriert sein.
- Magic-Link-Token-Speicherung in `magic_link_token` (nicht in Better-Auths Default-Tabelle).
- HMR im Dev-Modus: Auth-Instance an `globalThis` haengen, sonst doppelte Initialisierung.