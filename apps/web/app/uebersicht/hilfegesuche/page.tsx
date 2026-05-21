/**
 * /uebersicht/hilfegesuche — Eigene Hilfegesuche (Server Component, eingeloggt).
 *
 * Listet ALLE eigenen Hilfegesuche (alle Status). Plus 'Neues Quick-Help'-Button.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { desc, eq } from 'drizzle-orm';

import { de } from '@/i18n/de';
import { db } from '@/lib/db';
import { hilfegesuch } from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';

export const metadata: Metadata = {
  title: 'Meine Quick-Helps',
  robots: { index: false, follow: false },
};

const th = de.hilfegesuche;

async function buildRequestFromHeaders(): Promise<Request> {
  const h = await headers();
  const headerInit: Record<string, string> = {};
  for (const [name, value] of h.entries()) {
    headerInit[name] = value;
  }
  return new Request('http://internal.werkzirkel/uebersicht/hilfegesuche', {
    headers: headerInit,
  });
}

function formatDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

export default async function UebersichtHilfegesuchePage() {
  const req = await buildRequestFromHeaders();
  const sess = await getSessionFromRequest(req);
  if (!sess) {
    redirect('/anmelden?next=/uebersicht/hilfegesuche');
  }

  const meine = await db
    .select()
    .from(hilfegesuch)
    .where(eq(hilfegesuch.nutzerId, sess.nutzerId))
    .orderBy(desc(hilfegesuch.erstelltAm));

  return (
    <div className="page-shell">
      <nav className="site-nav" aria-label="Hauptnavigation">
        <div className="wrap nav-inner">
          <Link href="/uebersicht" className="brand">
            <span>Werkzirkel</span>
          </Link>
          <div className="nav-links">
            <Link href="/uebersicht">{de.uebersicht.nav_uebersicht}</Link>
            <Link href="/hilfegesuche">{th.nav}</Link>
          </div>
        </div>
      </nav>

      <header className="hero" id="top">
        <div className="wrap hero-grid single">
          <div>
            <p className="eyebrow">Werkzirkel · Hilfegesuche</p>
            <h1>{th.uebersicht_titel}</h1>
            <p className="hero-copy">{th.uebersicht_untertitel}</p>
            <div style={{ marginTop: 20 }}>
              <Link className="button primary" href="/hilfegesuche/neu">
                {th.neues_anlegen}
              </Link>
            </div>
          </div>
        </div>
      </header>

      <section className="section compact">
        <div className="wrap">
          {meine.length === 0 ? (
            <article className="work-card" aria-label={th.uebersicht_leer}>
              <div className="work-body">
                <h3 style={{ margin: 0, fontSize: 22 }}>{th.uebersicht_leer}</h3>
              </div>
            </article>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: 16,
              }}
            >
              {meine.map((h) => (
                <article key={h.id} className="work-card" aria-label={h.titel}>
                  <div className="work-body">
                    <h3 style={{ margin: 0, fontSize: 20 }}>
                      <Link href={`/hilfegesuche/${h.id}`} style={{ color: 'inherit' }}>
                        {h.titel}
                      </Link>
                    </h3>
                    <p
                      style={{
                        margin: '8px 0 12px',
                        color: 'var(--muted)',
                        fontSize: 14,
                        lineHeight: 1.5,
                      }}
                    >
                      {h.beschreibung.slice(0, 140)}
                      {h.beschreibung.length > 140 ? '…' : ''}
                    </p>
                    <div
                      style={{
                        display: 'flex',
                        gap: 6,
                        flexWrap: 'wrap',
                        marginBottom: 8,
                      }}
                    >
                      <span className="status-pill warm" data-status={h.status}>
                        {h.status === 'offen'
                          ? th.filter_status_offen
                          : h.status === 'beantwortet'
                            ? th.filter_status_beantwortet
                            : th.filter_status_abgelaufen}
                      </span>
                      <span className="status-pill">
                        {th.detail_gueltig_bis}: {formatDate(h.gueltigBis)}
                      </span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
