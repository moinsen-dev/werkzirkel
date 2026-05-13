import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Werkzirkel — Gemeinsam digitale Produkte bauen',
  description:
    'Werkzirkel verbindet unabhängige digitale Macher:innen in Hamburg — mit Bedarfsträger:innen und Förder:innen aus derselben Stadt. Werkstatt-Kultur, kein Marktplatz.',
};

export default function MacherLandingpage() {
  return (
    <div className="page-shell">
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
              Macher:innen
            </Link>
            <Link href="/bedarf">Bedarf einbringen</Link>
            <Link href="/foerdern">Werke fördern</Link>
            <a href="#kreise">Kreise</a>
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
            <p className="eyebrow">Werkstatt-Kultur · Hamburg zuerst</p>
            <h1>Baue digitale Produkte nicht allein.</h1>
            <p className="hero-copy">
              Werkzirkel bringt unabhängige digitale Macher:innen in Hamburg zusammen — zum
              Austauschen, Testen und Vorankommen. Und macht sie sichtbar gegenüber lokalen
              Bedarfsträger:innen und Förder:innen, die in derselben Stadt sitzen. Werkstatt-Kultur,
              kein Marktplatz.
            </p>
            <div className="hero-actions">
              <a className="button primary" href="#zugang">
                Werkpass vormerken
              </a>
              <a className="button secondary" href="#formate">
                Formate ansehen
              </a>
            </div>
            <div className="city-picker" aria-label="Regionale Zirkel">
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
                <p className="sidebar-title">Kreis</p>
                <div className="side-item active">
                  <span className="side-dot"></span>
                  <span>Übersicht</span>
                </div>
                <div className="side-item">
                  <span className="side-dot"></span>
                  <span>Werke</span>
                </div>
                <div className="side-item">
                  <span className="side-dot"></span>
                  <span>Prüfrunden</span>
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
                  <span>Hilfegesuche</span>
                </div>
              </aside>
              <main className="mock-main">
                <div className="mock-header">
                  <div>
                    <h2 className="mock-title">Nächster Arbeitskreis</h2>
                    <p className="mock-sub">
                      Für Menschen mit echten digitalen Werken, frühen Versionen und konkreten
                      Fragen.
                    </p>
                  </div>
                  <span className="status-pill warm">Hamburg</span>
                </div>
                <div className="mock-grid">
                  <article className="mock-card">
                    <p className="mock-label">Prüfrunde</p>
                    <strong>Bezahlstrecke einer kleinen App testen</strong>
                    <p>
                      Gesucht: drei ehrliche Testpersonen aus Hamburg, die den ersten Kaufweg
                      prüfen.
                    </p>
                  </article>
                  <article className="mock-card">
                    <p className="mock-label">Schauabend</p>
                    <strong>Fünf unfertige Werke, je acht Minuten</strong>
                    <p>Zeigen, was da ist. Keine Bühne für Selbstdarstellung.</p>
                  </article>
                  <article className="mock-card wide">
                    <p className="mock-label">Werkstand</p>
                    <strong>
                      Erst zeigen. Dann testen. Dann verbessern. Dann sichtbar machen.
                    </strong>
                    <div className="task-list">
                      <div className="task">
                        <span className="check">✓</span>
                        <span>Werkseite angelegt</span>
                        <small>erledigt</small>
                      </div>
                      <div className="task">
                        <span className="check">2</span>
                        <span>Prüffrage formulieren</span>
                        <small>heute</small>
                      </div>
                      <div className="task">
                        <span className="check">3</span>
                        <span>Schauabend anfragen</span>
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

      <section className="section compact" aria-label="Drei Wege in den Kreis">
        <div className="wrap">
          <div className="section-head">
            <h2>Drei Wege in den Kreis.</h2>
            <p>
              Werkzirkel verbindet drei Seiten — und schützt jede vor der anderen. Macher:innen
              zeigen Werke. Bedarfsträger:innen zeigen Probleme. Förder:innen zeigen Mittel.
              Vermittlungen passieren offline.
            </p>
          </div>
          <div className="role-switcher">
            <article className="role-card" aria-current="page">
              <div>
                <p className="meta">Du baust</p>
                <h3>Werkpass &amp; Werk anlegen</h3>
                <p>
                  Eigene digitale Produkte zeigen, testen lassen, weiterentwickeln. Auf
                  Schauabenden vorstellen, Prüfrunden geben und nehmen.
                </p>
              </div>
              <span className="arrow">Du bist hier →</span>
            </article>
            <Link className="role-card" href="/bedarf">
              <div>
                <p className="meta">Du brauchst</p>
                <h3>Bedarf einbringen</h3>
                <p>
                  Ein konkretes digitales Problem aus deiner Organisation in den Hamburger Kreis
                  stellen — mit Werkstattbeitrag, ohne Pitch-Wettbewerb.
                </p>
              </div>
              <span className="arrow">Zur Bedarfsseite →</span>
            </Link>
            <Link className="role-card" href="/foerdern">
              <div>
                <p className="meta">Du förderst</p>
                <h3>Werke fördern</h3>
                <p>
                  Förderprofil anlegen, von der Kurator:in verifizieren lassen, in einer
                  Bedarfsschau persönlich sichtbar werden. Klarname, transparenter Rahmen.
                </p>
              </div>
              <span className="arrow">Zur Förderseite →</span>
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
              Fortschritt gebaut: konkrete Werke, konkrete Fragen, konkrete nächste Schritte.
            </p>
          </div>
          <div className="principle-grid">
            <article className="principle-card">
              <span className="no">01</span>
              <h3>Kein endloser Nachrichtenstrom.</h3>
              <p>
                Statt Rauschen gibt es begrenzte Prüfrunden, sichtbare Werkstände und regionale
                Termine.
              </p>
            </article>
            <article className="principle-card">
              <span className="no">02</span>
              <h3>Keine Applaus-Jagd.</h3>
              <p>
                Ein Werk wird nicht nach Applaus sortiert, sondern nach Status, Bedarf und nächstem
                Schritt.
              </p>
            </article>
            <article className="principle-card">
              <span className="no">03</span>
              <h3>Keine Gründerbühne.</h3>
              <p>
                Unfertige Produkte dürfen unfertig sein. Entscheidend ist, dass andere sie ehrlich
                prüfen können.
              </p>
            </article>
          </div>

          <div className="reziproz-row" style={{ marginTop: '22px' }}>
            <div>
              <h3>Verbindlichkeit, nicht Verbrauch.</h3>
              <p>
                Wer eine Prüfrunde startet, hat zuvor zwei Werke anderer getestet — oder
                verpflichtet sich, das innerhalb von 14 Tagen zu tun. Die Test-Bilanz ist im
                Werkpass sichtbar.
              </p>
            </div>
            <div className="saldo">
              <span>2 ↔ 1</span>
              <small>Test-Saldo</small>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="formate">
        <div className="wrap">
          <div className="section-head">
            <h2>Formate, die Arbeit auslösen.</h2>
            <p>
              Jeder Kreis hat einfache, wiederkehrende Formate. Sie halten den Austausch klein
              genug für Vertrauen und konkret genug für echte Verbesserung.
            </p>
          </div>
          <div className="format-grid">
            <article className="format-card">
              <div>
                <span className="meta">Testen</span>
                <h3>Prüfrunde</h3>
                <p>
                  Eine Person bringt ein Werk und eine klare Prüffrage mit. Andere testen
                  strukturiert und geben verwertbare Rückmeldung.
                </p>
              </div>
              <span className="status-pill">Geben und nehmen</span>
            </article>
            <article className="format-card">
              <div>
                <span className="meta">Zeigen</span>
                <h3>Schauabend</h3>
                <p>
                  Lokaler Schauabend ohne Bühnenzwang: kurze Werkstände, offene Baustellen, direkte
                  Anschlussfragen.
                </p>
              </div>
              <span className="status-pill">Vor Ort</span>
            </article>
            <article className="format-card">
              <div>
                <span className="meta">Bauen</span>
                <h3>Baurunde</h3>
                <p>
                  Gemeinsames Arbeiten digital oder an einem Ort. Ruhig, verbindlich, mit Ziel für
                  die nächsten Stunden.
                </p>
              </div>
              <span className="status-pill">Fokuszeit</span>
            </article>
            <article className="format-card">
              <div>
                <span className="meta">Treffen</span>
                <h3>Bedarfsschau</h3>
                <p>
                  Pendant zum Schauabend, andere Stoßrichtung: Bedarfsträger:innen und Förder:innen
                  zeigen Probleme und Mittel — Macher:innen hören zu.
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
              <span className="status-pill">Werkstand: frühe Version</span>
              <h3>Ein Werk vor dem ersten echten Marktgespräch</h3>
              <p>
                Jede Werkseite zeigt knapp, was gebaut wird, für wen es gedacht ist, welcher
                Fortschritt sichtbar ist und welche Hilfe gerade gebraucht wird.
              </p>
              <div className="work-meta">
                <div className="meta-box">
                  <span>Bedarf</span>
                  <strong>Fünf Testpersonen für den ersten Ablauf</strong>
                </div>
                <div className="meta-box">
                  <span>Nächster Schritt</span>
                  <strong>Prüfrunde im eigenen Kreis anlegen</strong>
                </div>
                <div className="meta-box">
                  <span>Kreis</span>
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
            <p className="eyebrow">Werk vor Profil</p>
            <h2>Der Kern ist nicht, wer du bist. Sondern was du baust.</h2>
            <ul className="explain-list">
              <li>
                <span className="step-number">01</span>
                <div>
                  <strong>Werk anlegen</strong>
                  <p>
                    Eine App, ein Werkzeug, ein digitales Vorhaben oder ein Nebenprodukt bekommt
                    eine klare Seite im Werkpass.
                  </p>
                </div>
              </li>
              <li>
                <span className="step-number">02</span>
                <div>
                  <strong>Werkstand sichtbar machen</strong>
                  <p>
                    Nicht perfekt wirken, sondern zeigen, ob etwas Idee, Prototyp, frühe Version
                    oder laufendes Produkt ist.
                  </p>
                </div>
              </li>
              <li>
                <span className="step-number">03</span>
                <div>
                  <strong>Konkrete Hilfe erbitten</strong>
                  <p>
                    Wer Rückmeldung will, beschreibt die Frage. Wer Hilfe bekommt, unterstützt auch
                    andere Werke im Kreis — verbindlich.
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
              Wir starten bewusst mit einer Stadt. Erst wenn der Hamburger Kreis trägt — drei
              Schauabende, fünfzehn Werke, ehrliche Reziprozitätsbilanz — replizieren wir Berlin
              und München mit eigener Kurator:in vor Ort.
            </p>
          </div>
          <div className="city-grid">
            <article className="city-card">
              <span className="state aktiv">Aktiver Kreis</span>
              <h3>Werkzirkel Hamburg</h3>
              <p>
                Erster regionaler Kreis. Schauabende, Prüfrunden und die erste Bedarfsschau finden
                hier statt.
              </p>
            </article>
            <article className="city-card">
              <span className="state">In Vorbereitung</span>
              <h3>Werkzirkel Berlin</h3>
              <p>Aktiv, sobald Hamburg trägt — mit eigener Kurator:in, nicht ferngesteuert.</p>
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
            <h3>Für Menschen mit konkretem Produktinteresse.</h3>
            <ul>
              <li>unabhängige Entwickler:innen und App-Macher:innen</li>
              <li>SaaS-Macher:innen und Solo-Macher:innen</li>
              <li>Freischaffende mit eigenen digitalen Produkten</li>
              <li>No-Code-/Low-Code-Macher:innen mit echtem Vorhaben</li>
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
            <p className="eyebrow">Hamburger Kreis</p>
            <h2>Werkpass vormerken.</h2>
            <p>
              Du baust ein digitales Werk in Hamburg und willst es testen lassen, weiterentwickeln
              und in der Stadt sichtbar werden? Trag dich für den frühen Zugang ein. Der erste
              Schauabend wird per E-Mail angekündigt.
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

      <footer className="site-footer">
        <div className="wrap footer-inner">
          <span>Werkzirkel — Gemeinsam digitale Produkte bauen.</span>
          <div className="footer-links" aria-label="Fußnavigation">
            <Link href="/">Macher:innen</Link>
            <Link href="/bedarf">Bedarf</Link>
            <Link href="/foerdern">Fördern</Link>
            <a className="muted-link" href="#" aria-disabled="true" title="folgt zum Plattform-Start">
              Regeln
            </a>
            <a className="muted-link" href="#" aria-disabled="true" title="folgt zum Plattform-Start">
              Impressum
            </a>
            <a className="muted-link" href="#" aria-disabled="true" title="folgt zum Plattform-Start">
              Datenschutz
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
