---
acceptance_criteria:
  - Stripe-Webhook-Handler verarbeitet checkout.session.completed für alle drei Spendenzwecke (Werkstattbeitrag, Erfolgsbeitrag, Fördermitgliedschaft) mit Signaturprüfung
  - "Erfolgsbeitrag-Flow vollständig implementiert (PRD §21): Slider, Stripe Checkout, Kasse-Eintrag bei Webhook-Success"
  - Werkstatt-Kasse pro Stadt rendert öffentliche Quartalsübersicht mit Eingängen und Ausgängen (PRD §8.11)
  - Fördermitgliedschaft-Subscriptions in allen vier Stufen lauffähig mit Sync gegen `nutzer.foerdermitglied_seit/bis`
  - Werkstatt-Kasse-Quartalsabschluss-Workflow (Kurator:in erfasst, Admin gibt frei) E2E-getestet
created_at: 2026-05-13T09:48:12.162Z
created_by: human
edges:
  composed_of:
    - id: goal-root
id: geld-und-mitgliedschaft
is_root: false
open_questions: []
owner: null
parent: goal-root
private: false
risks: []
status: draft
summary: Stripe-Integration jenseits Werkstattbeitrag. Erfolgsbeitrag als freiwillige Spende, transparente Werkstatt-Kasse pro Stadt mit Quartalsabschluss, Fördermitgliedschaft-Subscriptions in vier Stufen.
tags: []
title: "Geld: Erfolgsbeitrag, Werkstatt-Kasse, Fördermitgliedschaft"
type: subproject
updated_at: 2026-05-13T09:48:12.162Z
---

## Was hier gebaut wird

Der ökonomische Tragfähigkeits-Pfad ohne Provisionsmodell. Werkzirkel nimmt nichts vom Honorar der Macher:innen — die Werkstatt-Kasse wird über drei freiwillige Mechanismen gespeist.

## Komponenten

- **Erfolgsbeitrag (§21, §F-607 fortgeführt):** Bei Bedarf-Erfüllung optional 5 % als Spende, Slider 0-10 %, Stripe Checkout mit One-time Payment, kein Inkasso vom Macher:innen-Honorar.
- **Werkstatt-Kasse (§8.11):** Pro Stadt öffentliche Eingangs-/Ausgangs-Liste, Quartalsbericht durch Kurator:in eingegeben und durch Admin freigegeben. Eingänge: werkstattbeitraege/erfolgsbeitraege/foerder_mitgliedsbeitraege/sonstige_spenden. Ausgänge: raum_miete/getraenke/kurator_aufwand/werkzeug_hosting.
- **Fördermitgliedschaft (§8.13):** Stripe Subscriptions in 4 Stufen (monatlich 9 €, jährlich 90 €, foerderer_privat 240 €/Jahr, foerderer_organisation 1.200 €/Jahr). Webhook-Sync, Limits durchsetzen (mehrere Werke etc.).
- **Stripe-Webhook-Handler (§15.11):** Signaturprüfung, checkout.session.completed → werkstattbeitrag/erfolgsbeitrag/foerdermitgliedschaft Eintrag + Kasse-Eintrag.

## Anti-Goal

Keine Provision auf Vermittlungen. Plattform stellt keine Rechnung als Vermittler:in. Erfolgsbeitrag = Spende, niemals als Gebühr formuliert.