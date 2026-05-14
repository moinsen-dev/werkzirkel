---
acceptance_criteria:
  - Erfuellt PRD §8.8 (iCal-Export pro Termin) und §15.8 vollstaendig
  - "RFC-5545-konformer .ics-Output: VCALENDAR/VTIMEZONE Europe/Berlin/VEVENT-Struktur, CRLF-Linebreaks, korrekt escaped"
  - "GET /api/v1/termine/:id/ical antwortet mit Content-Type: text/calendar und Content-Disposition: attachment; filename=..."
  - status='abgesagt' wird zu STATUS:CANCELLED im .ics, status='durchgefuehrt' zu STATUS:CONFIRMED
  - Unit-Test fuer Sonderzeichen-Escaping (Titel mit Komma, Semikolon, Backslash, Zeilenumbruch)
created_at: 2026-05-13T16:04:07.186Z
created_by: human
edges:
  blocks:
    - id: task-termin-pages
  composed_of:
    - id: wp-termine
  depends_on:
    - id: task-termin-crud-api
effort: S
id: task-ical-export
is_root: false
open_questions: []
owner: null
parent: wp-termine
private: false
risks: []
status: done
summary: RFC-5545-konformer .ics-Endpoint pro Termin. Europe/Berlin als VTIMEZONE. Wird in T-401 Bestaetigungs-Mail und auf der Termin-Detail-Seite als Download-Link verlinkt.
tags: []
title: "iCalendar-Export: GET /api/v1/termine/:id/ical"
type: task
updated_at: 2026-05-13T16:27:48.257Z
---

## Approach

Kein zusätzliches NPM-Paket — RFC-5545 ist gut genug per String-Template machbar.

### Endpoint `apps/web/app/api/v1/termine/[id]/ical/route.ts`

- GET, public fuer 'veroeffentlicht' + 'durchgefuehrt' Termine, sonst 404.
- Generate ics body:
  ```
  BEGIN:VCALENDAR
  VERSION:2.0
  PRODID:-//Werkzirkel//DE
  CALSCALE:GREGORIAN
  METHOD:PUBLISH
  BEGIN:VTIMEZONE
  TZID:Europe/Berlin
  BEGIN:STANDARD
  DTSTART:19701025T030000
  RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=10
  TZOFFSETFROM:+0200
  TZOFFSETTO:+0100
  TZNAME:CET
  END:STANDARD
  BEGIN:DAYLIGHT
  DTSTART:19700329T020000
  RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=3
  TZOFFSETFROM:+0100
  TZOFFSETTO:+0200
  TZNAME:CEST
  END:DAYLIGHT
  END:VTIMEZONE
  BEGIN:VEVENT
  UID:termin-<id>@werkzirkel.de
  DTSTAMP:<jetzt im UTC-Format>
  DTSTART;TZID=Europe/Berlin:<datum_uhrzeit als YYYYMMDDTHHMMSS>
  DTEND;TZID=Europe/Berlin:<datum_uhrzeit + 2h>  // Default 2h Dauer wenn keine Endzeit
  SUMMARY:<terminTitel escaped>
  DESCRIPTION:<beschreibung escaped + URL zum Termin>
  LOCATION:<ort_text oder online_link>
  URL:<APP_URL>/termine/<id>
  STATUS:<CONFIRMED|CANCELLED basierend auf termin.status>
  END:VEVENT
  END:VCALENDAR
  ```
- CRLF-Linebreaks (\r\n) sind RFC-Pflicht.
- Sonderzeichen escapen: \\, \;, \, , und Zeilenumbruch \n.
- Response: text/calendar; charset=utf-8 mit Content-Disposition: attachment; filename="werkzirkel-<typ>-<id>.ics"

### Helper-Funktion `apps/web/lib/termin/ical.ts`

```ts
export function buildIcsForTermin(termin: Termin): string {
  // ...
}
```

### Tests

`apps/web/tests/unit/termin-ical.test.ts`:
- `buildIcsForTermin(mockTermin)` → enthaelt erwartete RFC-5545-Lines.
- CRLF-Linebreaks.
- Escape von Sonderzeichen im Titel/Description.
- TZID=Europe/Berlin im DTSTART.
- status='abgesagt' → STATUS:CANCELLED.
- status='durchgefuehrt' → STATUS:CONFIRMED.

`apps/web/tests/integration/termin-ical-endpoint.test.ts`:
- GET /api/v1/termine/[id]/ical fuer veroeffentlichten Termin → 200, Content-Type: text/calendar, Body enthaelt BEGIN:VCALENDAR.
- GET fuer 'geplant'-Termin → 404.
- Content-Disposition attachment mit filename.

### Quality gate

```
cd /Users/udi/work/moinsen/ideas/werkzirkel/apps/web && rm -rf .next && pnpm exec vitest run
cd .. && pnpm typecheck && NODE_ENV=production pnpm build
```

DO NOT touch:
- Termin-CRUD-API.
- Andere Termin-Endpunkte.

Started 2026-05-13T16:22:23.597Z: autobuild termine iter 3

Done 2026-05-13T16:27:48.257Z: iCal-Export RFC-5545 mit Europe/Berlin-VTIMEZONE + Sonderzeichen-Escape (Tests: green via `cd /Users/udi/work/moinsen/ideas/werkzirkel/apps/web && pnpm exec vitest run`)
