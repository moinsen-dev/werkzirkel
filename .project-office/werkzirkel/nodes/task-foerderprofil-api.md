---
acceptance_criteria:
  - Erfuellt PRD §F-701 bis §F-706 (Foerderprofil-API + Verifikation + equity-Hinweis) vollstaendig
  - Auto-Pause-Cron /api/v1/cron/foerderprofil-quartal-pruefen pausiert Profile mit letzte_bedarfsschau_am < (now - 12 Monate)
  - Bedarfsschau-Anwesenheits-Hook reaktiviert pausierte Foerderprofile via termin_typ='bedarfsschau' + status='anwesend'
  - GET /:id rendert Equity-Hinweistext explizit wenn gegenleistung_typ='equity_offline' (PRD §11A Schutz Kulturverlust 5)
  - Stripe-IDs (stripe_customer_id, stripe_subscription_id) sind NICHT in public-field-map enthalten (Unit-Test prueft JSON-Schema)
  - Email-Templates T-501..T-505 implementiert
created_at: 2026-05-14T06:03:26.098Z
created_by: human
edges:
  blocks:
    - id: task-bedarfsschau-integration
    - id: task-bedarfsseite-pages
  composed_of:
    - id: bedarfsseite
  depends_on:
    - id: task-bedarfstraeger-foerderer-rolle-flow
effort: S
id: task-foerderprofil-api
is_root: false
open_questions: []
owner: null
parent: bedarfsseite
private: false
risks: []
status: done
summary: POST/GET/PATCH /api/v1/foerderprofile mit Verifikations-Workflow. Cron pausiert Profile automatisch wenn 4 Quartale ohne Bedarfsschau-Teilnahme. T-501..T-505 Emails.
tags: []
title: Foerderprofil-API + Kurator-Verifikation + Auto-Pause-Cron
type: task
updated_at: 2026-05-14T06:37:22.913Z
---

## Approach

### Validators

`apps/web/lib/validators/foerderprofil.ts`:
```ts
export const foerderprofilAnlegenSchema = z.object({
  organisation: z.string().min(1).max(200),
  foerderart: z.enum(['geld', 'raum', 'mentoring', 'sachmittel', 'vertriebszugang', 'mischung']),
  foerderrahmen_jahr_min_euro_cent: z.number().int().min(0).optional(),
  foerderrahmen_jahr_max_euro_cent: z.number().int().min(0).optional(),
  foerderrahmen_einzel_max_euro_cent: z.number().int().min(0).optional(),
  bevorzugte_werke: z.string().max(2000).optional(),
  gegenleistung_typ: z.enum(['keine', 'sichtbarkeit', 'berichterstattung', 'equity_offline', 'mischung']),
  gegenleistung_text: z.string().max(2000).optional(),
});
```

### Endpoints unter /api/v1/foerderprofile/

#### POST / (anlegen)
- Auth + Foerder:innen-Rolle.
- UNIQUE(nutzer_id) — pro User max 1 Foerderprofil.
- INSERT mit verifikation_status='entwurf'.
- Returns 201.

#### POST /:id/einreichen (entwurf → in_verifikation)
- Permission + status='entwurf'.
- UPDATE status='in_verifikation'.
- sendMail T-501 an Foerder:in (Bestaetigung).
- Notification an alle Hamburg-Kurator:innen (interne stadt-mail-Adresse).
- Returns 200.

#### POST /:id/pausieren (selbst pausieren)
- Permission + status='verifiziert'.
- UPDATE status='pausiert', pausiert_seit=now().
- Returns 200.

#### POST /:id/reaktivieren (pausiert → in_verifikation, neue Pruefung)
- Permission + status='pausiert'.
- UPDATE status='in_verifikation'.
- Returns 200.

#### GET / Liste (eingeloggt-only)
- Auth.
- Filter: stadt (via JOIN nutzer.stadt_id), foerderart, gegenleistung_typ.
- Nur status='verifiziert' (nicht pausiert, nicht entwurf).
- Returns 200.

#### GET /:id
- Auth fuer status='verifiziert', sonst nur Owner und Kurator.
- Public-fields wie organisation, foerderart, foerderrahmen, gegenleistung. KEINE stripe-IDs, KEIN privat-email.
- WICHTIGER PRD-Hinweis bei gegenleistung_typ='equity_offline': rendere expliziten Hinweistext ('Werkzirkel vermittelt keine Beteiligungen').
- Returns 200.

#### PATCH /:id
- Permission + status IN ('entwurf', 'verifiziert').
- Returns 200.

### Kurator-Endpoints

#### POST /api/v1/kurator/foerderprofile/:id/verifizieren
- istKuratorVon(stadt des Foerderers).
- Status muss 'in_verifikation' sein.
- UPDATE status='verifiziert', verifizierer_id, verifiziert_am.
- sendMail T-502.
- Returns 200.

#### POST /api/v1/kurator/foerderprofile/:id/ablehnen
- Body: { grund }.
- UPDATE status='abgelehnt'.
- sendMail T-503.
- Returns 200.

### Auto-Pause-Cron

`/api/v1/cron/foerderprofil-quartal-pruefen` (taeglich):
- SELECT foerderprofile WHERE status='verifiziert' AND letzte_bedarfsschau_am < (now() - INTERVAL '4 quarters' / '12 months').
- UPDATE status='pausiert', pausiert_seit=now().
- sendMail T-504 an betroffene Foerder:innen.
- Audit-log.
- Returns 200 mit Counts.

### Bedarfsschau-Teilnahme-Hook (im termin-anwesenheit-Endpoint)

Der existing termin-anwesenheit-Endpoint hat schon einen Werkstattbeitrag-Hook bei schauabend-Teilnahme. ANALOG: wenn termin.typ='bedarfsschau' UND nutzer hat foerderer-Rolle UND nutzer hat verifiziertes Foerderprofil:
- UPDATE foerderprofil SET letzte_bedarfsschau_id=termin.id, letzte_bedarfsschau_am=termin.datum_uhrzeit.
- Wenn Foerderprofil status='pausiert' war: UPDATE status='verifiziert' (Reaktivierung via Anwesenheit, ein Bonus-Pfad).

Dieser Hook wird im selben File wie der Werkstattbeitrag-Hook im termin-anwesenheit-Endpoint angesiedelt.

### Email-Templates

- T-501 foerderprofil-eingereicht
- T-502 foerderprofil-verifiziert
- T-503 foerderprofil-abgelehnt
- T-504 foerderprofil-pausiert
- T-505 foerderprofil-bedarfsschau-erinnerung (vom Auto-Pause-Cron — Quartalsende-Hinweis)

### Tests

`apps/web/tests/integration/foerderprofil-crud.test.ts`:
- POST anlegen → 201.
- Einreichen → status='in_verifikation', T-501 versendet.
- Kurator verifizieren → status='verifiziert', T-502 versendet.
- Pausieren → status='pausiert'.
- Reaktivieren → status='in_verifikation'.

`apps/web/tests/integration/foerderprofil-auto-pause-cron.test.ts`:
- Foerderprofil mit letzte_bedarfsschau_am=vor 13 Monaten + status='verifiziert'.
- Cron-Lauf → status='pausiert', T-504 versendet.
- Foerderprofil mit letzte_bedarfsschau_am=vor 6 Monaten → bleibt 'verifiziert'.

`apps/web/tests/integration/foerderprofil-bedarfsschau-hook.test.ts`:
- Termin Typ='bedarfsschau', Foerder:in als 'anwesend' markiert → foerderprofil.letzte_bedarfsschau_am aktualisiert.
- Wenn vorher pausiert → reaktiviert auf 'verifiziert'.

## Quality gate

```
cd /Users/udi/work/moinsen/ideas/werkzirkel/apps/web && rm -rf .next && pnpm exec vitest run
cd .. && pnpm typecheck && NODE_ENV=production pnpm build
```

Started 2026-05-14T06:22:41.681Z: autobuild bedarf iter 2

Done 2026-05-14T06:37:22.913Z: Foerderprofil-API + Verifikations-Workflow + Auto-Pause-Cron + Bedarfsschau-Hook + T-501..T-505 (Tests: green via `cd /Users/udi/work/moinsen/ideas/werkzirkel/apps/web && pnpm exec vitest run`)
