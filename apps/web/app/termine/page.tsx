/**
 * /termine — Oeffentliche Termin-Liste (Server Component).
 *
 * Quelle: PRD §F-401..§F-405, §15.8.
 *
 * SearchParams (alle optional):
 *   stadt      - Stadt-ID, default 'hh'.
 *   typ        - Mehrfach-Werte (Checkbox-Filter); ohne Angabe: alle Typen.
 *   ab_datum   - ISO-Datum, default heute.
 *   bis_datum  - ISO-Datum.
 *
 * Sichtbar: nur 'veroeffentlicht'-Termine in der Zukunft (Public-Pfad).
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { and, asc, eq, gte, inArray, lte } from 'drizzle-orm';

import { de } from '@/i18n/de';
import { db } from '@/lib/db';
import { stadt, termin } from '@/lib/db/schema';
import { terminTyp, type TerminTyp } from '@/lib/db/schema/enums';

export const metadata: Metadata = {
  title: 'Termine — Werkzirkel',
  description:
    'Demo Nights, Feedback-Loop-Abende, Build-Runden und mehr — alle Termine im Werkzirkel.',
};

const tl = de.termine.liste;
const tnav = de.uebersicht;

interface PageProps {
  searchParams: Promise<{
    stadt?: string;
    typ?: string | string[];
    ab_datum?: string;
    bis_datum?: string;
  }>;
}

function asArray(v: string | string[] | undefined): string[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

function terminTypLabel(t: string): string {
  return (de.termin_typ as Record<string, string>)[t] ?? t;
}

function formatDatumZeit(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}.${mm}.${yyyy}, ${hh}:${min} Uhr`;
}

function parseTypFilter(raw: string[]): TerminTyp[] {
  const allowed = new Set<string>(terminTyp);
  const out: TerminTyp[] = [];
  for (const v of raw) {
    if (allowed.has(v) && !out.includes(v as TerminTyp)) {
      out.push(v as TerminTyp);
    }
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
  const opts = await ladeStadtOptionen();
  const valid = opts.find((s) => s.id === rawStadt);
  if (valid) return valid.id;
  return opts.find((s) => s.id === 'hh')?.id ?? opts[0]?.id ?? 'hh';
}

function parseDate(raw: string | undefined): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return null;
  return d;
}

interface ListItem {
  id: string;
  typ: TerminTyp;
  titel: string;
  datumUhrzeit: Date;
  ortText: string | null;
  onlineLink: string | null;
  maxTeilnehmer: number;
}

async function ladeTermine(opts: {
  stadtId: string;
  typen: TerminTyp[];
  abDatum: Date;
  bisDatum: Date | null;
}): Promise<ListItem[]> {
  const filters = [
    eq(termin.stadtId, opts.stadtId),
    eq(termin.status, 'veroeffentlicht'),
    gte(termin.datumUhrzeit, opts.abDatum),
  ];
  if (opts.typen.length > 0) {
    filters.push(inArray(termin.typ, opts.typen));
  }
  if (opts.bisDatum) {
    filters.push(lte(termin.datumUhrzeit, opts.bisDatum));
  }

  const rows = await db
    .select({
      id: termin.id,
      typ: termin.typ,
      titel: termin.titel,
      datumUhrzeit: termin.datumUhrzeit,
      ortText: termin.ortText,
      onlineLink: termin.onlineLink,
      maxTeilnehmer: termin.maxTeilnehmer,
    })
    .from(termin)
    .where(and(...filters))
    .orderBy(asc(termin.datumUhrzeit), asc(termin.id))
    .limit(50);

  return rows.map((r) => ({
    id: r.id,
    typ: r.typ as TerminTyp,
    titel: r.titel,
    datumUhrzeit: r.datumUhrzeit,
    ortText: r.ortText,
    onlineLink: r.onlineLink,
    maxTeilnehmer: r.maxTeilnehmer,
  }));
}

export default async function TermineListePage({ searchParams }: PageProps) {
  const sp = await searchParams;

  const stadtOptionen = await ladeStadtOptionen();
  const stadtId = await resolveStadt(sp.stadt);
  const typen = parseTypFilter(asArray(sp.typ));
  const abDatumParam = parseDate(sp.ab_datum);
  const bisDatum = parseDate(sp.bis_datum);
  const abDatum = abDatumParam ?? new Date();

  const stadtName = stadtOptionen.find((s) => s.id === stadtId)?.name ?? '';

  const items = await ladeTermine({
    stadtId,
    typen,
    abDatum,
    bisDatum,
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
            <Link href="/">Builder:innen</Link>
            <Link href="/werke">Werke</Link>
            <Link href="/pruefrunden">{tnav.nav_pruefrunden}</Link>
            <Link href="/termine" aria-current="page">
              {tnav.nav_termine}
            </Link>
            <Link href="/bedarf">Bedarf einbringen</Link>
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
            <p className="hero-copy">{tl.counter(items.length)}</p>
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
              action="/termine"
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
                  {stadtOptionen.map((s) => (
                    <option
                      key={s.id}
                      value={s.id}
                      disabled={s.status !== 'aktiv'}
                    >
                      {s.name}
                      {s.status !== 'aktiv' ? ' (in Vorbereitung)' : ''}
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
                  {tl.filter_typ}
                </legend>
                <div style={{ display: 'grid', gap: 6 }}>
                  {terminTyp.map((t) => (
                    <label
                      key={t}
                      style={{
                        display: 'inline-flex',
                        gap: 8,
                        alignItems: 'center',
                      }}
                    >
                      <input
                        type="checkbox"
                        name="typ"
                        value={t}
                        defaultChecked={typen.includes(t)}
                      />
                      <span>{terminTypLabel(t)}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <button type="submit" className="button secondary">
                {tl.filter_anwenden}
              </button>
            </form>
          </aside>

          <div>
            {items.length === 0 ? (
              <article className="work-card" aria-label={tl.leer_titel}>
                <div className="work-body">
                  <h2 style={{ margin: 0, fontSize: 22 }}>{tl.leer_titel}</h2>
                  <p style={{ margin: '8px 0 0', color: 'var(--muted)' }}>
                    {tl.leer_text}
                  </p>
                </div>
              </article>
            ) : (
              <ul
                aria-label="Termine-Liste"
                style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: 0,
                  display: 'grid',
                  gap: 12,
                }}
              >
                {items.map((t) => {
                  const ortLabel =
                    t.ortText && t.ortText.trim()
                      ? t.ortText
                      : t.onlineLink
                        ? tl.ort_online
                        : '';
                  return (
                    <li key={t.id}>
                      <article
                        className="work-card"
                        aria-label={t.titel}
                        style={{ padding: 16, display: 'grid', gap: 8 }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            gap: 6,
                            flexWrap: 'wrap',
                            alignItems: 'center',
                          }}
                        >
                          <span className="status-pill">
                            {terminTypLabel(t.typ)}
                          </span>
                          <span
                            style={{
                              color: 'var(--muted)',
                              fontSize: 13,
                              fontWeight: 600,
                            }}
                          >
                            {formatDatumZeit(t.datumUhrzeit)}
                          </span>
                        </div>
                        <h3 style={{ margin: 0, fontSize: 20 }}>
                          <Link
                            href={`/termine/${t.id}`}
                            style={{ color: 'var(--fg)' }}
                          >
                            {t.titel}
                          </Link>
                        </h3>
                        {ortLabel ? (
                          <p
                            style={{
                              margin: 0,
                              color: 'var(--muted)',
                              fontSize: 14,
                            }}
                          >
                            {ortLabel}
                          </p>
                        ) : null}
                        <div style={{ marginTop: 6 }}>
                          <Link
                            className="button secondary"
                            href={`/termine/${t.id}`}
                          >
                            {tl.zum_detail}
                          </Link>
                        </div>
                      </article>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
