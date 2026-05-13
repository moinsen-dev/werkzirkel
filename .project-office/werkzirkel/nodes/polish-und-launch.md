---
acceptance_criteria:
  - Erfüllt PRD §29 (Accessibility BITV/WCAG 2.1 AA) — Lighthouse-Score Accessibility ≥95 auf allen public-routes
  - Erfüllt PRD §30 (Mobile-Layout mit Bottom-Tab-Bar) vollständig
  - Erfüllt PRD §31 (SEO, JSON-LD, sitemap.xml, robots.txt) vollständig
  - Erfüllt PRD §32 (Performance-Budgets) — LCP/CLS/TTI gemessen und in CI verankert
  - k6-Lasttest (200 RPS für 5 min auf Staging) erreicht p95 < 500ms und Fehlerquote < 0.5%
  - Externer Pentest abgeschlossen, alle Findings ≥ HIGH behoben
  - Anwaltliche Prüfung der Rechtstexte (Impressum, Datenschutz, AGB, Regeln) dokumentiert und Empfehlungen umgesetzt
  - "Erfüllt PRD §43 Skalierungs-Gate-Vorbereitung: erste Schauabende in Hamburg datiert und kommuniziert"
created_at: 2026-05-13T09:48:12.162Z
created_by: human
edges:
  composed_of:
    - id: goal-root
id: polish-und-launch
is_root: false
open_questions: []
owner: null
parent: goal-root
private: false
risks: []
status: draft
summary: Sprint 12-16 aus PRD §42. Mobile-Layout-Review mit Bottom-Tab-Bar, A11y-Audit BITV/WCAG AA, Performance-Opt, SEO mit JSON-LD und sitemap, Stadt-Digest-Newsletter, Pre-Launch-QA (E2E, Lasttest, Pentest, Anwalt), Soft-Launch und Public Launch.
tags: []
title: Polish, Mobile, Accessibility, SEO und Public Launch Hamburg
type: subproject
updated_at: 2026-05-13T09:48:12.162Z
---

## Was hier gebaut wird

Der letzte Polish-Streifen vor dem Public Launch in Hamburg. Hier wird aus „läuft technisch” ein „kann man ehrlich an die ersten 200 Macher:innen empfehlen”.

## Komponenten

- **Mobile-Polish (§30):** Bottom-Tab-Bar im App-Bereich (5 Tabs), Touch-Targets ≥44 px, native HTML5-Eingabetypen für mobile Keyboards.
- **Accessibility (§29):** BITV/WCAG 2.1 AA. axe-core in CI, Lighthouse-Score Accessibility ≥95. Fokus-Outlines, Skip-Link, ARIA-Live-Regions, alt-Texte mit Auto-Vorfüllung.
- **SEO & Marketing-Seiten (§31):** Startseite final (aus den drei LPs in Foundation entstanden), JSON-LD Schema.org (Organization, Event, Person, CreativeWork), sitemap.xml dynamisch, robots.txt sauber konfiguriert.
- **Stadt-Digest (§8.14, T-801):** Wöchentlicher Newsletter pro Stadt mit opt-out, Cron Mittwoch 09:00.
- **Performance (§32):** LCP < 2.5s, CLS < 0.1, JS-Bundle < 200kb gz, p95 API < 300ms.
- **Pre-Launch-QA (§38):** E2E-Tests komplett, Lasttest k6 (200 RPS / 5 min), Sicherheits-Scan OWASP ZAP, externer Pentest, anwaltliche Prüfung der Rechtstexte (Impressum, Datenschutz, AGB, Regeln).
- **Soft-Launch & Public Launch Hamburg:** Plattform live mit Direktansprache zunächst, ersten Schauabend zur Plattform-Vorstellung. Akquise gemäß §23 v0.3 starten — Macher:innen-Seite UND Bedarfsträger:innen-/Förder:innen-Seite parallel.

## Anti-Goal

Keine Berliner/Münchner Aktivierung in diesem Subprojekt — die folgt erst, wenn Hamburg trägt (PRD §43 Skalierungs-Gate).