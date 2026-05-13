---
acceptance_criteria:
  - Erfüllt PRD §F-001 bis §F-005 (Konto + DSGVO-Self-Service) vollständig
  - Erfüllt PRD §F-101 bis §F-106 (Werke) vollständig
  - Erfüllt PRD §F-201 bis §F-209 (Prüfrunden mit Reziprozität) vollständig
  - Erfüllt PRD §F-401 bis §F-405 (Termine) vollständig
  - "`pnpm test` deckt Reziprozitäts-Engine, Magic-Link-Verifikation und Termin-Slot-Logik mit Unit- + Integration-Tests ab"
created_at: 2026-05-13T09:48:12.161Z
created_by: human
edges:
  composed_of:
    - id: goal-root
  decomposes_into:
    - id: wp-auth
    - id: wp-werkpass-werke
    - id: wp-pruefrunden
    - id: wp-termine
    - id: wp-glue-pages
id: plattform-kern
is_root: false
open_questions: []
owner: null
parent: goal-root
private: false
risks: []
status: draft
summary: Macher:innen-Seite der Plattform. Auth, Werkpass, Werk-CRUD mit Screenshots und Werkstand-Historie, Prüfrunden mit Reziprozitäts-Engine, Termin-System mit Anmeldung und iCal-Export. Deckt PRD-Sprints 2-4 und schließt die Auth-Lücken aus Sprint 1.
tags: []
title: "Plattform-Kern: Konto, Werke, Prüfrunden, Termine"
type: subproject
updated_at: 2026-05-13T09:48:12.161Z
---

## Was hier gebaut wird

Die Macher:innen-Sicht der Plattform. Ohne diesen Kern gibt es nichts, was die anderen Subprojekte (Bedarfsseite, Geld, Polish) sinnvoll erweitern könnten — er ist die unerlässliche Basis.

## Komponenten

- **Auth-Vollintegration:** Magic-Link via Better-Auth, E-Mail-Verifikation, Session-Management, Konto-Einstellungen, Konto-Löschung mit 7-Tage-Karenz, DSGVO-Self-Service (Export, Auskunft).
- **Werkpass & Werk-CRUD:** Profil-Felder gemäß PRD §8.2, Werk-CRUD gemäß §8.3, Screenshot-Upload nach R2 mit sharp-Resize, Werkstand-Historie.
- **Prüfrunden & Reziprozität:** Prüfrunde-CRUD §8.4, Tester:innen-Anmeldung mit Slot-System, Feedback-Eingabe, Reziprozitäts-Engine §17 mit täglichem Cron-Job, hilfreich-Markierung.
- **Termine:** Termin-CRUD durch Kurator:innen §8.8, Slot-Anmeldung mit Warteliste, iCal-Export, Erinnerungs-Cron stündlich, Anwesenheits-Dokumentation nach dem Termin.

## Anti-Goal

Keine Bedarfsträger:innen-/Förder:innen-Funktionalität — die folgt in einem späteren Subprojekt. Hier nur die Macher:innen-Seite und die Termine, die das Foundation-Layer für Bedarfsschauen mit-anlegen.