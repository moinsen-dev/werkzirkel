/**
 * /uebersicht/werkstattbeitrag — Eigene Werkstattbeitraege (Server Component).
 *
 * Liste alle drei Pfade: Schauabend-Teilnahme, Geldbeitrag (mit Stripe-
 * Status), Sachleistung (mit Verifikations-Status).
 *
 * Stripe-Erfolg-Banner wenn ?status=ok kommt vom Checkout-Redirect.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { desc, eq } from 'drizzle-orm';

import { de } from '@/i18n/de';
import { db } from '@/lib/db';
import { werkstattbeitrag } from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';
import type {
  WerkstattbeitragArt,
  WerkstattbeitragStatus,
} from '@/lib/db/schema/enums';

export const metadata: Metadata = {
  title: 'Mein Werkstattbeitrag — Werkzirkel',
  robots: { index: false, follow: false },
};

const tu = de.bedarfsseite.uebersicht_werkstattbeitrag;
const tnav = de.uebersicht;

interface PageProps {
  searchParams: Promise<{ status?: string }>;
}

async function buildRequestFromHeaders(): Promise<Request> {
  const h = await headers();
  const headerInit: Record<string, string> = {};
  for (const [name, value] of h.entries()) {
    headerInit[name] = value;
  }
  return new Request('http://internal.werkzirkel/uebersicht/werkstattbeitrag', {
    headers: headerInit,
  });
}

function formatDatum(d: Date | null | undefined): string {
  if (!d) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

function artLabel(a: WerkstattbeitragArt): string {
  return (
    (de.bedarfsseite.werkstattbeitrag_art_label as Record<string, string>)[a] ??
    a
  );
}

function statusLabel(s: WerkstattbeitragStatus): string {
  return (
    (de.bedarfsseite.werkstattbeitrag_status_label as Record<string, string>)[s] ??
    s
  );
}

export default async function UebersichtWerkstattbeitragPage({
  searchParams,
}: PageProps) {
  const req = await buildRequestFromHeaders();
  const sess = await getSessionFromRequest(req);
  if (!sess) {
    redirect('/anmelden?next=/uebersicht/werkstattbeitrag');
  }

  const sp = await searchParams;

  const items = await db
    .select()
    .from(werkstattbeitrag)
    .where(eq(werkstattbeitrag.nutzerId, sess.nutzerId))
    .orderBy(desc(werkstattbeitrag.erstelltAm));

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
            <Link href="/uebersicht/werkstattbeitrag" aria-current="page">
              {de.bedarfsseite.nav_werkstattbeitrag}
            </Link>
            <Link href="/uebersicht/bedarfe">
              {de.bedarfsseite.nav_meine_bedarfe}
            </Link>
          </div>
        </div>
      </nav>

      <header className="hero" id="top">
        <div className="wrap hero-grid single">
          <div>
            <p className="eyebrow">{tu.eyebrow}</p>
            <h1>{tu.titel}</h1>
            <p className="hero-copy">{tu.untertitel}</p>
          </div>
        </div>
      </header>

      <section className="section compact">
        <div className="wrap" style={{ maxWidth: 860 }}>
          {sp.status === 'ok' ? (
            <Banner kind="ok">{tu.banner_erfolg}</Banner>
          ) : sp.status === 'abgebrochen' ? (
            <Banner kind="info">{tu.banner_abgebrochen}</Banner>
          ) : null}

          {items.length === 0 ? (
            <article className="work-card" aria-label={tu.leer_titel}>
              <div className="work-body">
                <h3 style={{ margin: 0, fontSize: 22 }}>{tu.leer_titel}</h3>
                <p style={{ margin: '8px 0 0', color: 'var(--muted)' }}>
                  {tu.leer_text}
                </p>
                <Link
                  className="button primary"
                  href="/bedarfe/neu"
                  style={{ marginTop: 12 }}
                >
                  Bedarf einbringen
                </Link>
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
              {items.map((b) => (
                <article
                  key={b.id}
                  className="work-card"
                  aria-label={artLabel(b.art)}
                >
                  <div className="work-body">
                    <p className="eyebrow" style={{ margin: 0 }}>
                      {artLabel(b.art)}
                    </p>
                    <div
                      style={{
                        display: 'flex',
                        gap: 6,
                        flexWrap: 'wrap',
                        margin: '8px 0',
                      }}
                    >
                      <span className="status-pill">
                        {statusLabel(b.status)}
                      </span>
                    </div>
                    {b.hoeheEuroCent ? (
                      <p style={{ margin: '6px 0', fontSize: 14 }}>
                        Höhe: {Math.round(b.hoeheEuroCent / 100)} €
                      </p>
                    ) : null}
                    {b.nachweisText ? (
                      <p
                        style={{
                          margin: '6px 0',
                          color: 'var(--muted)',
                          fontSize: 13,
                          whiteSpace: 'pre-line',
                        }}
                      >
                        {b.nachweisText}
                      </p>
                    ) : null}
                    <p
                      style={{
                        margin: '8px 0 0',
                        color: 'var(--muted)',
                        fontSize: 12,
                      }}
                    >
                      Erfasst am: {formatDatum(b.erstelltAm)}
                      {b.gueltigBis
                        ? ` · gültig bis ${formatDatum(b.gueltigBis)}`
                        : ''}
                      {b.verwendetFuerBedarfe > 0
                        ? ` · verwendet für ${b.verwendetFuerBedarfe} Bedarfe`
                        : ''}
                    </p>
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

function Banner({
  kind,
  children,
}: {
  kind: 'ok' | 'info';
  children: React.ReactNode;
}) {
  const styles =
    kind === 'ok'
      ? {
          border: '1px solid #2a7a2a',
          background: '#eaf6ea',
          color: '#15431a',
        }
      : {
          border: 'var(--hairline)',
          background: 'var(--surface)',
          color: 'var(--fg)',
        };
  return (
    <div
      role={kind === 'ok' ? 'status' : 'note'}
      className="callout"
      style={{
        marginBottom: 16,
        padding: '12px 14px',
        borderRadius: 10,
        ...styles,
      }}
    >
      {children}
    </div>
  );
}
