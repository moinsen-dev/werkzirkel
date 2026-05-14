---
acceptance_criteria:
  - "Vier neue Templates in `apps/web/lib/email/templates/`: t-401, t-402, t-403, t-404 mit typsicheren Props"
  - "`apps/web/lib/email/send.ts` `MailTemplate`-Union enthaelt 'T-401' | 'T-402' | 'T-403' | 'T-404'"
  - Alle 4 Templates rendern in deutsch (Sprach-Check-Test verifiziert keine englischen Strings)
  - Snapshot-Tests in `tests/unit/email-templates-termine.test.ts` fuer alle 4 Templates
created_at: 2026-05-13T16:04:07.185Z
created_by: human
edges:
  blocks:
    - id: task-termin-anmeldung-api
    - id: task-termin-cron-erinnerungen
  composed_of:
    - id: wp-termine
effort: S
id: task-email-templates-termine
is_root: false
open_questions: []
owner: null
parent: wp-termine
private: false
risks: []
status: done
summary: "Vier React-Email-Templates: T-401 Anmeldung bestaetigt, T-402 Erinnerung 7 Tage vor Termin, T-403 Erinnerung 1 Tag vor Termin, T-404 Termin abgesagt. Deutsch, Plain-Text-Fallback, eingebunden in sendMail-Helper."
tags: []
title: E-Mail-Templates T-401 bis T-404 fuer Termin-Lifecycle
type: task
updated_at: 2026-05-13T16:11:06.224Z
---

## Approach

Mustern an T-101..T-104 in `apps/web/lib/email/templates/`. Re-use `_layout.tsx`.

### Templates

- `t-401-termin-anmeldung-bestaetigt.tsx` — Props: `{ terminTitel, terminTyp, terminDatum, terminUhrzeit, ortText?, onlineLink?, terminUrl, slotPosition: 'angemeldet' | 'warteliste' }`. Betreff: `T401_BETREFF = 'Deine Anmeldung zum <Termin-Typ-Label>'`. Body: Anmeldung-Bestaetigung + Datum/Ort + iCal-Hinweis ('Diesen Termin in deinen Kalender uebernehmen: <Link zu /api/v1/termine/<id>/ical>'). Bei Warteliste: Hinweis 'Du stehst auf der Warteliste. Wir benachrichtigen dich, sobald ein Platz frei wird.'

- `t-402-termin-erinnerung-7d.tsx` — Props: `{ terminTitel, terminTyp, terminDatum, terminUhrzeit, ortText?, onlineLink?, terminUrl }`. Betreff: `T402_BETREFF = 'Erinnerung: <Termin> in einer Woche'`.

- `t-403-termin-erinnerung-1d.tsx` — gleiche Props. Betreff: 'Erinnerung: <Termin> morgen'.

- `t-404-termin-abgesagt.tsx` — Props: `{ terminTitel, terminTyp, terminDatum, absageGrund? }`. Betreff: 'Termin abgesagt: <Termin>'.

### sendMail-Update

In `apps/web/lib/email/send.ts` die `MailTemplate`-Union um T-401..T-404 erweitern.

### Tests

`apps/web/tests/unit/email-templates-termine.test.ts`:
- Snapshot-Test pro Template.
- Sprach-Check (keine englischen Strings 'Reminder', 'Confirmed', 'Cancelled', etc.).
- sendMail mit Test-Domain → mocked: true.

### Quality gate

```
cd /Users/udi/work/moinsen/ideas/werkzirkel/apps/web && rm -rf .next && pnpm exec vitest run
cd .. && pnpm typecheck && NODE_ENV=production pnpm build
```

DO NOT touch:
- Termin-CRUD-API (parallel oder spaeter).
- T-101..T-104 oder T-001..T-005.

Started 2026-05-13T16:05:01.946Z: autobuild termine iter 1

Done 2026-05-13T16:11:06.224Z: 4 React-Email-Templates T-401..T-404 fuer Termin-Lifecycle + sendMail-Union erweitert (Tests: green via `cd /Users/udi/work/moinsen/ideas/werkzirkel/apps/web && pnpm exec vitest run`)
