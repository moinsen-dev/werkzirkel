/**
 * /uebersicht/foerderprofil — Eigenes Foerderprofil (Server Component,
 * Auth + Foerder:innen-Rolle).
 *
 * Wenn Profil existiert: Detail mit Status + Letzte-Bedarfsschau-Datum.
 * Sonst: Hinweis + Link zu /foerderprofile/neu.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';

import { de } from '@/i18n/de';
import { db } from '@/lib/db';
import { foerderprofil } from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';
import { hasRolle } from '@/lib/auth/permissions';
import type { FoerderprofilStatus } from '@/lib/db/schema/enums';

export const metadata: Metadata = {
  title: 'Mein Förderprofil — Werkzirkel',
  robots: { index: false, follow: false },
};

const tu = de.bedarfsseite.uebersicht_foerderprofil;
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
  return new Request('http://internal.werkzirkel/uebersicht/foerderprofil', {
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

function statusLabel(s: FoerderprofilStatus): string {
  return (
    (de.bedarfsseite.foerderprofil_status_label as Record<string, string>)[s] ??
    s
  );
}

function foerderartLabel(f: string): string {
  return (
    (de.bedarfsseite.foerderart_label as Record<string, string>)[f] ?? f
  );
}

export default async function UebersichtFoerderprofilPage({
  searchParams,
}: PageProps) {
  const req = await buildRequestFromHeaders();
  const sess = await getSessionFromRequest(req);
  if (!sess) {
    redirect('/anmelden?next=/uebersicht/foerderprofil');
  }
  if (!hasRolle(sess.nutzer, 'foerderer')) {
    redirect('/uebersicht?fehler=keine_foerderer_rolle');
  }

  const sp = await searchParams;
  const rows = await db
    .select()
    .from(foerderprofil)
    .where(eq(foerderprofil.nutzerId, sess.nutzerId))
    .limit(1);
  const fp = rows[0] ?? null;

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
            <Link href="/uebersicht/foerderprofil" aria-current="page">
              {de.bedarfsseite.nav_mein_foerderprofil}
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
            <p className="eyebrow">{tu.eyebrow}</p>
            <h1>{tu.titel}</h1>
            <p className="hero-copy">{tu.untertitel}</p>
          </div>
        </div>
      </header>

      <section className="section compact">
        <div className="wrap" style={{ maxWidth: 760 }}>
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
              Förderprofil eingereicht. Eine Kurator:in meldet sich für die
              persönliche Verifikation.
            </div>
          ) : null}

          {fp ? (
            <article className="work-card" aria-label={fp.organisation}>
              <div className="work-body">
                <h2 style={{ margin: 0, fontSize: 24 }}>{fp.organisation}</h2>
                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    flexWrap: 'wrap',
                    margin: '12px 0',
                  }}
                >
                  <span className="status-pill">
                    {statusLabel(fp.verifikationStatus)}
                  </span>
                  <span className="status-pill warm">
                    {foerderartLabel(fp.foerderart)}
                  </span>
                </div>
                <p style={{ margin: 0, color: 'var(--muted)' }}>
                  {fp.letzteBedarfsschauAm
                    ? tu.letzte_bedarfsschau(
                        formatDatum(fp.letzteBedarfsschauAm),
                      )
                    : tu.keine_bedarfsschau}
                </p>
                <div style={{ marginTop: 16, display: 'flex', gap: 12 }}>
                  <Link
                    className="button secondary"
                    href={`/foerderprofile/${fp.id}`}
                  >
                    Profil ansehen
                  </Link>
                </div>
              </div>
            </article>
          ) : (
            <article className="work-card" aria-label={tu.leer_titel}>
              <div className="work-body">
                <h3 style={{ margin: 0, fontSize: 22 }}>{tu.leer_titel}</h3>
                <p style={{ margin: '8px 0 0', color: 'var(--muted)' }}>
                  {tu.leer_text}
                </p>
                <Link
                  className="button primary"
                  href="/foerderprofile/neu"
                  style={{ marginTop: 12 }}
                >
                  {de.bedarfsseite.foerderprofile_liste.neues_profil}
                </Link>
              </div>
            </article>
          )}
        </div>
      </section>
    </div>
  );
}
