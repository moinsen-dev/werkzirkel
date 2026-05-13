---
acceptance_criteria:
  - Erfüllt PRD §F-601 bis §F-607 (Bedarfe) vollständig
  - Erfüllt PRD §F-621 bis §F-625 (Werkangebote) vollständig
  - Erfüllt PRD §F-701 bis §F-706 (Förderprofile) vollständig
  - Erfüllt PRD §F-801 bis §F-805 (Schutzmechaniken) vollständig
  - Werkstattbeitrag-Workflow (PRD §18) mit allen drei Pfaden implementiert und durch E2E-Test verifiziert
  - Förderprofil-Verifikations-Workflow (PRD §19) inkl. Auto-Pause-Cron implementiert
created_at: 2026-05-13T09:48:12.162Z
created_by: human
edges:
  composed_of:
    - id: goal-root
id: bedarfsseite
is_root: false
open_questions: []
owner: null
parent: goal-root
private: false
risks: []
status: draft
summary: Die Nachfrageseite mit den fünf Schutzmechaniken aus PRD §11A. Bedarfsträger:innen-Rolle, Werkstattbeitrag-Pfade (Schauabend/Geld/Sachleistung), Bedarf-CRUD mit Sprach-Check, Werkangebote nicht öffentlich, Förderprofile mit Kurator:innen-Verifikation und Auto-Pause.
tags: []
title: "Bedarfsseite: Bedarfsträger:innen, Werkstattbeitrag, Werkangebote, Förderprofile"
type: subproject
updated_at: 2026-05-13T09:48:12.162Z
---

## Was hier gebaut wird

Der Hybrid-Charakter von Werkzirkel: Bedarfsträger:innen und Förder:innen kommen in den Kreis, ohne dass die Werkstatt-Kultur zur Akquise-Plattform mutiert. Alle fünf Schutzmechaniken aus PRD §11A werden technisch durchgesetzt.

## Komponenten

- **Werkstattbeitrag-Workflow (§18):** Drei Pfade (Schauabend-Teilnahme automatisch via Anwesenheits-Dokumentation, Geldbeitrag via Stripe Checkout 50/100/150 €, Sachleistung mit Kurator:innen-Verifikation). Gültigkeit 4 Bedarfe oder 6 Monate.
- **Bedarf-CRUD (§8.5, §F-601 bis §F-607):** Bedarfsträger:innen-Rolle, Pflichtfelder, Sprach-Check beim Einreichen mit serverseitiger verbotene-Wörter-Liste, Kurator:innen-View für Bedarfs-Prüfung, Status-Maschine §14.3.
- **Werkangebote (§8.6, §F-621 bis §F-625):** Macher:innen antworten auf Bedarfe mit strukturiertem Vorschlag. Sichtbarkeit nur für Bedarfsträger:in + Werk-Inhaber:in (Permissions im API-Layer, kein Postgres-RLS). Pro Bedarf × Werk max 1 Werkangebot (UNIQUE-Constraint).
- **Förderprofile (§8.7, §F-701 bis §F-706):** Förder:innen-Rolle, Verifikations-Workflow §19 (Kurator:in prüft Klarname/Mittel, persönliches Vorstellungsgespräch), Auto-Pause-Cron nach 4 Quartalen ohne Bedarfsschau-Teilnahme.
- **Schutzmechaniken §F-801 bis §F-805:** Keine DMs an Nachfrageseite, Werkangebote nicht öffentlich, kein Personen-Suchschlitz für Bedarfsträger:innen, Cold-Outreach-Meldung möglich.

## Anti-Goal

Kein algorithmisches Matching, keine Bewerber-Zahlen, keine Equity-Vermittlung. Werkzirkel ist Sichtbarkeitsbühne, nicht Marktplatz.