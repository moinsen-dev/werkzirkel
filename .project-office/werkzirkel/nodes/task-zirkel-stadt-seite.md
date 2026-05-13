---
acceptance_criteria:
  - "`apps/web/app/zirkel/[stadt]/page.tsx` rendert fuer hh/b/m (und alternativ fuer 'hamburg'/'berlin'/'muenchen' Slugs)"
  - "Hamburg (status=aktiv): rendert Mitglieder-Strip + Werke-Sektion + Termine-Sektion"
  - "Berlin/Muenchen (status=vorbereitung): rendert die kompakte 'in Vorbereitung'-Variante OHNE Mitglieder/Werke"
  - Unbekanntes Stadt-Kuerzel → 404 (Integration-Test)
  - Mitglieder-Strip + Werke-Cards verlinken auf /werkpass/[id] und /werke/[id]
  - Erfuellt PRD §F-301 bis §F-304 (Zirkel-Seite, Inhalte, Hervorhebung) vollstaendig fuer Hamburg
created_at: 2026-05-13T12:39:12.091Z
created_by: human
edges:
  composed_of:
    - id: wp-werkpass-werke
  depends_on:
    - id: task-werke-overview
effort: S
id: task-zirkel-stadt-seite
is_root: false
open_questions: []
owner: null
parent: wp-werkpass-werke
private: false
risks: []
status: done
summary: Oeffentliche Stadt-Hub-Seite. Hamburg ist initial aktiv. Zeigt Beschreibung, Werke aus der Region (gefiltert wie /werke aber stadt-fixiert), Mitglieder-Strip mit Avataren, kommende Termine (stub falls noch keine API). Berlin/Muenchen zeigen 'in Vorbereitung'-State.
tags: []
title: Zirkel-Stadt-Seite /zirkel/[stadt] mit Werken, Mitglieder, naechsten Terminen
type: task
updated_at: 2026-05-13T14:14:18.684Z
---

## Approach

`apps/web/app/zirkel/[stadt]/page.tsx` als Server Component. Param `stadt` ist Stadt-Kuerzel (hh/b/m). Wenn unbekannt → notFound().

Liest:
- stadt-Row
- nutzer-Liste WHERE stadt_id = X AND status='aktiv' AND 'macher' IN rollen (LIMIT 12 fuer den Mitglieder-Strip)
- werke WHERE nutzer.stadt_id = X AND sichtbarkeit='oeffentlich' AND status='aktiv' (LIMIT 6 fuer Vorschau)
- termine WHERE stadt_id = X AND datum_uhrzeit > now() AND status='veroeffentlicht' (LIMIT 3) — die termin-API ist noch nicht da, aber Drizzle-Query funktioniert

### Layout (status='aktiv')

- Nav-Bar
- Hero: 'Werkzirkel Hamburg' als H1, Subline mit Beschreibung aus stadt-Tabelle
- Sektion 'Aktive Macher:innen': Avatar-Strip (12 Mitglieder als Kreise), unten Link 'Alle Werkpaesse'
- Sektion 'Werke aus dem Kreis': 6 Werke-Cards, unten Link 'Alle Werke in Hamburg'
- Sektion 'Naechste Termine': falls Termine vorhanden, Liste mit Datum+Titel+Typ. Falls leer: 'Der naechste Schauabend steht noch nicht. Schreib dem Hamburger Kurator:in.'
- Sektion 'Mitmachen': drei Karten (Werkpass anlegen → /anmelden, Bedarf einbringen → /bedarf, Werke foerdern → /foerdern)

### Layout (status='vorbereitung', d.h. Berlin/Muenchen)

- Selbe Nav
- Hero mit Stadtname + 'In Vorbereitung'-Pill
- Erklaerung: 'Berlin startet, sobald der Hamburger Kreis traegt — drei Schauabende, 15 Werke, ehrliche Reziprozitaetsbilanz. Bis dahin halten wir die Stadt warm.'
- 'Auf die Berliner Eroeffnung warten'-Button als E-Mail-Waitlist-Stub (kann an dieselbe Magic-Link-Pipeline gehen, mit stadt-Praeferenz)
- KEINE Mitglieder/Werke/Termine-Sektionen (die sind eh leer).

### Metadata

```ts
export async function generateMetadata({ params }): Promise<Metadata> {
  return { title: `Werkzirkel ${stadtName}` };
}
```

## Pitfalls

- Stadt-Kuerzel-Mapping: 'hamburg'/'berlin'/'muenchen' als URL-Slug? ODER nur 'hh'/'b'/'m'? Empfehlung: beide Akzeptanz — bei URL `/zirkel/hamburg` ein Lookup auf stadt.name machen.
- Termin-Sektion robust gegen leere DB.
- 'in Vorbereitung'-Variante darf NICHT die Hauptseiten-Filter-Hyperlinks zu /werke?stadt=b zeigen — keine leere Werke-Liste fuer Berlin.

Started 2026-05-13T14:08:34.845Z: autobuild werke iter 7

Done 2026-05-13T14:14:18.684Z: Zirkel-Stadt-Seite /zirkel/[stadt] mit aktiv-/vorbereitung-Varianten, Slug-Mapping (hh|hamburg etc.), Mitglieder-Strip, Werke-Grid, Termine-Liste (Tests: green via `pnpm exec vitest run`)
