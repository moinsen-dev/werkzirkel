---
acceptance_criteria:
  - Erfüllt PRD §F-501 bis §F-504 (Moderation) vollständig
  - Hilfegesuche §8.15 CRUD + Antworten lauffähig
  - Melden-Knopf an allen sieben Referenz-Typen (werk, bedarf, werkangebot, foerderprofil, nutzer, feedback, hilfegesuch_antwort) im UI vorhanden
  - Kurator:innen-Dashboard rendert alle sechs Listen aus PRD §26 (Bedarfe, Förderprofile, Werkstattbeiträge, Meldungen, Termine, Kasse)
  - Admin-Endpunkte aus PRD §15.14 implementiert und Permissions-getestet
created_at: 2026-05-13T09:48:12.162Z
created_by: human
edges:
  composed_of:
    - id: goal-root
id: moderation-admin-hilfegesuche
is_root: false
open_questions: []
owner: null
parent: goal-root
private: false
risks: []
status: draft
summary: "Governance-Layer: Hilfegesuche mit Kommentaren, Meldungssystem mit Kurator:innen-Postfach, Admin-Backoffice für Nutzer:innen-Sperrung, Stadt-Verwaltung, Audit-Log-Browser."
tags: []
title: Moderation, Admin, Hilfegesuche
type: subproject
updated_at: 2026-05-13T09:48:12.162Z
---

## Was hier gebaut wird

Das, was nach den Kernfeatures noch fehlt: Hilfegesuche (kleines Mini-Forum-Feature), Moderations-Workflow für Meldungen, und das vollständige Admin-Backoffice. Ohne diesen Layer kann die Hamburger Kurator:in nicht arbeiten.

## Komponenten

- **Hilfegesuche (§8.15, §F-15.x):** Macher:innen können kleine Hilfegesuche mit max 14 Tagen Gültigkeit posten, Antworten als Kommentare (einziges Kommentar-Feature in v1.0), Tag-/Stadt-Filter.
- **Melde-System (§27, §F-503):** Melde-Knopf an allen Inhalten (Werk, Bedarf, Werkangebot, Förderprofil, Nutzer:in, Feedback, Hilfegesuch-Antwort) mit fünf Kategorien (cold_outreach, sales_sprech, spam, beleidigung, sonstiges). Kurator:innen-Postfach SLA 48h.
- **Kurator:innen-Dashboard (§26):** Offene Bedarfe in Prüfung, offene Förderprofile in Verifikation, offene Werkstattbeitrags-Verifikationen, offene Meldungen, anstehende Termine, Werkstatt-Kasse-Entwurf.
- **Admin-Backoffice (§15.14):** Nutzer:innen-Suche, Sperren/Entsperren, Städte anlegen, Kurator:in ernennen, Audit-Log-Browser, E-Mail-Log-Browser, globale Konfiguration (Werkstattbeitrag-Skala, verbotene Wörter).