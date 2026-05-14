---
acceptance_criteria:
  - Cron-Endpoint /api/v1/cron/termin-erinnerung-versenden mit X-Cron-Secret-Header (401 ohne)
  - T-402 wird an alle Angemeldeten (NICHT Wartelisten-Personen) bei 7-Tage-Fenster versendet, idempotent via audit_log-Dedup
  - T-403 wird im 1-Tag-Fenster versendet, idempotent
  - Termine mit status='abgesagt' oder 'durchgefuehrt' triggern keine Erinnerungen
  - Erfuellt PRD §F-405 (E-Mail-Erinnerungen vor Termin) und §11 (Cron `termin-erinnerung-versenden` stuendlich) vollstaendig
created_at: 2026-05-13T16:04:07.186Z
created_by: human
edges:
  composed_of:
    - id: wp-termine
  depends_on:
    - id: task-termin-anmeldung-api
    - id: task-email-templates-termine
effort: S
id: task-termin-cron-erinnerungen
is_root: false
open_questions: []
owner: null
parent: wp-termine
private: false
risks: []
status: done
summary: Stuendlicher Cron /api/v1/cron/termin-erinnerung-versenden mit X-Cron-Secret. Versendet T-402 (7 Tage vor Termin) und T-403 (1 Tag vor Termin) idempotent via audit_log-Dedup an alle angemeldeten Nutzer:innen (nicht Warteliste).
tags: []
title: "Cron: Termin-Erinnerungen 7d/1d versenden"
type: task
updated_at: 2026-05-13T16:50:44.507Z
---

## Approach

Endpoint `apps/web/app/api/v1/cron/termin-erinnerung-versenden/route.ts`.

### Logik

1. Auth via X-Cron-Secret.
2. SELECT termin WHERE status='veroeffentlicht' AND datum_uhrzeit BETWEEN now()+6d AND now()+8d.
   - Fuer jeden: SELECT termin_anmeldung WHERE termin_id AND status='angemeldet' (NICHT 'warteliste'!).
   - Fuer jeden Tester: pruefe audit_log auf `aktion='termin.erinnerung-7d'` UND `referenz_id=<anmeldung-id>` innerhalb letzte 7 Tage.
   - Wenn nicht: sendMail T-402 + INSERT audit_log.
3. Gleiche Logik fuer T-403, aber Fenster now()+10h AND now()+38h, audit-tag 'termin.erinnerung-1d'.
4. Audit-Log fuer den Cron-Lauf selbst.
5. Return JSON `{ verarbeitet_7d: N, verarbeitet_1d: M }`.

### Tests

`apps/web/tests/integration/termin-cron-erinnerungen.test.ts`:
- Seed Termin mit datum_uhrzeit = now()+7d und 3 Angemeldete + 1 Wartelisten-Person.
- Cron-Lauf → 3 T-402 versendet (Wartelisten-Person bekommt KEINE).
- Zweiter Cron-Lauf innerhalb 7 Tage → keine doppelten Mails.
- Seed Termin mit datum_uhrzeit = now()+24h und 2 Angemeldete → 2 T-403 versendet.
- Termin mit status='abgesagt' → keine Erinnerungen.
- Cron ohne X-Cron-Secret → 401.

### Quality gate

```
cd /Users/udi/work/moinsen/ideas/werkzirkel/apps/web && rm -rf .next && pnpm exec vitest run
cd .. && pnpm typecheck && NODE_ENV=production pnpm build
```

DO NOT touch:
- Andere Cron-Endpunkte (existieren schon).
- E-Mail-Templates (schon im email-templates-termine-Task gemacht).
- Termin-CRUD/Anmeldung.

Started 2026-05-13T16:45:43.454Z: autobuild termine iter 6

Done 2026-05-13T16:50:44.507Z: Stuendlicher Cron sendet T-402 (7d) und T-403 (1d) Erinnerungen mit audit_log-Dedup (Tests: green via `cd /Users/udi/work/moinsen/ideas/werkzirkel/apps/web && pnpm exec vitest run`)
