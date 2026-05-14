/**
 * /kasse/[stadt] — öffentliche Werkstatt-Kasse-Übersicht (Server Component).
 *
 * Zeigt pro Stadt + Quartal:
 *  - Eingangs-Tabelle (Datum / Kategorie / Beschreibung / Betrag)
 *  - Ausgangs-Tabelle
 *  - Gesamtsummen + Saldo
 *
 * Renderzustand: nur freigegebene Einträge (analog zum öffentlichen API-
 * Endpoint). Quartals-Filter via ?quartal=YYYY-Qn; ohne Parameter wird das
 * aktuelle Quartal vorausgewählt.
 *
 * Slug-Mapping wie /zirkel/[stadt]: hh/hamburg, b/berlin, m/muenchen/münchen.
 *
 * PRD-Referenz: §8.11 (öffentliche Quartalsübersicht).
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { and, desc, eq, isNotNull } from 'drizzle-orm';

import { db } from '@/lib/db';
import { stadt as stadtTable, werkstattKasseEintrag } from '@/lib/db/schema';
import {
  aktuellesQuartal,
  parseQuartal,
  vorigesQuartal,
  naechstesQuartal,
} from '@/lib/kasse/quartal';
import { kategorieLabel, euroFormat } from '@/lib/kasse/labels';

interface PageParams {
  params: Promise<{ stadt: string }>;
  searchParams: Promise<{ quartal?: string }>;
}

const SLUG_MAP: Record<string, 'hh' | 'b' | 'm'> = {
  hh: 'hh',
  hamburg: 'hh',
  b: 'b',
  berlin: 'b',
  m: 'm',
  muenchen: 'm',
  'münchen': 'm',
};

function resolveStadtId(raw: string): 'hh' | 'b' | 'm' | null {
  const slug = decodeURIComponent(raw).trim().toLowerCase();
  return SLUG_MAP[slug] ?? null;
}

export async function generateMetadata({
  params,
}: PageParams): Promise<Metadata> {
  const { stadt: rawSlug } = await params;
  const stadtId = resolveStadtId(rawSlug);
  if (!stadtId) {
    return { title: 'Nicht gefunden', robots: { index: false, follow: false } };
  }
  const rows = await db
    .select({ name: stadtTable.name })
    .from(stadtTable)
    .where(eq(stadtTable.id, stadtId))
    .limit(1);
  const name = rows[0]?.name ?? stadtId;
  return {
    title: `Werkstatt-Kasse ${name}`,
    description: `Öffentliche Quartalsübersicht der Werkstatt-Kasse für ${name} — Eingänge, Ausgänge, Saldo.`,
  };
}

export default async function KassePage({ params, searchParams }: PageParams) {
  const { stadt: rawSlug } = await params;
  const sp = await searchParams;
  const stadtId = resolveStadtId(rawSlug);
  if (!stadtId) notFound();

  const stadtRows = await db
    .select({ id: stadtTable.id, name: stadtTable.name })
    .from(stadtTable)
    .where(eq(stadtTable.id, stadtId))
    .limit(1);
  const stadtRow = stadtRows[0];
  if (!stadtRow) notFound();

  const aktuelles = aktuellesQuartal();
  const requested = sp.quartal && parseQuartal(sp.quartal) ? sp.quartal : aktuelles;

  const rows = await db
    .select()
    .from(werkstattKasseEintrag)
    .where(
      and(
        eq(werkstattKasseEintrag.stadtId, stadtId),
        eq(werkstattKasseEintrag.quartal, requested),
        isNotNull(werkstattKasseEintrag.freigegebenAm),
      ),
    )
    .orderBy(desc(werkstattKasseEintrag.datum), desc(werkstattKasseEintrag.id));

  const eingaenge = rows.filter((r) => r.typ === 'eingang');
  const ausgaenge = rows.filter((r) => r.typ === 'ausgang');
  const summeEingang = eingaenge.reduce((s, r) => s + r.hoeheEuroCent, 0);
  const summeAusgang = ausgaenge.reduce((s, r) => s + r.hoeheEuroCent, 0);
  const saldo = summeEingang - summeAusgang;

  const vorig = vorigesQuartal(requested);
  const naechst = naechstesQuartal(requested);
  const baseHref = `/kasse/${rawSlug}`;

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
            <Link href={`/zirkel/${rawSlug}`}>Zirkel {stadtRow.name}</Link>
            <Link href={`/kasse/${rawSlug}`} aria-current="page">
              Werkstatt-Kasse
            </Link>
          </div>
        </div>
      </nav>

      <header className="hero" id="top">
        <div className="wrap hero-grid single">
          <div>
            <p className="eyebrow">Werkzirkel · Werkstatt-Kasse</p>
            <h1>
              Werkstatt-Kasse {stadtRow.name} — {requested}
            </h1>
            <p className="hero-copy">
              Quartalsweise öffentliche Übersicht aller Eingänge und Ausgänge der
              Werkstatt-Kasse. Werkstattbeiträge, Erfolgsbeiträge und
              Fördermitgliedsbeiträge fließen automatisch ein; Ausgaben für Raum,
              Getränke, Werkzeug und Kurator-Aufwand werden hier transparent
              dokumentiert.
            </p>
          </div>
        </div>
      </header>

      <section className="section compact" aria-label="Quartal wählen">
        <div className="wrap" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {vorig ? (
            <Link className="button secondary" href={`${baseHref}?quartal=${vorig}`}>
              ← {vorig}
            </Link>
          ) : null}
          <span
            style={{
              padding: '8px 14px',
              borderRadius: 10,
              border: 'var(--hairline)',
              fontWeight: 600,
            }}
          >
            {requested}
          </span>
          {naechst ? (
            <Link className="button secondary" href={`${baseHref}?quartal=${naechst}`}>
              {naechst} →
            </Link>
          ) : null}
          {requested !== aktuelles ? (
            <Link className="button secondary" href={baseHref}>
              Aktuelles Quartal ({aktuelles})
            </Link>
          ) : null}
        </div>
      </section>

      <section className="section" aria-label="Eingänge">
        <div className="wrap">
          <h2>Eingänge</h2>
          {eingaenge.length === 0 ? (
            <p style={{ color: 'var(--muted)' }}>
              Keine freigegebenen Eingänge für dieses Quartal.
            </p>
          ) : (
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Datum</th>
                  <th style={thStyle}>Kategorie</th>
                  <th style={thStyle}>Beschreibung</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Betrag</th>
                </tr>
              </thead>
              <tbody>
                {eingaenge.map((r) => (
                  <tr key={r.id}>
                    <td style={tdStyle}>{r.datum}</td>
                    <td style={tdStyle}>{kategorieLabel(r.kategorie)}</td>
                    <td style={tdStyle}>{r.beschreibung}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      {euroFormat(r.hoeheEuroCent)}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={3} style={{ ...tdStyle, fontWeight: 700 }}>
                    Summe Eingang
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700 }}>
                    {euroFormat(summeEingang)}
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="section" aria-label="Ausgänge">
        <div className="wrap">
          <h2>Ausgänge</h2>
          {ausgaenge.length === 0 ? (
            <p style={{ color: 'var(--muted)' }}>
              Keine freigegebenen Ausgänge für dieses Quartal.
            </p>
          ) : (
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Datum</th>
                  <th style={thStyle}>Kategorie</th>
                  <th style={thStyle}>Beschreibung</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Betrag</th>
                </tr>
              </thead>
              <tbody>
                {ausgaenge.map((r) => (
                  <tr key={r.id}>
                    <td style={tdStyle}>{r.datum}</td>
                    <td style={tdStyle}>{kategorieLabel(r.kategorie)}</td>
                    <td style={tdStyle}>{r.beschreibung}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      {euroFormat(r.hoeheEuroCent)}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={3} style={{ ...tdStyle, fontWeight: 700 }}>
                    Summe Ausgang
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700 }}>
                    {euroFormat(summeAusgang)}
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="section" aria-label="Saldo">
        <div className="wrap">
          <h2>Saldo {requested}</h2>
          <p style={{ fontSize: 22, fontWeight: 700 }}>{euroFormat(saldo)}</p>
          <p style={{ color: 'var(--muted)' }}>
            Eingang {euroFormat(summeEingang)} − Ausgang {euroFormat(summeAusgang)}
          </p>
        </div>
      </section>
    </div>
  );
}

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  marginTop: 12,
};

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 10px',
  borderBottom: '2px solid var(--hairline-color, #ddd)',
  fontWeight: 600,
};

const tdStyle: React.CSSProperties = {
  padding: '8px 10px',
  borderBottom: '1px solid var(--hairline-color, #eee)',
  verticalAlign: 'top',
};
