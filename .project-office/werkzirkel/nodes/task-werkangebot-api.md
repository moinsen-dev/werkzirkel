---
acceptance_criteria:
  - Erfuellt PRD §F-621 bis §F-625 (Werkangebote-API + Privacy) vollstaendig
  - "Erfuellt PRD §11A Schutz S2 (Werkangebote nicht oeffentlich) — Privacy-Test: anonymer GET → 401, fremde Macher:in → 403, nur Bedarfstraeger:in + eigene Macher:in sehen relevantes"
  - UNIQUE(bedarf_id, werk_id) Constraint verhindert Mehrfach-Werkangebote pro Werk × Bedarf (Integration-Test verifiziert ON CONFLICT → 422)
  - Werkangebot-Counter ist NICHT in public Werk-Detail-Response sichtbar (Unit-Test scannt das JSON-Schema)
  - Email-Templates T-201 + T-202 implementiert
created_at: 2026-05-14T06:03:26.098Z
created_by: human
edges:
  blocks:
    - id: task-bedarfsseite-pages
  composed_of:
    - id: bedarfsseite
  depends_on:
    - id: task-bedarf-crud-api
effort: S
id: task-werkangebot-api
is_root: false
open_questions: []
owner: null
parent: bedarfsseite
private: false
risks: []
status: done
summary: "POST/GET/PATCH /api/v1/bedarfe/:id/werkangebote mit Schutzmechaniken: Werkangebote sind NICHT oeffentlich, nur Bedarfstraeger:in und Werk-Inhaber:in sehen sie. PRD-Schutz S2/S3."
tags: []
title: "Werkangebot-API: Privacy-Layer S2/S3, max 1 pro Werk × Bedarf, T-201/T-202"
type: task
updated_at: 2026-05-14T07:33:30.416Z
---

## Approach

Der kritischste Privacy-Layer in Werkzirkel. PRD §11A Schutz S2 + S3: Werkangebote sind nicht oeffentlich, kein Pitch-Wettbewerb.

### Validators

`apps/web/lib/validators/werkangebot.ts`:
```ts
export const werkangebotAnlegenSchema = z.object({
  werk_id: z.string().min(1),
  konkretes_vorgehen: z.string().min(50).max(3000),
  ausdruecklicher_ausschluss: z.string().min(20).max(2000),
  erster_liefer_meilenstein: z.string().min(20).max(1000),
});
```

### Endpoints

#### POST /api/v1/bedarfe/:id/werkangebote
- Auth + Macher:innen-Rolle.
- Bedarf muss status='oeffentlich' sein.
- werk_id muss dem User gehoeren (werk.nutzer_id == current.id).
- UNIQUE(bedarf_id, werk_id) Constraint catcht Mehrfach-Werkangebote pro Werk × Bedarf (ON CONFLICT → 422 'bereits_eingereicht').
- INSERT werkangebot mit status='eingereicht'.
- sendMail T-201 an Bedarfstraeger:in.
- Audit-log.
- Returns 201.

#### GET /api/v1/bedarfe/:id/werkangebote (Bedarfstraeger:in-only)
- Permission: current.id == bedarf.nutzer_id (Bedarfstraeger:in).
- ODER: current.id ist Macher:in eines der Werke (sieht nur eigenes).
- Sonst 403.
- Werkangebote mit Werk-Public-Daten + Macher:in-Anzeigename + erster_liefer_meilenstein-Excerpt.
- WICHTIG: KEINE Zaehler 'Wieviele Werkangebote hat dieser Bedarf'-Endpoint fuer Aussenstehende.
- Returns 200.

#### GET /api/v1/me/werkangebote (Macher:in-Sicht)
- Auth.
- Liste eigener werkangebote mit bedarf-Public-Daten + status.
- Returns 200.

#### PATCH /api/v1/werkangebote/:id
- Status-Updates:
  - Bedarfstraeger:in kann setzen: in_gespraechen, beauftragt, nicht_gewaehlt
  - Macher:in kann setzen: zurueckgezogen
- T-202 versenden an Macher:in bei status-Wechsel (in_gespraechen/beauftragt/nicht_gewaehlt).
- Audit-log.
- Returns 200.

### Privacy-Tests

`apps/web/tests/integration/werkangebot-privacy.test.ts`:
- Werkangebot anlegen.
- Anonymer GET /api/v1/bedarfe/:id/werkangebote → 401.
- Macher:in mit anderem Werk GET → 403 (nur Bedarfstraeger:in oder beteiligte Macher:in).
- Bedarfstraeger:in GET → 200 mit Liste.
- Beteiligte Macher:in GET → 200 nur mit EIGENEM werkangebot (nicht anderen).
- Auch in Werk-Detail-Page-Response: KEIN werkangebote-Counter im public field map.

### Email-Templates

- T-201 werkangebot-eingegangen (an Bedarfstraeger:in)
- T-202 werkangebot-status-geaendert (an Macher:in)

## Quality gate

```
cd /Users/udi/work/moinsen/ideas/werkzirkel/apps/web && rm -rf .next && pnpm exec vitest run
cd .. && pnpm typecheck && NODE_ENV=production pnpm build
```

DO NOT touch:
- Foerderprofil-API (parallel task).
- Pages (eigener Task).

Started 2026-05-14T07:22:22.881Z: autobuild bedarf iter 6

Done 2026-05-14T07:33:30.416Z: Werkangebot-API: Privacy S2/S3 + UNIQUE-Constraint + T-201/T-202 (Tests: green via `cd /Users/udi/work/moinsen/ideas/werkzirkel/apps/web && pnpm exec vitest run`)
