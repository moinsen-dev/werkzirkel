# Werkzirkel — Bau-Status

Stand: 2026-05-14 · maintained alongside `.project-office/werkzirkel/`

Dieses Dokument ist der **Wiedereinstiegs-Anker**. Wer nach einer Pause hier landet,
weiß in 30 Sekunden:

1. Wo wir stehen.
2. Was als Nächstes ansteht.
3. Wie man die App lokal hochfährt.
4. Welche bekannten Eigenheiten zu beachten sind.

PRD bleibt `prd.md`. Design-Tokens bleiben `DESIGN.md`. Diese Datei ist State,
keine Spec.

---

## Wo wir stehen

```
Werkzirkel v1.0 (draft)
├── foundation              ✓ done — Foundation-Gate PASS
├── plattform-kern          ✓ done (4/4 Workpackages + 1 Glue-Sprint)
│   ├── wp-auth             ✓ done (7 Tasks)
│   ├── wp-werkpass-werke   ✓ done (7 Tasks)
│   ├── wp-pruefrunden      ✓ done (7 Tasks — Reziprozitäts-Engine!)
│   ├── wp-termine          ✓ done (7 Tasks)
│   └── wp-glue-pages       ✓ done (4 Tasks Mini-Sprint)
├── bedarfsseite            ← NEXT
├── geld-und-mitgliedschaft   draft
├── moderation-admin-hilfegesuche   draft
└── polish-und-launch       draft
```

**39 Tasks autonom gebaut.** Test-Suite: **610 Tests / 79 Files alle grün**. Production-Build sauber.

Letzter Commit: `feat(termine): wp-termine komplett — Termin-CRUD, Anmeldung, iCal, Anwesenheit, Cron, UI`

## Was die App jetzt kann

### Macher:innen
- Magic-Link-Anmeldung (Better-Auth, kein Passwort) auf `/anmelden`
- Profil-/Werkpass-Edit auf `/einstellungen` mit Avatar-Upload (R2 oder Dev-Fallback)
- DSGVO-Self-Service: JSON-Export, Konto-Löschung mit 7-Tage-Karenz
- Werk-CRUD auf `/werke/neu` + `/werke/[id]/bearbeiten`, max 5 (unbegrenzt für Fördermitglieder)
- Screenshot-Upload mit `sharp`-Resize + EXIF-Strip
- Werkstand-Historie atomar
- Prüfrunde starten via `/pruefrunden/neu?werk=<id>` — **Reziprozitäts-Engine** prüft Test-Saldo, erzeugt Verpflichtung mit 14-Tage-Frist falls Saldo leer
- Als Tester:in zu fremder Prüfrunde anmelden, strukturiertes Feedback abgeben
- Test-Saldo öffentlich auf `/werkpass/[id]` + eigener `/uebersicht` mit Frist-Banner
- Zu Terminen anmelden, iCal-Download, automatische Warteliste
- Hilfreich-Markierung auf erhaltenes Feedback (wird anonymisiert auf Werk-Detail-Seite sichtbar)

### Kurator:innen (Hamburg)
- Termine anlegen, veröffentlichen, absagen, durchführen
- Anwesenheit dokumentieren — triggert automatisch `werkstattbeitrag`-Row bei Bedarfsträger:innen-Schauabend-Teilnahme
- Bedarfe-Verifikation (wartet auf wp-bedarfsseite)

### Crons (alle mit X-Cron-Secret-Header)
- `/api/v1/cron/konto-loeschung-frist-abgelaufen` — Hard-Delete nach 7 Tagen + T-005-Mail mit JSON-Anhang
- `/api/v1/cron/ip-kuerzung` — IP nach 30d kürzen, User-Agent nach 90d löschen
- `/api/v1/cron/magic-link-cleanup` — abgelaufene Token löschen
- `/api/v1/cron/reziprozitaet-frist-pruefen` — verfallene Verpflichtungen + T-103/T-104-Reminder
- `/api/v1/cron/termin-erinnerung-versenden` — T-402 (7d) + T-403 (1d) Reminder

### E-Mail-Templates (Resend, alle deutsch)
T-001..T-005 (Auth-Lifecycle), T-101..T-104 (Prüfrunden), T-401..T-404 (Termine). 9 Templates insgesamt.

## Was als Nächstes ansteht

**Next subprojekt: `bedarfsseite`** (PRD §11A Schutzmechaniken — der größte Hybrid-Block):

- Bedarfsträger:innen-Rolle vollständig integriert (Klarname-Pflicht, Werkstattbeitrag)
- Werkstattbeitrag-Workflow (3 Pfade: Schauabend-Teilnahme automatisch via Termin-Hook, Geldbeitrag via Stripe, Sachleistung mit Kurator-Verifikation)
- Bedarf-CRUD mit Sprach-Check + Kurator-Moderation
- Werkangebote (PRD-Schutz S2: nur für Bedarfsträger:in + Werk-Inhaber:in sichtbar)
- Förderprofile mit Verifikations-Workflow + Auto-Pause-Cron

Vermutlich 8-10 Tasks. Wenn der User „weiter mit bedarfsseite" sagt, JSON
schreiben + decompose-apply + autobuild.

Danach: `geld-und-mitgliedschaft` (Stripe-Subscriptions), `moderation-admin-hilfegesuche`
(Melde-System + Admin-Backoffice + Hilfegesuche), `polish-und-launch` (A11y/SEO/Pentest/Anwalt/Launch).

## Lokal hochfahren

Voraussetzungen: macOS mit OrbStack (oder Docker Desktop) für Postgres, Node ≥22, pnpm ≥10.

```bash
cd /Users/udi/work/moinsen/ideas/werkzirkel
docker compose up -d db                    # Postgres 17 in Container
pnpm db:migrate                            # Schema anwenden (idempotent)
pnpm db:seed                               # 3 Städte + admin + hh-kurator
cd apps/web && pnpm exec vitest run        # 610/79 grün
cd .. && pnpm dev                          # http://localhost:3210
```

Wichtige `.env`-Werte:
- `DATABASE_URL=postgresql://werkzirkel:werkzirkel_dev@localhost:5432/werkzirkel`
- `BETTER_AUTH_SECRET=...` (32+ Zeichen, ist bereits gesetzt)
- `RESEND_API_KEY=...` (für echte E-Mails — Mock-Pfad greift für Test-Domains und Vitest-Runtime)
- `CRON_SECRET=...`

## Bekannte Eigenheiten

1. **Resend-Quota geschützt durch Mock-Guard.** `sendMail()` greift in den Mock-Pfad wenn:
   - `RESEND_API_KEY` leer
   - `process.env.VITEST === 'true'` (Vitest-Runtime)
   - `NODE_ENV === 'test'`
   - `EMAIL_FORCE_MOCK === '1'` (manueller Override)
   - Empfänger in RFC-2606-Test-Domain (`@example.com/.de/.org/.net`, `@test.local`, `@localhost`)

2. **Tests aus `apps/web/` direkt laufen lassen.** `pnpm exec vitest run` aus
   `apps/web/` ist stabil grün. `pnpm test` aus dem Repo-Root hat manchmal
   flaky cron-Tests durch parallel-Vitest-Worker auf der geteilten Test-DB.

3. **Sub-Agent-Build-Cache.** Nach längeren autobuild-Iterationen kann der
   `.next`-Cache stale werden mit `Cannot find module './XXX.js'`-Fehlern.
   Fix: `rm -rf apps/web/.next && pnpm build` neu laufen lassen.

4. **`apps/web/.env` ist Symlink auf Workspace-Root-`.env`** — keine
   Drift-Gefahr zwischen Vitest-env-Loader und Next.js-env.

5. **Port 3210** — nicht 3000 (User-Präferenz, 3000 bei macOS oft belegt).

6. **Postgres läuft auf OrbStack** statt Docker Desktop. `docker compose up -d db`
   funktioniert identisch.

## Project-Office wieder einsteigen

```bash
# Goal-Tree-Übersicht
/Users/udi/work/moinsen/ideas/test-gate/plugins/project-office/bin/po-bridge.sh \
  po context --project /Users/udi/work/moinsen/ideas/werkzirkel/.project-office/werkzirkel \
  goal-root

# Foundation-Status
... po foundation status --project ...

# Nächste implementable Task (in einem Scope)
... po next-implementable --project ... --scope bedarfsseite

# Bottlenecks
... po bottlenecks --project ...
```

Decomposition-Pattern für neue Subprojekte: siehe `/tmp/werkzirkel-decompose-wp-*.json`
in den letzten Sessions als Referenz für JSON-Schema und Acceptance-Criteria-Form.

## Offene technische Schulden (für Polish & Launch)

- Test-Pollution bei parallelem `pnpm test` aus Root — Vitest `pool: 'forks', singleFork: true` in workspace-config würde lösen.
- Foundation-Decision-Alternativen nachpflegen (lint-warnings, kein Funktionsverlust).
- `lib/email/send.ts`: Mock-Eintrag im `email_benachrichtigung_log` als `gesendet`
  geloggt — sollte separater Status `mocked` sein für Forensik.
- `lib/auth/permissions.ts` ist relativ duplicated — könnte mit cached-session-helper konsolidiert werden.
- Sub-Agent hat ein Sprach-Check-Regex-Pattern mit „Marketing" zu strikt — false positives in deutschen UI-Strings die das Wort enthalten sollen. Bisher kein Test-Fail, aber wenn UI-Text mal das Wort braucht, anpassen.

## Letzte 5 Commits

```
git log --oneline -5
```

## Verzeichnis-Übersicht

```
apps/web/
├── app/                            ← 19 routable pages + 22 API routes
│   ├── api/v1/                     ← REST-Schicht
│   │   ├── auth/                   (Magic-Link + Logout)
│   │   ├── cron/                   (5 Cron-Endpoints)
│   │   ├── me/                     (Konto-Self-Service)
│   │   ├── werke/                  (Werk-CRUD + Screenshots + Historie)
│   │   ├── pruefrunden/            (CRUD + Anmeldung + Feedback)
│   │   ├── termine/                (CRUD + Anmeldung + Anwesenheit + iCal)
│   │   └── feedback/[id]/hilfreich/
│   ├── anmelden/, uebersicht/, einstellungen/, werke/, pruefrunden/, termine/, werkpass/[id]/, zirkel/[stadt]/, kurator/termine/
├── lib/
│   ├── auth/                       (Better-Auth + Sessions + Magic-Link + Rate-Limit + Cron-Secret + Permissions)
│   ├── db/                         (Drizzle Client, Schema in 14 Files, Migrationen 0000-0002)
│   ├── email/                      (sendMail + 13 Templates)
│   ├── reziprozitaet/              (Engine + Saldo)
│   ├── werkstattbeitrag/           (Schauabend-Hook)
│   ├── storage/                    (R2 + sharp-Image-Pipeline)
│   ├── pruefrunde/                 (Markdown-Renderer)
│   ├── dsgvo/                      (Export-Aggregator)
│   ├── validators/                 (Zod-Schemas pro Domäne)
│   └── env.ts                      (Zod-validierte Env-Variablen)
├── i18n/de.ts                      ← alle UI-Strings zentral
└── tests/
    ├── integration/                (~50 Files, DB-backed)
    ├── unit/                       (~25 Files, isoliert)
    └── _helpers/db-cleanup.ts      (truncateAll + deleteTestNutzer)
```

---

**Stand: alle Plattform-Kern-Mechaniken laufen.** Bereit für Bedarfsseite-Bau
oder Pre-Launch-Pause (anwaltliche Prüfung, externe Sichtprüfung, Akquise).
