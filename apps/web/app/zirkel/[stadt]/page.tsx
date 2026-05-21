/**
 * /zirkel/[stadt] — Oeffentliche Zirkel-Stadt-Seite (Server Component).
 *
 * Quelle: PRD §F-301..§F-304 (Zirkel-Seite, Inhalte, Hervorhebung) + §8.5
 * (regionale Zirkel). Hamburg ist initial aktiv (`stadt.status='aktiv'`);
 * Berlin/Muenchen sind 'vorbereitung'.
 *
 * Slug-Mapping: `hh`/`hamburg` → 'hh', `b`/`berlin` → 'b',
 * `m`/`muenchen`/`münchen` → 'm'. Alles andere → 404.
 *
 * Hard rules:
 * - Mitglieder-/Werke-/Termin-Listen NUR fuer status='aktiv'-Variante.
 * - In `vorbereitung`-Variante werden Mitglieder/Werke/Termine NIE
 *   gerendert, selbst wenn die DB Daten haette (Seed-Hygiene).
 * - Kein klarname/email/Stripe-Felder im HTML — wir selecten nur
 *   public-relevante Spalten.
 * - Kurator-E-Mail wird NICHT direkt aus `nutzer.email` aufgeloest; statt
 *   dessen zeigen wir die Stadt-Mail-Konvention `<slug>@werkzirkel.de`
 *   (siehe seed.ts SEED_KURATOR_HH_EMAIL — `hamburg@werkzirkel.de`).
 */

import type { Metadata } from 'next';
import { and, desc, eq, gt, sql } from 'drizzle-orm';
import { notFound } from 'next/navigation';

import { db } from '@/lib/db';
import { nutzer, stadt, termin, werk } from '@/lib/db/schema';
import type { Werkstand, Hilfebedarf, TerminTyp } from '@/lib/db/schema/enums';

import ZirkelStadtView, {
  type ZirkelMitglied,
  type ZirkelWerk,
  type ZirkelTermin,
  type ZirkelStadtRow,
} from './zirkel-stadt-view';

interface PageParams {
  params: Promise<{ stadt: string }>;
}

/**
 * Slug → Stadt-ID. Beide Schreibweisen werden akzeptiert.
 * Slugs sind case-insensitive; die normalisierung passiert vor dem Lookup.
 */
const SLUG_MAP: Record<string, 'hh' | 'b' | 'm'> = {
  hh: 'hh',
  hamburg: 'hh',
  b: 'b',
  berlin: 'b',
  m: 'm',
  muenchen: 'm',
  'münchen': 'm',
};

const MITGLIEDER_LIMIT = 12;
const WERKE_LIMIT = 6;
const TERMINE_LIMIT = 3;

/** Konvention: jede Stadt hat eine Mail-Adresse <stadtKurzname>@werkzirkel.de. */
const STADT_MAIL: Record<'hh' | 'b' | 'm', string> = {
  hh: 'hamburg@werkzirkel.de',
  b: 'berlin@werkzirkel.de',
  m: 'muenchen@werkzirkel.de',
};

function normalizeSlug(raw: string): string {
  return decodeURIComponent(raw).trim().toLowerCase();
}

function resolveStadtId(slug: string): 'hh' | 'b' | 'm' | null {
  return SLUG_MAP[normalizeSlug(slug)] ?? null;
}

async function ladeStadt(stadtId: string): Promise<ZirkelStadtRow | null> {
  const rows = await db
    .select({
      id: stadt.id,
      name: stadt.name,
      status: stadt.status,
      beschreibung: stadt.beschreibung,
    })
    .from(stadt)
    .where(eq(stadt.id, stadtId))
    .limit(1);
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    name: r.name,
    status: r.status as 'aktiv' | 'vorbereitung' | 'inaktiv',
    beschreibung: r.beschreibung,
  };
}

async function ladeMitglieder(stadtId: string): Promise<ZirkelMitglied[]> {
  // Nur public Felder selecten. `rollen @> ARRAY['macher']` — Postgres-Array-
  // Contains-Operator, Drizzle exponiert keinen schoenen Helper, also raw SQL.
  const rows = await db
    .select({
      id: nutzer.id,
      anzeigename: nutzer.anzeigename,
      avatarUrl: nutzer.avatarUrl,
    })
    .from(nutzer)
    .where(
      and(
        eq(nutzer.stadtId, stadtId),
        eq(nutzer.status, 'aktiv'),
        sql`${nutzer.rollen} @> ARRAY['macher']::text[]`,
      ),
    )
    .orderBy(desc(nutzer.erstelltAm), desc(nutzer.id))
    .limit(MITGLIEDER_LIMIT);
  return rows.map((r) => ({
    id: r.id,
    anzeigename: r.anzeigename,
    avatarUrl: r.avatarUrl,
  }));
}

async function ladeWerke(stadtId: string): Promise<ZirkelWerk[]> {
  const rows = await db
    .select({
      id: werk.id,
      name: werk.name,
      kurzbeschreibung: werk.kurzbeschreibung,
      werkstand: werk.werkstand,
      hilfebedarf: werk.hilfebedarf,
      screenshots: werk.screenshots,
      inhaberAnzeigename: nutzer.anzeigename,
      inhaberAvatarUrl: nutzer.avatarUrl,
    })
    .from(werk)
    .innerJoin(nutzer, eq(nutzer.id, werk.nutzerId))
    .where(
      and(
        eq(nutzer.stadtId, stadtId),
        eq(werk.sichtbarkeit, 'oeffentlich'),
        eq(werk.status, 'aktiv'),
      ),
    )
    .orderBy(desc(werk.aktualisiertAm), desc(werk.id))
    .limit(WERKE_LIMIT);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    kurzbeschreibung: r.kurzbeschreibung,
    werkstand: r.werkstand as Werkstand,
    hilfebedarf: (r.hilfebedarf ?? []) as Hilfebedarf[],
    screenshots: r.screenshots ?? [],
    inhaberAnzeigename: r.inhaberAnzeigename,
    inhaberAvatarUrl: r.inhaberAvatarUrl,
  }));
}

async function ladeTermine(stadtId: string): Promise<ZirkelTermin[]> {
  const rows = await db
    .select({
      id: termin.id,
      titel: termin.titel,
      typ: termin.typ,
      datumUhrzeit: termin.datumUhrzeit,
    })
    .from(termin)
    .where(
      and(
        eq(termin.stadtId, stadtId),
        eq(termin.status, 'veroeffentlicht'),
        gt(termin.datumUhrzeit, new Date()),
      ),
    )
    .orderBy(termin.datumUhrzeit)
    .limit(TERMINE_LIMIT);
  return rows.map((r) => ({
    id: r.id,
    titel: r.titel,
    typ: r.typ as TerminTyp,
    datumUhrzeit: r.datumUhrzeit,
  }));
}

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { stadt: rawSlug } = await params;
  const stadtId = resolveStadtId(rawSlug);
  if (!stadtId) {
    return { title: 'Nicht gefunden', robots: { index: false, follow: false } };
  }
  const row = await ladeStadt(stadtId);
  if (!row) {
    return { title: 'Nicht gefunden', robots: { index: false, follow: false } };
  }
  return {
    title: `Werkzirkel ${row.name}`,
    description:
      row.beschreibung ??
      `Werkzirkel ${row.name} — Builder:innen aus der Region zeigen Werke, testen gegenseitig und kommen voran.`,
  };
}

export default async function ZirkelStadtPage({ params }: PageParams) {
  const { stadt: rawSlug } = await params;
  const stadtId = resolveStadtId(rawSlug);
  if (!stadtId) notFound();

  const stadtRow = await ladeStadt(stadtId);
  if (!stadtRow) notFound();

  // In Vorbereitung/Inaktiv: KEINE Mitglieder/Werke/Termine-Sektionen rendern.
  // (Selbst wenn die DB Daten haette — Seed-Hygiene, siehe PRD §8.5.)
  if (stadtRow.status !== 'aktiv') {
    return (
      <ZirkelStadtView
        stadtRow={stadtRow}
        mitglieder={[]}
        werke={[]}
        termine={[]}
        stadtMail={STADT_MAIL[stadtId]}
      />
    );
  }

  const [mitglieder, werke, termine] = await Promise.all([
    ladeMitglieder(stadtId),
    ladeWerke(stadtId),
    ladeTermine(stadtId),
  ]);

  return (
    <ZirkelStadtView
      stadtRow={stadtRow}
      mitglieder={mitglieder}
      werke={werke}
      termine={termine}
      stadtMail={STADT_MAIL[stadtId]}
    />
  );
}
