/**
 * /uebersicht — Landing-Pad nach Login (Server Component).
 *
 * Begruessung, Builder-Profil-Karte, Test-Saldo-Karte, Schnellzugriff fuer die
 * spaeter folgenden Bereiche (Werke, Pruefrunden, Termine — noch nicht
 * implementiert, deshalb als '(in Vorbereitung)' gelabelt) und ein
 * Abmelden-Button (Server-Action, ruft `signOut()` und redirected zu `/`).
 *
 * Ohne Session: redirect zu `/anmelden?next=/uebersicht`.
 *
 * Strings kommen aus `i18n/de.ts` — Sprach-Check-Tests pruefen das HTML
 * gegen eine Verbots-Liste englischer Begriffe.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { AvatarImage } from '@/components/ui/avatar-image';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';

import { de } from '@/i18n/de';
import { db } from '@/lib/db';
import {
  session as sessionTable,
  stadt,
} from '@/lib/db/schema';
import {
  buildClearSessionCookie,
  getSessionFromRequest,
} from '@/lib/auth/session';
import { getSaldoForUser } from '@/lib/reziprozitaet/saldo';

export const metadata: Metadata = {
  title: 'Übersicht',
  robots: { index: false, follow: false },
};

const t = de.uebersicht;

const ROLLE_LABEL: Record<string, string> = {
  macher: de.rolle.macher,
  bedarfstraeger: de.rolle.bedarfstraeger,
  foerderer: de.rolle.foerderer,
  kurator: de.rolle.kurator,
  admin: de.rolle.admin,
};

/**
 * Wir bauen einen synthetischen `Request` aus den Inbound-Headers, damit
 * `getSessionFromRequest()` (das normalerweise gegen einen Route-Handler-
 * `Request` laeuft) auch in Server-Components nutzbar ist.
 */
async function buildRequestFromHeaders(): Promise<Request> {
  const h = await headers();
  const headerInit: Record<string, string> = {};
  for (const [name, value] of h.entries()) {
    headerInit[name] = value;
  }
  return new Request('http://internal.werkzirkel/uebersicht', {
    headers: headerInit,
  });
}

/**
 * Server-Action: invalidiert die aktuelle Session, loescht das Cookie via
 * Response-Header (`set-cookie` ueber Next-15-`cookies()`-API analog zur
 * Route) und redirected zu `/`.
 *
 * Wir setzen das Cookie NICHT, weil Server-Actions im Page-Modul keine
 * direkte Response-Manipulation haben — stattdessen invalidieren wir die
 * Session-Row in der DB. Nach dem Redirect ist `wz_session` zwar noch
 * gesetzt, aber die Session-Lookup-Funktion findet keine DB-Row mehr und
 * behandelt sie als ungueltig → redirect zu /anmelden. Zusaetzlich
 * setzen wir das Cookie ueber `next/headers`-cookies-API zurueck.
 */
export async function abmeldenAction(): Promise<void> {
  'use server';

  const req = await buildRequestFromHeaders();
  const sess = await getSessionFromRequest(req);
  if (sess) {
    await db.delete(sessionTable).where(eq(sessionTable.id, sess.id));
  }

  // Cookie loeschen (Max-Age=0 + leerer Wert)
  const cookieStore = await cookies();
  const clear = buildClearSessionCookie();
  // Wir parsen den `Max-Age=0`-Cookie aus unserem Helper und setzen ihn via
  // cookies-API. Vereinfachung: name + leerer Wert + Path=/ reichen.
  cookieStore.set({
    name: 'wz_session',
    value: '',
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 0,
    secure: clear.includes('Secure'),
  });

  redirect('/');
}

interface AvatarInitialenProps {
  name: string;
}

function avatarInitialen(name: string): string {
  const parts = name.trim().split(/\s+/);
  const letters = parts
    .map((p) => p[0] ?? '')
    .filter(Boolean)
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return letters || '?';
}

function AvatarBlock({
  avatarUrl,
  name,
}: {
  avatarUrl: string | null;
  name: string;
}) {
  if (avatarUrl) {
    return (
      <AvatarImage
        src={avatarUrl}
        alt=""
        width={56}
        height={56}
        style={{
          borderRadius: '50%',
          objectFit: 'cover',
          border: 'var(--hairline)',
        }}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-grid',
        placeItems: 'center',
        width: 56,
        height: 56,
        borderRadius: '50%',
        background: 'var(--surface)',
        border: 'var(--hairline)',
        fontWeight: 680,
        fontSize: 20,
        letterSpacing: '-0.01em',
      }}
    >
      {avatarInitialen(name)}
    </span>
  );
}

function NavAvatar({ avatarUrl, name }: AvatarInitialenProps & { avatarUrl: string | null }) {
  if (avatarUrl) {
    return (
      <AvatarImage
        src={avatarUrl}
        alt=""
        width={28}
        height={28}
        style={{
          borderRadius: '50%',
          objectFit: 'cover',
          border: 'var(--hairline)',
        }}
        priority
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-grid',
        placeItems: 'center',
        width: 28,
        height: 28,
        borderRadius: '50%',
        background: 'var(--surface)',
        border: 'var(--hairline)',
        fontWeight: 680,
        fontSize: 12,
      }}
    >
      {avatarInitialen(name)}
    </span>
  );
}

function formatFrist(d: Date | null): string {
  if (!d) return '';
  // tt.mm.jjjj — kein date-fns, keine Lokalisierung im Browser noetig.
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

export default async function UebersichtPage() {
  const req = await buildRequestFromHeaders();
  const sess = await getSessionFromRequest(req);
  if (!sess) {
    redirect('/anmelden?next=/uebersicht');
  }

  const me = sess.nutzer;

  // Stadt laden (left join waere ein Statement, aber zwei kleine Selects sind
  // hier klarer und nicht teurer).
  const stadtRows = await db
    .select()
    .from(stadt)
    .where(eq(stadt.id, me.stadtId))
    .limit(1);
  const stadtRow = stadtRows[0];
  const stadtName = stadtRow?.name ?? '';

  const saldo = await getSaldoForUser(me.id);

  const gegeben = saldo.tests_gegeben;
  const erhalten = saldo.tests_erhalten;
  const offen = saldo.offene_verpflichtung_anzahl;
  const frist = saldo.naechste_verpflichtung_frist;
  const istLeer = gegeben === 0 && erhalten === 0 && offen === 0;

  // Frist-Banner: nur wenn offene Verpflichtung UND Frist < 3 Tage entfernt.
  const DREI_TAGE_MS = 3 * 24 * 60 * 60 * 1000;
  const fristBannerAnzeigen =
    offen > 0 &&
    frist !== null &&
    frist.getTime() - Date.now() < DREI_TAGE_MS;
  const pruefrundenSucheHref = me.stadtId
    ? `/pruefrunden?stadt=${encodeURIComponent(me.stadtId)}`
    : '/pruefrunden';

  const klarnameZeigen =
    me.klarname && me.klarname.trim().length > 0 ? me.klarname : me.anzeigename;

  const rollen = (me.rollen ?? []).map((r) => ROLLE_LABEL[r] ?? r);
  const istMacher = (me.rollen ?? []).includes('macher');
  const istBedarf = (me.rollen ?? []).includes('bedarfstraeger');
  const istFoerd = (me.rollen ?? []).includes('foerderer');

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
            <Link href="/uebersicht" aria-current="page">
              {t.nav_uebersicht}
            </Link>
            <Link href="/uebersicht/werke">
              {t.nav_werke}
            </Link>
            <Link href="/uebersicht/pruefrunden">
              {t.nav_pruefrunden}
            </Link>
            <Link href="/uebersicht/termine">
              {t.nav_termine}
            </Link>
          </div>
          <div
            style={{ display: 'flex', gap: 12, alignItems: 'center' }}
            aria-label="Konto"
          >
            <Link
              href="/einstellungen?tab=profil"
              style={{
                display: 'inline-flex',
                gap: 8,
                alignItems: 'center',
                color: 'var(--fg)',
              }}
              aria-label={`${me.anzeigename} — ${t.werkpass_bearbeiten}`}
            >
              <NavAvatar avatarUrl={me.avatarUrl} name={klarnameZeigen} />
              <span>{me.anzeigename}</span>
            </Link>
            <form action={abmeldenAction}>
              <button
                type="submit"
                style={{
                  background: 'transparent',
                  border: 0,
                  padding: '6px 10px',
                  color: 'var(--muted)',
                  cursor: 'pointer',
                  fontSize: 14,
                }}
              >
                {t.abmelden}
              </button>
            </form>
          </div>
        </div>
      </nav>

      <header className="hero" id="top">
        <div className="wrap hero-grid single">
          <div>
            <p className="eyebrow">
              {t.eyebrow_template(stadtName || 'Werkzirkel')}
            </p>
            <h1>{t.hallo(me.anzeigename)}</h1>
            <p className="hero-copy">{t.subline}</p>
          </div>
        </div>
      </header>

      {fristBannerAnzeigen ? (
        <section className="section compact" aria-label={t.frist_banner_titel}>
          <div className="wrap">
            <div
              role="alert"
              className="callout"
              style={{
                padding: '16px 18px',
                borderRadius: 10,
                border: '1px solid #d04848',
                background: '#fbeaea',
                color: '#5a1a1a',
              }}
            >
              <strong style={{ display: 'block', fontSize: 16 }}>
                {t.frist_banner_titel}
              </strong>
              <p style={{ margin: '6px 0 12px' }}>
                {t.frist_banner_text(offen, formatFrist(frist))}
              </p>
              <Link
                href={pruefrundenSucheHref}
                className="button primary"
                style={{
                  background: '#5a1a1a',
                  color: '#fff',
                  borderColor: '#5a1a1a',
                }}
              >
                {t.frist_banner_link}
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      <section className="section compact">
        <div className="wrap">
          <div
            className="product-split"
            style={{ alignItems: 'stretch' }}
          >
            <article className="work-card" aria-label={t.werkpass_titel}>
              <div className="work-body">
                <div
                  style={{
                    display: 'flex',
                    gap: 16,
                    alignItems: 'center',
                    marginBottom: 16,
                  }}
                >
                  <AvatarBlock avatarUrl={me.avatarUrl} name={klarnameZeigen} />
                  <div>
                    <p className="eyebrow" style={{ margin: 0 }}>
                      {t.werkpass_titel}
                    </p>
                    <h3 style={{ margin: '4px 0 0', fontSize: 22 }}>
                      {klarnameZeigen}
                    </h3>
                    {stadtName ? (
                      <p style={{ margin: '4px 0 0', color: 'var(--muted)' }}>
                        {stadtName}
                      </p>
                    ) : null}
                  </div>
                </div>
                {rollen.length > 0 ? (
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 6,
                      marginBottom: 16,
                    }}
                  >
                    {rollen.map((r) => (
                      <span key={r} className="status-pill">
                        {r}
                      </span>
                    ))}
                  </div>
                ) : null}
                <Link
                  className="button secondary"
                  href="/einstellungen?tab=profil"
                >
                  {t.werkpass_bearbeiten}
                </Link>
              </div>
            </article>

            <article className="work-card" aria-label={t.test_saldo_titel}>
              <div className="work-body">
                <p className="eyebrow" style={{ margin: 0 }}>
                  {t.test_saldo_titel}
                </p>
                <div className="work-meta" style={{ marginTop: 16 }}>
                  <div className="meta-box">
                    <span>{t.gegeben}</span>
                    <strong>{gegeben}</strong>
                  </div>
                  <div className="meta-box">
                    <span>{t.erhalten}</span>
                    <strong>{erhalten}</strong>
                  </div>
                  <div className="meta-box">
                    <span>{t.offen}</span>
                    <strong>{offen}</strong>
                  </div>
                </div>
                {offen > 0 ? (
                  <div
                    role="alert"
                    className="callout"
                    style={{
                      marginTop: 16,
                      borderColor: '#d04848',
                      background: '#fbeaea',
                      color: '#5a1a1a',
                      padding: '12px 14px',
                      borderRadius: 10,
                      border: '1px solid #d04848',
                    }}
                  >
                    {t.offene_verpflichtung(offen, formatFrist(frist))}
                  </div>
                ) : istLeer ? (
                  <p
                    style={{
                      marginTop: 16,
                      color: 'var(--muted)',
                      fontSize: 14,
                      lineHeight: 1.5,
                    }}
                  >
                    {t.saldo_leer_erklaerung}
                  </p>
                ) : null}
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="section compact">
        <div className="wrap">
          <div className="section-head">
            <div>
              <h2 style={{ fontSize: 32 }}>{t.schnellzugriff_titel}</h2>
            </div>
          </div>
          <div className="mock-grid">
            {istMacher ? (
              <Link
                href="/uebersicht/werke"
                className="mock-card wide"
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <p className="mock-label">{t.meine_werke}</p>
                <strong>{t.meine_werke}</strong>
                <p>Lege Werke an, bearbeite Build-Stand und Screenshots.</p>
              </Link>
            ) : null}
            {istBedarf ? (
              <>
                <Link
                  href="/uebersicht/bedarfe"
                  className="mock-card"
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  <p className="mock-label">Meine Bedarfe</p>
                  <strong>Meine Bedarfe</strong>
                  <p>
                    Eigene Bedarfe, Status der Membership-Beiträge und
                    Match-Angebote von Builder:innen.
                  </p>
                </Link>
                <Link
                  href="/uebersicht/werkstattbeitrag"
                  className="mock-card"
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  <p className="mock-label">Membership-Beitrag</p>
                  <strong>Membership-Beitrag</strong>
                  <p>
                    Demo Night-Teilnahmen, Geldbeiträge und Sachleistungen auf
                    einen Blick.
                  </p>
                </Link>
              </>
            ) : null}
            {istMacher ? (
              <Link
                href="/uebersicht/werkangebote"
                className="mock-card"
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <p className="mock-label">Meine Match-Angebote</p>
                <strong>Meine Match-Angebote</strong>
                <p>
                  Match-Angebote, die du als Builder:in zu Bedarfen eingereicht
                  hast.
                </p>
              </Link>
            ) : null}
            {istFoerd ? (
              <Link
                href="/uebersicht/foerderprofil"
                className="mock-card"
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <p className="mock-label">Mein Sponsor-Profil</p>
                <strong>Mein Sponsor-Profil</strong>
                <p>
                  Verifikations-Status, Briefing Night-Teilnahmen und
                  Sponsor-Budget verwalten.
                </p>
              </Link>
            ) : null}
            <Link
              href="/uebersicht/pruefrunden"
              className="mock-card"
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <p className="mock-label">{t.meine_pruefrunden}</p>
              <strong>{t.meine_pruefrunden}</strong>
              <p>
                Eigene Feedback-Loops und Tester:innen-Anmeldungen auf einen Blick.
              </p>
            </Link>
            <Link
              href={`/termine?stadt=${encodeURIComponent(me.stadtId)}`}
              className="mock-card"
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <p className="mock-label">
                {t.termine_in(stadtName || 'Hamburg')}
              </p>
              <strong>{t.termine_in(stadtName || 'Hamburg')}</strong>
              <p>Demo Nights, Feedback-Loop-Abende, Build-Runden — alle Termine in deiner Stadt.</p>
            </Link>
            <Link
              href="/uebersicht/termine"
              className="mock-card"
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <p className="mock-label">Meine Anmeldungen</p>
              <strong>Meine Anmeldungen</strong>
              <p>Termine, zu denen du angemeldet bist oder warst.</p>
            </Link>
          </div>
        </div>
      </section>

      <footer className="site-footer">
        <div
          className="wrap footer-inner"
          style={{ flexWrap: 'wrap', gap: 16 }}
        >
          <span>Werkzirkel — Gemeinsam digitale Produkte bauen.</span>
          <form action={abmeldenAction}>
            <button
              type="submit"
              style={{
                background: 'transparent',
                border: 0,
                padding: '6px 10px',
                color: 'var(--muted)',
                cursor: 'pointer',
                fontSize: 13,
                textDecoration: 'underline',
              }}
            >
              {t.abmelden}
            </button>
          </form>
        </div>
      </footer>
    </div>
  );
}
