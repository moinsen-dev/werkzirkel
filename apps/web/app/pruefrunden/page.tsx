/**
 * /pruefrunden — Oeffentliche Pruefrunden-Liste (Server Component).
 *
 * Quelle: PRD §F-201 ff., §15.4 (Filter), §8.4 (Pruefrunden-Felder).
 *
 * SearchParams (alle optional):
 *   stadt   - Stadt-ID, default 'hh'
 *   status  - Mehrfach-Werte (Checkbox-Filter); Default: 'oeffentlich' +
 *             'geschlossen' (laufende Runden, die Tester:innen brauchen).
 *   cursor  - Pruefrunde-ID fuer Pagination.
 *
 * KEIN Suchschlitz (Prinzip P4) — nur Stadt-Dropdown + Status-Checkboxen.
 * Sichtbar: oeffentlich, geschlossen, abgeschlossen. Entwurfe NIE.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { and, asc, eq, gt, inArray, or, sql } from 'drizzle-orm';

import { de } from '@/i18n/de';
import { db } from '@/lib/db';
import {
  nutzer,
  pruefrunde,
  pruefrundenAnmeldung,
  stadt,
  werk,
} from '@/lib/db/schema';
import { type PruefrundeStatus } from '@/lib/db/schema/enums';

export const metadata: Metadata = {
  title: 'Prüfrunden — Werkzirkel',
  description:
    'Offene Prüfrunden im Werkzirkel. Werde Tester:in und gib strukturiertes Feedback zu Werken anderer Macher:innen.',
};

const PAGE_SIZE = 20;
const tl = de.pruefrunden.liste;
const tn = de.uebersicht;
const PUBLIC_STATUS: ReadonlyArray<PruefrundeStatus> = [
  'oeffentlich',
  'geschlossen',
  'abgeschlossen',
];
const DEFAULT_STATUS: PruefrundeStatus[] = ['oeffentlich', 'geschlossen'];

interface PageProps {
  searchParams: Promise<{
    stadt?: string;
    status?: string | string[];
    cursor?: string;
  }>;
}

function asArray(v: string | string[] | undefined): string[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

function formatFrist(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

function werkstandLabel(w: string): string {
  return (de.werkstand as Record<string, string>)[w] ?? w;
}

function statusLabel(s: PruefrundeStatus): string {
  return (de.pruefrunden.status as Record<string, string>)[s] ?? s;
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
  const opts = await ladeStadtOptionen();
  const valid = opts.find((s) => s.id === rawStadt);
  if (valid) return valid.id;
  return opts.find((s) => s.id === 'hh')?.id ?? opts[0]?.id ?? 'hh';
}

function parseStatusFilter(raw: string[]): PruefrundeStatus[] {
  const allowed = new Set<string>(PUBLIC_STATUS);
  const out: PruefrundeStatus[] = [];
  for (const v of raw) {
    if (allowed.has(v) && !out.includes(v as PruefrundeStatus)) {
      out.push(v as PruefrundeStatus);
    }
  }
  return out;
}

interface ListItem {
  id: string;
  titel: string;
  frist: Date;
  status: PruefrundeStatus;
  zeitbedarfMinuten: number;
  gesuchteTester: number;
  angemeldet: number;
  werkId: string;
  werkName: string;
  werkstand: string;
  inhaberAnzeigename: string;
}

async function ladePruefrunden(opts: {
  stadtId: string;
  status: PruefrundeStatus[];
  cursor: string | undefined;
}): Promise<{ items: ListItem[]; nextCursor: string | null; gesamt: number }> {
  if (opts.status.length === 0) {
    return { items: [], nextCursor: null, gesamt: 0 };
  }

  // Cursor-Wert nachladen
  let cursorRow: { frist: Date; id: string } | null = null;
  if (opts.cursor) {
    const rows = await db
      .select({ frist: pruefrunde.frist, id: pruefrunde.id })
      .from(pruefrunde)
      .where(eq(pruefrunde.id, opts.cursor))
      .limit(1);
    cursorRow = rows[0] ?? null;
  }

  const filters = [
    inArray(pruefrunde.status, opts.status),
    eq(nutzer.stadtId, opts.stadtId),
  ];
  if (cursorRow) {
    filters.push(
      or(
        gt(pruefrunde.frist, cursorRow.frist),
        and(
          eq(pruefrunde.frist, cursorRow.frist),
          gt(pruefrunde.id, cursorRow.id),
        ),
      )!,
    );
  }

  const rows = await db
    .select({
      pruefrundeId: pruefrunde.id,
      titel: pruefrunde.titel,
      frist: pruefrunde.frist,
      status: pruefrunde.status,
      zeitbedarfMinuten: pruefrunde.zeitbedarfMinuten,
      gesuchteTester: pruefrunde.gesuchteTester,
      werkId: werk.id,
      werkName: werk.name,
      werkstand: werk.werkstand,
      inhaberAnzeigename: nutzer.anzeigename,
    })
    .from(pruefrunde)
    .innerJoin(werk, eq(werk.id, pruefrunde.werkId))
    .innerJoin(nutzer, eq(nutzer.id, werk.nutzerId))
    .where(and(...filters))
    .orderBy(asc(pruefrunde.frist), asc(pruefrunde.id))
    .limit(PAGE_SIZE + 1);

  const hasMore = rows.length > PAGE_SIZE;
  const sliced = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
  const last = sliced.at(-1);
  const nextCursor = hasMore && last ? last.pruefrundeId : null;

  // Anmeldungs-Counts in einer Aggregat-Query
  const ids = sliced.map((r) => r.pruefrundeId);
  const countMap = new Map<string, number>();
  if (ids.length > 0) {
    const countRows = await db
      .select({
        pruefrundeId: pruefrundenAnmeldung.pruefrundeId,
        anzahl: sql<number>`count(*)::int`,
      })
      .from(pruefrundenAnmeldung)
      .where(
        and(
          inArray(pruefrundenAnmeldung.pruefrundeId, ids),
          inArray(pruefrundenAnmeldung.status, [
            'angemeldet',
            'feedback_gegeben',
          ]),
        ),
      )
      .groupBy(pruefrundenAnmeldung.pruefrundeId);
    for (const c of countRows) countMap.set(c.pruefrundeId, c.anzahl);
  }

  // Gesamt-Counter (auf der Page-Statistik)
  const totalRows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(pruefrunde)
    .innerJoin(werk, eq(werk.id, pruefrunde.werkId))
    .innerJoin(nutzer, eq(nutzer.id, werk.nutzerId))
    .where(
      and(
        inArray(pruefrunde.status, opts.status),
        eq(nutzer.stadtId, opts.stadtId),
      ),
    );
  const gesamt = totalRows[0]?.n ?? 0;

  const items: ListItem[] = sliced.map((r) => ({
    id: r.pruefrundeId,
    titel: r.titel,
    frist: r.frist,
    status: r.status,
    zeitbedarfMinuten: r.zeitbedarfMinuten,
    gesuchteTester: r.gesuchteTester,
    angemeldet: countMap.get(r.pruefrundeId) ?? 0,
    werkId: r.werkId,
    werkName: r.werkName,
    werkstand: r.werkstand ?? '',
    inhaberAnzeigename: r.inhaberAnzeigename,
  }));

  return { items, nextCursor, gesamt };
}

function buildHref(
  stadtId: string,
  status: PruefrundeStatus[],
  cursor?: string | null,
): string {
  const params = new URLSearchParams();
  params.set('stadt', stadtId);
  for (const s of status) params.append('status', s);
  if (cursor) params.set('cursor', cursor);
  return `/pruefrunden?${params.toString()}`;
}

export default async function PruefrundenListePage({ searchParams }: PageProps) {
  const sp = await searchParams;

  const stadtOptions = await ladeStadtOptionen();
  const stadtId = await resolveStadt(sp.stadt);
  const statusRaw = parseStatusFilter(asArray(sp.status));
  const status = statusRaw.length > 0 ? statusRaw : DEFAULT_STATUS;
  const cursor = sp.cursor && sp.cursor.length > 0 ? sp.cursor : undefined;

  const stadtName = stadtOptions.find((s) => s.id === stadtId)?.name ?? '';

  const { items, nextCursor, gesamt } = await ladePruefrunden({
    stadtId,
    status,
    cursor,
  });

  return (
    <div className="page-shell">
      <nav className="site-nav" aria-label="Hauptnavigation">
        <div className="wrap nav-inner">
          <Link href="/" className="brand" aria-label="Werkzirkel Start">
            <span className="brand-mark" aria-hidden="true">
              <span></span>
              <span></span>
              <span></span>
              <span></span>
            </span>
            <span>Werkzirkel</span>
          </Link>
          <div className="nav-links" aria-label="Bereiche">
            <Link href="/">Macher:innen</Link>
            <Link href="/werke">Werke</Link>
            <Link href="/pruefrunden" aria-current="page">
              {tn.nav_pruefrunden}
            </Link>
            <Link href="/bedarf">Bedarf einbringen</Link>
            <Link href="/foerdern">Werke fördern</Link>
          </div>
          <Link className="nav-cta" href="/anmelden">
            Anmelden
          </Link>
        </div>
      </nav>

      <header className="hero" id="top">
        <div className="wrap hero-grid single">
          <div>
            <p className="eyebrow">{tl.eyebrow(stadtName)}</p>
            <h1>{tl.titel(stadtName)}</h1>
            <p className="hero-copy">{tl.counter(gesamt)}</p>
          </div>
        </div>
      </header>

      <section className="section compact">
        <div
          className="wrap"
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(220px, 280px) 1fr',
            gap: 24,
          }}
        >
          <aside aria-label={tl.filter_titel}>
            <form
              method="get"
              action="/pruefrunden"
              style={{ display: 'grid', gap: 18 }}
            >
              <h2 style={{ fontSize: 18, margin: 0 }}>{tl.filter_titel}</h2>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>{tl.filter_stadt}</span>
                <select
                  name="stadt"
                  defaultValue={stadtId}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: 'var(--hairline)',
                    background: 'var(--surface)',
                    color: 'var(--fg)',
                  }}
                >
                  {stadtOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <fieldset
                style={{
                  border: 'var(--hairline)',
                  borderRadius: 12,
                  padding: 12,
                  margin: 0,
                }}
              >
                <legend style={{ fontWeight: 600, padding: '0 6px' }}>
                  {tl.filter_status}
                </legend>
                <div style={{ display: 'grid', gap: 6 }}>
                  {PUBLIC_STATUS.map((s) => (
                    <label
                      key={s}
                      style={{
                        display: 'inline-flex',
                        gap: 8,
                        alignItems: 'center',
                      }}
                    >
                      <input
                        type="checkbox"
                        name="status"
                        value={s}
                        defaultChecked={status.includes(s)}
                      />
                      <span>{statusLabel(s)}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <button type="submit" className="button secondary">
                Filter anwenden
              </button>
            </form>
          </aside>

          <div>
            {items.length === 0 ? (
              <article
                className="work-card"
                aria-label={tl.leer_titel(stadtName)}
              >
                <div className="work-body">
                  <h2 style={{ margin: 0, fontSize: 22 }}>
                    {tl.leer_titel(stadtName)}
                  </h2>
                  <p style={{ margin: '8px 0 0', color: 'var(--muted)' }}>
                    {tl.leer_text}
                  </p>
                </div>
              </article>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    'repeat(auto-fill, minmax(280px, 1fr))',
                  gap: 16,
                }}
              >
                {items.map((p) => (
                  <article
                    key={p.id}
                    className="work-card"
                    aria-label={p.titel}
                  >
                    <div className="work-body">
                      <h3 style={{ margin: 0, fontSize: 20 }}>
                        <Link
                          href={`/pruefrunden/${p.id}`}
                          style={{ color: 'var(--fg)' }}
                        >
                          {p.titel}
                        </Link>
                      </h3>
                      <p
                        style={{
                          margin: '6px 0 12px',
                          color: 'var(--muted)',
                          fontSize: 14,
                        }}
                      >
                        zu{' '}
                        <Link
                          href={`/werke/${p.werkId}`}
                          style={{ color: 'var(--muted)' }}
                        >
                          {p.werkName}
                        </Link>{' '}
                        · {p.inhaberAnzeigename}
                      </p>
                      <div
                        style={{
                          display: 'flex',
                          gap: 6,
                          flexWrap: 'wrap',
                          marginBottom: 12,
                        }}
                      >
                        {p.werkstand ? (
                          <span className="status-pill warm">
                            {werkstandLabel(p.werkstand)}
                          </span>
                        ) : null}
                        <span className="status-pill">
                          {statusLabel(p.status)}
                        </span>
                      </div>
                      <p
                        style={{
                          margin: '0 0 6px',
                          color: 'var(--fg)',
                          fontSize: 14,
                        }}
                      >
                        {tl.frist_label}: {formatFrist(p.frist)}
                      </p>
                      <p
                        style={{
                          margin: 0,
                          color: 'var(--muted)',
                          fontSize: 13,
                        }}
                      >
                        {tl.tester_counter(p.angemeldet, p.gesuchteTester)} ·{' '}
                        {p.zeitbedarfMinuten} Min
                      </p>
                      <div style={{ marginTop: 14 }}>
                        <Link
                          className="button secondary"
                          href={`/pruefrunden/${p.id}`}
                        >
                          {tl.zum_detail}
                        </Link>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}

            {nextCursor ? (
              <div style={{ marginTop: 24, textAlign: 'center' }}>
                <Link
                  className="button"
                  href={buildHref(stadtId, status, nextCursor)}
                >
                  Weitere Prüfrunden laden
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
