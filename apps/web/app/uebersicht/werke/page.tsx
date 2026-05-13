/**
 * /uebersicht/werke — Eigene Werke (Server Component).
 *
 * Listet ALLE eigenen Werke (oeffentlich, nur_zirkel, pausiert; aktiv +
 * ausgeblendet). Pro Werk: Name, Werkstand, Sichtbarkeit, Bearbeiten-Link.
 * Plus 'Neues Werk anlegen'-Button (disabled wenn Limit erreicht).
 *
 * Auth Pflicht — ohne Session redirect zu /anmelden?next=/uebersicht/werke.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { desc, eq } from 'drizzle-orm';

import { de } from '@/i18n/de';
import { db } from '@/lib/db';
import { werk } from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';
import { pruefeWerkAnlegenLimit } from '@/lib/werk/limit';

export const metadata: Metadata = {
  title: 'Meine Werke',
  robots: { index: false, follow: false },
};

const tu = de.werke_uebersicht;

async function buildRequestFromHeaders(): Promise<Request> {
  const h = await headers();
  const headerInit: Record<string, string> = {};
  for (const [name, value] of h.entries()) {
    headerInit[name] = value;
  }
  return new Request('http://internal.werkzirkel/uebersicht/werke', {
    headers: headerInit,
  });
}

function werkstandLabel(w: string): string {
  return (de.werkstand as Record<string, string>)[w] ?? w;
}

export default async function UebersichtWerkePage() {
  const req = await buildRequestFromHeaders();
  const sess = await getSessionFromRequest(req);
  if (!sess) {
    redirect('/anmelden?next=/uebersicht/werke');
  }

  const meineWerke = await db
    .select()
    .from(werk)
    .where(eq(werk.nutzerId, sess.nutzerId))
    .orderBy(desc(werk.aktualisiertAm));

  const limit = await pruefeWerkAnlegenLimit(sess.nutzerId);
  const kannAnlegen = limit.erlaubt;

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
            <Link href="/uebersicht">{de.uebersicht.nav_uebersicht}</Link>
            <Link href="/uebersicht/werke" aria-current="page">
              {de.uebersicht.nav_werke}
            </Link>
          </div>
        </div>
      </nav>

      <header className="hero" id="top">
        <div className="wrap hero-grid single">
          <div>
            <p className="eyebrow">Werkzirkel · Meine Werke</p>
            <h1>{tu.titel}</h1>
            <p className="hero-copy">{tu.untertitel}</p>
            <div
              style={{ display: 'flex', gap: 12, marginTop: 20, flexWrap: 'wrap' }}
            >
              {kannAnlegen ? (
                <Link className="button primary" href="/werke/neu">
                  {tu.neues_werk}
                </Link>
              ) : (
                <button
                  type="button"
                  className="button primary"
                  disabled
                  aria-disabled="true"
                  title={tu.limit_erreicht_hinweis}
                >
                  {tu.neues_werk}
                </button>
              )}
            </div>
            {!kannAnlegen ? (
              <p
                style={{
                  margin: '12px 0 0',
                  color: 'var(--muted)',
                  fontSize: 14,
                }}
                data-limit-hinweis
              >
                {tu.limit_erreicht_hinweis}
              </p>
            ) : null}
          </div>
        </div>
      </header>

      <section className="section compact">
        <div className="wrap">
          {meineWerke.length === 0 ? (
            <article className="work-card" aria-label={tu.leer_titel}>
              <div className="work-body">
                <h3 style={{ margin: 0, fontSize: 22 }}>{tu.leer_titel}</h3>
                <p style={{ margin: '8px 0 0', color: 'var(--muted)' }}>
                  {tu.leer_text}
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
              {meineWerke.map((w) => (
                <article
                  key={w.id}
                  className="work-card"
                  aria-label={w.name}
                >
                  <div className="work-body">
                    <h3 style={{ margin: 0, fontSize: 20 }}>{w.name}</h3>
                    <p
                      style={{
                        margin: '8px 0 12px',
                        color: 'var(--muted)',
                        fontSize: 14,
                        lineHeight: 1.5,
                      }}
                    >
                      {w.kurzbeschreibung}
                    </p>
                    <div
                      style={{
                        display: 'flex',
                        gap: 6,
                        flexWrap: 'wrap',
                        marginBottom: 12,
                      }}
                    >
                      <span className="status-pill warm">
                        {tu.werkstand_label}: {werkstandLabel(w.werkstand)}
                      </span>
                      {w.sichtbarkeit === 'pausiert' ? (
                        <span className="status-pill">{tu.badge_pausiert}</span>
                      ) : null}
                      {w.sichtbarkeit === 'nur_zirkel' ? (
                        <span className="status-pill">{tu.badge_nur_zirkel}</span>
                      ) : null}
                      {w.status === 'ausgeblendet' ? (
                        <span className="status-pill">
                          {tu.badge_ausgeblendet}
                        </span>
                      ) : null}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <Link
                        className="button secondary"
                        href={`/werke/${w.id}/bearbeiten`}
                      >
                        {tu.bearbeiten}
                      </Link>
                      <Link
                        className="button"
                        href={`/werke/${w.id}`}
                        style={{ color: 'var(--muted)' }}
                      >
                        Detail
                      </Link>
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
