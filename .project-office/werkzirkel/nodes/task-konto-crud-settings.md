---
acceptance_criteria:
  - Erfuellt PRD §F-001 bis §F-005 vollstaendig (Konto-Registrierung, Stadt, Werkpass, Teilnahmeart, Deaktivierung)
  - "`GET /api/v1/me` gibt vollstaendiges eigenes Profil zurueck; `PATCH /api/v1/me` aktualisiert mit Zod-validiertem Body"
  - Avatar-Upload `POST /api/v1/me/avatar` validiert MIME (jpeg|png|webp), max 2MB, persistiert resized 256+512 WebP in R2
  - "App-Validierung erzwingt: wenn `rollen` `bedarfstraeger` oder `foerderer` enthaelt, ist `klarname` Pflicht (Test deckt diesen Fehlerpfad ab)"
  - UI-Seite `/einstellungen` rendert die drei Tabs (Profil, Benachrichtigungen, Datenschutz) als Server Components mit Server Actions
created_at: 2026-05-13T09:58:44.228Z
created_by: human
edges:
  blocks:
    - id: task-konto-loeschung
  composed_of:
    - id: wp-auth
  depends_on:
    - id: task-magic-link-endpoints
effort: S
id: task-konto-crud-settings
is_root: false
open_questions: []
owner: null
parent: wp-auth
private: false
risks: []
status: draft
summary: GET/PATCH /api/v1/me (Profil-Lese/Update), POST /api/v1/me/avatar (R2-Upload mit sharp-Resize), Pause-Konto-Aktion, UI unter /einstellungen mit drei Tabs (Profil, Benachrichtigungen, Datenschutz).
tags: []
title: "Konto-Einstellungen: Profil-Edit, Avatar-Upload, Pause, Benachrichtigungen"
type: task
updated_at: 2026-05-13T09:58:44.228Z
---

## Approach

Server-Component-basierte UI in `apps/web/app/einstellungen/page.tsx` mit drei Tabs:
1. Profil: Klarname, Anzeigename, Stadt, Rollen (Mehrfachauswahl), Faehigkeiten, Avatar
2. Benachrichtigungen: `nutzer.benachrichtigungs_einstellungen` JSONB-Felder als Checkbox-Liste
3. Datenschutz: DSGVO-Self-Service-Buttons (kommt in task-dsgvo-export)

Server Actions fuer Updates. Validierung mit Zod-Schemas in `lib/validators/nutzer.ts` — gleichzeitig im Client (react-hook-form) und Server (POST/PATCH-Handler).

Avatar-Upload: Multipart-FormData → sharp resized zu 256x256 + 512x512 WebP → R2-Upload nach `avatare/<nutzer-id>-<size>.webp` → URL in `nutzer.avatar_url` speichern.

Konto-Pause: `nutzer.status='pausiert'`. Alle eigenen Werke werden via Sichtbarkeit weiterhin oeffentlich gezeigt (Pause bezieht sich nur auf neue Aktivitaet, nicht auf bisherige Inhalte).

## Pitfalls

- Klarname-Pflicht: wenn `rollen` `bedarfstraeger` oder `foerderer` enthaelt, muss `klarname` nicht-leer sein (App-Validierung in Zod).
- Avatar-Original wird NICHT gespeichert (DSGVO-Datenminimierung). Nur die zwei resized-Varianten.
- Benachrichtigungs-Einstellungen-Defaults: zentral in `lib/notifications/defaults.ts`, nicht hardcoded.