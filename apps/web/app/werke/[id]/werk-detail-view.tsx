/**
 * Pure, sessionless Server-Component-Renderer fuer die Build-Detail-Seite.
 *
 * Bewusst getrennt vom Page-Modul, damit Unit-Tests die Komponente mit
 * Mock-Daten rendern koennen, ohne `next/headers`, `notFound()` oder die
 * DB mocken zu muessen.
 *
 * NIE in dieser Komponente: email, klarname, audit-Felder, foerdermitgliedschaft-Details.
 * Alle Inhaber:innen-Felder kommen ueber `InhaberPublic` rein — die Server-Page
 * macht die Public-Field-Selektion.
 */

import Link from 'next/link';

import { AvatarImage } from '@/components/ui/avatar-image';
import { de } from '@/i18n/de';
import MeldenButton from '@/components/ui/melden-button';
import type { Werk } from '@/lib/db/schema';
import type { Hilfebedarf } from '@/lib/db/schema/enums';

export interface WerkDetailInhaber {
  id: string;
  anzeigename: string;
  avatarUrl: string | null;
  stadtId: string;
  istFoerdermitglied: boolean;
}

export interface WerkDetailHistorieEintrag {
  werkstandAlt: string | null;
  werkstandNeu: string | null;
  geaendertAm: Date;
  geaendertVonAnzeigename: string | null;
}

/** Anonymisierter Hilfreich-Feedback-Eintrag (PRD §8.4). */
export interface WerkDetailHilfreichFeedback {
  /** Sequentielles, anonymes Label: "Tester:in 1", "Tester:in 2" usw. */
  testerLabel: string;
  gesamteindruck: string | null;
  ersterEindruck: string | null;
  verstaendlichkeit: string | null;
  nutzen: string | null;
  bedienbarkeit: string | null;
  verbesserungen: string | null;
  hilfreichMarkiertAm: Date | null;
}

export interface WerkDetailViewProps {
  werk: Werk;
  inhaber: WerkDetailInhaber;
  stadtName: string;
  historie: WerkDetailHistorieEintrag[];
  /** Anonymisierte Hilfreich-Markierungen (PRD §8.4). Default: leer. */
  hilfreichFeedbacks?: WerkDetailHilfreichFeedback[];
  /** Session-Status fuer die Inhaber:innen-/Anmeldung-Aktionen. */
  istInhaber?: boolean;
  istEingeloggt?: boolean;
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

function werkstandLabel(w: string | null): string {
  if (!w) return '—';
  return (de.werkstand as Record<string, string>)[w] ?? w;
}

function hilfebedarfLabel(h: string): string {
  return (de.hilfebedarf as Record<string, string>)[h] ?? h;
}

export function buildJsonLd(props: {
  werk: Werk;
  inhaber: { anzeigename: string };
}): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    name: props.werk.name,
    description: props.werk.kurzbeschreibung,
    author: {
      '@type': 'Person',
      name: props.inhaber.anzeigename,
    },
    dateModified: props.werk.aktualisiertAm.toISOString(),
  };
}

export default function WerkDetailView({
  werk,
  inhaber,
  stadtName,
  historie,
  hilfreichFeedbacks = [],
  istInhaber = false,
  istEingeloggt = false,
}: WerkDetailViewProps) {
  const jsonLd = buildJsonLd({ werk, inhaber });
  const hilfebedarf: Hilfebedarf[] = werk.hilfebedarf ?? [];

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
            <Link href="/bedarf">Bedarf einbringen</Link>
            <Link href="/foerdern">Builds sponsorn</Link>
          </div>
          <Link className="nav-cta" href="/anmelden">
            Anmelden
          </Link>
        </div>
      </nav>

      <header className="hero" id="top">
        <div className="wrap hero-grid single">
          <div>
            <p className="eyebrow">
              {stadtName
                ? `Build im Werkzirkel ${stadtName}`
                : 'Build im Werkzirkel'}
            </p>
            <h1>{werk.name}</h1>
            <div
              style={{
                display: 'flex',
                gap: 8,
                marginTop: 20,
                flexWrap: 'wrap',
              }}
            >
              <span className="status-pill warm">
                Build-Stand: {werkstandLabel(werk.werkstand)}
              </span>
              {werk.link ? (
                <a
                  className="status-pill"
                  href={werk.link}
                  rel="noopener noreferrer nofollow"
                  target="_blank"
                >
                  Live ansehen →
                </a>
              ) : null}
            </div>
            <p className="hero-copy">{werk.kurzbeschreibung}</p>
          </div>
        </div>
      </header>

      {werk.screenshots.length > 0 ? (
        <section className="section compact" aria-label="Screenshots">
          <div className="wrap">
            <div
              style={{
                display: 'grid',
                gridAutoFlow: 'column',
                gridAutoColumns: 'minmax(320px, 1fr)',
                gap: 14,
                overflowX: 'auto',
                paddingBottom: 8,
              }}
            >
              {werk.screenshots.map((url, i) => (
                <div
                  key={url}
                  style={{
                    border: 'var(--hairline)',
                    borderRadius: 14,
                    overflow: 'hidden',
                    background: 'var(--surface)',
                  }}
                >
                  <AvatarImage
                    src={url}
                    alt={`Screenshot ${i + 1} von ${werk.name}`}
                    width={1200}
                    height={800}
                    style={{
                      width: '100%',
                      height: 'auto',
                      display: 'block',
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="section product-section">
        <div className="wrap product-split">
          <div>
            <p className="eyebrow">Werk</p>
            <h2 style={{ fontSize: 38 }}>Problem</h2>
            <p
              style={{
                marginTop: 16,
                whiteSpace: 'pre-line',
                color: 'var(--fg)',
                fontSize: 17,
                lineHeight: 1.55,
              }}
            >
              {werk.problem}
            </p>

            <h2 style={{ fontSize: 32, marginTop: 40 }}>Zielgruppe</h2>
            <p
              style={{
                marginTop: 12,
                whiteSpace: 'pre-line',
                color: 'var(--fg)',
                fontSize: 17,
                lineHeight: 1.55,
              }}
            >
              {werk.zielgruppe}
            </p>

            {hilfebedarf.length > 0 ? (
              <>
                <h2 style={{ fontSize: 32, marginTop: 40 }}>Hilfebedarf</h2>
                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    flexWrap: 'wrap',
                    marginTop: 14,
                  }}
                >
                  {hilfebedarf.map((h) => (
                    <span key={h} className="status-pill">
                      {hilfebedarfLabel(h)}
                    </span>
                  ))}
                </div>
              </>
            ) : null}
          </div>

          <aside aria-label="Inhaber:in">
            <article className="work-card">
              <div className="work-body">
                <p className="eyebrow" style={{ margin: 0 }}>
                  Inhaber:in
                </p>
                <div
                  style={{
                    display: 'flex',
                    gap: 14,
                    alignItems: 'center',
                    marginTop: 12,
                  }}
                >
                  {inhaber.avatarUrl ? (
                    <AvatarImage
                      src={inhaber.avatarUrl}
                      alt=""
                      width={56}
                      height={56}
                      style={{
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
                        width: 56,
                        height: 56,
                        borderRadius: '50%',
                        background: 'var(--surface)',
                        border: 'var(--hairline)',
                        fontWeight: 680,
                        fontSize: 20,
                      }}
                    >
                      {avatarInitialen(inhaber.anzeigename)}
                    </span>
                  )}
                  <div>
                    <h3 style={{ margin: 0, fontSize: 20 }}>
                      <Link
                        href={`/werkpass/${inhaber.id}`}
                        style={{ color: 'var(--fg)' }}
                      >
                        {inhaber.anzeigename}
                      </Link>
                    </h3>
                    {stadtName ? (
                      <p style={{ margin: '4px 0 0', color: 'var(--muted)' }}>
                        {stadtName}
                      </p>
                    ) : null}
                  </div>
                </div>
                {inhaber.istFoerdermitglied ? (
                  <div style={{ marginTop: 14 }}>
                    <span className="status-pill warm">Fördermitglied</span>
                  </div>
                ) : null}
                <div style={{ marginTop: 22 }}>
                  {istInhaber ? (
                    <Link
                      className="button primary"
                      href={`/pruefrunden/neu?werk=${werk.id}`}
                    >
                      {de.pruefrunden.werk.pruefrunde_anbieten}
                    </Link>
                  ) : !istEingeloggt ? (
                    <>
                      <Link
                        className="button primary"
                        href={`/anmelden?next=/werke/${werk.id}`}
                      >
                        {de.pruefrunden.werk.pruefrunde_anbieten}
                      </Link>
                      <p
                        style={{
                          margin: '8px 0 0',
                          color: 'var(--muted)',
                          fontSize: 13,
                        }}
                      >
                        {de.pruefrunden.werk.anonym_anmelden_hinweis}
                      </p>
                    </>
                  ) : (
                    <p
                      style={{
                        margin: 0,
                        color: 'var(--muted)',
                        fontSize: 13,
                      }}
                    >
                      {de.pruefrunden.werk.nicht_inhaber_hinweis}
                    </p>
                  )}
                </div>
              </div>
            </article>
          </aside>
        </div>
      </section>

      {historie.length > 0 ? (
        <section className="section compact" aria-label="Build-Verlauf">
          <div className="wrap">
            <div className="section-head">
              <h2 style={{ fontSize: 32 }}>Build-Verlauf</h2>
            </div>
            <ul className="explain-list">
              {historie.map((h, i) => (
                <li key={`${h.geaendertAm.toISOString()}-${i}`}>
                  <span className="step-number">{historie.length - i}</span>
                  <div>
                    <strong>
                      {h.werkstandAlt === null
                        ? `Werk angelegt mit Build-Stand ${werkstandLabel(h.werkstandNeu)}`
                        : `Build-Stand geändert von ${werkstandLabel(h.werkstandAlt)} auf ${werkstandLabel(h.werkstandNeu)}`}
                    </strong>
                    <p>
                      {formatDatum(h.geaendertAm)} ·{' '}
                      {h.geaendertVonAnzeigename
                        ? `von ${h.geaendertVonAnzeigename}`
                        : 'von unbekannt'}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {hilfreichFeedbacks.length > 0 ? (
        <section
          className="section compact"
          aria-labelledby="hilfreich-feedback-titel"
        >
          <div className="wrap">
            <h2
              id="hilfreich-feedback-titel"
              style={{ fontSize: 32, margin: '0 0 8px' }}
            >
              Was Tester:innen sagten
            </h2>
            <p
              style={{
                margin: '0 0 16px',
                color: 'var(--muted)',
              }}
            >
              {hilfreichFeedbacks.length === 1
                ? '1 Tester:in '
                : `${hilfreichFeedbacks.length} Tester:innen `}
              gaben Feedback, das {inhaber.anzeigename} als hilfreich
              markiert hat. Namen bleiben anonym.
            </p>
            <ul
              style={{
                margin: 0,
                padding: 0,
                listStyle: 'none',
                display: 'grid',
                gap: 12,
              }}
            >
              {hilfreichFeedbacks.map((f, i) => (
                <li
                  key={`${f.testerLabel}-${i}`}
                  style={{
                    padding: 14,
                    borderRadius: 12,
                    background: 'var(--surface-alt, #f6f6f1)',
                    display: 'grid',
                    gap: 6,
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      fontWeight: 600,
                      fontSize: 14,
                    }}
                  >
                    {f.testerLabel} sagte:
                  </p>
                  {f.gesamteindruck ? (
                    <p style={{ margin: 0, fontSize: 15 }}>
                      „{f.gesamteindruck}"
                    </p>
                  ) : null}
                  {f.verbesserungen ? (
                    <p
                      style={{
                        margin: 0,
                        fontSize: 14,
                        color: 'var(--muted)',
                      }}
                    >
                      Verbesserung: „{f.verbesserungen}"
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      <section className="section compact" aria-label="Inhalt melden">
        <div
          className="wrap"
          style={{ display: 'flex', justifyContent: 'flex-end' }}
        >
          <MeldenButton referenzTyp="werk" referenzId={werk.id} />
        </div>
      </section>

      <footer className="site-footer">
        <div className="wrap footer-inner">
          <span>Werkzirkel — Gemeinsam digitale Produkte bauen.</span>
          <div className="footer-links" aria-label="Fußnavigation">
            <Link href="/">Builder:innen</Link>
            <Link href="/bedarf">Bedarf</Link>
            <Link href="/foerdern">Fördern</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
