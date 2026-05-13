# Werkzirkel

Deutschsprachige lokale Hybrid-Plattform für unabhängige digitale Macher:innen, Bedarfsträger:innen und Förder:innen im DACH-Raum.

> Baue digitale Produkte nicht allein. Werde lokal gesehen.

**Status:** v1.0 in Entwicklung. Plattform-Bau läuft parallel zur Hamburger Schauabend-Akquise. Erste aktive Stadt: Hamburg. Berlin und München strukturell vorbereitet.

**Lizenz:** MIT — Open Source, getragen von [Moinsen](https://moinsen.dev).

## Was ist das?

Werkzirkel verbindet drei Seiten und schützt jede vor der anderen:

- **Macher:innen** zeigen Werke, geben und nehmen Prüfrunden, treffen sich auf Schauabenden.
- **Bedarfsträger:innen** bringen konkrete digitale Probleme aus ihrer Hamburger Organisation in den Kreis — mit Werkstattbeitrag statt Ausschreibung.
- **Förder:innen** stellen sich mit verifiziertem Profil und transparentem Rahmen vor — auf Bedarfsschauen persönlich.

Vermittlungen passieren offline. Die Plattform ist eine kuratierte Sichtbarkeitsbühne, kein Marktplatz.

Vollständige Produktdefinition: siehe [`prd.md`](./prd.md).
Designsystem: siehe [`DESIGN.md`](./DESIGN.md) (folgt mit Sprint 1).

## Werkstatt-Kultur

- Deutsch-only.
- Keine Jobbörse, kein Freelancer-Marktplatz, kein Investoren-Marktplatz.
- Keine Direktnachrichten an Bedarfsträger:innen und Förder:innen.
- Keine Provision. Keine Vertragsabwicklung über die Plattform.
- Reziprozität verbindlich: Wer Hilfe bekommt, hilft auch anderen.

## Tech-Stack

- **Frontend + Backend:** Next.js 15 (App Router, Server Components, Server Actions) · React 19 · TypeScript 5
- **Datenbank:** PostgreSQL 17 · Drizzle ORM
- **Auth:** Better-Auth (Magic-Link, keine Passwörter)
- **Payments:** Stripe (Werkstattbeitrag, Fördermitgliedschaft, Erfolgsbeitrag-Spende)
- **Mail:** Resend
- **Speicher:** Cloudflare R2
- **Hosting:** Hetzner Cloud + Docker (kein Coolify; eigene Container)
- **CDN/DNS:** Cloudflare
- **Monitoring:** Sentry + selbst-gehostetes Plausible
- **Tests:** Vitest (Unit/Integration) + Playwright (E2E)

## Repo-Struktur

```
werkzirkel/
├── apps/
│   └── web/                   # Next.js-Hauptanwendung
│       ├── app/               # App Router
│       ├── components/
│       ├── lib/
│       │   ├── db/            # Drizzle Schema + Migrationen
│       │   ├── auth/
│       │   └── ...
│       ├── i18n/de.ts         # alle deutschen UI-Strings
│       └── design/tokens.ts   # Design-Tokens
├── prd.md                     # Product Requirement Document v1.0
├── DESIGN.md                  # Designsystem (folgt)
├── Dockerfile
├── docker-compose.yml
└── README.md
```

## Lokale Entwicklung

Voraussetzungen: Node.js ≥ 22, pnpm ≥ 10, Docker.

```bash
pnpm install
cp .env.example .env
docker compose up -d db          # Postgres starten
pnpm db:migrate                  # Schema anwenden
pnpm db:seed                     # drei Städte + Admin-Konto
pnpm dev                         # http://localhost:3000
```

## Tests

```bash
pnpm typecheck
pnpm lint
pnpm test
```

## Deployment

Production läuft auf Hetzner Cloud via eigenem Docker-Stack. Siehe [`Dockerfile`](./Dockerfile) und [`docker-compose.yml`](./docker-compose.yml).

## Mitmachen

Werkzirkel ist Open Source — Beiträge willkommen, solange sie die Werkstatt-Kultur respektieren (siehe PRD §1). Diskussionen über das Produktverständnis bitte als Issue, technische Verbesserungen als PR.

## Kontakt

Hamburger Kreis: `hamburg@werkzirkel.de` *(zum Plattform-Start aktiv)*
Allgemein: `kontakt@werkzirkel.de`
