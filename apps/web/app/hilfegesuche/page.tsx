/**
 * /hilfegesuche — Liste aller Hilfegesuche (Server Component, eingeloggt).
 *
 * Filter:
 *   ?status=offen|beantwortet|abgelaufen (default offen)
 *   ?stadt=hh|b|m
 *   ?tag=<beliebig>
 *
 * Auth-Pflicht — ohne Session redirect zu /anmelden?next=/hilfegesuche.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { and, arrayContains, desc, eq } from 'drizzle-orm';

import { de } from '@/i18n/de';
import { db } from '@/lib/db';
import { hilfegesuch, nutzer, stadt } from '@/lib/db/schema';
import { hilfegesuchStatus } from '@/lib/db/schema/enums';
import type { HilfegesuchStatus } from '@/lib/db/schema/enums';
import { getSessionFromRequest } from '@/lib/auth/session';

export const metadata: Metadata = {
  title: 'Hilfegesuche — Werkzirkel',
  robots: { index: false, follow: false },
};

const th = de.hilfegesuche;

interface PageProps {
  searchParams: Promise<{ status?: string; stadt?: string; tag?: string }>;
}

async function buildRequestFromHeaders(): Promise<Request> {
  const h = await headers();
  const headerInit: Record<string, string> = {};
  for (const [name, value] of h.entries()) {
    headerInit[name] = value;
  }
  return new Request('http://internal.werkzirkel/hilfegesuche', {
    headers: headerInit,
  });
}

function parseStatus(v: string | undefined): HilfegesuchStatus {
  if (!v) return 'offen';
  return (hilfegesuchStatus as readonly string[]).includes(v)
    ? (v as HilfegesuchStatus)
    : 'offen';
}

function formatDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

export default async function HilfegesucheListePage({ searchParams }: PageProps) {
  const req = await buildRequestFromHeaders();
  const sess = await getSessionFromRequest(req);
  if (!sess) {
    redirect('/anmelden?next=/hilfegesuche');
  }

  const sp = await searchParams;
  const status = parseStatus(sp.status);
  const stadtFilter =
    sp.stadt && sp.stadt.trim().length > 0 ? sp.stadt.trim() : undefined;
  const tagFilter =
    sp.tag && sp.tag.trim().length > 0 ? sp.tag.trim() : undefined;

  const filters = [eq(hilfegesuch.status, status)];
  if (stadtFilter) filters.push(eq(hilfegesuch.stadtId, stadtFilter));
  if (tagFilter) filters.push(arrayContains(hilfegesuch.tags, [tagFilter]));

  const rows = await db
    .select({
      hg: hilfegesuch,
      autorAnzeigename: nutzer.anzeigename,
      autorAvatarUrl: nutzer.avatarUrl,
      autorStadtId: nutzer.stadtId,
      stadtName: stadt.name,
    })
    .from(hilfegesuch)
    .innerJoin(nutzer, eq(nutzer.id, hilfegesuch.nutzerId))
    .innerJoin(stadt, eq(stadt.id, hilfegesuch.stadtId))
    .where(and(...filters))
    .orderBy(desc(hilfegesuch.erstelltAm), desc(hilfegesuch.id))
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
            <Link href="/uebersicht">{de.uebersicht.nav_uebersicht}</Link>
            <Link href="/hilfegesuche" aria-current="page">
              {th.nav}
            </Link>
          </div>
        </div>
      </nav>

      <header className="hero" id="top">
        <div className="wrap hero-grid single">
          <div>
            <p className="eyebrow">Werkzirkel · Quick-Helps</p>
            <h1>{th.liste_titel}</h1>
            <p className="hero-copy">{th.liste_untertitel}</p>
            <div style={{ display: 'flex', gap: 12, marginTop: 20, flexWrap: 'wrap' }}>
              <Link className="button primary" href="/hilfegesuche/neu">
                {th.neues_anlegen}
              </Link>
              <Link className="button secondary" href="/uebersicht/hilfegesuche">
                {th.uebersicht_titel}
              </Link>
            </div>
          </div>
        </div>
      </header>

      <section className="section compact">
        <div className="wrap">
          <form
            method="get"
            style={{
              display: 'flex',
              gap: 12,
              flexWrap: 'wrap',
              marginBottom: 24,
              alignItems: 'flex-end',
            }}
          >
            <label style={{ display: 'grid', gap: 4 }}>
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>
                {th.filter_status_label}
              </span>
              <select
                name="status"
                defaultValue={status}
                style={{ padding: '8px 10px', borderRadius: 8, border: 'var(--hairline)' }}
              >
                <option value="offen">{th.filter_status_offen}</option>
                <option value="beantwortet">{th.filter_status_beantwortet}</option>
                <option value="abgelaufen">{th.filter_status_abgelaufen}</option>
              </select>
            </label>
            <label style={{ display: 'grid', gap: 4 }}>
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>Tag</span>
              <input
                name="tag"
                defaultValue={tagFilter ?? ''}
                placeholder="z.B. marketing"
                style={{
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: 'var(--hairline)',
                }}
              />
            </label>
            <button type="submit" className="button secondary">
              Filtern
            </button>
          </form>

          {rows.length === 0 ? (
            <article className="work-card" aria-label={th.leer_titel}>
              <div className="work-body">
                <h3 style={{ margin: 0, fontSize: 22 }}>{th.leer_titel}</h3>
                <p style={{ margin: '8px 0 0', color: 'var(--muted)' }}>{th.leer_text}</p>
              </div>
            </article>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: 16,
              }}
            >
              {rows.map((r) => (
                <article key={r.hg.id} className="work-card" aria-label={r.hg.titel}>
                  <div className="work-body">
                    <h3 style={{ margin: 0, fontSize: 20 }}>
                      <Link
                        href={`/hilfegesuche/${r.hg.id}`}
                        style={{ color: 'inherit' }}
                      >
                        {r.hg.titel}
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
                      {r.hg.beschreibung.slice(0, 160)}
                      {r.hg.beschreibung.length > 160 ? '…' : ''}
                    </p>
                    <div
                      style={{
                        display: 'flex',
                        gap: 6,
                        flexWrap: 'wrap',
                        marginBottom: 8,
                      }}
                    >
                      {r.hg.tags.slice(0, 5).map((t) => (
                        <span key={t} className="status-pill">
                          {t}
                        </span>
                      ))}
                    </div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 13,
                        color: 'var(--muted)',
                      }}
                    >
                      {r.autorAnzeigename} · {r.stadtName} ·{' '}
                      {th.detail_gueltig_bis}: {formatDate(r.hg.gueltigBis)}
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
