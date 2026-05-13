---
acceptance_criteria:
  - Erfuellt PRD §F-001 bis §F-005 vollstaendig (Registrierung, Stadtwahl, Werkpass-CRUD, Teilnahmeart, Konto-Deaktivierung)
  - Erfuellt PRD §15.1 vollstaendig (POST /api/v1/auth/magic-link, GET .../verify, POST .../logout, POST .../logout-all, GET .../me)
  - Magic-Link-Token wird ausschliesslich als SHA-256-Hash in `magic_link_token.token_hash` gespeichert; Klartext-Token verlaesst nie den Server bis auf den E-Mail-Versand
  - Session-Cookie `wz_session` hat httpOnly + Secure + SameSite=Lax + Max-Age 30 Tage (Sliding-Window)
  - Konto-Loeschung initiiert 7-Tage-Karenz; Cron `konto_loeschung_frist_abgelaufen` fuehrt nach Ablauf die harte Loeschung aus (Pseudonymisierung von Feedback auf 'anonyme:r Tester:in')
  - DSGVO-Export-Endpoint `GET /api/v1/me/export` liefert JSON mit allen personenbezogenen Daten der eingeloggten Person
created_at: 2026-05-13T09:49:33.790Z
created_by: human
edges:
  composed_of:
    - id: plattform-kern
  decomposes_into:
    - id: task-auth-config
    - id: task-magic-link-endpoints
    - id: task-email-templates-auth
    - id: task-konto-crud-settings
    - id: task-konto-loeschung
    - id: task-dsgvo-export
    - id: task-cron-jobs-auth
id: wp-auth
is_root: false
open_questions: []
owner: null
parent: plattform-kern
private: false
risks: []
status: done
summary: Better-Auth Magic-Link-Integration mit deutscher E-Mail, Session-Management via wz_session-Cookie, Konto-CRUD (Profil, Stadt, Rollen), Konto-Löschung mit 7-Tage-Karenz, DSGVO-Self-Service (JSON-Export, Auskunftsanfrage). Foundation-Layer fuer alle weiteren Workpackages.
tags: []
title: "Auth & Konto: Magic-Link, Session, DSGVO-Self-Service"
type: workpackage
updated_at: 2026-05-13T11:12:45.795Z
---

## Approach

Better-Auth ist bereits in `apps/web/package.json` installiert. Schema-Tabellen `nutzer`, `session`, `magic_link_token` stehen. Jetzt wird die Konfiguration in `apps/web/lib/auth/` angelegt, der Drizzle-Adapter angeschlossen und die API-Routen aus PRD §15.1 implementiert.

Die Magic-Link-Mail wird via Resend versendet — Template T-001 (Login) und T-002 (Registrierung) als React-Email-Komponenten in `lib/email/templates/`.

## Pitfalls

- Token-Speicherung: niemals Klartext, nur SHA-256-Hash in `magic_link_token.token_hash`.
- Rate-Limits gemaess PRD §16: 5 Magic-Links/E-Mail/Std, 30/IP/Std.
- DSGVO-Loeschung: 7-Tage-Karenz, NICHT sofort hard-delete. Cron `konto_loeschung_frist_abgelaufen` macht den endgueltigen Loeschvorgang.
- IP-Adressen in `session` und `audit_log` nach 30 Tagen kuerzen (letztes Oktett nullen).