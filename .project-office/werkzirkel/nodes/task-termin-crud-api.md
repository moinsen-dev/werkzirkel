---
acceptance_criteria:
  - Erfuellt PRD §F-401 (Termin-CRUD durch Kurator:innen) und §F-403 (lokal oder online) vollstaendig
  - Erfuellt PRD §15.8 (Termine-Endpunkte) vollstaendig — POST/GET-List/GET-Detail/PATCH/DELETE/veroeffentlichen/absagen/durchgefuehrt
  - "Permission-Layer: Schreib-Operationen nur fuer Kurator:in der jeweiligen Stadt (Admin override) — Integration-Test prueft 403 fuer fremde Kurator:in"
  - absagen-Endpoint versendet T-404 an alle Angemeldeten + Wartelisten (Mock-Mode via email_benachrichtigung_log nachweisbar)
  - "Validierung: Termin muss mindestens 1 Stunde in der Zukunft liegen UND mindestens ort_text oder online_link gesetzt sein"
created_at: 2026-05-13T16:04:07.186Z
created_by: human
edges:
  blocks:
    - id: task-termin-anmeldung-api
    - id: task-ical-export
  composed_of:
    - id: wp-termine
effort: S
id: task-termin-crud-api
is_root: false
open_questions: []
owner: null
parent: wp-termine
private: false
risks: []
status: done
summary: Server-API fuer Termine gemaess PRD §15.8 + §8.8. Erstellen/Bearbeiten/Loeschen nur durch Kurator:innen der jeweiligen Stadt. Status-Maschine geplant → veroeffentlicht → abgesagt | durchgefuehrt. 6 Termin-Typen (Schauabend, Pruefabend, Baurunde, Werkgespraech, Kennenlernrunde, Bedarfsschau).
tags: []
title: "Termin-CRUD-API: POST/GET/PATCH/DELETE durch Kurator:innen, 6 Termin-Typen"
type: task
updated_at: 2026-05-13T16:21:10.001Z
---

## Approach

Fuenf Endpunkte unter `apps/web/app/api/v1/termine/`. Permission-Layer: nur Kurator:innen koennen schreiben (siehe nutzer.rollen + stadt.kurator_id-FK). Lese-Endpunkte sind public fuer status='veroeffentlicht'+'durchgefuehrt'.

### Validators in `apps/web/lib/validators/termin.ts`

```ts
export const terminAnlegenSchema = z.object({
  stadt_id: z.string().min(1),
  typ: z.enum(terminTyp),  // 6 Werte
  titel: z.string().min(1).max(200),
  beschreibung: z.string().min(1).max(5000),
  ort_text: z.string().optional(),
  online_link: z.string().url().optional(),
  datum_uhrzeit: z.coerce.date().refine(d => d > new Date(Date.now() + 1000*60*60), {
    message: 'Termin muss mindestens 1 Stunde in der Zukunft liegen'
  }),
  max_teilnehmer: z.number().int().min(2).max(100),
}).refine(d => d.ort_text || d.online_link, {
  message: 'Termin braucht entweder einen Ort oder einen Online-Link (oder beides)'
});

export const terminPatchSchema = terminAnlegenSchema.partial().omit({ stadt_id: true });
```

### Permission-Helper in `apps/web/lib/auth/permissions.ts` (oder existing)

```ts
export async function istKuratorVon(nutzer_id: string, stadt_id: string): Promise<boolean> {
  // a) nutzer.rollen enthaelt 'kurator' UND nutzer.stadt_id === stadt_id
  // ODER b) stadt.kurator_id === nutzer_id
  // ODER c) nutzer.rollen enthaelt 'admin'
}
```

### Endpunkte

#### POST /api/v1/termine — anlegen
- Auth + istKuratorVon(current, body.stadt_id) — sonst 403.
- Validierung. INSERT termin mit status='geplant', erstellt_von=current.id.
- Returns 201.

#### POST /api/v1/termine/:id/veroeffentlichen — geplant → veroeffentlicht
- Permission-Check.
- Status muss 'geplant' sein.
- Returns 200.

#### GET /api/v1/termine — Liste
- Public.
- Filter: stadt_id, typ (Mehrfach), ab_datum (default now()), bis_datum (optional), status (default ['veroeffentlicht','durchgefuehrt']).
- Sortierung: datum_uhrzeit ASC.
- Cursor-Pagination.
- Returns 200 mit list + nextCursor.

#### GET /api/v1/termine/:id — Detail
- Public fuer non-'geplant'. 'geplant' nur fuer Kurator:in der Stadt.
- Returns 200 mit Termin + Kurator-Public-Info + Anzahl-Anmeldungen (Counter).

#### PATCH /api/v1/termine/:id — bearbeiten
- Permission + Status muss 'geplant' oder 'veroeffentlicht' sein.
- Returns 200.

#### POST /api/v1/termine/:id/absagen — → abgesagt
- Permission. Status muss 'veroeffentlicht' sein.
- Optional Body: `{ absageGrund: string }`.
- Sendet T-404 an alle Angemeldeten + Wartelisten-Personen.
- UPDATE status='abgesagt'.
- Returns 200.

#### POST /api/v1/termine/:id/durchgefuehrt — → durchgefuehrt
- Permission.
- Status muss 'veroeffentlicht' sein + datum_uhrzeit < now().
- UPDATE status='durchgefuehrt'. Anwesenheits-Dokumentation kommt im separaten Task.
- Returns 200.

#### DELETE /api/v1/termine/:id
- Permission. Nur 'geplant'-Termine sind loeschbar (CASCADE raeumt termin_anmeldung + bezuege).
- Returns 204.

### Tests

`apps/web/tests/integration/termin-crud.test.ts`:
- Alle 8 CRUD-Operationen.
- Permission-Tests: nur Kurator:in der Stadt kann schreiben.
- Status-Transitions korrekt.
- 'absagen' versendet T-404 an alle Angemeldeten (Mock-Log).
- 'durchgefuehrt' nur nach Termin-Zeitpunkt.

`apps/web/tests/integration/termine-list.test.ts`:
- Public-Filter.
- Pagination.
- Kurator sieht 'geplant'-Termine eigener Stadt; Public nicht.

### Quality gate

```
cd /Users/udi/work/moinsen/ideas/werkzirkel/apps/web && rm -rf .next && pnpm exec vitest run
cd .. && pnpm typecheck && NODE_ENV=production pnpm build
```

DO NOT touch:
- Anmeldung-API (eigener Task).
- iCal-Export (eigener Task).
- Cron-Erinnerungen.
- UI-Pages.

Started 2026-05-13T16:12:12.036Z: autobuild termine iter 2

Done 2026-05-13T16:21:10.001Z: Termin-CRUD-API: 8 Endpunkte + Permission-Layer (istKuratorVon) + Status-Maschine (Tests: green via `cd /Users/udi/work/moinsen/ideas/werkzirkel/apps/web && pnpm exec vitest run`)
