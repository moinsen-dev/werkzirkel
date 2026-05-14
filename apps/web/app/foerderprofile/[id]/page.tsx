/**
 * /foerderprofile/[id] — Foerderprofil-Detail (Server Component, Auth-Pflicht
 * fuer verifizierte Profile; Owner und Kurator sehen auch entwurf/in_verifikation).
 *
 * Quelle: PRD §F-705, §11A Kulturverlust 5 (Equity nicht vermitteln).
 *
 * Rendert Equity-Hinweistext expliziert bei gegenleistung_typ='equity_offline'.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';

import { de } from '@/i18n/de';
import MeldenButton from '@/components/ui/melden-button';
import { db } from '@/lib/db';
import { foerderprofil, nutzer } from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';
import { istKuratorVon } from '@/lib/auth/permissions';
import { EQUITY_HINWEISTEXT } from '@/lib/foerderprofil/serialize';

const td = de.bedarfsseite.foerderprofil_detail;
const tnav = de.uebersicht;

interface PageParams {
  params: Promise<{ id: string }>;
}

async function buildRequestFromHeaders(path: string): Promise<Request> {
  const h = await headers();
  const headerInit: Record<string, string> = {};
  for (const [name, value] of h.entries()) {
    headerInit[name] = value;
  }
  return new Request(`http://internal.werkzirkel${path}`, {
    headers: headerInit,
  });
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

async function ladeProfilMitInhaber(id: string) {
  const rows = await db
    .select({
      fp: foerderprofil,
      inhaberId: nutzer.id,
      inhaberAnzeigename: nutzer.anzeigename,
      inhaberStadtId: nutzer.stadtId,
      inhaberRollen: nutzer.rollen,
    })
    .from(foerderprofil)
    .innerJoin(nutzer, eq(nutzer.id, foerderprofil.nutzerId))
    .where(eq(foerderprofil.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function generateMetadata({
  params,
}: PageParams): Promise<Metadata> {
  const { id } = await params;
  const row = await ladeProfilMitInhaber(id);
  return {
    title: row ? `${row.fp.organisation} — Förderprofil` : 'Förderprofil',
    robots: { index: false, follow: false },
  };
}

export default async function FoerderprofilDetailPage({ params }: PageParams) {
  const { id } = await params;
  const req = await buildRequestFromHeaders(`/foerderprofile/${id}`);
  const sess = await getSessionFromRequest(req);

  const row = await ladeProfilMitInhaber(id);
  if (!row) notFound();

  const fp = row.fp;
  const istVerifiziert = fp.verifikationStatus === 'verifiziert';

  if (!sess) {
    // Anonym: nur verifizierte sind grundsaetzlich sichtbar, aber Kontakt-
    // Funktion bleibt eingeschraenkt. Eingeloggte Personen sehen alle Felder.
    if (!istVerifiziert) notFound();
  } else if (!istVerifiziert) {
    const istOwner = fp.nutzerId === sess.nutzerId;
    if (!istOwner) {
      const istKurator = await istKuratorVon(sess.nutzerId, row.inhaberStadtId);
      if (!istKurator) notFound();
    }
  }

  const istEquity = fp.gegenleistungTyp === 'equity_offline';
  const inhaberIstMacher = row.inhaberRollen.includes('macher');

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
            <p className="eyebrow">{td.eyebrow}</p>
            <h1>{fp.organisation}</h1>
            <div
              style={{
                display: 'flex',
                gap: 8,
                marginTop: 16,
                flexWrap: 'wrap',
              }}
            >
              <span className="status-pill">
                {foerderartLabel(fp.foerderart)}
              </span>
              {istEquity ? (
                <span className="status-pill warm">
                  {de.bedarfsseite.foerderprofile_liste.equity_badge}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <section className="section product-section">
        <div className="wrap product-split">
          <div>
            <h2 style={{ fontSize: 28, marginTop: 12 }}>
              {td.sektion_foerderart}
            </h2>
            <p style={{ marginTop: 8 }}>{foerderartLabel(fp.foerderart)}</p>

            {fp.foerderrahmenJahrMinEuroCent !== null ||
            fp.foerderrahmenJahrMaxEuroCent !== null ||
            fp.foerderrahmenEinzelMaxEuroCent !== null ? (
              <>
                <h2 style={{ fontSize: 28, marginTop: 32 }}>
                  {td.sektion_foerderrahmen}
                </h2>
                <div className="work-meta" style={{ marginTop: 12 }}>
                  {fp.foerderrahmenJahrMinEuroCent !== null ||
                  fp.foerderrahmenJahrMaxEuroCent !== null ? (
                    <div className="meta-box">
                      <span>Pro Jahr</span>
                      <strong>
                        {formatEuro(fp.foerderrahmenJahrMinEuroCent)}
                        {fp.foerderrahmenJahrMinEuroCent !== null &&
                        fp.foerderrahmenJahrMaxEuroCent !== null
                          ? ' – '
                          : ''}
                        {formatEuro(fp.foerderrahmenJahrMaxEuroCent)}
                      </strong>
                    </div>
                  ) : null}
                  {fp.foerderrahmenEinzelMaxEuroCent !== null ? (
                    <div className="meta-box">
                      <span>Einzelförder max</span>
                      <strong>
                        {formatEuro(fp.foerderrahmenEinzelMaxEuroCent)}
                      </strong>
                    </div>
                  ) : null}
                </div>
              </>
            ) : null}

            {fp.bevorzugteWerke ? (
              <>
                <h2 style={{ fontSize: 28, marginTop: 32 }}>
                  {td.sektion_bevorzugte_werke}
                </h2>
                <p
                  style={{
                    marginTop: 8,
                    whiteSpace: 'pre-line',
                    lineHeight: 1.55,
                  }}
                >
                  {fp.bevorzugteWerke}
                </p>
              </>
            ) : null}

            <h2 style={{ fontSize: 28, marginTop: 32 }}>
              {td.sektion_gegenleistung}
            </h2>
            <p style={{ marginTop: 8 }}>
              <strong>{gegenleistungLabel(fp.gegenleistungTyp)}</strong>
            </p>
            {fp.gegenleistungText ? (
              <p style={{ marginTop: 8, whiteSpace: 'pre-line' }}>
                {fp.gegenleistungText}
              </p>
            ) : null}

            {istEquity ? (
              <div
                role="note"
                data-equity-hinweis
                className="callout"
                style={{
                  marginTop: 16,
                  padding: '12px 14px',
                  borderRadius: 10,
                  border: '1px solid #d04848',
                  background: '#fbeaea',
                  color: '#5a1a1a',
                }}
              >
                <strong>{td.equity_hinweis_titel}</strong>
                <p style={{ margin: '8px 0 0' }}>{EQUITY_HINWEISTEXT}</p>
              </div>
            ) : null}
          </div>

          <aside aria-label="Kontakt">
            <article className="work-card">
              <div className="work-body">
                <p className="eyebrow" style={{ margin: 0 }}>
                  {td.kontakt_titel}
                </p>
                {sess ? (
                  <>
                    <p style={{ marginTop: 8 }}>{row.inhaberAnzeigename}</p>
                    {inhaberIstMacher ? (
                      <Link
                        className="button secondary"
                        href={`/werkpass/${row.inhaberId}`}
                      >
                        {td.kontakt_werkpass_link}
                      </Link>
                    ) : null}
                    <p
                      style={{
                        marginTop: 12,
                        color: 'var(--muted)',
                        fontSize: 13,
                      }}
                    >
                      {td.kontakt_bedarfsschau_hinweis}
                    </p>
                  </>
                ) : (
                  <p style={{ marginTop: 8, color: 'var(--muted)' }}>
                    {td.kontakt_anonym_hinweis}
                  </p>
                )}
              </div>
            </article>
          </aside>
        </div>
      </section>

      <section className="section compact" aria-label="Inhalt melden">
        <div
          className="wrap"
          style={{ display: 'flex', justifyContent: 'flex-end' }}
        >
          <MeldenButton referenzTyp="foerderprofil" referenzId={id} />
        </div>
      </section>
    </div>
  );
}
