---
acceptance_criteria:
  - Erfuellt PRD §F-401 bis §F-405 vollstaendig (Termin-CRUD durch Kurator:innen, Anmeldung, Online/Vor-Ort, max-Teilnehmer, E-Mail-Erinnerung)
  - Erfuellt PRD §15.8 vollstaendig (Termine-Endpoints + iCal-Export)
  - Sechs Termin-Typen funktionieren laut PRD §8.8 (pruefabend, schauabend, bedarfsschau, baurunde, werkgespraech, kennenlernrunde)
  - Slot-System mit automatischer Warteliste — bei Stornierung rueckt Wartelisten-Erste:r automatisch nach
  - E-Mail-Templates T-401 bis T-404 implementiert (Anmeldung bestaetigt, Erinnerung 7d/1d, Absage)
  - Cron `termin-erinnerung-versenden` versendet Erinnerungen stuendlich an angemeldete Personen, idempotent (keine Doppel-Mails)
created_at: 2026-05-13T09:49:33.795Z
created_by: human
edges:
  composed_of:
    - id: plattform-kern
  decomposes_into:
    - id: task-email-templates-termine
    - id: task-termin-crud-api
    - id: task-termin-anmeldung-api
    - id: task-ical-export
    - id: task-termin-anwesenheit-api
    - id: task-termin-cron-erinnerungen
    - id: task-termin-pages
id: wp-termine
is_root: false
open_questions: []
owner: null
parent: plattform-kern
private: false
risks: []
status: done
summary: Termin-CRUD durch Kurator:innen mit sechs Termin-Typen, Slot-Anmeldung mit Warteliste, iCal-Export pro Termin, Erinnerungs-Cron stuendlich (7d/1d vor Termin), Anwesenheits-Dokumentation nach dem Termin durch Kurator:in.
tags: []
title: "Termine: Schauabend, Pruefabend, Baurunde, Werkgespraech, Kennenlernrunde, Bedarfsschau"
type: workpackage
updated_at: 2026-05-14T05:26:42.282Z
---

## Approach

Termine sind Termin-Typ-uebergreifend (PRD §8.8): pruefabend / schauabend / bedarfsschau / baurunde / werkgespraech / kennenlernrunde. Schema unter `termin`, Verknuepfungen zu Werken/Bedarfen/Foerderprofilen ueber separate Bezug-Tabellen (siehe `termin_werk_bezug` etc. in PRD §13.18-§13.20).

Anmeldung mit Slot-System: `max_teilnehmer` als Limit, automatische Warteliste wenn voll. Bei Stornierung ruecken Wartelisten-Plaetze hoch.

iCal-Export via `GET /api/v1/termine/:id/ical` mit RFC-5545-konformem .ics-Body.

Erinnerungs-Cron `termin-erinnerung-versenden` laeuft stuendlich und schickt T-402 (7d), T-403 (1d) an alle Angemeldeten.

Bedarfsschau-Termine sind hier nur als Termin-Typ angelegt — die Bedarfe und Foerderprofile, die in einer Bedarfsschau vorgestellt werden, werden im Bedarfsseite-Subprojekt verknuepft.

## Pitfalls

- Slot-Race: zwei gleichzeitige Anmeldungen duerfen nicht beide auf den letzten Slot — Postgres-Transaktion mit Sperre auf `termin_anmeldung`-Count.
- Anwesenheits-Dokumentation triggert Werkstattbeitrag fuer Bedarfstraeger:innen mit `art=schauabend_teilnahme` (kommt im Bedarfsseite-Workpackage, hier nur Schema-Vorbereitung).
- iCal: Zeitzonen sauber. Europe/Berlin als VTIMEZONE im .ics, nicht UTC.