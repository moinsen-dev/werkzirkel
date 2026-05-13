---
acceptance_criteria:
  - "`apps/web/app/werkpass/[id]/page.tsx` rendert das oeffentliche Macher:innen-Profil mit anzeigename + Werken"
  - Werkpass eines Nutzers OHNE 'macher'-Rolle → 404 (Integration-Test mit reinem Bedarfstraeger)
  - Email und klarname kommen NICHT im HTML-Output vor (Unit-Test scannt das gerenderte HTML)
  - Test-Saldo wird angezeigt; bei fehlender test_saldo-Row → 0/0/0
  - Werke der Macher:in als Cards mit Link zu /werke/[id]
  - Erfuellt die `Werke statt Werkpaesse`-Hierarchie-Aussage aus PRD §8 (Werkpass zeigt Werke prominent, nicht nur Bio)
created_at: 2026-05-13T12:39:12.091Z
created_by: human
edges:
  composed_of:
    - id: wp-werkpass-werke
  depends_on:
    - id: task-werk-detail-page
effort: S
id: task-werkpass-public
is_root: false
open_questions: []
owner: null
parent: wp-werkpass-werke
private: false
risks: []
status: done
summary: "Oeffentliches Macher:innen-Profil. Zeigt anzeigename, kurzbeschreibung, faehigkeiten, links (website/github/...), Stadt, Test-Saldo, eigene Werke-Liste. Versteckt: email, klarname (wenn Pseudonym erlaubt), foerdermitgliedschaft-Details."
tags: []
title: Oeffentliche Werkpass-Seite /werkpass/[id]
type: task
updated_at: 2026-05-13T14:04:25.863Z
---

## Approach

`apps/web/app/werkpass/[id]/page.tsx` als Server Component, oeffentlich. Liest:
- nutzer per id
- test_saldo per nutzer_id (left join, default 0/0/0)
- werke wo nutzer_id = id AND sichtbarkeit IN ('oeffentlich', 'nur_zirkel') AND status='aktiv'

Wenn nutzer nicht existiert ODER status IN ('gesperrt', 'loeschung_anstehend'): `notFound()`.

### Layout

- Nav-Bar
- Hero: Avatar (oder Initialen), Anzeigename als H1, Stadt-Pill, Test-Saldo als kompakte Anzeige
- Zwei Spalten:
  - Links: Bio-Block — kurzbeschreibung, Faehigkeiten als Tag-Liste, Interessen als Tag-Liste
  - Rechts: Links-Block — website, github, linkedin, mastodon (nur die, die gesetzt sind, als Icon+Label-Liste)
- Werke-Sektion: Grid mit Werk-Cards der Macher:in (max 6 sichtbar, 'Alle Werke ansehen' wenn mehr). Re-use die work-card-Komponente aus task-werke-overview.
- Test-Saldo-Erklaerung wenn sichtbar: kleiner Hinweis 'Test-Saldo zeigt: Diese Person hat N Mal Feedback gegeben und M Mal welches erhalten. Reziprozitaet ist Werkzirkel-Pflicht.'

### Versteckte Felder

NIE im public werkpass rendern:
- email
- klarname (wenn Macher:in unter Pseudonym auftritt — der Anzeigename ist der Werkpass-Name)
- rollen-Details (nur 'Macher:in', 'Foerdermitglied' als Badge)
- IP-Adressen, audit-Felder
- foerdermitgliedschaft.stripe_*
- benachrichtigungs_einstellungen

### Bedarfsträger / Förderer

Wenn der Nutzer ausschliesslich `bedarfstraeger` oder `foerderer` ist (kein `macher`), gibt es kein Werkpass. notFound() ist OK. Werkzirkel-Werkpass = Macher:innen-Profil.

## Pitfalls

- Klarname-Leak: doppelt absichern — explizite Select-Liste in der Drizzle-Query, NICHT `db.select().from(nutzer)`.
- Wenn nutzer rolle 'macher' fehlt: notFound().
- Test-Saldo: wenn keine test_saldo-Row → 0/0/0 anzeigen, nicht 'noch nichts'.
- generateMetadata async — vorsichtig mit fetching.

Started 2026-05-13T13:58:34.373Z: autobuild werke iter 6

Done 2026-05-13T14:04:25.863Z: Öffentliche Werkpass-Seite /werkpass/[id] mit Bio + Test-Saldo + Werke-Liste, klarname/email/stripe-IDs versteckt (Tests: green via `pnpm exec vitest run`)
