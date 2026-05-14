---
acceptance_criteria:
  - Erfuellt PRD §F-601 bis §F-605 (Bedarf-CRUD mit Werkstattbeitrag-Nachweis-Pflicht + Kurator-Moderation) vollstaendig
  - "Erfuellt PRD §14.3 (Bedarf-Statusmaschine: entwurf → in_pruefung → oeffentlich → in_gespraechen → erfuellt | eingestellt)"
  - POST /:id/einreichen ohne gueltigen werkstattbeitrag (status='verifiziert', gueltig_bis > now, verwendet_fuer_bedarfe < 4) → 422 mit code='werkstattbeitrag_fehlt'
  - "Sprach-Check via lib/moderation/verbotene-woerter.ts: Treffer in titel/problem/nutzen/organisation wird als audit_log-Eintrag dokumentiert (Kurator:in sieht ihn)"
  - Kurator veroeffentlichen-Endpoint inkrementiert werkstattbeitrag.verwendet_fuer_bedarfe um 1 (Limit max 4 wird so durchgesetzt)
  - Email-Templates T-301..T-303 + sendMail-Union erweitert
created_at: 2026-05-14T06:03:26.098Z
created_by: human
edges:
  blocks:
    - id: task-werkangebot-api
  composed_of:
    - id: bedarfsseite
  depends_on:
    - id: task-werkstattbeitrag-api
effort: S
id: task-bedarf-crud-api
is_root: false
open_questions: []
owner: null
parent: bedarfsseite
private: false
risks: []
status: done
summary: Bedarf-Endpunkte gemaess PRD §15.5 + §F-601..§F-607. Status-Maschine entwurf → in_pruefung → oeffentlich → in_gespraechen → erfuellt | eingestellt. Sprach-Check via verbotener Begriffe. Werkstattbeitrag-Gate beim Einreichen. T-301..T-304 Emails.
tags: []
title: "Bedarf-CRUD-API: Status-Maschine, Werkstattbeitrag-Gate, Sprach-Check, Kurator-Moderation"
type: task
updated_at: 2026-05-14T07:21:26.248Z
---

## Approach

Bedarf-CRUD mit zwei kritischen Schutzmechaniken:
1. **Werkstattbeitrag-Gate**: Bedarf kann nicht in 'oeffentlich' ohne gueltigen werkstattbeitrag verknuepft.
2. **Sprach-Check**: serverseitige Liste verbotener Begriffe (Sales-Sprech, Marktplatz-Vokabular) — Treffer fuehrt zu 'in_pruefung' statt direkt oeffentlich.

### A) Validators in `apps/web/lib/validators/bedarf.ts`

```ts
export const bedarfAnlegenSchema = z.object({
  organisation: z.string().min(1).max(200),
  titel: z.string().min(1).max(200),
  problem: z.string().min(1).max(5000),
  nutzen: z.string().min(1).max(2000),
  stadt_id: z.string().min(1),
  groessenordnung_zeit_wochen: z.number().int().min(1).max(52).optional(),
  groessenordnung_aufwand_tage: z.number().int().min(1).max(200).optional(),
  geldrahmen_min_euro_cent: z.number().int().min(0).optional(),
  geldrahmen_max_euro_cent: z.number().int().min(0).optional(),
  frist: z.coerce.date().refine(d => d > new Date(Date.now() + 24*60*60*1000)),
  branche: z.string().max(100).optional(),
  bevorzugter_werkstand: z.string().max(100).optional(),
}).refine(d => !d.geldrahmen_min_euro_cent || !d.geldrahmen_max_euro_cent || d.geldrahmen_min_euro_cent <= d.geldrahmen_max_euro_cent, {
  message: 'Geldrahmen Min muss <= Max sein',
});
```

### B) Sprach-Check in `apps/web/lib/moderation/verbotene-woerter.ts`

```ts
export const VERBOTENE_BEGRIFFE = [
  'pitch', 'pitch deck', 'ausschreibung', 'bewerbung', 'matching', 'marktplatz',
  'roi', 'investment opportunity', 'scale', 'leads', 'sales pipeline',
  'unicorn', 'disruptor', '10x', 'hustle',
];

export function checkSprache(text: string): { ok: boolean; treffer: string[] } {
  // case-insensitive, word-boundary regex
}
```

### C) Endpoints unter /api/v1/bedarfe/

#### POST / (Entwurf anlegen)
- Auth + Bedarfstraeger:innen-Rolle.
- Klarname + Organisation muessen gesetzt sein.
- INSERT bedarf mit status='entwurf', nutzer_id=current.id.
- Returns 201.

#### POST /:id/einreichen (entwurf → in_pruefung)
- Permission + status='entwurf'.
- **Werkstattbeitrag-Gate**: SELECT werkstattbeitrag WHERE nutzer_id AND status='verifiziert' AND (gueltig_bis IS NULL OR gueltig_bis > now()) AND verwendet_fuer_bedarfe < 4. Wenn keine Row: 422 mit code='werkstattbeitrag_fehlt'.
- **Sprach-Check** auf titel + problem + nutzen + organisation.
  - Wenn Treffer: status='in_pruefung' (Kurator muss freischalten), audit_log mit Treffern.
  - Wenn clean: status auch 'in_pruefung' (PRD §14.3 — Kurator prueft IMMER vor 'oeffentlich').
- UPDATE bedarf SET werkstattbeitrag_id, status='in_pruefung'.
- sendMail T-301 an Bedarfstraeger:in (Bestaetigung).
- Returns 200.

#### POST /:id/erfuellt
- Permission + status IN ('oeffentlich', 'in_gespraechen').
- Body: `{ werk_id?: string, selbstauskunft_min_euro_cent?: number, selbstauskunft_max_euro_cent?: number }`.
- UPDATE status='erfuellt', erfuellt_von_werk_id, erfuellt_am, selbstauskunft.
- Audit-log.
- Returns 200.

#### POST /:id/einstellen (entwurf|in_pruefung|oeffentlich|in_gespraechen → eingestellt)
- Permission. status != 'erfuellt' (wer schon erfuellt hat soll nicht 'einstellen').
- UPDATE status='eingestellt'.
- Returns 200.

#### GET / Liste (eingeloggt-only!)
- Auth required (anonyme bekommen 401).
- Filter: stadt_id, status (default 'oeffentlich','in_gespraechen'), geldrahmen-range.
- Sortierung: frist ASC.
- Cursor-Pagination.
- Returns 200.

#### GET /:id
- Auth.
- Public-Fields des Bedarfs. Wenn current.id == bedarf.nutzer_id: zusatzlich werkangebote-counter und alle werkangebote-IDs (für Inhaberin-View).
- Returns 200.

#### PATCH /:id (Edit)
- Permission + status='entwurf'.
- Returns 200.

### D) Kurator-Endpoints

#### GET /api/v1/kurator/bedarfe-in-pruefung
- istKuratorVon(stadt) — Liste aller bedarfe der Stadt mit status='in_pruefung'.
- Returns 200 mit list + sprach-check-Treffer pro Bedarf.

#### POST /api/v1/kurator/bedarfe/:id/veroeffentlichen
- Permission. Status muss 'in_pruefung' sein.
- UPDATE status='oeffentlich'.
- UPDATE werkstattbeitrag.verwendet_fuer_bedarfe + 1.
- sendMail T-302 an Bedarfstraeger:in.
- Returns 200.

#### POST /api/v1/kurator/bedarfe/:id/ablehnen
- Body: `{ grund: string }`.
- UPDATE status='eingestellt'.
- sendMail T-303 mit Grund.
- Returns 200.

### E) Email-Templates

- T-301 bedarf-eingereicht-bestaetigung (an Bedarfstraeger:in)
- T-302 bedarf-veroeffentlicht (an Bedarfstraeger:in)
- T-303 bedarf-abgelehnt (mit Grund)
- T-304 bedarf-frist-naht (wird vom Cron getriggert — separater Task)

### Tests

`apps/web/tests/integration/bedarf-crud.test.ts`:
- POST anlegen → 201, status='entwurf'.
- POST einreichen ohne werkstattbeitrag → 422 mit code='werkstattbeitrag_fehlt'.
- POST einreichen mit gueltigem werkstattbeitrag → 200, status='in_pruefung'.
- Sprach-Check: POST mit 'pitch' im Problem-Feld → status='in_pruefung' + audit_log-Treffer.
- Kurator veroeffentlichen → status='oeffentlich' + werkstattbeitrag.verwendet_fuer_bedarfe++.
- Kurator ablehnen mit Grund → status='eingestellt', T-303 versendet.
- Erfuellt-Markierung mit werk_id → status='erfuellt', erfuellt_von_werk_id gesetzt.

`apps/web/tests/unit/sprach-check.test.ts`:
- 'Hier ist mein Pitch' → trifft.
- 'Pitcher in baseball' → trifft (false positive Beispiel, kann nicht vermieden werden).
- 'Ich brauche Hilfe' → kein Treffer.

## Quality gate

```
cd /Users/udi/work/moinsen/ideas/werkzirkel/apps/web && rm -rf .next && pnpm exec vitest run
cd .. && pnpm typecheck && NODE_ENV=production pnpm build
```

DO NOT touch:
- Werkangebot-API (next task).
- Pages.

Started 2026-05-14T07:08:30.888Z: autobuild bedarf iter 5

Done 2026-05-14T07:21:26.248Z: Bedarf-CRUD + Werkstattbeitrag-Gate + Sprach-Check + Kurator-Moderation + T-301..T-303 (Tests: green via `cd /Users/udi/work/moinsen/ideas/werkzirkel/apps/web && pnpm exec vitest run`)
