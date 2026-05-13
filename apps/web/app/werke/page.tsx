/**
 * /werke — Oeffentliche Werke-Uebersicht mit Filter-Sidebar (Server Component).
 *
 * Quelle: PRD §8.12 (Suche/Filter/Sortierung), §F-103 (Werke-Filter), Prinzip P4
 * (Verbindlichkeit statt Rauschen — KEIN Suchschlitz).
 *
 * SearchParams (alle optional):
 *   stadt        - Stadt-ID, default 'hh'
 *   werkstand    - Mehrfach-Werte (Checkbox-Filter)
 *   hilfebedarf  - Mehrfach-Werte (Checkbox-Filter)
 *   sort         - 'aktuell' (default) | 'neu' | 'sucht_hilfe'
 *   cursor       - Werk-ID fuer Pagination
 *
 * Pagination: 20 pro Seite, Cursor stabil ueber (aktualisiert_am, id).
 *
 * Hard rules:
 * - KEIN Such-Input. Filter NUR via Checkbox/Radio/Select.
 * - Inhaber:innen-Daten: NUR `anzeigename`, `avatarUrl`, Stadt-Name (per JOIN).
 *   email/klarname werden in der DB-Query NICHT geselectet.
 */

import type { Metadata } from 'next';
import {
  and,
  arrayOverlaps,
  asc,
  desc,
  eq,
  inArray,
  lt,
  or,
  sql,
} from 'drizzle-orm';

import { db } from '@/lib/db';
import { nutzer, stadt, werk } from '@/lib/db/schema';
import {
  hilfebedarf as hilfebedarfEnum,
  werkstand as werkstandEnum,
  type Hilfebedarf,
  type Werkstand,
} from '@/lib/db/schema/enums';

import WerkeListView, {
  type SortOption,
  type WerkeListFilterState,
  type WerkeListItem,
} from './werke-list-view';

export const metadata: Metadata = {
  title: 'Werke — Werkzirkel',
  description:
    'Alle öffentlichen Werke aus dem Werkzirkel. Filter nach Stadt, Werkstand und Hilfebedarf — kein Suchschlitz, sondern bewusste Auswahl.',
};

const PAGE_SIZE = 20;

const VALID_SORT: readonly SortOption[] = ['aktuell', 'neu', 'sucht_hilfe'] as const;

interface PageProps {
  searchParams: Promise<{
    stadt?: string;
    werkstand?: string | string[];
    hilfebedarf?: string | string[];
    sort?: string;
    cursor?: string;
  }>;
}

function asArray(v: string | string[] | undefined): string[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

function parseSort(v: string | undefined): SortOption {
  if (!v) return 'aktuell';
  return (VALID_SORT as readonly string[]).includes(v) ? (v as SortOption) : 'aktuell';
}

function filterEnumValues<T extends string>(
  raw: string[],
  allowed: readonly T[],
): T[] {
  const set = new Set<string>(allowed);
  const out: T[] = [];
  for (const v of raw) {
    if (set.has(v) && !out.includes(v as T)) out.push(v as T);
  }
  return out;
}

interface StadtOption {
  id: string;
  name: string;
  status: 'aktiv' | 'vorbereitung' | 'inaktiv';
}

async function ladeStadtOptionen(): Promise<StadtOption[]> {
  const rows = await db
    .select({
      id: stadt.id,
      name: stadt.name,
      status: stadt.status,
      sortierung: stadt.sortierung,
    })
    .from(stadt)
    .orderBy(asc(stadt.sortierung), asc(stadt.name));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    status: r.status as 'aktiv' | 'vorbereitung' | 'inaktiv',
  }));
}

async function resolveStadt(rawStadt: string | undefined): Promise<string> {
  const stadtOpts = await ladeStadtOptionen();
  const valid = stadtOpts.find(
    (s) => s.id === rawStadt && s.status !== 'inaktiv',
  );
  if (valid) return valid.id;
  // Default-Fallback: 'hh' wenn vorhanden, sonst erste aktive Stadt.
  const hh = stadtOpts.find((s) => s.id === 'hh');
  if (hh) return hh.id;
  return stadtOpts[0]?.id ?? 'hh';
}

async function ladeAnzahl(stadtId: string): Promise<number> {
  const rows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(werk)
    .innerJoin(nutzer, eq(nutzer.id, werk.nutzerId))
    .where(
      and(
        eq(werk.sichtbarkeit, 'oeffentlich'),
        eq(werk.status, 'aktiv'),
        eq(nutzer.stadtId, stadtId),
      ),
    );
  return rows[0]?.n ?? 0;
}

async function ladeWerke(opts: {
  stadtId: string;
  werkstaende: Werkstand[];
  hilfebedarfFilter: Hilfebedarf[];
  sort: SortOption;
  cursor: string | undefined;
}): Promise<{ items: WerkeListItem[]; nextCursor: string | null }> {
  // Cursor-Werk laden (fuer (aktualisiert_am | erstellt_am, id) < cursor).
  let cursorRow: {
    aktualisiertAm: Date;
    erstelltAm: Date;
    hilfebedarfLen: number;
    id: string;
  } | null = null;
  if (opts.cursor) {
    const rows = await db
      .select({
        aktualisiertAm: werk.aktualisiertAm,
        erstelltAm: werk.erstelltAm,
        hilfebedarfLen: sql<number>`cardinality(${werk.hilfebedarf})`,
        id: werk.id,
      })
      .from(werk)
      .where(eq(werk.id, opts.cursor))
      .limit(1);
    cursorRow = rows[0] ?? null;
  }

  const filters = [
    eq(werk.sichtbarkeit, 'oeffentlich'),
    eq(werk.status, 'aktiv'),
    eq(nutzer.stadtId, opts.stadtId),
  ];
  if (opts.werkstaende.length > 0) {
    filters.push(inArray(werk.werkstand, opts.werkstaende));
  }
  if (opts.hilfebedarfFilter.length > 0) {
    filters.push(arrayOverlaps(werk.hilfebedarf, opts.hilfebedarfFilter));
  }
  if (cursorRow) {
    if (opts.sort === 'neu') {
      filters.push(
        or(
          lt(werk.erstelltAm, cursorRow.erstelltAm),
          and(eq(werk.erstelltAm, cursorRow.erstelltAm), lt(werk.id, cursorRow.id)),
        )!,
      );
    } else if (opts.sort === 'sucht_hilfe') {
      filters.push(
        or(
          lt(sql<number>`cardinality(${werk.hilfebedarf})`, cursorRow.hilfebedarfLen),
          and(
            eq(sql<number>`cardinality(${werk.hilfebedarf})`, cursorRow.hilfebedarfLen),
            lt(werk.aktualisiertAm, cursorRow.aktualisiertAm),
          ),
          and(
            eq(sql<number>`cardinality(${werk.hilfebedarf})`, cursorRow.hilfebedarfLen),
            eq(werk.aktualisiertAm, cursorRow.aktualisiertAm),
            lt(werk.id, cursorRow.id),
          ),
        )!,
      );
    } else {
      // 'aktuell' (default)
      filters.push(
        or(
          lt(werk.aktualisiertAm, cursorRow.aktualisiertAm),
          and(
            eq(werk.aktualisiertAm, cursorRow.aktualisiertAm),
            lt(werk.id, cursorRow.id),
          ),
        )!,
      );
    }
  }

  // ORDER BY je nach Sort.
  const baseQuery = db
    .select({
      werkId: werk.id,
      werkName: werk.name,
      werkKurz: werk.kurzbeschreibung,
      werkWerkstand: werk.werkstand,
      werkHilfebedarf: werk.hilfebedarf,
      werkScreenshots: werk.screenshots,
      werkAktualisiertAm: werk.aktualisiertAm,
      werkErstelltAm: werk.erstelltAm,
      // NUR public Felder fuer Inhaber:in:
      inhaberAnzeigename: nutzer.anzeigename,
      inhaberAvatarUrl: nutzer.avatarUrl,
      inhaberStadtId: nutzer.stadtId,
    })
    .from(werk)
    .innerJoin(nutzer, eq(nutzer.id, werk.nutzerId))
    .where(and(...filters));

  let rows;
  if (opts.sort === 'neu') {
    rows = await baseQuery
      .orderBy(desc(werk.erstelltAm), desc(werk.id))
      .limit(PAGE_SIZE + 1);
  } else if (opts.sort === 'sucht_hilfe') {
    rows = await baseQuery
      .orderBy(
        desc(sql<number>`cardinality(${werk.hilfebedarf})`),
        desc(werk.aktualisiertAm),
        desc(werk.id),
      )
      .limit(PAGE_SIZE + 1);
  } else {
    rows = await baseQuery
      .orderBy(desc(werk.aktualisiertAm), desc(werk.id))
      .limit(PAGE_SIZE + 1);
  }

  const hasMore = rows.length > PAGE_SIZE;
  const sliced = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
  const last = sliced.at(-1);
  const nextCursor = hasMore && last ? last.werkId : null;

  // Stadt-Namen fuer alle vorkommenden Inhaber-Staedte (typisch 1 — wir filtern
  // ja auf eine Stadt). Defensiv: wir laden trotzdem den Namen aus stadt.
  const stadtIds = Array.from(new Set(sliced.map((r) => r.inhaberStadtId)));
  const stadtNamen = new Map<string, string>();
  if (stadtIds.length > 0) {
    const stadtRows = await db
      .select({ id: stadt.id, name: stadt.name })
      .from(stadt)
      .where(inArray(stadt.id, stadtIds));
    for (const r of stadtRows) stadtNamen.set(r.id, r.name);
  }

  const items: WerkeListItem[] = sliced.map((r) => ({
    id: r.werkId,
    name: r.werkName,
    kurzbeschreibung: r.werkKurz,
    werkstand: r.werkWerkstand as Werkstand,
    hilfebedarf: (r.werkHilfebedarf ?? []) as Hilfebedarf[],
    screenshots: r.werkScreenshots ?? [],
    inhaberAnzeigename: r.inhaberAnzeigename,
    inhaberAvatarUrl: r.inhaberAvatarUrl,
    inhaberStadtName: stadtNamen.get(r.inhaberStadtId) ?? '',
  }));

  return { items, nextCursor };
}

export default async function WerkeUebersichtPage({ searchParams }: PageProps) {
  const sp = await searchParams;

  const stadtOptions = await ladeStadtOptionen();
  const stadtId = await resolveStadt(sp.stadt);
  const werkstaende = filterEnumValues(asArray(sp.werkstand), werkstandEnum);
  const hilfebedarfFilter = filterEnumValues(
    asArray(sp.hilfebedarf),
    hilfebedarfEnum,
  );
  const sort = parseSort(sp.sort);
  const cursor = sp.cursor && sp.cursor.length > 0 ? sp.cursor : undefined;

  const filter: WerkeListFilterState = {
    stadt: stadtId,
    werkstand: werkstaende,
    hilfebedarf: hilfebedarfFilter,
    sort,
  };

  const stadtName =
    stadtOptions.find((s) => s.id === stadtId)?.name ?? '';

  const [{ items, nextCursor }, gesamtAktuell] = await Promise.all([
    ladeWerke({
      stadtId,
      werkstaende,
      hilfebedarfFilter,
      sort,
      cursor,
    }),
    ladeAnzahl(stadtId),
  ]);

  return (
    <WerkeListView
      items={items}
      filter={filter}
      stadtOptions={stadtOptions}
      stadtName={stadtName}
      gesamtAktuell={gesamtAktuell}
      nextCursor={nextCursor}
    />
  );
}
