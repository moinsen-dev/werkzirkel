/**
 * Pure, sessionless Server-Component-Renderer fuer die Builder-Profil-Seite.
 *
 * Bewusst getrennt vom Page-Modul, damit Unit-Tests die Komponente mit
 * Mock-Daten rendern koennen, ohne `next/headers`, `notFound()` oder die
 * DB mocken zu muessen.
 *
 * NIE in dieser Komponente: email, klarname, stripe_customer_id,
 * stripe_subscription_id, benachrichtigungs_einstellungen, IP-Adressen,
 * audit-Felder, rollen-Details (nur die Builder:in-Eigenschaft als Badge —
 * und die wird ueber die Server-Page als boolean reingereicht).
 *
 * Alle Inhaber:innen-Felder kommen ueber `WerkpassNutzer` rein — die
 * Server-Page macht die Public-Field-Selektion.
 */

import Link from 'next/link';

import { AvatarImage } from '@/components/ui/avatar-image';
import { de } from '@/i18n/de';
import MeldenButton from '@/components/ui/melden-button';
import type {
  Hilfebedarf,
  Teilnahmeart,
  Werkstand,
} from '@/lib/db/schema/enums';

export interface WerkpassNutzer {
  id: string;
  anzeigename: string;
  avatarUrl: string | null;
  kurzbeschreibung: string | null;
  faehigkeiten: string[];
  interessen: string[];
  website: string | null;
  github: string | null;
  linkedin: string | null;
  mastodon: string | null;
  teilnahmeart: Teilnahmeart | null;
  stadtName: string;
  istFoerdermitglied: boolean;
}

export interface WerkpassWerk {
  id: string;
  name: string;
  kurzbeschreibung: string;
  werkstand: Werkstand;
  hilfebedarf: Hilfebedarf[];
  screenshots: string[];
}

export interface WerkpassTestSaldo {
  testsGegeben: number;
  testsErhalten: number;
  offeneVerpflichtungAnzahl: number;
  naechsteVerpflichtungFrist: Date | null;
}

export interface WerkpassAktivitaetEintrag {
  art: 'schauabend' | 'feedback';
  zeitpunkt: Date;
  titel: string;
  sekundaer: string;
  /** Public link target (e.g. werkpass-area /werke). Keine privaten Pfade. */
  ref: string;
}

export interface WerkpassViewProps {
  nutzer: WerkpassNutzer;
  testSaldo: WerkpassTestSaldo;
  werke: WerkpassWerk[];
  werkeGesamt: number;
  aktivitaet?: WerkpassAktivitaetEintrag[];
  aktivitaetTotals?: {
    schauabende: number;
    feedbacks: number;
  };
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

function formatDatum(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

function werkstandLabel(w: string): string {
  return (de.werkstand as Record<string, string>)[w] ?? w;
}

function hilfebedarfLabel(h: string): string {
  return (de.hilfebedarf as Record<string, string>)[h] ?? h;
}

function teilnahmeartLabel(t: string): string {
  return (de.teilnahmeart as Record<string, string>)[t] ?? t;
}

function domainAusUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

const VORSCHAU_LIMIT = 6;

/**
 * JSON-LD Person-Schema fuer den Builder-Profil (PRD §31).
 * Bewusst minimal — wir leaken keine privaten Daten (keine email, kein
 * klarname). Nur Anzeigename, Stadt, Werke-Anzahl und (sofern vorhanden)
 * oeffentliche Links.
 */
export function buildWerkpassJsonLd(props: {
  nutzer: WerkpassNutzer;
  werkeGesamt: number;
}): Record<string, unknown> {
  const { nutzer, werkeGesamt } = props;
  const sameAs = [
    nutzer.website,
    nutzer.github,
    nutzer.linkedin,
    nutzer.mastodon,
  ].filter((u): u is string => !!u);
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: nutzer.anzeigename,
    description:
      nutzer.kurzbeschreibung ??
      `Builder:in im Werkzirkel${nutzer.stadtName ? ` ${nutzer.stadtName}` : ''}`,
    knowsAbout: nutzer.faehigkeiten,
    homeLocation: nutzer.stadtName
      ? { '@type': 'Place', name: nutzer.stadtName }
      : undefined,
    ...(sameAs.length > 0 ? { sameAs } : {}),
    ...(werkeGesamt > 0
      ? {
          owns: {
            '@type': 'QuantitativeValue',
            value: werkeGesamt,
            unitText: 'Builds',
          },
        }
      : {}),
  };
}

export default function WerkpassView({
  nutzer,
  testSaldo,
  werke,
  werkeGesamt,
  aktivitaet = [],
  aktivitaetTotals = { schauabende: 0, feedbacks: 0 },
}: WerkpassViewProps) {
  const sichtbareWerke = werke.slice(0, VORSCHAU_LIMIT);
  const mehrAlsVorschau = werkeGesamt > VORSCHAU_LIMIT;
  const hatLinks =
    !!nutzer.website ||
    !!nutzer.github ||
    !!nutzer.linkedin ||
    !!nutzer.mastodon ||
    !!nutzer.teilnahmeart;
  const hatBio =
    !!nutzer.kurzbeschreibung ||
    nutzer.faehigkeiten.length > 0 ||
    nutzer.interessen.length > 0;
  const jsonLd = buildWerkpassJsonLd({ nutzer, werkeGesamt });

  return (
    <div className="page-shell">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <nav className="site-nav" aria-label="Hauptnavigation">
        <div className="wrap nav-inner">
          <Link href="/" className="brand" aria-label="Werkzirkel Start">
            <span className="brand-mark" aria-hidden="true">
              <span></span>
              <span></span>
              <span></span>
              <span></span>
            </span>
            <span>Werkzirkel</span>
          </Link>
          <div className="nav-links" aria-label="Bereiche">
            <Link href="/">Builder:innen</Link>
            <Link href="/werke">Werke</Link>
            <Link href="/bedarf">Bedarf einbringen</Link>
            <Link href="/foerdern">Builds sponsorn</Link>
          </div>
          <Link className="nav-cta" href="/anmelden">
            Anmelden
          </Link>
        </div>
      </nav>

      <header className="hero" id="top">
        <div
          className="wrap"
          style={{
            display: 'grid',
            gridTemplateColumns: '256px minmax(0, 1fr)',
            gap: 32,
            alignItems: 'center',
          }}
        >
          <div>
            {nutzer.avatarUrl ? (
              <AvatarImage
                src={nutzer.avatarUrl}
                alt=""
                width={256}
                height={256}
                style={{
                  width: 256,
                  height: 256,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: 'var(--hairline)',
                  display: 'block',
                }}
                priority
              />
            ) : (
              <span
                aria-hidden="true"
                style={{
                  display: 'inline-grid',
                  placeItems: 'center',
                  width: 256,
                  height: 256,
                  borderRadius: '50%',
                  background: 'var(--surface)',
                  border: 'var(--hairline)',
                  fontWeight: 680,
                  fontSize: 72,
                  color: 'var(--fg)',
                }}
              >
                {avatarInitialen(nutzer.anzeigename)}
              </span>
            )}
          </div>
          <div>
            <p className="eyebrow">Builder-Profil im Werkzirkel</p>
            <h1>{nutzer.anzeigename}</h1>
            <div
              style={{
                display: 'flex',
                gap: 8,
                marginTop: 16,
                flexWrap: 'wrap',
              }}
            >
              {nutzer.stadtName ? (
                <span className="status-pill">{nutzer.stadtName}</span>
              ) : null}
              {nutzer.istFoerdermitglied ? (
                <span className="status-pill warm">Fördermitglied</span>
              ) : null}
            </div>
            <p
              style={{
                marginTop: 18,
                color: 'var(--muted)',
                fontSize: 15,
              }}
              aria-label="Test-Saldo"
            >
              {testSaldo.testsGegeben} gegeben · {testSaldo.testsErhalten}{' '}
              erhalten · {testSaldo.offeneVerpflichtungAnzahl} offen
            </p>
            {testSaldo.offeneVerpflichtungAnzahl > 0 ? (
              <p
                style={{
                  marginTop: 6,
                  color: 'var(--muted)',
                  fontSize: 13,
                }}
              >
                Hat eine offene Feedback-Schuld
                {testSaldo.naechsteVerpflichtungFrist
                  ? ` bis ${formatDatum(testSaldo.naechsteVerpflichtungFrist)}`
                  : ''}
                .
              </p>
            ) : null}
          </div>
        </div>
      </header>

      {(hatBio || hatLinks) ? (
        <section className="section product-section">
          <div className="wrap product-split">
            <div>
              <p className="eyebrow">Bio</p>
              {nutzer.kurzbeschreibung ? (
                <p
                  style={{
                    marginTop: 12,
                    whiteSpace: 'pre-line',
                    color: 'var(--fg)',
                    fontSize: 17,
                    lineHeight: 1.55,
                  }}
                >
                  {nutzer.kurzbeschreibung}
                </p>
              ) : null}

              {nutzer.faehigkeiten.length > 0 ? (
                <>
                  <h2 style={{ fontSize: 24, marginTop: 32 }}>Was ich kann</h2>
                  <div
                    style={{
                      display: 'flex',
                      gap: 6,
                      flexWrap: 'wrap',
                      marginTop: 12,
                    }}
                  >
                    {nutzer.faehigkeiten.map((f) => (
                      <span key={f} className="status-pill">
                        {f}
                      </span>
                    ))}
                  </div>
                </>
              ) : null}

              {nutzer.interessen.length > 0 ? (
                <>
                  <h2 style={{ fontSize: 24, marginTop: 32 }}>
                    Was mich interessiert
                  </h2>
                  <div
                    style={{
                      display: 'flex',
                      gap: 6,
                      flexWrap: 'wrap',
                      marginTop: 12,
                    }}
                  >
                    {nutzer.interessen.map((i) => (
                      <span key={i} className="status-pill">
                        {i}
                      </span>
                    ))}
                  </div>
                </>
              ) : null}
            </div>

            <aside aria-label="Links">
              <article className="work-card">
                <div className="work-body" style={{ display: 'grid', gap: 12 }}>
                  <p className="eyebrow" style={{ margin: 0 }}>
                    Links
                  </p>
                  {nutzer.website ? (
                    <a
                      href={nutzer.website}
                      rel="noopener noreferrer nofollow"
                      target="_blank"
                      style={{
                        display: 'block',
                        padding: '10px 12px',
                        borderRadius: 10,
                        border: 'var(--hairline)',
                        background: 'var(--bg)',
                        color: 'var(--fg)',
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>Website</span>
                      <br />
                      <span style={{ color: 'var(--muted)', fontSize: 13 }}>
                        {domainAusUrl(nutzer.website)}
                      </span>
                    </a>
                  ) : null}
                  {nutzer.github ? (
                    <a
                      href={nutzer.github}
                      rel="noopener noreferrer nofollow"
                      target="_blank"
                      style={{ color: 'var(--fg)' }}
                    >
                      <span aria-hidden="true">▸</span> GitHub
                    </a>
                  ) : null}
                  {nutzer.linkedin ? (
                    <a
                      href={nutzer.linkedin}
                      rel="noopener noreferrer nofollow"
                      target="_blank"
                      style={{ color: 'var(--fg)' }}
                    >
                      <span aria-hidden="true">▸</span> LinkedIn
                    </a>
                  ) : null}
                  {nutzer.mastodon ? (
                    <a
                      href={nutzer.mastodon}
                      rel="noopener noreferrer nofollow"
                      target="_blank"
                      style={{ color: 'var(--fg)' }}
                    >
                      <span aria-hidden="true">▸</span> Mastodon
                    </a>
                  ) : null}
                  {nutzer.teilnahmeart ? (
                    <p
                      style={{
                        margin: 0,
                        color: 'var(--muted)',
                        fontSize: 13,
                      }}
                    >
                      Teilnahme: {teilnahmeartLabel(nutzer.teilnahmeart)}
                    </p>
                  ) : null}
                </div>
              </article>
            </aside>
          </div>
        </section>
      ) : null}

      <section className="section" aria-label="Builds">
        <div className="wrap">
          <div className="section-head" style={{ marginBottom: 18 }}>
            <h2 style={{ fontSize: 32, margin: 0 }}>
              Werke von {nutzer.anzeigename} ({werkeGesamt})
            </h2>
          </div>
          {sichtbareWerke.length === 0 ? (
            <p style={{ color: 'var(--muted)' }}>
              Noch keine öffentlichen Builds.
            </p>
          ) : (
            <ul
              aria-label="Builds-Liste"
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                display: 'grid',
                gridTemplateColumns:
                  'repeat(auto-fill, minmax(280px, 1fr))',
                gap: 18,
              }}
            >
              {sichtbareWerke.map((w) => (
                <li key={w.id}>
                  <article className="work-card">
                    {w.screenshots[0] ? (
                      <div
                        style={{
                          background: 'var(--bg)',
                          display: 'grid',
                          placeItems: 'center',
                          minHeight: 140,
                          borderBottom: 'var(--hairline)',
                          overflow: 'hidden',
                        }}
                        aria-hidden="true"
                      >
                        <AvatarImage
                          src={w.screenshots[0]}
                          alt=""
                          width={400}
                          height={300}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            display: 'block',
                          }}
                        />
                      </div>
                    ) : null}
                    <div
                      className="work-body"
                      style={{ padding: 16, display: 'grid', gap: 8 }}
                    >
                      <h3 style={{ margin: 0, fontSize: 18 }}>
                        <Link
                          href={`/werke/${w.id}`}
                          style={{ color: 'var(--fg)' }}
                        >
                          {w.name}
                        </Link>
                      </h3>
                      <span
                        className="status-pill warm"
                        style={{ alignSelf: 'flex-start' }}
                      >
                        Build-Stand: {werkstandLabel(w.werkstand)}
                      </span>
                      <p
                        style={{
                          margin: 0,
                          color: 'var(--muted)',
                          fontSize: 14,
                          lineHeight: 1.5,
                        }}
                      >
                        {w.kurzbeschreibung}
                      </p>
                      {w.hilfebedarf.length > 0 ? (
                        <div
                          style={{
                            display: 'flex',
                            gap: 6,
                            flexWrap: 'wrap',
                            marginTop: 4,
                          }}
                        >
                          {w.hilfebedarf.slice(0, 2).map((h) => (
                            <span key={h} className="status-pill">
                              {hilfebedarfLabel(h)}
                            </span>
                          ))}
                          {w.hilfebedarf.length > 2 ? (
                            <span
                              className="status-pill"
                              style={{ opacity: 0.7 }}
                            >
                              … mehr
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </article>
                </li>
              ))}
            </ul>
          )}
          {mehrAlsVorschau ? (
            <div style={{ marginTop: 18 }}>
              <Link
                href={`/werke?inhaber=${nutzer.id}`}
                className="button secondary"
              >
                … alle {werkeGesamt} Werke ansehen
              </Link>
            </div>
          ) : null}
        </div>
      </section>

      <section
        className="section compact"
        aria-labelledby="aktivitaet-titel"
      >
        <div className="wrap">
          <h2 id="aktivitaet-titel" style={{ fontSize: 24, margin: '0 0 8px' }}>
            Aktivität
          </h2>
          <p style={{ margin: '0 0 16px', color: 'var(--muted)' }}>
            Wo {nutzer.anzeigename} im Werkzirkel mitgemacht hat —
            Demo Night-Teilnahmen und gegebene Feedbacks. Inhalte der
            Feedbacks bleiben privat.
          </p>
          {aktivitaet.length === 0 ? (
            <p
              style={{
                margin: 0,
                padding: 16,
                borderRadius: 10,
                background: 'var(--surface-alt, #f6f6f1)',
                color: 'var(--muted)',
                fontSize: 14,
              }}
            >
              Noch keine öffentliche Aktivität.
            </p>
          ) : (
            <>
              <p style={{ margin: '0 0 12px', fontSize: 14 }}>
                <strong>{aktivitaetTotals.schauabende}</strong> Demo Night-
                Teilnahme{aktivitaetTotals.schauabende === 1 ? '' : 'n'} ·{' '}
                <strong>{aktivitaetTotals.feedbacks}</strong> gegebene
                Feedback{aktivitaetTotals.feedbacks === 1 ? '' : 's'}
              </p>
              <ul
                style={{
                  margin: 0,
                  padding: 0,
                  listStyle: 'none',
                  display: 'grid',
                  gap: 10,
                }}
              >
                {aktivitaet.map((e, i) => (
                  <li
                    key={`${e.art}-${e.zeitpunkt.toISOString()}-${i}`}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 10,
                      background: 'var(--surface-alt, #f6f6f1)',
                      display: 'grid',
                      gap: 2,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        gap: 8,
                        alignItems: 'baseline',
                        flexWrap: 'wrap',
                      }}
                    >
                      <span
                        className="status-pill"
                        style={{ fontSize: 11 }}
                      >
                        {e.art === 'schauabend'
                          ? 'Demo Night'
                          : 'Feedback'}
                      </span>
                      <strong>{e.titel}</strong>
                    </div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 13,
                        color: 'var(--muted)',
                      }}
                    >
                      {e.sekundaer} ·{' '}
                      {e.zeitpunkt.toLocaleDateString('de-DE', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                      })}
                    </p>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </section>

      <section
        className="section compact"
        aria-label="Was ist ein Test-Saldo"
      >
        <div className="wrap">
          <h2 style={{ fontSize: 24 }}>Was ist ein Test-Saldo?</h2>
          <p
            style={{
              marginTop: 12,
              color: 'var(--fg)',
              fontSize: 15,
              lineHeight: 1.55,
              maxWidth: 720,
            }}
          >
            Im Werkzirkel ist Gegenseitigkeit verbindlich: Wer eine Feedback-Loop
            startet, hat zuvor zwei Builds anderer getestet — oder verpflichtet
            sich, es innerhalb von 14 Tagen zu tun. Das Test-Saldo macht das
            öffentlich sichtbar.
          </p>
        </div>
      </section>

      <section className="section compact" aria-label="Nutzer:in melden">
        <div
          className="wrap"
          style={{ display: 'flex', justifyContent: 'flex-end' }}
        >
          <MeldenButton referenzTyp="nutzer" referenzId={nutzer.id} />
        </div>
      </section>

      <footer className="site-footer">
        <div className="wrap footer-inner">
          <span>Werkzirkel — Gemeinsam digitale Produkte bauen.</span>
          <div className="footer-links" aria-label="Fußnavigation">
            <Link href="/">Builder:innen</Link>
            <Link href="/werke">Werke</Link>
            <Link href="/bedarf">Bedarf</Link>
            <Link href="/foerdern">Fördern</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
