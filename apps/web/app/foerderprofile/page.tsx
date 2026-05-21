/**
 * /foerderprofile — Foerderprofile-Liste (Server Component, eingeloggt-only).
 *
 * Quelle: PRD §F-704, §11A Kulturverlust 5 (Equity nicht vermitteln).
 *
 * Auth Pflicht. Filter: stadt (Dropdown), foerderart (Checkbox),
 * gegenleistung_typ (Checkbox). KEIN Suchschlitz.
 * Zeigt nur status='verifiziert'. Equity-Badge bei gegenleistung_typ='equity_offline'.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { and, asc, eq, inArray } from 'drizzle-orm';

import { de } from '@/i18n/de';
import { db } from '@/lib/db';
import { foerderprofil, nutzer, stadt } from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';
import {
  foerderart as foerderartEnum,
  gegenleistungTyp as gegenleistungTypEnum,
  type Foerderart,
  type GegenleistungTyp,
} from '@/lib/db/schema/enums';

export const metadata: Metadata = {
  title: 'Sponsor-Profile — Werkzirkel',
  robots: { index: false, follow: false },
};

const tl = de.bedarfsseite.foerderprofile_liste;
const tnav = de.uebersicht;

interface PageProps {
  searchParams: Promise<{
    stadt?: string;
    foerderart?: string | string[];
    gegenleistung_typ?: string | string[];
  }>;
}

async function buildRequestFromHeaders(): Promise<Request> {
  const h = await headers();
  const headerInit: Record<string, string> = {};
  for (const [name, value] of h.entries()) {
    headerInit[name] = value;
  }
  return new Request('http://internal.werkzirkel/foerderprofile', {
    headers: headerInit,
  });
}

function asArray(v: string | string[] | undefined): string[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

function foerderartLabel(f: string): string {
  return (
    (de.bedarfsseite.foerderart_label as Record<string, string>)[f] ?? f
  );
}

function gegenleistungLabel(g: string): string {
  return (
    (de.bedarfsseite.gegenleistung_typ_label as Record<string, string>)[g] ?? g
  );
}

function formatEuro(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return '';
  return `${Math.round(cents / 100).toLocaleString('de-DE')} €`;
}

async function ladeStadtOptionen() {
  return db
    .select({
      id: stadt.id,
      name: stadt.name,
      sortierung: stadt.sortierung,
    })
    .from(stadt)
    .orderBy(asc(stadt.sortierung), asc(stadt.name));
}

export default async function FoerderprofileListePage({
  searchParams,
}: PageProps) {
  const req = await buildRequestFromHeaders();
  const sess = await getSessionFromRequest(req);
  if (!sess) {
    redirect('/anmelden?next=/foerderprofile');
  }

  const sp = await searchParams;
  const stadtOptionen = await ladeStadtOptionen();
  const stadtId =
    sp.stadt && stadtOptionen.some((s) => s.id === sp.stadt)
      ? sp.stadt
      : sess.nutzer.stadtId || 'hh';

  const foerderartFilter = asArray(sp.foerderart).filter((v) =>
    (foerderartEnum as readonly string[]).includes(v),
  ) as Foerderart[];
  const gegenleistungFilter = asArray(sp.gegenleistung_typ).filter((v) =>
    (gegenleistungTypEnum as readonly string[]).includes(v),
  ) as GegenleistungTyp[];

  const filters = [
    eq(foerderprofil.verifikationStatus, 'verifiziert'),
    eq(nutzer.stadtId, stadtId),
  ];
  if (foerderartFilter.length > 0) {
    filters.push(inArray(foerderprofil.foerderart, foerderartFilter));
  }
  if (gegenleistungFilter.length > 0) {
    filters.push(inArray(foerderprofil.gegenleistungTyp, gegenleistungFilter));
  }

  const items = await db
    .select({
      id: foerderprofil.id,
      organisation: foerderprofil.organisation,
      foerderart: foerderprofil.foerderart,
      foerderrahmenJahrMinEuroCent: foerderprofil.foerderrahmenJahrMinEuroCent,
      foerderrahmenJahrMaxEuroCent: foerderprofil.foerderrahmenJahrMaxEuroCent,
      gegenleistungTyp: foerderprofil.gegenleistungTyp,
    })
    .from(foerderprofil)
    .innerJoin(nutzer, eq(nutzer.id, foerderprofil.nutzerId))
    .where(and(...filters))
    .limit(50);

  return (
    <div className="page-shell">
      <nav className="site-nav" aria-label="Hauptnavigation">
        <div className="wrap nav-inner">
          <Link href="/uebersicht" className="brand" aria-label="Werkzirkel Start">
            <span className="brand-mark" aria-hidden="true">
              <span></span>
              <span></span>
              <span></span>
              <span></span>
            </span>
            <span>Werkzirkel</span>
          </Link>
          <div className="nav-links" aria-label="Bereiche">
            <Link href="/uebersicht">{tnav.nav_uebersicht}</Link>
            <Link href="/bedarfe">{de.bedarfsseite.nav_bedarfe}</Link>
            <Link href="/foerderprofile" aria-current="page">
              {de.bedarfsseite.nav_foerderprofile}
            </Link>
          </div>
        </div>
      </nav>

      <header className="hero" id="top">
        <div className="wrap hero-grid single">
          <div>
            <p className="eyebrow">{tl.eyebrow}</p>
            <h1>{tl.titel}</h1>
            <p className="hero-copy">{tl.untertitel}</p>
            <p style={{ marginTop: 8, color: 'var(--muted)' }}>
              {tl.counter(items.length)}
            </p>
            <div style={{ marginTop: 16 }}>
              <Link className="button primary" href="/foerderprofile/neu">
                {tl.neues_profil}
              </Link>
            </div>
          </div>
        </div>
      </header>

      <section className="section compact">
        <div
          className="wrap"
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(240px, 300px) 1fr',
            gap: 24,
          }}
        >
          <aside aria-label={tl.filter_titel}>
            <form
              method="get"
              action="/foerderprofile"
              style={{ display: 'grid', gap: 18 }}
            >
              <h2 style={{ fontSize: 18, margin: 0 }}>{tl.filter_titel}</h2>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Stadt</span>
                <select
                  name="stadt"
                  defaultValue={stadtId}
                  style={inputStyle}
                >
                  {stadtOptionen.map((s) => (
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
                  {tl.filter_foerderart}
                </legend>
                <div style={{ display: 'grid', gap: 6 }}>
                  {foerderartEnum.map((f) => (
                    <label
                      key={f}
                      style={{
                        display: 'inline-flex',
                        gap: 8,
                        alignItems: 'center',
                      }}
                    >
                      <input
                        type="checkbox"
                        name="foerderart"
                        value={f}
                        defaultChecked={foerderartFilter.includes(f)}
                      />
                      <span>{foerderartLabel(f)}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset
                style={{
                  border: 'var(--hairline)',
                  borderRadius: 12,
                  padding: 12,
                  margin: 0,
                }}
              >
                <legend style={{ fontWeight: 600, padding: '0 6px' }}>
                  {tl.filter_gegenleistung}
                </legend>
                <div style={{ display: 'grid', gap: 6 }}>
                  {gegenleistungTypEnum.map((g) => (
                    <label
                      key={g}
                      style={{
                        display: 'inline-flex',
                        gap: 8,
                        alignItems: 'center',
                      }}
                    >
                      <input
                        type="checkbox"
                        name="gegenleistung_typ"
                        value={g}
                        defaultChecked={gegenleistungFilter.includes(g)}
                      />
                      <span>{gegenleistungLabel(g)}</span>
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
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    'repeat(auto-fill, minmax(280px, 1fr))',
                  gap: 16,
                }}
              >
                {items.map((f) => (
                  <article
                    key={f.id}
                    className="work-card"
                    aria-label={f.organisation}
                  >
                    <div className="work-body">
                      <h3 style={{ margin: 0, fontSize: 20 }}>
                        <Link
                          href={`/foerderprofile/${f.id}`}
                          style={{ color: 'var(--fg)' }}
                        >
                          {f.organisation}
                        </Link>
                      </h3>
                      <div
                        style={{
                          display: 'flex',
                          gap: 6,
                          flexWrap: 'wrap',
                          margin: '10px 0',
                        }}
                      >
                        <span className="status-pill">
                          {foerderartLabel(f.foerderart)}
                        </span>
                        {f.gegenleistungTyp === 'equity_offline' ? (
                          <span className="status-pill warm">
                            {tl.equity_badge}
                          </span>
                        ) : null}
                      </div>
                      {f.foerderrahmenJahrMinEuroCent !== null ||
                      f.foerderrahmenJahrMaxEuroCent !== null ? (
                        <p
                          style={{
                            margin: '0 0 6px',
                            color: 'var(--fg)',
                            fontSize: 14,
                          }}
                        >
                          Sponsor-Budget pro Jahr:{' '}
                          {formatEuro(f.foerderrahmenJahrMinEuroCent)}
                          {f.foerderrahmenJahrMinEuroCent !== null &&
                          f.foerderrahmenJahrMaxEuroCent !== null
                            ? ' – '
                            : ''}
                          {formatEuro(f.foerderrahmenJahrMaxEuroCent)}
                        </p>
                      ) : null}
                      <p
                        style={{
                          margin: 0,
                          color: 'var(--muted)',
                          fontSize: 13,
                        }}
                      >
                        Gegenleistung: {gegenleistungLabel(f.gegenleistungTyp)}
                      </p>
                      <div style={{ marginTop: 14 }}>
                        <Link
                          className="button secondary"
                          href={`/foerderprofile/${f.id}`}
                        >
                          {tl.zum_detail}
                        </Link>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '8px 10px',
  borderRadius: 8,
  border: 'var(--hairline)',
  background: 'var(--surface)',
  color: 'var(--fg)',
};
