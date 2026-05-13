---
acceptance_criteria:
  - "Vier neue Templates in `apps/web/lib/email/templates/`: t-101-pruefrunde-neue-anmeldung, t-102-pruefrunde-neues-feedback, t-103-reziprozitaet-frist-3d, t-104-reziprozitaet-frist-1d"
  - "`apps/web/lib/email/send.ts` `MailTemplate`-Union enthaelt 'T-101' | 'T-102' | 'T-103' | 'T-104' mit typsicheren Props"
  - Alle 4 Templates rendern in deutsch (Sprach-Check-Test verifiziert keine englischen Strings)
  - Alle 4 Templates haben Plain-Text-Fallback (via react-email PlainText)
  - Snapshot-Test pro Template existiert in `tests/unit/email-templates-pruefrunden.test.ts`
created_at: 2026-05-13T14:42:36.764Z
created_by: human
edges:
  blocks:
    - id: task-pruefrunden-anmeldung-api
    - id: task-feedback-api
  composed_of:
    - id: wp-pruefrunden
effort: S
id: task-email-templates-pruefrunden
is_root: false
open_questions: []
owner: null
parent: wp-pruefrunden
private: false
risks: []
status: done
summary: "Vier React-Email-Templates: T-101 neue Anmeldung als Tester:in, T-102 neues Feedback erhalten, T-103 Reziprozitaets-Frist 3 Tage, T-104 Frist 1 Tag (oder verfallen). Deutsch, Plain-Text-Fallback, eingebunden in sendMail-Helper."
tags: []
title: E-Mail-Templates T-101 bis T-104 fuer Pruefrunden-Lifecycle
type: task
updated_at: 2026-05-13T14:48:33.749Z
---

## Approach

Vier neue Templates in `apps/web/lib/email/templates/` parallel zu den existierenden T-001..T-005:

### T-101 — pruefrunde-neue-anmeldung
Betreff: 'Neue Anmeldung zu deiner Pruefrunde'
Empfaenger: Werk-Inhaber:in.
Props: `{ werkName, pruefrundeTitel, testerAnzeigename, pruefrundeUrl, anzahlAngemeldet, gesuchteTester }`.
Kern-Text: '<testerAnzeigename> hat sich als Tester:in fuer deine Pruefrunde "<pruefrundeTitel>" zu "<werkName>" angemeldet. Du brauchst noch <gesuchte-angemeldet> weitere Tester:innen.'

### T-102 — pruefrunde-neues-feedback
Betreff: 'Neues Feedback zu deinem Werk'
Empfaenger: Werk-Inhaber:in.
Props: `{ werkName, pruefrundeTitel, pruefrundeUrl, anzahlFeedbacks }`.
Kern-Text: 'Es gibt neues Feedback zu deiner Pruefrunde "<pruefrundeTitel>". Insgesamt <anzahl> Rueckmeldung(en) erhalten. Schau rein und markiere, was dir geholfen hat.'

### T-103 — reziprozitaet-frist-3d
Betreff: 'Deine Reziprozitaets-Frist endet in 3 Tagen'
Empfaenger: Nutzer:in mit offener Verpflichtung.
Props: `{ frist, offeneAnzahl, pruefrundenSucheUrl }`.
Kern-Text: 'Du hast vor einer Weile eine Pruefrunde gestartet und versprochen, im Gegenzug zwei Werke anderer zu testen. Die Frist endet am <frist>. Bisher offen: <anzahl> Test(s). Such dir jetzt eine Pruefrunde aus.'

### T-104 — reziprozitaet-frist-1d
Betreff: 'Deine Reziprozitaets-Frist endet morgen'
Props: `{ frist, offeneAnzahl, pruefrundenSucheUrl }`.
Kern-Text: 'Letzte Erinnerung: deine Reziprozitaets-Frist endet morgen (<frist>). Wenn du bis dahin nicht <anzahl> Test(s) gibst, kannst du keine neuen Pruefrunden starten, bis du das nachholst.'

### Registry-Update

In `apps/web/lib/email/send.ts` die `MailTemplate`-Union-Type erweitern und die `buildEmail`-Switch-cases hinzufuegen. Re-use den bestehenden Pattern aus den T-001..T-005-Templates.

### Tonalitaet

Deutsch durchgehend. Du-Anrede. Klar, direkt, keine Sales-/Networking-Sprache. Pflichten in der Reziprozitaet werden nicht moralisierend ('Du musst!') sondern werkstaettig ('So funktioniert der Kreis') formuliert.

### Tests

`apps/web/tests/unit/email-templates-pruefrunden.test.ts`:
- Render alle 4 Templates zu HTML.
- Snapshot-Test fuer das Layout.
- Sprach-Check: keine englischen Strings ('Sign in', 'Login', 'Reminder', 'Deadline', 'Click here').
- `sendMail({ template: 'T-101', ... })` kompiliert und versendet (Mock-Pfad in Test-Runtime).

### Quality gate

```
cd /Users/udi/work/moinsen/ideas/werkzirkel/apps/web
rm -rf .next
pnpm exec vitest run
cd .. && pnpm typecheck && NODE_ENV=production pnpm build
```

Alles gruen.

DO NOT touch:
- Bestehende T-001..T-005 Templates.
- Reziprozitaets-Engine (eigener Task).
- Pruefrunde-CRUD-API.

Started 2026-05-13T14:43:38.818Z: autobuild pruefrunden iter 1

Done 2026-05-13T14:48:33.749Z: 4 React-Email-Templates T-101..T-104 + sendMail-Union erweitert (Tests: green via `cd /Users/udi/work/moinsen/ideas/werkzirkel/apps/web && pnpm exec vitest run`)
