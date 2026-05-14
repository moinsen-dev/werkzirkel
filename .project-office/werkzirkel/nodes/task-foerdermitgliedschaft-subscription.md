---
acceptance_criteria:
  - Erfüllt PRD §8.13 (Fördermitgliedschaft-Stufen) + §20 (Modell v1 + Förder-Mitgliedschaft) vollständig
  - Vier Stufen (monatlich/jährlich/foerderer_privat/foerderer_organisation) als Stripe-Subscriptions umgesetzt
  - Webhook-Events checkout.session.completed, customer.subscription.updated, invoice.payment_succeeded, invoice.payment_failed, customer.subscription.deleted alle gehandhabt (Integration-Test pro Event)
  - "Werk-Limit-Override: nutzer mit aktiver foerdermitgliedschaft kann mehr als 5 Werke anlegen (Integration-Test verifiziert)"
  - Stripe Customer Portal-Link für Kündigung/Update funktional
created_at: 2026-05-14T08:00:10.626Z
created_by: human
edges:
  blocks:
    - id: task-werkstatt-kasse-pages
  composed_of:
    - id: geld-und-mitgliedschaft
  depends_on:
    - id: task-erfolgsbeitrag-stripe
effort: S
id: task-foerdermitgliedschaft-subscription
is_root: false
open_questions: []
owner: null
parent: geld-und-mitgliedschaft
private: false
risks: []
status: done
summary: POST /api/v1/me/foerdermitgliedschaft/start mit Stufe (monatlich 9€, jährlich 90€, foerderer_privat 240€/Jahr, foerderer_organisation 1200€/Jahr). Webhook syncs subscription-status auf nutzer.foerdermitglied_seit/bis.
tags: []
title: "Fördermitgliedschaft: Stripe-Subscriptions in 4 Stufen"
type: task
updated_at: 2026-05-14T08:25:01.693Z
---

## Approach

Fördermitgliedschaft als Stripe-Subscription. Vier Stufen, vier Stripe-Prices (in .env als STRIPE_PRICE_*-IDs).

### Endpoints

- POST /api/v1/me/foerdermitgliedschaft/start mit Body { stufe }. Erstellt Stripe Checkout Session mode='subscription' mit price_id aus env.STRIPE_PRICE_<stufe>. Metadata.zweck='foerdermitgliedschaft', nutzer_id, stufe. Returns { checkoutUrl }.
- POST /api/v1/me/foerdermitgliedschaft/portal — Stripe Customer Portal Link (für Kündigung/Update). Returns { portalUrl }.
- GET /api/v1/me/foerdermitgliedschaft — eigene aktive Mitgliedschaft.

### Webhook-Events

- checkout.session.completed (zweck='foerdermitgliedschaft'): INSERT foerdermitgliedschaft mit stripe_customer_id, stripe_subscription_id, beginn=now, status='aktiv'. UPDATE nutzer.foerdermitglied_seit/bis.
- customer.subscription.updated: status-Sync (current_period_end → foerdermitglied_bis, ggf. 'gekuendigt').
- invoice.payment_succeeded: foerdermitglied_bis auf neues period_end aktualisieren + Kasse-Eintrag mit kategorie='foerder_mitgliedsbeitraege'.
- invoice.payment_failed: status='zahlung_fehlt'.
- customer.subscription.deleted: status='gekuendigt', foerdermitglied_bis=ende.

### UI-Stub auf /einstellungen

Neuer Tab 'Fördermitgliedschaft' mit 4 Stufen-Karten + 'Aktivieren'-Button (führt zu Stripe Checkout).
Wenn schon aktiv: Status + 'Verwalten'-Button (führt zu Stripe Customer Portal).

### Tests

- POST start → Stripe Session + Mock-Customer.
- Webhook checkout.session.completed → foerdermitgliedschaft-Row + nutzer-Update.
- invoice.payment_succeeded → Kasse-Eintrag + foerdermitglied_bis verlängert.
- subscription.deleted → status='gekuendigt'.
- Limits-Check: nutzer mit aktiver foerdermitgliedschaft kann >5 Werke anlegen (vorher in werk-limit-Helper geprüft).

Quality gate, mark done.

Started 2026-05-14T08:14:32.700Z: autobuild geld iter 2

Done 2026-05-14T08:25:01.693Z: Fördermitgliedschaft als Stripe Subscription, 4 Stufen, 5 Webhook-Events (Tests: green via `cd /Users/udi/work/moinsen/ideas/werkzirkel/apps/web && pnpm exec vitest run`)
