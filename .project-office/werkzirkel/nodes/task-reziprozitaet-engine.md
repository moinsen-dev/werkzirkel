---
acceptance_criteria:
  - "`apps/web/lib/reziprozitaet/engine.ts` exportiert `kannPruefrundeStarten`, `feedbackGegeben`, `feedbackErhalten` als async functions"
  - "Erfuellt PRD §17 (Reziprozitaets-Engine: kannPruefrundeStarten + feedbackGegeben) vollstaendig"
  - "`/api/v1/cron/reziprozitaet-frist-pruefen` endpoint mit X-Cron-Secret-Header markiert verfallene Verpflichtungen und versendet T-103/T-104 Erinnerungen (idempotent via audit_log dedup)"
  - "Race-Test in Unit-Suite: zwei parallele `feedbackGegeben`-Calls schliessen NICHT dieselbe Verpflichtung doppelt (FOR UPDATE-Sperre verifiziert)"
  - test_saldo-Row wird via `ensureSaldoRow()` lazy angelegt, wenn sie fuer einen nutzer_id noch nicht existiert
created_at: 2026-05-13T14:42:36.762Z
created_by: human
edges:
  blocks:
    - id: task-pruefrunde-crud-api
  composed_of:
    - id: wp-pruefrunden
effort: S
id: task-reziprozitaet-engine
is_root: false
open_questions: []
owner: null
parent: wp-pruefrunden
private: false
risks: []
status: done
summary: Pure Functions in lib/reziprozitaet/ als identitaetsbildende Mechanik (PRD Prinzip P5). Prueft Test-Saldo, erzeugt/schliesst Verpflichtungen, pflegt test_saldo-Materialisierung. Plus taeglicher Cron, der verfallene Verpflichtungen markiert.
tags: []
title: "Reziprozitaets-Engine: kannPruefrundeStarten, feedbackGegeben, Cron, Verpflichtungs-Tracking"
type: task
updated_at: 2026-05-13T14:59:44.861Z
---

## Approach

Die Reziprozitaets-Engine ist die Kernmechanik von Werkzirkel — alle anderen Pruefrunden-Tasks ruhen auf ihr.

### A) `apps/web/lib/reziprozitaet/engine.ts`

Exportiert (pure functions, alle async, DB als injizierbare Dependency):

```ts
export type SaldoCheckResult =
  | { ok: true; modus: 'saldo_erfuellt' | 'neue_verpflichtung'; frist?: Date }
  | { ok: false; grund: 'frist_abgelaufen'; offeneVerpflichtungen: number };

export async function kannPruefrundeStarten(
  nutzer_id: string,
  pruefrunde_frist: Date,
): Promise<SaldoCheckResult>;

export async function feedbackGegeben(
  nutzer_id: string,
  feedback_id: string,
): Promise<void>;

export async function feedbackErhalten(
  nutzer_id: string,
  delta: number,
): Promise<void>;
```

Logik fuer `kannPruefrundeStarten`:
1. Lade `test_saldo` fuer nutzer_id (left join — wenn nicht existiert: 0/0/0).
2. Wenn `tests_gegeben >= 2`: erlaubt → `{ ok: true, modus: 'saldo_erfuellt' }`.
3. Wenn `tests_gegeben < 2`:
   - Wenn `offene_verpflichtung_anzahl > 0` UND `naechste_verpflichtung_frist < now()`: blockiert → `{ ok: false, grund: 'frist_abgelaufen', ... }`.
   - Sonst erlaubt mit neuer Verpflichtung:
     - INSERT pruefrunden_verpflichtung mit `frist = pruefrunde_frist + 14 Tage`.
     - UPDATE test_saldo SET offene_verpflichtung_anzahl++, naechste_verpflichtung_frist=min(...).
     - Return `{ ok: true, modus: 'neue_verpflichtung', frist: ... }`.

Logik fuer `feedbackGegeben`:
1. UPDATE test_saldo SET tests_gegeben = tests_gegeben + 1.
2. Wenn `offene_verpflichtung_anzahl > 0`: SELECT aelteste offene `pruefrunden_verpflichtung` (status='offen', ORDER BY frist ASC) und setze `status='erfuellt', erfuellt_durch_feedback_id=feedback_id`.
3. UPDATE test_saldo SET offene_verpflichtung_anzahl = COALESCE(...) - 1, naechste_verpflichtung_frist = MIN(rest) ODER NULL.
4. Alles in einer Drizzle-Transaktion (Race-Schutz, siehe PRD §17 'Race-Conditions').

### B) `apps/web/lib/reziprozitaet/init-saldo.ts`

Hilfsfunktion `ensureSaldoRow(nutzer_id)`: INSERT INTO test_saldo (nutzer_id) ON CONFLICT DO NOTHING. Wird vor allen Engine-Operationen aufgerufen.

### C) Cron `apps/web/app/api/v1/cron/reziprozitaet-frist-pruefen/route.ts`

Taeglich, X-Cron-Secret. Logik:
1. SELECT pruefrunden_verpflichtung WHERE status='offen' AND frist < now() → markiere als 'verfallen'.
2. UPDATE test_saldo der betroffenen Nutzer:innen — `offene_verpflichtung_anzahl` neu berechnen, `naechste_verpflichtung_frist` aktualisieren.
3. **Erinnerungs-Mails:**
   - 3 Tage vor Frist: T-103 Reziprozitaets-Frist 3d (wenn noch nicht versendet — dedup via audit_log mit aktion='reziprozitaet.erinnerung-3d').
   - 1 Tag vor Frist: T-104.
4. Audit-Log fuer den Cron-Lauf.

### D) Unit-Tests

`apps/web/tests/unit/reziprozitaet-engine.test.ts`:
- `kannPruefrundeStarten` mit 0/0 Saldo + 0 Verpflichtung → erlaubt mit neuer Verpflichtung, frist = jetzt+14d.
- Mit 2/0 Saldo → erlaubt, modus='saldo_erfuellt', keine Verpflichtung.
- Mit 0/0 + abgelaufener Verpflichtung → blockiert.
- Mit 3 Verpflichtungen, eine in 3d, eine in 10d, eine in 20d: `naechste_verpflichtung_frist` = 3d.
- `feedbackGegeben` mit offener Verpflichtung → tests_gegeben++, aelteste Verpflichtung erfuellt, offene_anzahl--.
- `feedbackGegeben` ohne Verpflichtung → nur tests_gegeben++.
- Race-Test: 2 parallele feedbackGegeben-Calls duerfen NICHT beide dieselbe Verpflichtung schliessen (FOR UPDATE im SELECT).

`apps/web/tests/integration/reziprozitaet-cron.test.ts`:
- Setze eine Verpflichtung mit frist = gestern → Cron-Lauf markiert sie 'verfallen'.
- Setze Verpflichtung mit frist in 3d → T-103 wird verschickt (Mock-Mode).
- Zweiter Cron-Lauf: keine Doppel-Erinnerung (dedup-check funktioniert).
- Setze Verpflichtung frist=gestern: nach Cron-Lauf ist test_saldo.offene_verpflichtung_anzahl korrekt dekrementiert.

### E) E-Mail-Templates

DIESER Task implementiert die T-103/T-104 Templates noch NICHT — der parallel-Task `task-email-templates-pruefrunden` macht das. Hier nur die `sendMail`-Aufrufe gegen Template-Strings vorbereiten ('T-103', 'T-104'). Wenn die Templates noch nicht in `lib/email/send.ts`s Registry sind, fail-soft: catch + console.warn statt crash.

### F) Quality gate

```
cd /Users/udi/work/moinsen/ideas/werkzirkel
rm -rf apps/web/.next
cd apps/web && pnpm exec vitest run
cd /Users/udi/work/moinsen/ideas/werkzirkel && pnpm typecheck && NODE_ENV=production pnpm build
```

Alles gruen.

DO NOT touch:
- pruefrunde-CRUD-API (kommt im naechsten Task).
- Feedback-API (eigener Task).
- UI-Pages (eigener Task).

Started 2026-05-13T14:51:10.018Z: autobuild pruefrunden iter 2

Done 2026-05-13T14:59:44.861Z: Reziprozitäts-Engine als pure functions, mit Cron-Job für Fristen-Pruefung + Erinnerungen (Tests: green via `cd /Users/udi/work/moinsen/ideas/werkzirkel/apps/web && pnpm exec vitest run`)
