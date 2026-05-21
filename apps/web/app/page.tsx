import type { Metadata } from 'next';
import Link from 'next/link';

import SiteFooter from '@/components/ui/site-footer';
import { env } from '@/lib/env';

export const metadata: Metadata = {
  title: 'Werkzirkel — Build in Public, mit echten Testern',
  description:
    'Werkzirkel verbindet unabhängige Builder:innen und Founder:innen in Hamburg — mit Auftraggeber:innen und Sponsor:innen aus derselben Stadt. Build in Public, ohne Pitch-Theater.',
};

const APP_URL = env.APP_URL.replace(/\/+$/, '');

/**
 * JSON-LD Organization-Schema (PRD §31).
 *
 * Quelle: https://schema.org/Organization. Wir liefern es nur fuer die
 * Startseite — Suchmaschinen lesen das einmal pro Site und nehmen
 * Logo/Sprache/Knowledge-Graph-Daten daraus.
 */
const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Werkzirkel',
  url: APP_URL,
  logo: `${APP_URL}/og-default.png`,
  description:
    'Build-in-Public-Plattform fuer unabhaengige Builder:innen und Founder:innen in Hamburg. Builder, Auftraggeber:innen und Sponsor:innen aus derselben Stadt — kein Marktplatz, keine Vermittlung, keine Provision.',
  areaServed: { '@type': 'City', name: 'Hamburg' },
  inLanguage: 'de',
} as const;

export default function MacherLandingpage() {
  return (
    <div className="page-shell">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
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
            <Link href="/" aria-current="page">
              Builder:innen
            </Link>
            <Link href="/bedarf">Bedarf einbringen</Link>
            <Link href="/foerdern">Builds sponsorn</Link>
            <a href="#kreise">Städte</a>
            <a href="#regeln">Regeln</a>
          </div>
          <a className="nav-cta" href="#zugang">
            Frühen Zugang anfragen
          </a>
        </div>
      </nav>

      <header className="hero" id="top">
        <div className="wrap hero-grid">
          <div>
            <p className="eyebrow">Build in Public · Hamburg zuerst</p>
            <h1>Bau dein Produkt nicht allein.</h1>
            <p className="hero-copy">
              Werkzirkel bringt unabhängige Builder:innen und Founder:innen in Hamburg zusammen — zum
              Austauschen, Testen und Vorankommen. Und macht sie sichtbar für lokale
              Auftraggeber:innen und Sponsor:innen, die in derselben Stadt sitzen. Build in Public,
              ohne Pitch-Theater.
            </p>
            <div className="hero-actions">
              <a className="button primary" href="#zugang">
                Builder-Profil vormerken
              </a>
              <a className="button secondary" href="#formate">
                Formate ansehen
              </a>
            </div>
            <div className="city-picker" aria-label="Regionale Werkzirkel">
              <button className="city-chip" type="button" aria-pressed="true">
                Hamburg · aktiv
              </button>
              <button
                className="city-chip"
                type="button"
                aria-pressed="false"
                aria-disabled="true"
              >
                Berlin · in Vorbereitung
              </button>
              <button
                className="city-chip"
                type="button"
                aria-pressed="false"
                aria-disabled="true"
              >
                München · in Vorbereitung
              </button>
            </div>
          </div>

          <div className="product-frame" aria-label="Produktvorschau Werkzirkel Hamburg">
            <div className="frame-topbar">
              <div className="window-dots" aria-hidden="true">
                <span></span>
                <span></span>
                <span></span>
              </div>
              <span>Werkzirkel Hamburg</span>
            </div>
            <div className="frame-body">
              <aside className="mock-sidebar" aria-label="Bereiche im Produkt">
                <p className="sidebar-title">Stadt</p>
                <div className="side-item active">
                  <span className="side-dot"></span>
                  <span>Übersicht</span>
                </div>
                <div className="side-item">
                  <span className="side-dot"></span>
                  <span>Builds</span>
                </div>
                <div className="side-item">
                  <span className="side-dot"></span>
                  <span>Feedback-Loops</span>
                </div>
                <div className="side-item">
                  <span className="side-dot"></span>
                  <span>Bedarfe</span>
                </div>
                <div className="side-item">
                  <span className="side-dot"></span>
                  <span>Termine</span>
                </div>
                <div className="side-item">
                  <span className="side-dot"></span>
                  <span>Quick-Help</span>
                </div>
              </aside>
              <main className="mock-main">
                <div className="mock-header">
                  <div>
                    <h2 className="mock-title">Nächste Demo Night</h2>
                    <p className="mock-sub">
                      Für Builder:innen mit echten digitalen Produkten, frühen Versionen und
                      konkreten Fragen.
                    </p>
                  </div>
                  <span className="status-pill warm">Hamburg</span>
                </div>
                <div className="mock-grid">
                  <article className="mock-card">
                    <p className="mock-label">Feedback-Loop</p>
                    <strong>Bezahlstrecke einer kleinen App testen</strong>
                    <p>
                      Gesucht: drei ehrliche Testpersonen aus Hamburg, die den ersten Kaufweg
                      prüfen.
                    </p>
                  </article>
                  <article className="mock-card">
                    <p className="mock-label">Demo Night</p>
                    <strong>Fünf Builds, je acht Minuten</strong>
                    <p>Zeigen, was läuft. Keine Bühne für Selbstdarstellung.</p>
                  </article>
                  <article className="mock-card wide">
                    <p className="mock-label">Build-Stand</p>
                    <strong>
                      Erst zeigen. Dann testen. Dann verbessern. Dann sichtbar machen.
                    </strong>
                    <div className="task-list">
                      <div className="task">
                        <span className="check">✓</span>
                        <span>Build-Seite angelegt</span>
                        <small>erledigt</small>
                      </div>
                      <div className="task">
                        <span className="check">2</span>
                        <span>Testfrage formulieren</span>
                        <small>heute</small>
                      </div>
                      <div className="task">
                        <span className="check">3</span>
                        <span>Demo Night anfragen</span>
                        <small>offen</small>
                      </div>
                    </div>
                  </article>
                </div>
              </main>
            </div>
          </div>
        </div>
      </header>

      <section className="section compact" aria-label="Drei Wege in den Werkzirkel">
        <div className="wrap">
          <div className="section-head">
            <h2>Drei Wege rein.</h2>
            <p>
              Werkzirkel verbindet drei Seiten — und schützt jede vor der anderen. Builder:innen
              zeigen Builds. Auftraggeber:innen zeigen Probleme. Sponsor:innen zeigen Mittel.
              Vermittlungen passieren offline.
            </p>
          </div>
          <div className="role-switcher">
            <article className="role-card" aria-current="page">
              <div>
                <p className="meta">Du baust</p>
                <h3>Builder-Profil &amp; Build anlegen</h3>
                <p>
                  Eigene digitale Produkte zeigen, testen lassen, weiterentwickeln. Auf Demo Nights
                  vorstellen, Feedback-Loops geben und nehmen.
                </p>
              </div>
              <span className="arrow">Du bist hier →</span>
            </article>
            <Link className="role-card" href="/bedarf">
              <div>
                <p className="meta">Du brauchst</p>
                <h3>Bedarf einbringen</h3>
                <p>
                  Ein konkretes digitales Problem aus deiner Organisation in den Hamburger Werkzirkel
                  stellen — mit Membership-Beitrag, ohne Pitch-Wettbewerb.
                </p>
              </div>
              <span className="arrow">Zur Bedarfsseite →</span>
            </Link>
            <Link className="role-card" href="/foerdern">
              <div>
                <p className="meta">Du sponsorst</p>
                <h3>Builds sponsorn</h3>
                <p>
                  Sponsor-Profil anlegen, vom City-Lead verifizieren lassen, auf einer Briefing Night
                  persönlich sichtbar werden. Klarname, transparenter Rahmen.
                </p>
              </div>
              <span className="arrow">Zur Sponsor-Seite →</span>
            </Link>
          </div>
        </div>
      </section>

      <section className="section compact" id="regeln">
        <div className="wrap">
          <div className="section-head">
            <h2>Nicht noch ein soziales Netzwerk.</h2>
            <p>
              Werkzirkel verkauft keinen Kontakt um des Kontakts willen. Die Plattform ist auf
              Fortschritt gebaut: konkrete Builds, konkrete Fragen, konkrete nächste Schritte.
            </p>
          </div>
          <div className="principle-grid">
            <article className="principle-card">
              <span className="no">01</span>
              <h3>Kein endloser Feed.</h3>
              <p>
                Statt Rauschen gibt es begrenzte Feedback-Loops, sichtbare Build-Stände und regionale
                Termine.
              </p>
            </article>
            <article className="principle-card">
              <span className="no">02</span>
              <h3>Keine Applaus-Jagd.</h3>
              <p>
                Ein Build wird nicht nach Applaus sortiert, sondern nach Status, Bedarf und nächstem
                Schritt.
              </p>
            </article>
            <article className="principle-card">
              <span className="no">03</span>
              <h3>Keine Gründerbühne.</h3>
              <p>
                Unfertige Produkte dürfen unfertig sein. Entscheidend ist, dass andere sie ehrlich
                testen können.
              </p>
            </article>
          </div>

          <div className="reziproz-row" style={{ marginTop: '22px' }}>
            <div>
              <h3>Gib zwei, nimm eins.</h3>
              <p>
                Wer einen eigenen Feedback-Loop startet, hat zuvor zwei Builds anderer getestet —
                oder verpflichtet sich, das innerhalb von 14 Tagen zu tun. Das Feedback-Saldo ist
                im Builder-Profil sichtbar.
              </p>
            </div>
            <div className="saldo">
              <span>2 ↔ 1</span>
              <small>Feedback-Saldo</small>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="formate">
        <div className="wrap">
          <div className="section-head">
            <h2>Formate, die Arbeit auslösen.</h2>
            <p>
              Jede Stadt hat einfache, wiederkehrende Formate. Sie halten den Austausch klein genug
              für Vertrauen und konkret genug für echte Verbesserung.
            </p>
          </div>
          <div className="format-grid">
            <article className="format-card">
              <div>
                <span className="meta">Testen</span>
                <h3>Feedback-Loop</h3>
                <p>
                  Eine Person bringt einen Build und eine klare Testfrage mit. Andere testen
                  strukturiert und geben verwertbare Rückmeldung.
                </p>
              </div>
              <span className="status-pill">Geben und nehmen</span>
            </article>
            <article className="format-card">
              <div>
                <span className="meta">Zeigen</span>
                <h3>Demo Night</h3>
                <p>
                  Lokale Demo Night ohne Bühnenzwang: kurze Build-Stände, offene Baustellen,
                  direkte Anschlussfragen.
                </p>
              </div>
              <span className="status-pill">Vor Ort</span>
            </article>
            <article className="format-card">
              <div>
                <span className="meta">Bauen</span>
                <h3>Build-Runde</h3>
                <p>
                  Gemeinsames Arbeiten digital oder an einem Ort. Ruhig, verbindlich, mit Ziel für
                  die nächsten Stunden.
                </p>
              </div>
              <span className="status-pill">Deep Work</span>
            </article>
            <article className="format-card">
              <div>
                <span className="meta">Treffen</span>
                <h3>Briefing Night</h3>
                <p>
                  Gegenstück zur Demo Night, andere Stoßrichtung: Auftraggeber:innen und
                  Sponsor:innen zeigen Probleme und Mittel — Builder:innen hören zu.
                </p>
              </div>
              <span className="status-pill">Vor Ort</span>
            </article>
          </div>
        </div>
      </section>

      <section className="section product-section" id="werke">
        <div className="wrap product-split">
          <div className="work-card">
            <div className="work-cover">
              <div className="work-logo" aria-hidden="true">
                W
              </div>
            </div>
            <div className="work-body">
              <span className="status-pill">Build-Stand: Beta</span>
              <h3>Ein Build vor dem ersten echten Marktgespräch</h3>
              <p>
                Jede Build-Seite zeigt knapp, was gebaut wird, für wen es gedacht ist, welcher
                Fortschritt sichtbar ist und welches Feedback gerade gebraucht wird.
              </p>
              <div className="work-meta">
                <div className="meta-box">
                  <span>Bedarf</span>
                  <strong>Fünf Testpersonen für den ersten Ablauf</strong>
                </div>
                <div className="meta-box">
                  <span>Nächster Schritt</span>
                  <strong>Feedback-Loop in der eigenen Stadt anlegen</strong>
                </div>
                <div className="meta-box">
                  <span>Stadt</span>
                  <strong>Hamburg</strong>
                </div>
                <div className="meta-box">
                  <span>Sprache</span>
                  <strong>Deutsch</strong>
                </div>
              </div>
            </div>
          </div>
          <div>
            <p className="eyebrow">Build vor Profil</p>
            <h2>Der Kern ist nicht, wer du bist. Sondern was du baust.</h2>
            <ul className="explain-list">
              <li>
                <span className="step-number">01</span>
                <div>
                  <strong>Build anlegen</strong>
                  <p>
                    Eine App, ein SaaS, ein Tool, ein Side-Project oder ein Indie-Hack bekommt eine
                    klare Seite im Builder-Profil.
                  </p>
                </div>
              </li>
              <li>
                <span className="step-number">02</span>
                <div>
                  <strong>Build-Stand sichtbar machen</strong>
                  <p>
                    Nicht perfekt wirken, sondern zeigen, ob etwas Idee, Prototyp, Beta oder Live
                    ist.
                  </p>
                </div>
              </li>
              <li>
                <span className="step-number">03</span>
                <div>
                  <strong>Konkretes Feedback erbitten</strong>
                  <p>
                    Wer Feedback will, beschreibt die Frage. Wer Feedback bekommt, unterstützt auch
                    andere Builds im Werkzirkel — verbindlich.
                  </p>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className="section" id="kreise">
        <div className="wrap">
          <div className="section-head">
            <h2>Hamburg zuerst. Sauber.</h2>
            <p>
              Wir starten bewusst mit einer Stadt. Erst wenn der Hamburger Werkzirkel trägt — drei
              Demo Nights, fünfzehn Builds, ehrliches Feedback-Saldo — replizieren wir Berlin und
              München mit eigenem City-Lead vor Ort.
            </p>
          </div>
          <div className="city-grid">
            <article className="city-card">
              <span className="state aktiv">Aktive Stadt</span>
              <h3>Werkzirkel Hamburg</h3>
              <p>
                Erster Standort. Demo Nights, Feedback-Loops und die erste Briefing Night finden
                hier statt.
              </p>
            </article>
            <article className="city-card">
              <span className="state">In Vorbereitung</span>
              <h3>Werkzirkel Berlin</h3>
              <p>Aktiv, sobald Hamburg trägt — mit eigenem City-Lead, nicht ferngesteuert.</p>
            </article>
            <article className="city-card">
              <span className="state">In Vorbereitung</span>
              <h3>Werkzirkel München</h3>
              <p>Folgt ca. vier Wochen nach Berlin — bewusst gestaffelt, nicht parallel.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="section compact">
        <div className="wrap">
          <div className="flow-band">
            <p className="eyebrow">Leitsatz</p>
            <div className="flow-row">
              <div className="flow-step">
                <span>01</span>
                <strong>Erst zeigen.</strong>
              </div>
              <div className="flow-step">
                <span>02</span>
                <strong>Dann testen.</strong>
              </div>
              <div className="flow-step">
                <span>03</span>
                <strong>Dann verbessern.</strong>
              </div>
              <div className="flow-step">
                <span>04</span>
                <strong>Dann sichtbar machen.</strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section" aria-label="Zielgruppe">
        <div className="wrap audience-grid">
          <article className="audience-card">
            <p className="eyebrow">Dafür gebaut</p>
            <h3>Für Builder:innen mit konkretem Produkt-Interesse.</h3>
            <ul>
              <li>Indie-Hacker:innen und Solo-Founder:innen</li>
              <li>SaaS-Builder:innen und App-Founder:innen</li>
              <li>Tech-Mitarbeiter:innen mit Side-Projects</li>
              <li>No-Code-/Low-Code-Builder:innen mit echtem Vorhaben</li>
              <li>UX-/UI-Designer:innen mit eigenen Ideen</li>
            </ul>
          </article>
          <article className="audience-card">
            <p className="eyebrow">Bewusst nicht dafür</p>
            <h3>Kein Ort für reine Selbstdarstellung.</h3>
            <ul>
              <li>keine Jobbörse</li>
              <li>keine Freelancer-Projektbörse mit Sterne-Ranking</li>
              <li>keine investorengetriebene Gründerbühne</li>
              <li>keine Krypto-, Trend- oder Schneeballsysteme</li>
              <li>keine rein englischsprachige Produktgruppe</li>
            </ul>
          </article>
        </div>
      </section>

      <section className="cta-section" id="zugang">
        <div className="wrap cta-box">
          <div>
            <p className="eyebrow">Hamburger Werkzirkel</p>
            <h2>Builder-Profil vormerken.</h2>
            <p>
              Du baust ein digitales Produkt in Hamburg und willst es testen lassen, weiterentwickeln
              und in der Stadt sichtbar werden? Trag dich für den frühen Zugang ein. Die erste
              Demo Night wird per E-Mail angekündigt.
            </p>
          </div>
          <form className="waitlist" action="#" method="post">
            <label htmlFor="mail">Frühen Zugang anfragen</label>
            <div className="waitlist-row">
              <input
                id="mail"
                name="mail"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="deine-mail@beispiel.de"
                aria-label="E-Mail-Adresse"
                required
              />
              <button className="button primary" type="submit">
                Vormerken
              </button>
            </div>
            <p className="small-note">
              Keine Newsletter, keine Werbung. Nur Hamburger Termine und Plattform-Start.
            </p>
          </form>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
