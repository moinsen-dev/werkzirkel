# Werkzirkel — Designsystem

Diese Datei ist der Anker für visuelle Entscheidungen in Werkzirkel. Sie liegt
parallel zu `prd.md` und wird mit jeder Designentscheidung weitergeschrieben.

Die Quelle der Wahrheit für Tokens ist `apps/web/design/tokens.ts` plus der
`@theme`-Block in `apps/web/app/globals.css`. Diese Datei beschreibt das *Warum*
hinter den Werten.

---

## Stilziele

**Werkstatt-würdig, nicht Startup-modern.** Werkzirkel ist eine Sichtbarkeitsbühne
für handwerklich-digitale Arbeit. Das Design darf ruhig, etwas zurückgenommen und
solide wirken — keine Neon-Akzente, keine glasmorphism-Verspielheit, keine
animierten Grafiken.

**Lesbar zuerst, dekorativ zweitrangig.** Lange deutsche Wörter brauchen Platz.
Klare Hierarchie schlägt grafischen Effekt.

**Lokal verankert.** Wenn jemand „Hamburg" im UI sieht, soll es sich anfühlen wie
ein Stadtteil-Werkzeug, nicht wie eine globale SaaS-Plattform.

---

## Farben

Tokens in `apps/web/design/tokens.ts` und `app/globals.css` (`@theme`).

| Token             | Wert (OKLCH)           | Verwendung                                                       |
| ----------------- | ---------------------- | ---------------------------------------------------------------- |
| `--color-bg`      | `oklch(99% 0.002 240)` | Seiten-Hintergrund (fast-weiß mit minimalem Blau-Stich)          |
| `--color-surface` | `oklch(100% 0 0)`      | Karten, Mockups, Eingaben                                        |
| `--color-fg`      | `oklch(18% 0.012 250)` | Haupttext, primäre Buttons, Brand-Mark                           |
| `--color-muted`   | `oklch(54% 0.012 250)` | Sekundärtext, Beschriftungen, Eyebrows                           |
| `--color-border`  | `oklch(92% 0.005 250)` | Haarlinien, Card-Border, Trennlinien                             |
| `--color-accent`  | `oklch(58% 0.18 255)` | Primäre Aktionen, Links, Indigo-Akzent                            |
| `--color-warn`    | `oklch(75% 0.16 70)`   | Hinweis-States (z.B. Reziprozitäts-Frist nähert sich)            |
| `--color-fehler`  | `oklch(55% 0.20 25)`   | Fehler-States (Validierung, Server-Errors)                       |
| `--color-erfolg`  | `oklch(58% 0.13 145)`  | Erfolg (z.B. „Bedarf erfüllt", „Verifizierung abgeschlossen")    |

Hintergrund-Gradient (Body): `linear-gradient(180deg, …)` mit 14 % Accent-Mix
oben, blendet nach 420 px zum reinen `--color-bg`. Subtil — kein Hero-Splash.

OKLCH bewusst gewählt: perzeptuell linear, gleichmäßige Kontraste auch bei
Hue-Wechsel, gute Druckdarstellung (für Schauabend-Aushänge).

---

## Typografie

- **UI:** Inter (Variable Font, geplant selbst gehostet — derzeit System-Sans
  via `-apple-system, BlinkMacSystemFont, 'SF Pro Text'`)
- **Headlines:** IBM Plex Sans (geplant; derzeit `'SF Pro Display'` System-Stack)
- **Mono (selten, nur für Code):** `'SF Mono', Menlo, Consolas`

Größen (in `landingpages.css` und Tailwind-Defaults):

| Element        | Wert               | Letter-Spacing |
| -------------- | ------------------ | -------------- |
| H1             | 76 px / 0.94 lh    | −0.03 em       |
| H2             | 50 px / 1 lh       | −0.03 em       |
| H3             | 24 px / 1.12 lh    | −0.02 em       |
| Body           | 16 px / 1.55 lh    | 0              |
| Hero-Copy      | 20 px / 1.45 lh    | 0              |
| Eyebrow        | 12 px / uppercase  | 0.08 em        |

Mobile reduziert auf 52 px (H1) und 38 px (H2).

Sprache: ausschließlich Deutsch, du-Anrede, „Macher:innen"-Schreibweise mit
Doppelpunkt (BITV-konform und in der Werkstatt-Kultur akzeptiert).

---

## Abstände

Inhalts-Maximalbreite: **1180 px** (`--container-wrap`). Außerhalb dieser Breite
gibt es nur Hintergrundgradient.

Standardabstände (Tailwind-Skala): 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 6, 8, 12 rem.

Sections: 88 px (regulär) bzw. 64 px (kompakt) Padding vertikal.

---

## Border, Radien, Schatten

- **Border:** Haarlinie `1 px solid var(--color-border)`. Keine 2 px-Borders.
- **Radien:** 8 px (Default), 14 px (Cards), 18 px (Hero-Frames, CTA-Box).
- **Schatten:** sparsam. Nur Hero-Mockup und CTA-Box bekommen einen
  `0 22px 80px color-mix(in oklch, var(--color-fg) 12%, transparent)` —
  weich, blau-gefärbt durch fg.

Keine inneren Shadows, keine Glas-Effekte, kein Glow.

---

## Komponenten — Inventar (wächst mit dem Bau)

Stand v0.1.0 (Pre-Launch-LP-Trio):

| Komponente         | Datei                                          | Hinweis                                         |
| ------------------ | ---------------------------------------------- | ----------------------------------------------- |
| `.brand`           | `landingpages.css`                             | Wortmarke mit 2×2-Kachel-Logo                   |
| `.button`          | `landingpages.css`                             | primary / secondary / nav-cta                   |
| `.city-chip`       | `landingpages.css`                             | Stadt-Wahl, aria-pressed + aria-disabled        |
| `.role-card`       | `landingpages.css`                             | Drei-Wege-Switcher zwischen Pages               |
| `.product-frame`   | `landingpages.css`                             | Mockup-Wrapper mit Topbar + Sidebar             |
| `.mock-card`       | `landingpages.css`                             | Inhaltskarte im Produkt-Mockup                  |
| `.principle-card`  | `landingpages.css`                             | „Nicht-Prinzipien" mit Nummerierung             |
| `.format-card`     | `landingpages.css`                             | Format-Übersicht (Prüfrunde / Schauabend / …)   |
| `.work-card`       | `landingpages.css`                             | Werkpass-Vorschau in der LP                     |
| `.path-card`       | `landingpages.css`                             | Werkstattbeitrag-Pfade (A/B/C)                  |
| `.example-card`    | `landingpages.css`                             | Dafür / nicht dafür-Aufzählung                  |
| `.protect-list`    | `landingpages.css`                             | Schutzmechaniken (Bedarfsseite, Förderseite)    |
| `.flow-band`       | `landingpages.css`                             | Leitsatz-Streifen (vier Schritte)               |
| `.waitlist`        | `landingpages.css`                             | E-Mail-Formular mit Skizze-Feld                 |
| `.status-pill`     | `landingpages.css`                             | Status-Badges (Werkstand, „erfüllt", „verifiziert") |
| `.reziproz-row`    | `landingpages.css`                             | Test-Saldo-Anzeige als Vertrauenssignal         |
| `.callout`         | `landingpages.css`                             | Hinweis-Streifen mit Accent-Border-Left         |

App-Routen-Komponenten (Werkpass, Werkseite, Prüfrunde-Form, Bedarfs-Form usw.)
folgen mit den Sprints 2–11; sie kommen unter `apps/web/components/ui/`.

---

## Ikonografie

Lucide Icons (Tree-shakeable React-Bibliothek) für alle App-Routen.
In der LP-Phase aktuell keine Icons — nur das 2×2-Brand-Mark.

---

## Layout-Patterns

### Grid `.hero-grid`
Zwei Spalten 0.95fr / 1.05fr bei ≥1060 px. Mobile einspaltig.

### Grid `.section-head`
Headline links (0.75fr), Begleittext rechts (0.45fr). Mobile gestapelt.

### Grid `.product-split`
Zwei Spalten 0.72fr / 0.58fr für Werk-Karte + Erklär-Liste.

### Drei-Wege-Switcher (`.role-switcher`)
Drei `.role-card` nebeneinander. Aktive Karte hat `aria-current="page"` und
dunklere Border. Andere sind klickbar, hovern hochgehoben.

---

## Accessibility

- BITV/WCAG 2.1 AA als Zielstandard.
- Fokus-Outline: 2 px Accent, 3 px Offset. Niemals entfernen.
- Touch-Targets ≥ 44×44 px.
- Native HTML-Elemente bevorzugen (button, label, input, textarea, nav, header,
  footer, section, article). ARIA nur wo nativ HTML nicht ausreicht.
- du-Anrede; Sprach-Stil verzichtet auf „Hustle"-Begriffe (siehe PRD §6 & §25).
- alle Interaktionen müssen per Tastatur durchführbar sein.

---

## Mobile

- Mobile-first Tailwind (sm: 640, md: 768, lg: 1024, xl: 1280).
- Navigation klappt zu reiner Brand+CTA bei < 760 px (Hamburger-Menu kommt in
  Sprint 12 Polish).
- Grids reduzieren auf eine Spalte.

---

## Dark Mode

**Nicht in v1.0.** Werkstatt-Optik mit hellem Hintergrund ist absichtlich. Falls
in v2 angefragt, würden wir einen separaten `@theme dark`-Block ergänzen — nicht
durch System-Preference automatisch, sondern mit expliziter Wahl im Konto.

---

## Tonalität in Visuals

- Mockups zeigen **echte Werkzirkel-Inhalte** in Beispielen — keine Lorem
  ipsum-Platzhalter, keine fiktiven Startup-Namen. Beispielwerke heißen
  nach realen Hamburger Kontexten („Schichtplanung Backstube", „Bezahlstrecke
  einer kleinen App").
- Buttons heißen aktivisch: „Vormerken", „Werkpass anlegen" — nicht „Mehr
  erfahren", „Jetzt starten".
- Statussprache: „in Vorbereitung", „aktiv", „verifiziert", „erfüllt" —
  niemals „coming soon", „launching", „live".
