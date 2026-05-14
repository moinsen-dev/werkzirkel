---
acceptance_criteria:
  - Erfüllt PRD §10.10 (Erfolgsbeitrag freiwillig) und §21 (Erfolgsbeitrag-Flow) vollständig
  - POST /api/v1/bedarfe/:id/erfolgsbeitrag funktioniert nur bei status='erfuellt' (422 sonst), erstellt Stripe Checkout + erfolgsbeitrag-Row
  - "Stripe-Webhook für metadata.zweck='erfolgsbeitrag' erfasst Zahlung idempotent: zweiter Replay → KEIN doppelter Kasse-Eintrag"
  - UI auf /bedarfe/[id] zeigt nach Erfüllt-Markierung Spende-Modal mit Slider 0-10%, defaultauf 5%
created_at: 2026-05-14T08:00:10.625Z
created_by: human
edges:
  blocks:
    - id: task-foerdermitgliedschaft-subscription
  composed_of:
    - id: geld-und-mitgliedschaft
effort: S
id: task-erfolgsbeitrag-stripe
is_root: false
open_questions: []
owner: null
parent: geld-und-mitgliedschaft
private: false
risks: []
status: done
summary: POST /api/v1/bedarfe/:id/erfolgsbeitrag erzeugt Stripe Checkout für freiwilligen 5%-Beitrag an Werkstatt-Kasse. Webhook erfasst Zahlung + Kasse-Eintrag. KEINE Provision — Spende-Status klar in UI.
tags: []
title: "Erfolgsbeitrag-Stripe-Flow: freiwillige Spende bei Bedarf-Erfüllung"
type: task
updated_at: 2026-05-14T08:12:06.619Z
---

## Approach

Erfolgsbeitrag ist eine FREIWILLIGE Spende, keine Provision. Wird bei der Bedarf-Erfüllt-Markierung optional angeboten.

### A) Validator

`apps/web/lib/validators/erfolgsbeitrag.ts`:
```ts
export const erfolgsbeitragSchema = z.object({
  hoehe_euro_cent: z.number().int().min(100).max(10000000), // 1€..100k€
  prozent_satz: z.number().min(0).max(10).optional(), // Info-Field
});
```

### B) POST /api/v1/bedarfe/:id/erfolgsbeitrag
- Auth + Bedarfsträger:in dieses Bedarfs.
- Bedarf muss status='erfuellt' sein (sonst 422).
- Body validiert.
- Stripe Checkout Session mit metadata.zweck='erfolgsbeitrag', bedarf_id, nutzer_id.
- INSERT erfolgsbeitrag mit status='initiiert'.
- Returns { checkoutUrl }.
- Dev-Fallback wenn Stripe nicht konfiguriert: 422 mit klarem Hinweis.

### C) Stripe-Webhook erweitern

Bei `checkout.session.completed` mit metadata.zweck='erfolgsbeitrag':
- UPDATE erfolgsbeitrag SET status='bezahlt', gezahlt_am.
- INSERT werkstatt_kasse_eintrag mit kategorie='erfolgsbeitraege'.
- sendMail an Bedarfsträger:in (Danke) — kein neues Template nötig, T-Dank inline.

### D) UI-Stub auf /bedarfe/[id]

Wenn Bedarfsträger:in markiert 'Erfüllt': zeige Modal/Section mit Slider 0-10% + 'Spenden'-Button → ruft den Endpoint, redirect zu Stripe-Checkout.
Nach Erfolg: Banner 'Vielen Dank! Deine Spende geht in die Werkstatt-Kasse Hamburg.'

### Tests

- POST erfolgsbeitrag mit erfülltem Bedarf → checkoutUrl + erfolgsbeitrag-Row.
- POST mit nicht-erfülltem Bedarf → 422.
- Webhook bezahlt → status=bezahlt + Kasse-Eintrag erstellt.
- Idempotenz: zweimaliger Webhook-Replay erzeugt NUR EINEN Kasse-Eintrag.

Quality gate, mark done, JSON-Report.

Started 2026-05-14T08:00:53.752Z: autobuild geld iter 1

Done 2026-05-14T08:12:06.619Z: Erfolgsbeitrag freiwillige Spende via Stripe + Webhook idempotent (Tests: green via `cd /Users/udi/work/moinsen/ideas/werkzirkel/apps/web && pnpm exec vitest run`)
