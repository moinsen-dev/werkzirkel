---
acceptance_criteria:
  - Erfuellt PRD §10.5 (Werkstattbeitrag-Workflow) und §18 (Drei Pfade) vollstaendig fuer Geldbeitrag + Sachleistung — Pfad A (Schauabend) ist via existing termin-anwesenheit-Hook abgedeckt
  - POST /api/v1/werkstattbeitrag/geldbeitrag erstellt Stripe Checkout Session mit metadata.zweck='werkstattbeitrag' und nutzer_id; gibt checkoutUrl zurueck
  - Stripe Webhook /api/v1/stripe/webhook verifiziert Signatur via STRIPE_WEBHOOK_SECRET und setzt werkstattbeitrag.status='verifiziert' + erstellt werkstatt_kasse_eintrag bei checkout.session.completed
  - Kurator-Verifizieren-Endpunkt POST /api/v1/kurator/werkstattbeitraege/:id/verifizieren setzt status='verifiziert' und gueltig_bis = now() + 6 Monate (PRD §18 Gueltigkeitsdauer)
  - Drei neue Email-Templates T-601, T-602, T-603 in lib/email/templates/ + sendMail-Union erweitert
  - "Dev-Fallback ohne STRIPE_SECRET_KEY: geldbeitrag-Endpoint gibt 422 mit klarem Hinweis statt zu crashen"
created_at: 2026-05-14T06:03:26.097Z
created_by: human
edges:
  blocks:
    - id: task-bedarf-crud-api
  composed_of:
    - id: bedarfsseite
  depends_on:
    - id: task-bedarfstraeger-foerderer-rolle-flow
effort: S
id: task-werkstattbeitrag-api
is_root: false
open_questions: []
owner: null
parent: bedarfsseite
private: false
risks: []
status: done
summary: "Drei Werkstattbeitrag-Pfade: Schauabend-Hook (existiert), Geldbeitrag via Stripe Checkout (50/100/150 EUR), Sachleistung mit Kurator-Verifikation. Plus T-601..T-603 Emails. Stripe-Webhook-Handler."
tags: []
title: "Werkstattbeitrag-Workflow: Stripe-Geldbeitrag + Sachleistungs-Verifikation + Email-Templates"
type: task
updated_at: 2026-05-14T07:05:31.948Z
---

## Approach

Der Schauabend-Pfad (Pfad A) ist schon vom termin-anwesenheit-API Hook abgedeckt. Hier fokussiert auf Geldbeitrag (Pfad B) + Sachleistung (Pfad C) + Email-Templates.

### A) Stripe-Setup

`apps/web/lib/stripe/client.ts`:
```ts
import Stripe from 'stripe';
import { env } from '@/lib/env';

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    if (!env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY missing');
    _stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2024-12-18.acacia' });
  }
  return _stripe;
}

export function isStripeConfigured(): boolean {
  return Boolean(env.STRIPE_SECRET_KEY);
}
```

`pnpm --filter @werkzirkel/web add stripe`.

### B) POST /api/v1/werkstattbeitrag/geldbeitrag

- Auth + Bedarfstraeger:innen-Rolle.
- Body Zod: `{ hoehe_euro_cent: z.enum([5000, 10000, 15000]) }` (50/100/150 EUR).
- Stripe Checkout Session erstellen:
  - mode: 'payment'
  - line_items: ein item mit price_data { currency: 'eur', product_data: { name: 'Werkstattbeitrag Werkzirkel Hamburg' }, unit_amount: hoehe_euro_cent }
  - metadata: { zweck: 'werkstattbeitrag', nutzer_id: current.id }
  - success_url: APP_URL + '/uebersicht/werkstattbeitrag?status=ok&session={CHECKOUT_SESSION_ID}'
  - cancel_url: APP_URL + '/uebersicht/werkstattbeitrag?status=abgebrochen'
  - payment_method_types: ['card', 'klarna', 'sofort', 'sepa_debit', 'paypal'].
- INSERT werkstattbeitrag mit art='geldbeitrag', status='erfasst', stripe_session_id, hoehe_euro_cent.
- Returns `{ checkoutUrl: session.url }`.

Dev-Fallback (STRIPE_SECRET_KEY leer): 422 mit Klartext-Hinweis 'Stripe ist nicht konfiguriert — bitte Schauabend-Teilnahme oder Sachleistung waehlen.'

### C) POST /api/v1/werkstattbeitrag/sachleistung

- Auth + Bedarfstraeger:innen-Rolle.
- Body: `{ nachweis_text: string, nachweis_dokument_url?: string }`.
- INSERT werkstattbeitrag mit art='sachleistung', status='erfasst'.
- Kurator:in muss verifizieren (kommt in Kurator-Endpoints).
- Returns 201.

### D) GET /api/v1/me/werkstattbeitrag

- Auth.
- Liste aller eigenen werkstattbeitrag-Rows mit Status.
- Returns 200.

### E) Kurator-Endpoints

`POST /api/v1/kurator/werkstattbeitraege/:id/verifizieren`:
- Permission: istKuratorVon(stadt des nutzers).
- UPDATE werkstattbeitrag SET status='verifiziert', verifiziert_durch, verifiziert_am, gueltig_bis = now() + 6 Monate.
- sendMail T-602 an Bedarfstraeger:in.
- Audit-log.
- Returns 200.

`POST /api/v1/kurator/werkstattbeitraege/:id/ablehnen`:
- Body: `{ grund: string }`.
- UPDATE status='abgelehnt'.
- sendMail an Bedarfstraeger:in mit Grund.
- Returns 200.

### F) Stripe-Webhook /api/v1/stripe/webhook

- Signaturpruefung via STRIPE_WEBHOOK_SECRET.
- Behandelt event types:
  - `checkout.session.completed`: bei metadata.zweck='werkstattbeitrag': UPDATE werkstattbeitrag SET status='verifiziert', verifiziert_am=now(), gueltig_bis=now()+6Monate. INSERT werkstatt_kasse_eintrag mit kategorie='werkstattbeitraege'. sendMail T-601.
- Returns 200 immer (auch unhandled events).

### G) Email-Templates

- `t-601-werkstattbeitrag-bezahlt.tsx` — Stripe-Erfolg, danke.
- `t-602-werkstattbeitrag-verifiziert.tsx` — Kurator-Verifikation (fuer Sachleistung).
- `t-603-werkstattbeitrag-ablauf-warnung.tsx` — 30 Tage vor Ablauf der 6-Monats-Gueltigkeit (mit Cron — kann hier vorgesehen werden, Implementierung im Cron-Task).

MailTemplate-Union erweitern.

### Tests

`apps/web/tests/integration/werkstattbeitrag-geldbeitrag.test.ts`:
- POST 5000ct → checkoutUrl + werkstattbeitrag-Row mit status='erfasst'.
- POST 12345ct → 422 (kein gueltiger Wert).
- POST ohne bedarfstraeger-Rolle → 403.
- Mock Stripe-Webhook: checkout.session.completed mit metadata → werkstattbeitrag.status='verifiziert', werkstatt_kasse_eintrag erstellt, T-601 versendet.

`apps/web/tests/integration/werkstattbeitrag-sachleistung.test.ts`:
- POST mit nachweis_text → 201, status='erfasst'.
- Kurator-Verifizieren → 200, status='verifiziert', T-602 versendet.
- Kurator-Ablehnen → 200, status='abgelehnt'.

## Quality gate

```
cd /Users/udi/work/moinsen/ideas/werkzirkel/apps/web && rm -rf .next && pnpm exec vitest run
cd .. && pnpm typecheck && NODE_ENV=production pnpm build
```

DO NOT touch:
- Bedarf-CRUD (next task).
- Erfolgsbeitrag- und Foerdermitgliedschafts-Stripe-Flows (kommen in geld-und-mitgliedschaft).

Started 2026-05-14T06:51:16.060Z: autobuild bedarf iter 4

Done 2026-05-14T07:05:31.948Z: Werkstattbeitrag: Stripe-Geldbeitrag + Sachleistung + Kurator-Verifikation + Webhook + T-601..T-603 (Tests: green via `cd /Users/udi/work/moinsen/ideas/werkzirkel/apps/web && pnpm exec vitest run`)
