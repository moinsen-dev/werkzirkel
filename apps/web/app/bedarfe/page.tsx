/**
 * /bedarfe — Bedarfe-Liste (Server Component, eingeloggt-only).
 *
 * Quelle: PRD §F-601 ff., §11A Schutz S1/S2/S4.
 *
 * Auth Pflicht — anonyme bekommen einen Redirect zur Anmeldung.
 * Filter: stadt (Dropdown), KEIN Suchschlitz (Prinzip P4, PRD §11A Schutz S4).
 * Zeigt nur status='oeffentlich' und 'in_gespraechen' (PRD §F-603).
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { and, asc, eq, inArray } from 'drizzle-orm';

import { de } from '@/i18n/de';
import { db } from '@/lib/db';
import { bedarf, stadt } from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';
import type { BedarfStatus } from '@/lib/db/schema/enums';

export const metadata: Metadata = {
  title: 'Bedarfe — Werkzirkel',
  robots: { index: false, follow: false },
};

const tl = de.bedarfsseite.bedarfe_liste;
const tn = de.uebersicht;

const SICHTBARE_STATUS: BedarfStatus[] = ['oeffentlich', 'in_gespraechen'];

interface PageProps {
  searchParams: Promise<{ stadt?: string }>;
}

async function buildRequestFromHeaders(): Promise<Request> {
  const h = await headers();
  const headerInit: Record<string, string> = {};
  for (const [name, value] of h.entries()) {
    headerInit[name] = value;
  }
  return new Request('http://internal.werkzirkel/bedarfe', {
    headers: headerInit,
  });
}

function formatFrist(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

function formatEuro(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return '';
  return `${Math.round(cents / 100).toLocaleString('de-DE')} €`;
}

function statusLabel(s: BedarfStatus): string {
  return (
    (de.bedarfsseite.bedarf_status_label as Record<string, string>)[s] ?? s
  );
}

function werkstandLabel(w: string | null): string {
  if (!w) return '';
  return (de.werkstand as Record<string, string>)[w] ?? w;
}

async function ladeStadtOptionen() {
  const rows = await db
    .select({
      id: stadt.id,
      name: stadt.name,
      status: stadt.status,
      sortierung: stadt.sortierung,
    })
    .from(stadt)
    .orderBy(asc(stadt.sortierung), asc(stadt.name));
  return rows;
}

export default async function BedarfeListePage({ searchParams }: PageProps) {
  const req = await buildRequestFromHeaders();
  const sess = await getSessionFromRequest(req);
  if (!sess) {
    redirect('/anmelden?next=/bedarfe');
  }

  const sp = await searchParams;
  const stadtOptionen = await ladeStadtOptionen();
  const stadtId =
    sp.stadt && stadtOptionen.some((s) => s.id === sp.stadt)
      ? sp.stadt
      : sess.nutzer.stadtId || 'hh';
  const stadtName = stadtOptionen.find((s) => s.id === stadtId)?.name ?? '';

  const filters = [
    inArray(bedarf.status, SICHTBARE_STATUS),
    eq(bedarf.stadtId, stadtId),
  ];

  const items = await db
    .select()
    .from(bedarf)
    .where(and(...filters))
    .orderBy(asc(bedarf.frist))
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
            <Link href="/uebersicht">{tn.nav_uebersicht}</Link>
            <Link href="/bedarfe" aria-current="page">
              {de.bedarfsseite.nav_bedarfe}
            </Link>
            <Link href="/foerderprofile">
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
              <Link className="button primary" href="/bedarfe/neu">
                {tl.neuer_bedarf}
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
            gridTemplateColumns: 'minmax(220px, 280px) 1fr',
            gap: 24,
          }}
        >
          <aside aria-label={tl.filter_titel}>
            <form
              method="get"
              action="/bedarfe"
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
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
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
                {items.map((b) => (
                  <article
                    key={b.id}
                    className="work-card"
                    aria-label={b.titel}
                  >
                    <div className="work-body">
                      <h3 style={{ margin: 0, fontSize: 20 }}>
                        <Link
                          href={`/bedarfe/${b.id}`}
                          style={{ color: 'var(--fg)' }}
                        >
                          {b.titel}
                        </Link>
                      </h3>
                      <p
                        style={{
                          margin: '6px 0 12px',
                          color: 'var(--muted)',
                          fontSize: 14,
                        }}
                      >
                        {b.organisation} · {stadtName}
                      </p>
                      <div
                        style={{
                          display: 'flex',
                          gap: 6,
                          flexWrap: 'wrap',
                          marginBottom: 12,
                        }}
                      >
                        <span className="status-pill">
                          {statusLabel(b.status)}
                        </span>
                        {b.bevorzugterWerkstand ? (
                          <span className="status-pill warm">
                            {werkstandLabel(b.bevorzugterWerkstand)}
                          </span>
                        ) : null}
                      </div>
                      <p
                        style={{
                          margin: '0 0 6px',
                          color: 'var(--fg)',
                          fontSize: 14,
                        }}
                      >
                        {tl.frist_label}: {formatFrist(b.frist)}
                      </p>
                      {b.geldrahmenMinEuroCent !== null ||
                      b.geldrahmenMaxEuroCent !== null ? (
                        <p
                          style={{
                            margin: 0,
                            color: 'var(--muted)',
                            fontSize: 13,
                          }}
                        >
                          {tl.geldrahmen_label}:{' '}
                          {formatEuro(b.geldrahmenMinEuroCent)}
                          {b.geldrahmenMinEuroCent !== null &&
                          b.geldrahmenMaxEuroCent !== null
                            ? ' – '
                            : ''}
                          {formatEuro(b.geldrahmenMaxEuroCent)}
                        </p>
                      ) : null}
                      <div style={{ marginTop: 14 }}>
                        <Link
                          className="button secondary"
                          href={`/bedarfe/${b.id}`}
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
