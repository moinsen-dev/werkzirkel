---
acceptance_criteria:
  - "/anmelden hat 4 Buttons: Anmelden (login), Werkpass anlegen (registrierung-macher), Bedarf einbringen (registrierung-bedarf), Foerder:in werden (registrierung-foerder)"
  - magic_link_token.zweck akzeptiert 'registrierung-bedarf' und 'registrierung-foerder' als gueltige Werte (enum-Erweiterung)
  - Erfuellt PRD §13.2 (klarname Pflicht fuer Bedarfstraeger:innen und Foerder:innen) — Validator wirft 422 bei rolle-Hinzufuegen ohne klarname
  - lib/auth/permissions.ts exportiert hasRolle, istBedarfstraeger, istFoerderer (Helper fuer downstream-Tasks)
  - /uebersicht zeigt rollen-spezifische Schnellzugriff-Karten (Macher:innen sehen 'Meine Werke', Bedarfstraeger:innen 'Meine Bedarfe', Foerder:innen 'Mein Foerderprofil')
created_at: 2026-05-14T06:03:26.096Z
created_by: human
edges:
  blocks:
    - id: task-werkstattbeitrag-api
    - id: task-foerderprofil-api
  composed_of:
    - id: bedarfsseite
effort: S
id: task-bedarfstraeger-foerderer-rolle-flow
is_root: false
open_questions: []
owner: null
parent: bedarfsseite
private: false
risks: []
status: done
summary: "Erweitert das Auth-Flow um drei Rollen-Pfade: /anmelden mit zweck=registrierung-bedarf|registrierung-foerder. /einstellungen erlaubt Rollen-Hinzufuegen mit Klarname-Validierung. Macht alle Bedarfsseiten-Routen rollen-bewusst."
tags: []
title: "Bedarfstraeger:in/Foerder:in-Rolle: Registrierung, Klarname-Validierung, UI-Switch"
type: task
updated_at: 2026-05-14T06:21:43.942Z
---

## Approach

Grundlage fuer wp-bedarfsseite. Bedarfsträger:innen und Förder:innen brauchen klar getrennte Pfade in den UI-Flows.

### A) Anmelden-Page Variant

`apps/web/app/anmelden/page.tsx` erweitern:
- Drei Buttons im Form: 'Anmelden' (zweck=login), 'Werkpass anlegen' (registrierung-macher), 'Bedarf einbringen' (registrierung-bedarf), 'Foerder:in werden' (registrierung-foerder).
- Bei registrierung-bedarf/foerder: Magic-Link verlinkt auf eine spezielle Registrierungs-Page `/registrieren?rolle=bedarf|foerder&token=<magic-link-token>` (statt /uebersicht).
- Diese Page sammelt Klarname + Organisation (Pflicht fuer beide Rollen).
- Submit setzt nutzer.rollen plus klarname + organisation und redirected zu /uebersicht.

### B) /einstellungen Rolle-Switch

Im Profil-Tab eine neue Sektion 'Weitere Rollen hinzufuegen':
- Wenn 'bedarfstraeger' nicht in rollen: Button 'Bedarfstraeger:innen-Rolle hinzufuegen' (mit Hinweis-Modal zum Klarname-Pflicht).
- Analog fuer 'foerderer'.
- Server Action validiert: wenn rollen 'bedarfstraeger' oder 'foerderer' enthaelt → klarname Pflicht (min 1, nicht-leer).
- UI-Hinweis: 'Bedarfstraeger:innen treten mit Klarnamen auf. Pseudonyme sind dafuer nicht erlaubt.'

### C) Validators-Update

`apps/web/lib/validators/nutzer.ts` — `nutzerProfilUpdateSchema` so erweitern, dass beim Patch mit 'bedarfstraeger' oder 'foerderer' in rollen ein nicht-leerer klarname-Wert vorliegt. Existing Schema hat das vermutlich schon im Ansatz — verfeinern.

### D) Permission-Helper

`apps/web/lib/auth/permissions.ts` ergaenzen:
```ts
export function hasRolle(nutzer: { rollen: string[] }, rolle: Rolle): boolean;
export function istBedarfstraeger(nutzer): boolean;
export function istFoerderer(nutzer): boolean;
```

Diese werden in den Bedarfs- und Förderprofil-Endpunkten der naechsten Tasks verwendet.

### E) /uebersicht Anpassung

Wenn User Bedarfstraeger:in/Foerder:in: zeige zusaetzliche Schnellzugriff-Karten:
- 'Meine Bedarfe' → /uebersicht/bedarfe (Stub, kommt in pages-Task)
- 'Mein Foerderprofil' → /uebersicht/foerderprofil (Stub)

### Tests

`apps/web/tests/integration/rolle-bedarf-registrierung.test.ts`:
- POST /api/v1/auth/magic-link mit zweck=registrierung-bedarf → 204, magic-link mit URL `/registrieren?rolle=bedarf&token=...`.
- Verify-Klick legt nutzer mit rollen=['bedarfstraeger'], klarname-leer an.
- Bei /registrieren-Submit: validiert Klarname Pflicht, setzt klarname.
- Ohne klarname → 422 mit deutscher Fehler-Message.

`apps/web/tests/integration/rolle-hinzufuegen.test.ts`:
- User mit rollen=['macher'] + klarname='' → Server Action 'rolle hinzufuegen bedarfstraeger' ohne klarname → 422.
- Mit klarname='Max Mustermann' → 200, rollen=['macher', 'bedarfstraeger'].

## Quality gate

```
cd /Users/udi/work/moinsen/ideas/werkzirkel/apps/web && rm -rf .next && pnpm exec vitest run
cd .. && pnpm typecheck && NODE_ENV=production pnpm build
```

DO NOT touch:
- Bedarf-/Werkangebot-/Foerderprofil-APIs (kommen in eigenen Tasks).
- Stripe (eigener Task).

Started 2026-05-14T06:04:27.209Z: autobuild bedarf iter 1

Done 2026-05-14T06:21:43.942Z: Bedarfstraeger/Foerderer-Rollen-Flow: Anmelden-Variants + Klarname-Validierung + /registrieren-Page + Permission-Helper (Tests: green via `cd /Users/udi/work/moinsen/ideas/werkzirkel/apps/web && pnpm exec vitest run`)
