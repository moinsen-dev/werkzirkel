/**
 * /uebersicht/bedarfe — Eigene Bedarfe (Server Component, Auth + Bedarfstraeger:in).
 *
 * Listet alle eigenen Bedarfe gruppiert nach Status. Plus Membership-Beitrag-
 * Status-Karte (welche sind aktiv, wann laufen sie ab).
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { and, desc, eq, gt, isNull, lt, or } from 'drizzle-orm';

import { de } from '@/i18n/de';
import { db } from '@/lib/db';
import { bedarf, werkstattbeitrag } from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';
import { hasRolle } from '@/lib/auth/permissions';
import type { BedarfStatus } from '@/lib/db/schema/enums';

export const metadata: Metadata = {
  title: 'Meine Bedarfe — Werkzirkel',
  robots: { index: false, follow: false },
};

const tu = de.bedarfsseite.uebersicht_bedarfe;
const tnav = de.uebersicht;
const VERWENDET_LIMIT = 4;

async function buildRequestFromHeaders(): Promise<Request> {
  const h = await headers();
  const headerInit: Record<string, string> = {};
  for (const [name, value] of h.entries()) {
    headerInit[name] = value;
  }
  return new Request('http://internal.werkzirkel/uebersicht/bedarfe', {
    headers: headerInit,
  });
}

function formatFrist(d: Date | null | undefined): string {
  if (!d) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

function statusLabel(s: BedarfStatus): string {
  return (
    (de.bedarfsseite.bedarf_status_label as Record<string, string>)[s] ?? s
  );
}

export default async function UebersichtBedarfePage() {
  const req = await buildRequestFromHeaders();
  const sess = await getSessionFromRequest(req);
  if (!sess) {
    redirect('/anmelden?next=/uebersicht/bedarfe');
  }

  const istBedarf = hasRolle(sess.nutzer, 'bedarfstraeger');
  if (!istBedarf) {
    redirect('/uebersicht?fehler=keine_bedarfstraeger_rolle');
  }

  const meineBedarfe = await db
    .select()
    .from(bedarf)
    .where(eq(bedarf.nutzerId, sess.nutzerId))
    .orderBy(desc(bedarf.erstelltAm));

  const jetzt = new Date();
  const aktiveBeitraege = await db
    .select()
    .from(werkstattbeitrag)
    .where(
      and(
        eq(werkstattbeitrag.nutzerId, sess.nutzerId),
        eq(werkstattbeitrag.status, 'verifiziert'),
        or(
          isNull(werkstattbeitrag.gueltigBis),
          gt(werkstattbeitrag.gueltigBis, jetzt),
        ),
        lt(werkstattbeitrag.verwendetFuerBedarfe, VERWENDET_LIMIT),
      ),
    );

  const naechsterAblauf = aktiveBeitraege.reduce<Date | null>((min, b) => {
    if (!b.gueltigBis) return min;
    if (!min || b.gueltigBis < min) return b.gueltigBis;
    return min;
  }, null);

  const gruppen = {
    aktiv: meineBedarfe.filter((b) =>
      (['oeffentlich', 'in_gespraechen'] as BedarfStatus[]).includes(b.status),
    ),
    in_pruefung: meineBedarfe.filter((b) => b.status === 'in_pruefung'),
    entwurf: meineBedarfe.filter((b) => b.status === 'entwurf'),
    abgeschlossen: meineBedarfe.filter((b) =>
      (['erfuellt', 'eingestellt'] as BedarfStatus[]).includes(b.status),
    ),
  };

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
            <Link href="/uebersicht/bedarfe" aria-current="page">
              {de.bedarfsseite.nav_meine_bedarfe}
            </Link>
            <Link href="/bedarfe">{de.bedarfsseite.nav_bedarfe}</Link>
          </div>
        </div>
      </nav>

      <header className="hero" id="top">
        <div className="wrap hero-grid single">
          <div>
            <p className="eyebrow">{tu.eyebrow}</p>
            <h1>{tu.titel}</h1>
            <p className="hero-copy">{tu.untertitel}</p>
            <div style={{ marginTop: 16 }}>
              <Link className="button primary" href="/bedarfe/neu">
                {tu.neu_button}
              </Link>
            </div>
          </div>
        </div>
      </header>

      <section className="section compact">
        <div className="wrap">
          <article className="work-card" aria-label={tu.werkstattbeitrag_titel}>
            <div className="work-body">
              <p className="eyebrow" style={{ margin: 0 }}>
                {tu.werkstattbeitrag_titel}
              </p>
              {aktiveBeitraege.length > 0 ? (
                <p style={{ marginTop: 8 }}>
                  {tu.werkstattbeitrag_aktiv(
                    aktiveBeitraege.length,
                    formatFrist(naechsterAblauf) || 'unbegrenzt',
                  )}
                </p>
              ) : (
                <p style={{ marginTop: 8, color: 'var(--muted)' }}>
                  {tu.werkstattbeitrag_keiner}
                </p>
              )}
              <Link
                className="button secondary"
                href="/uebersicht/werkstattbeitrag"
                style={{ marginTop: 8 }}
              >
                {de.bedarfsseite.nav_werkstattbeitrag} ansehen
              </Link>
            </div>
          </article>
        </div>
      </section>

      <section className="section compact">
        <div className="wrap">
          {meineBedarfe.length === 0 ? (
            <article className="work-card" aria-label={tu.leer_titel}>
              <div className="work-body">
                <h3 style={{ margin: 0, fontSize: 22 }}>{tu.leer_titel}</h3>
                <p style={{ margin: '8px 0 0', color: 'var(--muted)' }}>
                  {tu.leer_text}
                </p>
              </div>
            </article>
          ) : (
            <>
              <Sektion titel={tu.sektion_aktiv} bedarfe={gruppen.aktiv} />
              <Sektion
                titel={tu.sektion_in_pruefung}
                bedarfe={gruppen.in_pruefung}
              />
              <Sektion titel={tu.sektion_entwuerfe} bedarfe={gruppen.entwurf} />
              <Sektion
                titel={tu.sektion_abgeschlossen}
                bedarfe={gruppen.abgeschlossen}
              />
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function Sektion({
  titel,
  bedarfe,
}: {
  titel: string;
  bedarfe: Array<typeof bedarf.$inferSelect>;
}) {
  if (bedarfe.length === 0) return null;
  return (
    <div style={{ marginBottom: 24 }}>
      <h2 style={{ fontSize: 20 }}>{titel}</h2>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 16,
        }}
      >
        {bedarfe.map((b) => (
          <article
            key={b.id}
            className="work-card"
            aria-label={b.titel}
          >
            <div className="work-body">
              <h3 style={{ margin: 0, fontSize: 18 }}>
                <Link
                  href={`/bedarfe/${b.id}`}
                  style={{ color: 'var(--fg)' }}
                >
                  {b.titel}
                </Link>
              </h3>
              <p
                style={{
                  margin: '6px 0',
                  color: 'var(--muted)',
                  fontSize: 13,
                }}
              >
                {b.organisation}
              </p>
              <span className="status-pill">{statusLabel(b.status)}</span>
              <p
                style={{
                  margin: '8px 0 0',
                  color: 'var(--muted)',
                  fontSize: 12,
                }}
              >
                Frist: {formatFrist(b.frist)}
              </p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
