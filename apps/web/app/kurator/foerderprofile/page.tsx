/**
 * /kurator/foerderprofile — City-Leads-Postfach für Sponsor-Profil-
 * Verifikationen (PRD §8.7, §11A.S7).
 *
 * Listet alle Sponsor-Profile der eigenen Stadt mit
 * `verifikation_status = 'in_verifikation'`. Pro Eintrag: zwei Forms, die
 * die existierenden API-Routen
 *   POST /api/v1/kurator/foerderprofile/:id/verifizieren
 *   POST /api/v1/kurator/foerderprofile/:id/ablehnen
 * direkt anstoßen. Kein neues Backend nötig — diese UI füllt die Lücke,
 * dass es bisher nur API-Endpunkte ohne sichtbares Postfach gab.
 *
 * Berechtigung: nur City-Leads der Stadt (PRD §15.7). Admins sehen
 * alle Städte.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { and, asc, eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { foerderprofil, nutzer } from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';
import { env } from '@/lib/env';

const APP_URL = env.APP_URL.replace(/\/+$/, '');

/**
 * Server-Action: ruft den existierenden Verifizier-Endpunkt mit dem Cookie
 * aus dem aktuellen Request und redirected ans Postfach mit Erfolgs- oder
 * Fehler-Banner. Nutzt die API-Route — keine Duplizierung der Verifizier-
 * Logik.
 */
export async function verifizierenAction(
  foerderprofilId: string,
): Promise<void> {
  'use server';
  const h = await headers();
  const cookie = h.get('cookie') ?? '';
  const res = await fetch(
    `${APP_URL}/api/v1/kurator/foerderprofile/${encodeURIComponent(foerderprofilId)}/verifizieren`,
    {
      method: 'POST',
      headers: { cookie, origin: APP_URL },
    },
  );
  if (res.ok) {
    redirect('/kurator/foerderprofile?erfolg=verifiziert');
  }
  const code = `${res.status}`;
  redirect(`/kurator/foerderprofile?fehler=${encodeURIComponent(code)}`);
}

export async function ablehnenAction(
  foerderprofilId: string,
): Promise<void> {
  'use server';
  const h = await headers();
  const cookie = h.get('cookie') ?? '';
  const res = await fetch(
    `${APP_URL}/api/v1/kurator/foerderprofile/${encodeURIComponent(foerderprofilId)}/ablehnen`,
    {
      method: 'POST',
      headers: { cookie, origin: APP_URL },
    },
  );
  if (res.ok) {
    redirect('/kurator/foerderprofile?erfolg=abgelehnt');
  }
  const code = `${res.status}`;
  redirect(`/kurator/foerderprofile?fehler=${encodeURIComponent(code)}`);
}

interface PageProps {
  searchParams: Promise<{ erfolg?: string; fehler?: string }>;
}

export const metadata: Metadata = {
  title: 'City-Leads-Postfach: Sponsor-Profile',
  robots: { index: false, follow: false },
};

async function buildRequestFromHeaders(): Promise<Request> {
  const h = await headers();
  const headerInit: Record<string, string> = {};
  const cookie = h.get('cookie');
  if (cookie) headerInit['cookie'] = cookie;
  return new Request('http://internal.werkzirkel/kurator/foerderprofile', {
    headers: headerInit,
  });
}

function formatDatum(d: Date): string {
  return d.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function GegenleistungLabel({ typ }: { typ: string }) {
  const map: Record<string, string> = {
    sachleistung: 'Sachleistung',
    geld: 'Geld',
    equity_offline: 'Equity (offline)',
    erfahrung_mentoring: 'Erfahrung / Mentoring',
    reichweite: 'Reichweite',
    sonstiges: 'Sonstiges',
  };
  return <>{map[typ] ?? typ}</>;
}

export default async function KuratorFoerderprofilePage({
  searchParams,
}: PageProps) {
  const sp = await searchParams;

  const req = await buildRequestFromHeaders();
  const sess = await getSessionFromRequest(req);
  if (!sess) {
    redirect('/anmelden?next=/kurator/foerderprofile');
  }

  const istAdmin = sess.nutzer.rollen.includes('admin');
  const istKurator = sess.nutzer.rollen.includes('kurator');
  if (!istAdmin && !istKurator) {
    return (
      <div className="page-shell">
        <section className="section">
          <div className="wrap" style={{ maxWidth: 760 }}>
            <h1>Nur für City-Leads</h1>
            <p>
              Diese Seite ist nur für City-Leads einer Stadt oder Admins
              zugänglich.
            </p>
            <Link href="/uebersicht">← Zurück zur Übersicht</Link>
          </div>
        </section>
      </div>
    );
  }

  // Admins sehen alle, City-Leads nur ihre Stadt.
  const stadtFilter = istAdmin
    ? undefined
    : eq(nutzer.stadtId, sess.nutzer.stadtId);

  const rows = await db
    .select({
      id: foerderprofil.id,
      organisation: foerderprofil.organisation,
      foerderart: foerderprofil.foerderart,
      gegenleistungTyp: foerderprofil.gegenleistungTyp,
      gegenleistungText: foerderprofil.gegenleistungText,
      erstelltAm: foerderprofil.erstelltAm,
      stadtId: nutzer.stadtId,
      klarname: nutzer.klarname,
      anzeigename: nutzer.anzeigename,
    })
    .from(foerderprofil)
    .innerJoin(nutzer, eq(nutzer.id, foerderprofil.nutzerId))
    .where(
      stadtFilter
        ? and(
            eq(foerderprofil.verifikationStatus, 'in_verifikation'),
            stadtFilter,
          )
        : eq(foerderprofil.verifikationStatus, 'in_verifikation'),
    )
    .orderBy(asc(foerderprofil.erstelltAm));

  return (
    <div className="page-shell">
      <nav className="site-nav" aria-label="Hauptnavigation">
        <div className="wrap nav-inner">
          <Link href="/uebersicht" className="brand" aria-label="Werkzirkel Start">
            <span>Werkzirkel</span>
          </Link>
          <div className="nav-links" aria-label="Bereiche">
            <Link href="/kurator/bedarfe-in-pruefung">Bedarfe</Link>
            <Link href="/kurator/foerderprofile" aria-current="page">
              Sponsor-Profile
            </Link>
            <Link href="/kurator/meldungen">Meldungen</Link>
            <Link href="/kurator/termine">Termine</Link>
          </div>
        </div>
      </nav>

      <header className="hero" id="top">
        <div className="wrap hero-grid single">
          <div>
            <p className="eyebrow">City-Leads-Postfach</p>
            <h1>Sponsor-Profile zur Verifikation</h1>
            <p className="hero-copy">
              {rows.length} {rows.length === 1 ? 'Profil' : 'Profile'} warten
              auf deine Prüfung. Klarname + Organisation + Sponsor-Budget
              sichten, dann verifizieren oder ablehnen.
            </p>
          </div>
        </div>
      </header>

      <section className="section compact">
        <div className="wrap" style={{ maxWidth: 880 }}>
          {sp.erfolg === 'verifiziert' ? (
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
              Sponsor-Profil verifiziert — es ist jetzt öffentlich sichtbar.
            </div>
          ) : null}
          {sp.erfolg === 'abgelehnt' ? (
            <div
              role="status"
              className="callout"
              style={{
                marginBottom: 16,
                padding: '12px 14px',
                borderRadius: 10,
                border: '1px solid #b45309',
                background: '#fef3c7',
                color: '#78350f',
              }}
            >
              Sponsor-Profil abgelehnt — die Sponsor:in wurde benachrichtigt.
            </div>
          ) : null}
          {sp.fehler ? (
            <div
              role="alert"
              className="callout"
              style={{
                marginBottom: 16,
                padding: '12px 14px',
                borderRadius: 10,
                border: '1px solid #d04848',
                background: '#fbeaea',
                color: '#5a1a1a',
              }}
            >
              Fehler: {sp.fehler}
            </div>
          ) : null}

          {rows.length === 0 ? (
            <p
              style={{
                padding: 20,
                background: 'var(--surface-alt, #f6f6f1)',
                borderRadius: 10,
              }}
            >
              Aktuell keine Sponsor-Profile zur Prüfung.
            </p>
          ) : (
            <ul
              style={{
                margin: 0,
                padding: 0,
                listStyle: 'none',
                display: 'grid',
                gap: 16,
              }}
            >
              {rows.map((r) => (
                <li
                  key={r.id}
                  style={{
                    padding: 16,
                    borderRadius: 12,
                    border: 'var(--hairline)',
                    background: 'var(--surface)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 8,
                      marginBottom: 8,
                    }}
                  >
                    <strong style={{ fontSize: 16 }}>{r.organisation}</strong>
                    <span
                      style={{
                        fontSize: 13,
                        color: 'var(--muted)',
                      }}
                    >
                      eingereicht {formatDatum(r.erstelltAm)}
                    </span>
                  </div>
                  <p style={{ margin: '0 0 6px', fontSize: 14 }}>
                    Sponsor-Art: <strong>{r.foerderart}</strong> · Gegenleistung:{' '}
                    <strong>
                      <GegenleistungLabel typ={r.gegenleistungTyp} />
                    </strong>
                  </p>
                  <p
                    style={{
                      margin: '0 0 12px',
                      fontSize: 13,
                      color: 'var(--muted)',
                    }}
                  >
                    Eingereicht von:{' '}
                    {r.klarname ? `${r.klarname} (` : ''}
                    {r.anzeigename}
                    {r.klarname ? ')' : ''} · Stadt {r.stadtId}
                  </p>
                  {r.gegenleistungText ? (
                    <p
                      style={{
                        margin: '0 0 12px',
                        fontSize: 14,
                        padding: 10,
                        borderRadius: 8,
                        background: 'var(--surface-alt, #f6f6f1)',
                      }}
                    >
                      {r.gegenleistungText}
                    </p>
                  ) : null}
                  <div
                    style={{
                      display: 'flex',
                      gap: 10,
                      flexWrap: 'wrap',
                    }}
                  >
                    <form action={verifizierenAction.bind(null, r.id)}>
                      <button
                        type="submit"
                        className="button primary"
                        style={{ fontSize: 13 }}
                      >
                        Verifizieren
                      </button>
                    </form>
                    <form action={ablehnenAction.bind(null, r.id)}>
                      <button
                        type="submit"
                        className="button"
                        style={{ fontSize: 13, color: '#5a1a1a' }}
                      >
                        Ablehnen
                      </button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
