---
acceptance_criteria:
  - Erfuellt PRD §F-101 bis §F-106 vollstaendig (Werk-CRUD, Filter, Pausieren, Screenshots, Sichtbarkeit)
  - Erfuellt PRD §15.3 vollstaendig (GET/POST/PATCH/DELETE /api/v1/werke[/:id], Screenshots-Endpoints, Historie)
  - Werkpass auf `/uebersicht` zeigt Test-Saldo aus PRD §13.10 (`tests_gegeben`/`tests_erhalten`/`offene_verpflichtung_anzahl`)
  - Screenshot-Upload validiert MIME-Type (jpeg/png/webp), max 5MB raw, persistiert resized in R2 unter `werke/<id>-<size>.<ext>`
  - Werke-Uebersicht hat KEINEN Suchschlitz (siehe PRD Prinzip P4 + Schutzmechanik S5 fuer Bedarfstraeger:innen-Sicht)
created_at: 2026-05-13T09:49:33.795Z
created_by: human
edges:
  composed_of:
    - id: plattform-kern
  decomposes_into:
    - id: task-werk-crud-api
    - id: task-werk-screenshots-r2
    - id: task-werk-detail-page
    - id: task-werk-edit-page
    - id: task-werke-overview
    - id: task-werkpass-public
    - id: task-zirkel-stadt-seite
id: wp-werkpass-werke
is_root: false
open_questions: []
owner: null
parent: plattform-kern
private: false
risks: []
status: done
summary: Macher:innen-Profil (Werkpass mit Test-Saldo-Anzeige) und Werk-Objekt mit Screenshots, Werkstand-Historie, Hilfebedarfs-Tags. Werke-Uebersicht mit Filter-Sidebar, Werk-Detailseite oeffentlich, Hamburg-Zirkelseite mit Werk-Listing.
tags: []
title: "Werkpass & Werke: CRUD, Screenshots, Werkstand-Historie, Uebersicht"
type: workpackage
updated_at: 2026-05-13T14:15:48.644Z
---

## Approach

Werkpass nutzt die `nutzer`-Tabelle mit zusaetzlichem `test_saldo`-Materialisierung (kommt mit Pruefrunde-Workpackage). Werke kommen in `werk`-Tabelle, Werkstand-Wechsel in `werk_historie`. Screenshots werden nach Cloudflare R2 hochgeladen via `sharp`-Resize (1600px JPEG 85). Bis zu 3 Screenshots pro Werk.

Die Werke-Uebersicht hat keinen Suchschlitz (Prinzip P4 Verbindlichkeit), sondern Filter-Sidebar fuer Stadt, Werkstand, Hilfebedarf. Sortierung default `aktualisiert_am DESC`.

## Pitfalls

- Avatar-Resize: 256x256 + 512x512 WebP, Original wird nicht gespeichert (DSGVO-Datenminimierung).
- Werkstand-Historie: jede Aenderung erzeugt einen `werk_historie`-Eintrag — Server Action darf nicht race-en.
- Sichtbarkeit-Logik: `oeffentlich`/`nur_zirkel`/`pausiert` durchgaengig in API-Filtern.
- Max 5 Werke pro Macher:in (kostenlos), unbegrenzt fuer Foerdermitglieder.