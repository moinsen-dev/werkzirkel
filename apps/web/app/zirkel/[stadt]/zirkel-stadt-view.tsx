/**
 * Pure, sessionless Renderer fuer /zirkel/[stadt].
 *
 * Drei Varianten:
 *  - `aktiv` (Hamburg):     Hero + Mitglieder-Strip + Werke + Termine + Mitmachen.
 *  - `vorbereitung` (B/M):  Hero + 'Bis dahin'-Hinweise. KEINE Datenlisten.
 *  - `inaktiv`:             Hero ('Ruhend') ohne Vormerken-CTA, KEINE Datenlisten.
 *
 * Hard rules:
 *  - Nur Public-Felder. Kein klarname/email im HTML.
 *  - Werkpass-/Werk-Links bauen wir hier; die Daten-Auswahl macht die Page.
 */

import Link from 'next/link';

import { AvatarImage } from '@/components/ui/avatar-image';
import { de } from '@/i18n/de';
import type {
  Hilfebedarf,
  TerminTyp,
  Werkstand,
} from '@/lib/db/schema/enums';

export type StadtStatus = 'aktiv' | 'vorbereitung' | 'inaktiv';

export interface ZirkelStadtRow {
  id: string;
  name: string;
  status: StadtStatus;
  beschreibung: string | null;
}

export interface ZirkelMitglied {
  id: string;
  anzeigename: string;
  avatarUrl: string | null;
}

export interface ZirkelWerk {
  id: string;
  name: string;
  kurzbeschreibung: string;
  werkstand: Werkstand;
  hilfebedarf: Hilfebedarf[];
  screenshots: string[];
  inhaberAnzeigename: string;
  inhaberAvatarUrl: string | null;
}

export interface ZirkelTermin {
  id: string;
  titel: string;
  typ: TerminTyp;
  datumUhrzeit: Date;
}

export interface ZirkelStadtViewProps {
  stadtRow: ZirkelStadtRow;
  mitglieder: ZirkelMitglied[];
  werke: ZirkelWerk[];
  termine: ZirkelTermin[];
  stadtMail: string;
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

function werkstandLabel(w: string): string {
  return (de.werkstand as Record<string, string>)[w] ?? w;
}

function hilfebedarfLabel(h: string): string {
  return (de.hilfebedarf as Record<string, string>)[h] ?? h;
}

function terminTypLabel(t: string): string {
  return (de.termin_typ as Record<string, string>)[t] ?? t;
}

function formatDatumZeit(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}.${mm}.${yyyy}, ${hh}:${min} Uhr`;
}

function HeroNav() {
  return (
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
          <Link href="/">Macher:innen</Link>
          <Link href="/werke">Werke</Link>
          <Link href="/bedarf">Bedarf einbringen</Link>
          <Link href="/foerdern">Werke fördern</Link>
        </div>
        <Link className="nav-cta" href="/anmelden">
          Anmelden
        </Link>
      </div>
    </nav>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="wrap footer-inner">
        <span>Werkzirkel — Gemeinsam digitale Produkte bauen.</span>
        <div className="footer-links" aria-label="Fußnavigation">
          <Link href="/">Macher:innen</Link>
          <Link href="/werke">Werke</Link>
          <Link href="/bedarf">Bedarf</Link>
          <Link href="/foerdern">Fördern</Link>
        </div>
      </div>
    </footer>
  );
}

/* ────────────────────── Variante A: aktiv ────────────────────── */

function AktivVariant({
  stadtRow,
  mitglieder,
  werke,
  termine,
  stadtMail,
}: ZirkelStadtViewProps) {
  const subline =
    stadtRow.beschreibung ??
    `Der ${stadtRow.name}er Werkzirkel — wo Macher:innen ihre digitalen Werke zeigen, testen und voranbringen.`;

  return (
    <div className="page-shell">
      <HeroNav />

      <header className="hero" id="top">
        <div className="wrap hero-grid single">
          <div>
            <p className="eyebrow">Aktiver Kreis</p>
            <h1>Werkzirkel {stadtRow.name}</h1>
            <p className="hero-copy">{subline}</p>
            <div className="hero-actions" style={{ marginTop: 18 }}>
              <Link href="/anmelden" className="button primary">
                Werkpass anlegen
              </Link>
              <Link
                href={`/werke?stadt=${stadtRow.id}`}
                className="button secondary"
              >
                Werke ansehen
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* ────── Mitglieder ────── */}
      <section className="section" aria-label="Aktive Macher:innen">
        <div className="wrap">
          <div className="section-head" style={{ marginBottom: 18 }}>
            <h2 style={{ fontSize: 28, margin: 0 }}>Aktive Macher:innen</h2>
          </div>
          {mitglieder.length === 0 ? (
            <p style={{ color: 'var(--muted)' }}>
              Noch keine Mitglieder. Sei die Erste.
            </p>
          ) : (
            <ul
              aria-label="Mitglieder"
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                display: 'flex',
                gap: 14,
                flexWrap: 'wrap',
              }}
            >
              {mitglieder.map((m) => (
                <li key={m.id}>
                  <Link
                    href={`/werkpass/${m.id}`}
                    aria-label={`Werkpass von ${m.anzeigename}`}
                    style={{
                      display: 'inline-flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 6,
                      textDecoration: 'none',
                      color: 'var(--fg)',
                      width: 72,
                    }}
                  >
                    {m.avatarUrl ? (
                      <AvatarImage
                        src={m.avatarUrl}
                        alt=""
                        width={64}
                        height={64}
                        style={{
                          width: 64,
                          height: 64,
                          borderRadius: '50%',
                          objectFit: 'cover',
                          border: 'var(--hairline)',
                        }}
                      />
                    ) : (
                      <span
                        aria-hidden="true"
                        style={{
                          display: 'inline-grid',
                          placeItems: 'center',
                          width: 64,
                          height: 64,
                          borderRadius: '50%',
                          background: 'var(--surface)',
                          border: 'var(--hairline)',
                          fontSize: 22,
                          fontWeight: 700,
                        }}
                      >
                        {avatarInitialen(m.anzeigename)}
                      </span>
                    )}
                    <span
                      style={{
                        fontSize: 12,
                        textAlign: 'center',
                        color: 'var(--muted)',
                        lineHeight: 1.2,
                        wordBreak: 'break-word',
                      }}
                    >
                      {m.anzeigename}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* ────── Werke ────── */}
      <section className="section" aria-label="Werke aus dem Kreis">
        <div className="wrap">
          <div
            className="section-head"
            style={{
              marginBottom: 18,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <h2 style={{ fontSize: 28, margin: 0 }}>Werke aus dem Kreis</h2>
            <Link
              href={`/werke?stadt=${stadtRow.id}`}
              style={{ color: 'var(--muted)' }}
            >
              Alle Werke in {stadtRow.name}
            </Link>
          </div>
          {werke.length === 0 ? (
            <p style={{ color: 'var(--muted)' }}>
              Noch keine öffentlichen Werke aus {stadtRow.name}.
            </p>
          ) : (
            <ul
              aria-label="Werke-Liste"
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: 18,
              }}
            >
              {werke.map((w) => (
                <li key={w.id}>
                  <article className="work-card">
                    {w.screenshots[0] ? (
                      <div
                        style={{
                          background: 'var(--bg)',
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
                        Werkstand: {werkstandLabel(w.werkstand)}
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
        </div>
      </section>

      {/* ────── Termine ────── */}
      <section className="section" aria-label="Nächste Termine">
        <div className="wrap">
          <div className="section-head" style={{ marginBottom: 18 }}>
            <h2 style={{ fontSize: 28, margin: 0 }}>Nächste Termine</h2>
          </div>
          {termine.length === 0 ? (
            <p style={{ color: 'var(--muted)', maxWidth: 640 }}>
              Der nächste Schauabend steht noch nicht. Schreib der
              Kurator:in unter{' '}
              <a href={`mailto:${stadtMail}`} style={{ color: 'var(--fg)' }}>
                {stadtMail}
              </a>
              .
            </p>
          ) : (
            <ul
              aria-label="Termine-Liste"
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                display: 'grid',
                gap: 12,
              }}
            >
              {termine.map((t) => (
                <li key={t.id}>
                  <article
                    className="work-card"
                    style={{
                      padding: 16,
                      display: 'grid',
                      gap: 6,
                      gridTemplateColumns: 'minmax(0, 1fr) auto',
                      alignItems: 'baseline',
                    }}
                  >
                    <div style={{ display: 'grid', gap: 4 }}>
                      <span
                        style={{
                          color: 'var(--muted)',
                          fontSize: 13,
                          fontWeight: 600,
                        }}
                      >
                        {formatDatumZeit(t.datumUhrzeit)}
                      </span>
                      <h3 style={{ margin: 0, fontSize: 18 }}>{t.titel}</h3>
                    </div>
                    <span className="status-pill">{terminTypLabel(t.typ)}</span>
                  </article>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* ────── Mitmachen ────── */}
      <section className="section compact" aria-label="Mitmachen">
        <div className="wrap">
          <h2 style={{ fontSize: 24, marginTop: 0 }}>Mitmachen</h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: 16,
              marginTop: 12,
            }}
          >
            <Link
              href="/anmelden"
              className="work-card"
              style={{
                padding: 18,
                display: 'block',
                textDecoration: 'none',
                color: 'var(--fg)',
              }}
            >
              <p className="eyebrow" style={{ margin: 0 }}>
                Du baust ein Werk
              </p>
              <p style={{ marginTop: 8, color: 'var(--muted)', fontSize: 14 }}>
                Lege deinen Werkpass an und zeige dein Werk dem Kreis.
              </p>
            </Link>
            <Link
              href="/bedarf"
              className="work-card"
              style={{
                padding: 18,
                display: 'block',
                textDecoration: 'none',
                color: 'var(--fg)',
              }}
            >
              <p className="eyebrow" style={{ margin: 0 }}>
                Du brauchst Hilfe
              </p>
              <p style={{ marginTop: 8, color: 'var(--muted)', fontSize: 14 }}>
                Beschreibe deinen Bedarf und finde lokale Macher:innen.
              </p>
            </Link>
            <Link
              href="/foerdern"
              className="work-card"
              style={{
                padding: 18,
                display: 'block',
                textDecoration: 'none',
                color: 'var(--fg)',
              }}
            >
              <p className="eyebrow" style={{ margin: 0 }}>
                Du förderst Werke
              </p>
              <p style={{ marginTop: 8, color: 'var(--muted)', fontSize: 14 }}>
                Mach Werke aus deiner Stadt mit Mitteln, Räumen oder Zeit
                möglich.
              </p>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

/* ─────────────── Variante B: vorbereitung / C: inaktiv ─────────────── */

function VorbereitungVariant({ stadtRow }: ZirkelStadtViewProps) {
  const istInaktiv = stadtRow.status === 'inaktiv';
  const eyebrow = istInaktiv ? 'Ruhend' : 'In Vorbereitung';
  const subline = istInaktiv
    ? `Der ${stadtRow.name}er Kreis ruht aktuell. Wir halten die Stadt warm.`
    : `${stadtRow.name} startet, sobald der Hamburger Kreis trägt — drei Schauabende, fünfzehn Werke, ehrliche Reziprozitätsbilanz. Bis dahin halten wir die Stadt warm.`;

  return (
    <div className="page-shell">
      <HeroNav />

      <header className="hero" id="top">
        <div className="wrap hero-grid single">
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h1>Werkzirkel {stadtRow.name}</h1>
            <p className="hero-copy">{subline}</p>
            {!istInaktiv ? (
              <div className="hero-actions" style={{ marginTop: 18 }}>
                <Link
                  href={`/anmelden?stadt=${stadtRow.id}`}
                  className="button primary"
                >
                  Auf die {stadtRow.name}er Eröffnung warten
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <section className="section" aria-label="Bis dahin">
        <div className="wrap">
          <h2 style={{ fontSize: 24, marginTop: 0 }}>Bis dahin</h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: 16,
              marginTop: 12,
            }}
          >
            <Link
              href="/zirkel/hamburg"
              className="work-card"
              style={{
                padding: 18,
                display: 'block',
                textDecoration: 'none',
                color: 'var(--fg)',
              }}
            >
              <p className="eyebrow" style={{ margin: 0 }}>
                Komm zum Hamburger Schauabend
              </p>
              <p style={{ marginTop: 8, color: 'var(--muted)', fontSize: 14 }}>
                Der Hamburger Kreis ist offen für Gäste aus anderen Städten.
              </p>
            </Link>
            <Link
              href="/bedarf"
              className="work-card"
              style={{
                padding: 18,
                display: 'block',
                textDecoration: 'none',
                color: 'var(--fg)',
              }}
            >
              <p className="eyebrow" style={{ margin: 0 }}>
                Stell deinen Bedarf in Hamburg vor
              </p>
              <p style={{ marginTop: 8, color: 'var(--muted)', fontSize: 14 }}>
                Bedarfsträger:innen sind im Hamburger Kreis willkommen — auch
                wenn du nicht dort wohnst.
              </p>
            </Link>
            <Link
              href="/foerdern"
              className="work-card"
              style={{
                padding: 18,
                display: 'block',
                textDecoration: 'none',
                color: 'var(--fg)',
              }}
            >
              <p className="eyebrow" style={{ margin: 0 }}>
                Werde Förder:in von Hamburger Werken
              </p>
              <p style={{ marginTop: 8, color: 'var(--muted)', fontSize: 14 }}>
                Förderung beginnt mit Sichtbarkeit — und die ist Hamburg-First.
              </p>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

/**
 * JSON-LD Place + organizer-Organization (PRD §31).
 *
 * Suchmaschinen verstehen `Place` als geografischen Eintrag — wir mappen
 * den Zirkel auf eine City, weil das semantisch zu "Werkzirkel Hamburg"
 * passt (kein Geo-Punkt, sondern ein lokal verankerter Kreis).
 */
export function buildZirkelJsonLd(props: {
  stadtRow: ZirkelStadtRow;
  appUrl: string;
}): Record<string, unknown> {
  const { stadtRow, appUrl } = props;
  return {
    '@context': 'https://schema.org',
    '@type': 'Place',
    name: `Werkzirkel ${stadtRow.name}`,
    description:
      stadtRow.beschreibung ??
      `Werkzirkel ${stadtRow.name} — Macher:innen, Bedarfstraeger:innen und Foerder:innen aus der Region.`,
    address: { '@type': 'PostalAddress', addressLocality: stadtRow.name },
    containedInPlace: { '@type': 'City', name: stadtRow.name },
    isAccessibleForFree: true,
    publicAccess: stadtRow.status === 'aktiv',
    url: appUrl,
    additionalProperty: {
      '@type': 'Organization',
      name: 'Werkzirkel',
    },
  };
}

export default function ZirkelStadtView(props: ZirkelStadtViewProps) {
  const jsonLd = buildZirkelJsonLd({
    stadtRow: props.stadtRow,
    appUrl:
      typeof process !== 'undefined' && process.env.APP_URL
        ? process.env.APP_URL.replace(/\/+$/, '')
        : 'https://werkzirkel.de',
  });
  if (props.stadtRow.status === 'aktiv') {
    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <AktivVariant {...props} />
      </>
    );
  }
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <VorbereitungVariant {...props} />
    </>
  );
}
