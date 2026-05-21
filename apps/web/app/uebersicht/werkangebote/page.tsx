/**
 * /uebersicht/werkangebote — Eigene Werkangebote (Server Component,
 * Auth + Builder:innen-Rolle).
 *
 * Liste eigener werkangebote mit Bedarf-Mini + Status.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { desc, eq } from 'drizzle-orm';

import { de } from '@/i18n/de';
import { db } from '@/lib/db';
import { bedarf, werk, werkangebot } from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';
import { hasRolle } from '@/lib/auth/permissions';
import type { WerkangebotStatus } from '@/lib/db/schema/enums';

export const metadata: Metadata = {
  title: 'Meine Match-Angebote — Werkzirkel',
  robots: { index: false, follow: false },
};

const tu = de.bedarfsseite.uebersicht_werkangebote;
const tnav = de.uebersicht;

interface PageProps {
  searchParams: Promise<{ erfolg?: string }>;
}

async function buildRequestFromHeaders(): Promise<Request> {
  const h = await headers();
  const headerInit: Record<string, string> = {};
  for (const [name, value] of h.entries()) {
    headerInit[name] = value;
  }
  return new Request('http://internal.werkzirkel/uebersicht/werkangebote', {
    headers: headerInit,
  });
}

function statusLabel(s: WerkangebotStatus): string {
  return (
    (de.bedarfsseite.werkangebot_status_label as Record<string, string>)[s] ?? s
  );
}

export default async function UebersichtWerkangebotePage({
  searchParams,
}: PageProps) {
  const req = await buildRequestFromHeaders();
  const sess = await getSessionFromRequest(req);
  if (!sess) {
    redirect('/anmelden?next=/uebersicht/werkangebote');
  }

  const istMacher = hasRolle(sess.nutzer, 'macher');
  if (!istMacher) {
    redirect('/uebersicht?fehler=keine_macher_rolle');
  }

  const sp = await searchParams;

  const items = await db
    .select({
      id: werkangebot.id,
      bedarfId: werkangebot.bedarfId,
      bedarfTitel: bedarf.titel,
      bedarfOrganisation: bedarf.organisation,
      werkId: werkangebot.werkId,
      werkName: werk.name,
      status: werkangebot.status,
      erstelltAm: werkangebot.erstelltAm,
    })
    .from(werkangebot)
    .innerJoin(bedarf, eq(bedarf.id, werkangebot.bedarfId))
    .innerJoin(werk, eq(werk.id, werkangebot.werkId))
    .where(eq(werkangebot.macherId, sess.nutzerId))
    .orderBy(desc(werkangebot.erstelltAm));

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
            <Link href="/uebersicht/werkangebote" aria-current="page">
              {de.bedarfsseite.nav_meine_werkangebote}
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
          </div>
        </div>
      </header>

      <section className="section compact">
        <div className="wrap">
          {sp.erfolg === 'eingereicht' ? (
            <div
              role="status"
              className="callout"
              style={{
                marginBottom: 16,
                padding: '12px 14px',
                borderRadius: 10,
                border: '1px solid #2a7a2a',
                background: '#eaf6ea',
                color: '#15431a',
              }}
            >
              Match-Angebot eingereicht. Die Auftraggeber:in wird informiert.
            </div>
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
                  href="/bedarfe"
                  style={{ marginTop: 12 }}
                >
                  {tu.bedarfe_durchsuchen}
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
              {items.map((w) => (
                <article
                  key={w.id}
                  className="work-card"
                  aria-label={w.bedarfTitel}
                >
                  <div className="work-body">
                    <h3 style={{ margin: 0, fontSize: 18 }}>
                      <Link
                        href={`/bedarfe/${w.bedarfId}`}
                        style={{ color: 'var(--fg)' }}
                      >
                        {w.bedarfTitel}
                      </Link>
                    </h3>
                    <p
                      style={{
                        margin: '6px 0',
                        color: 'var(--muted)',
                        fontSize: 13,
                      }}
                    >
                      {w.bedarfOrganisation}
                    </p>
                    <p
                      style={{
                        margin: '6px 0',
                        fontSize: 13,
                      }}
                    >
                      Werk: <strong>{w.werkName}</strong>
                    </p>
                    <span className="status-pill">{statusLabel(w.status)}</span>
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
