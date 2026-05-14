/**
 * /uebersicht/termine — Eigene Termin-Anmeldungen (Server Component).
 *
 * Auth Pflicht. Zwei Sektionen:
 *  - Kommende Termine (datum > now, status='veroeffentlicht')
 *  - Vergangene Termine
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { desc, eq } from 'drizzle-orm';

import { de } from '@/i18n/de';
import { db } from '@/lib/db';
import { termin, terminAnmeldung } from '@/lib/db/schema';
import type {
  TerminStatus,
  TerminTyp,
  TerminAnmeldungStatus,
} from '@/lib/db/schema/enums';
import { getSessionFromRequest } from '@/lib/auth/session';

const tm = de.termine.meine;
const tnav = de.uebersicht;

export const metadata: Metadata = {
  title: 'Meine Termine',
  robots: { index: false, follow: false },
};

async function buildRequestFromHeaders(): Promise<Request> {
  const h = await headers();
  const headerInit: Record<string, string> = {};
  for (const [name, value] of h.entries()) {
    headerInit[name] = value;
  }
  return new Request('http://internal.werkzirkel/uebersicht/termine', {
    headers: headerInit,
  });
}

function terminTypLabel(t: string): string {
  return (de.termin_typ as Record<string, string>)[t] ?? t;
}

function anmeldungsStatusLabel(s: TerminAnmeldungStatus): string {
  return (
    (tm.anmeldung_status as Record<string, string>)[s] ?? s
  );
}

function formatDatumZeit(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}.${mm}.${yyyy}, ${hh}:${min} Uhr`;
}

export default async function MeineTerminePage() {
  const req = await buildRequestFromHeaders();
  const sess = await getSessionFromRequest(req);
  if (!sess) {
    redirect('/anmelden?next=/uebersicht/termine');
  }

  const rows = await db
    .select({
      anmeldungId: terminAnmeldung.id,
      anmeldungStatus: terminAnmeldung.status,
      terminId: termin.id,
      titel: termin.titel,
      typ: termin.typ,
      datumUhrzeit: termin.datumUhrzeit,
      terminStatus: termin.status,
    })
    .from(terminAnmeldung)
    .innerJoin(termin, eq(termin.id, terminAnmeldung.terminId))
    .where(eq(terminAnmeldung.nutzerId, sess.nutzerId))
    .orderBy(desc(termin.datumUhrzeit));

  const now = Date.now();
  const kommend = rows
    .filter(
      (r) =>
        r.datumUhrzeit.getTime() > now &&
        r.terminStatus === 'veroeffentlicht' &&
        r.anmeldungStatus !== 'storniert',
    )
    .sort((a, b) => a.datumUhrzeit.getTime() - b.datumUhrzeit.getTime());
  const vergangen = rows.filter(
    (r) =>
      r.datumUhrzeit.getTime() <= now ||
      r.terminStatus === 'durchgefuehrt' ||
      r.terminStatus === 'abgesagt',
  );

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
            <Link href="/uebersicht/werke">{tnav.nav_werke}</Link>
            <Link href="/uebersicht/pruefrunden">{tnav.nav_pruefrunden}</Link>
            <Link href="/uebersicht/termine" aria-current="page">
              {tnav.nav_termine}
            </Link>
          </div>
        </div>
      </nav>

      <header className="hero" id="top">
        <div className="wrap hero-grid single">
          <div>
            <p className="eyebrow">{tm.eyebrow}</p>
            <h1>{tm.titel}</h1>
            <p className="hero-copy">{tm.untertitel}</p>
          </div>
        </div>
      </header>

      <section className="section compact">
        <div className="wrap">
          <h2 style={{ fontSize: 24, marginTop: 0 }}>{tm.sektion_kommend}</h2>
          {kommend.length === 0 ? (
            <article className="work-card">
              <div className="work-body">
                <p style={{ margin: 0, color: 'var(--muted)' }}>
                  {tm.sektion_kommend_leer}
                </p>
              </div>
            </article>
          ) : (
            <ul
              aria-label="Kommende Termine"
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                display: 'grid',
                gap: 12,
              }}
            >
              {kommend.map((t) => (
                <TerminCard
                  key={t.anmeldungId}
                  terminId={t.terminId}
                  titel={t.titel}
                  typ={t.typ as TerminTyp}
                  datumUhrzeit={t.datumUhrzeit}
                  anmeldungStatus={t.anmeldungStatus as TerminAnmeldungStatus}
                  terminStatus={t.terminStatus as TerminStatus}
                  kommend={true}
                />
              ))}
            </ul>
          )}

          <h2 style={{ fontSize: 24, marginTop: 32 }}>{tm.sektion_vergangen}</h2>
          {vergangen.length === 0 ? (
            <article className="work-card">
              <div className="work-body">
                <p style={{ margin: 0, color: 'var(--muted)' }}>
                  {tm.sektion_vergangen_leer}
                </p>
              </div>
            </article>
          ) : (
            <ul
              aria-label="Vergangene Termine"
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                display: 'grid',
                gap: 12,
              }}
            >
              {vergangen.map((t) => (
                <TerminCard
                  key={t.anmeldungId}
                  terminId={t.terminId}
                  titel={t.titel}
                  typ={t.typ as TerminTyp}
                  datumUhrzeit={t.datumUhrzeit}
                  anmeldungStatus={t.anmeldungStatus as TerminAnmeldungStatus}
                  terminStatus={t.terminStatus as TerminStatus}
                  kommend={false}
                />
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

interface TerminCardProps {
  terminId: string;
  titel: string;
  typ: TerminTyp;
  datumUhrzeit: Date;
  anmeldungStatus: TerminAnmeldungStatus;
  terminStatus: TerminStatus;
  kommend: boolean;
}

function TerminCard({
  terminId,
  titel,
  typ,
  datumUhrzeit,
  anmeldungStatus,
  terminStatus,
  kommend,
}: TerminCardProps) {
  return (
    <li>
      <article
        className="work-card"
        aria-label={titel}
        style={{ padding: 16, display: 'grid', gap: 8 }}
      >
        <div
          style={{
            display: 'flex',
            gap: 6,
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <span className="status-pill">{terminTypLabel(typ)}</span>
          <span
            style={{
              color: 'var(--muted)',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {formatDatumZeit(datumUhrzeit)}
          </span>
          <span className="status-pill warm">
            {anmeldungsStatusLabel(anmeldungStatus)}
          </span>
          {terminStatus === 'abgesagt' ? (
            <span
              className="status-pill"
              style={{ background: '#fbeaea', color: '#5a1a1a' }}
            >
              Termin abgesagt
            </span>
          ) : null}
        </div>
        <h3 style={{ margin: 0, fontSize: 18 }}>
          <Link href={`/termine/${terminId}`} style={{ color: 'var(--fg)' }}>
            {titel}
          </Link>
        </h3>
        {kommend ? (
          <div style={{ marginTop: 6 }}>
            <Link
              href={`/termine/${terminId}`}
              className="button secondary"
            >
              Details
            </Link>
          </div>
        ) : null}
      </article>
    </li>
  );
}
