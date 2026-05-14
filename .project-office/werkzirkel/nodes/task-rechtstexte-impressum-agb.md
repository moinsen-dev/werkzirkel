---
acceptance_criteria:
  - Erfüllt PRD §40 (Rechtliche Seiten Impressum/Datenschutz/AGB/Regeln/Streitschlichtung/Cookies) vollständig (Entwurfsfassung)
  - Footer-Stubs 'in Arbeit' aufgelöst — alle 6 Rechtstexte-Links funktional
  - Datenschutz enthält AVV-Liste (Resend, Stripe, Cloudflare, Hetzner, Sentry, Plausible) und Betroffenenrechte-Self-Service-Links
  - "AGB sagt explizit: keine Provision, keine Vermittlung, keine Equity-Vermittlung über die Plattform (Werkstatt-Kultur-Schutz)"
created_at: 2026-05-14T09:53:24.234Z
created_by: human
edges:
  composed_of:
    - id: polish-und-launch
effort: S
id: task-rechtstexte-impressum-agb
is_root: false
open_questions: []
owner: null
parent: polish-und-launch
private: false
risks: []
status: done
summary: Vier Pflicht-Pages mit ersten Entwürfen. Anwaltliche Prüfung ist externe Aufgabe (kein Bau-Task), aber die Inhalte stehen als Markdown-Dateien bereit, die der Anwalt durchgehen kann.
tags: []
title: "Rechtstexte: Impressum, Datenschutz, AGB, Werkstatt-Regeln (statisch + anwaltlich-pruefbar)"
type: task
updated_at: 2026-05-14T11:19:29.129Z
---

## Approach

### Pages

- /impressum: Diensteanbieter, Adresse, vertretungsberechtigte Person (Moinsen Uli), Kontakt, USt-ID falls vorhanden, Verantwortliche:r für Inhalte nach § 18 Abs. 2 MStV
- /datenschutz: Verarbeitungen pro Zweck mit Rechtsgrundlage, AVV-Liste (Resend, Stripe, Cloudflare, Hetzner, Sentry, Plausible), Speicherdauern, Betroffenenrechte mit Self-Service-Endpoint-Links
- /agb: Geltungsbereich, Vertragsschluss, Pflichten, KEINE Provision, KEINE Vermittlung, KEINE Equity, Haftungsausschluss, Kündigung, Salvatorische Klausel, Gerichtsstand Hamburg
- /regeln: Werkstatt-Regeln (PRD §9 + erweiterte Bedarfsseite-Regeln)
- /streitschlichtung: VSBG-Hinweis
- /cookies: nur funktionale Cookies (wz_session) — kein Banner nötig

### Implementation

Server Components, statischer Inhalt aus MDX oder direkt im JSX. Footer-Links in allen Layouts auflösen (vorher 'in Arbeit'-Stub).

### Anwaltliche Prüfung

Das ist eine **externe Aufgabe** (User-Verantwortung). Dieser Task liefert die Inhalte als Entwürfe — die anwaltliche Freigabe passiert offline.

### Tests

- Render-Tests pro Page (200 OK, deutscher Text).
- Footer-Links auf allen Pages funktional (kein 404 mehr für /impressum, /datenschutz, /agb, /regeln).

Started 2026-05-14T11:05:12.959Z: autobuild polish iter 6

Done 2026-05-14T11:19:29.129Z: Rechtstexte-Entwurf: 6 Pflicht-Pages, Footer-Stubs aufgelöst (Tests: green via `cd /Users/udi/work/moinsen/ideas/werkzirkel/apps/web && pnpm exec vitest run`)
