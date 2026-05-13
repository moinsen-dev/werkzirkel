import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Bedarf einbringen',
  description:
    'Du hast ein konkretes digitales Problem in Hamburg? Bring deinen Bedarf in den Werkzirkel — Werkstattbeitrag statt Ausschreibung, kein Pitch-Wettbewerb, kein Marktplatz.',
};

export default function BedarfLandingpage() {
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
            <Link href="/">Macher:innen</Link>
            <Link href="/bedarf" aria-current="page">
              Bedarf einbringen
            </Link>
            <Link href="/foerdern">Werke fördern</Link>
            <a href="#ablauf">Ablauf</a>
            <a href="#schutz">Schutz</a>
          </div>
          <a className="nav-cta" href="#zugang">
            Bedarf vormerken
          </a>
        </div>
      </nav>

      <header className="hero" id="top">
        <div className="wrap hero-grid single">
          <div>
            <p className="eyebrow">Bedarfsträger:innen · Hamburg</p>
            <h1>Dein digitales Problem trifft lokale Macher:innen.</h1>
            <p className="hero-copy">
              Werkzirkel ist kein Freelancer-Marktplatz und keine Ausschreibungsplattform. Es ist
              eine Werkstatt mit kuratierter Sichtbarkeit. Du bringst dein Problem persönlich in
              den Kreis — Hamburger Macher:innen antworten mit Werkangeboten, verhandelt wird
              offline.
            </p>
            <div className="hero-actions">
              <a className="button primary" href="#zugang">
                Bedarf vormerken
              </a>
              <a className="button secondary" href="#ablauf">
                So funktioniert das
              </a>
            </div>
          </div>
        </div>
      </header>

      <section className="section compact" aria-label="Drei Wege in den Kreis">
        <div className="wrap">
          <div className="role-switcher">
            <Link className="role-card" href="/">
              <div>
                <p className="meta">Du baust</p>
                <h3>Werkpass anlegen</h3>
                <p>
                  Eigene digitale Produkte zeigen, testen lassen, weiterentwickeln. Auf
                  Schauabenden vorstellen.
                </p>
              </div>
              <span className="arrow">Zur Macher:innen-Seite →</span>
            </Link>
            <article className="role-card" aria-current="page">
              <div>
                <p className="meta">Du brauchst</p>
                <h3>Bedarf einbringen</h3>
                <p>
                  Ein konkretes digitales Problem aus deiner Organisation in den Hamburger Kreis
                  stellen — mit Werkstattbeitrag, ohne Pitch-Wettbewerb.
                </p>
              </div>
              <span className="arrow">Du bist hier →</span>
            </article>
            <Link className="role-card" href="/foerdern">
              <div>
                <p className="meta">Du förderst</p>
                <h3>Werke fördern</h3>
                <p>
                  Förderprofil anlegen, verifizieren lassen, in einer Bedarfsschau persönlich
                  sichtbar werden.
                </p>
              </div>
              <span className="arrow">Zur Förderseite →</span>
            </Link>
          </div>
        </div>
      </section>

      <section className="section compact" aria-label="Beispiele">
        <div className="wrap">
          <div className="section-head">
            <h2>Für wen das gedacht ist.</h2>
            <p>
              Werkzirkel funktioniert für Hamburger Bedarfsträger:innen mit echtem, abgrenzbarem
              digitalen Bedarf — typischerweise zwischen 500 € und 30.000 €. Lokal verankert, nicht
              anonym, bereit für Werkstatt-Kultur statt Ausschreibungsformular.
            </p>
          </div>
          <div className="example-grid">
            <article className="example-card">
              <span className="label">Dafür gebaut</span>
              <h3>Echte, abgrenzbare digitale Bedarfe.</h3>
              <ul>
                <li>Inhaber:in eines Hamburger Mittelständlers mit Digitalisierungsbedarf</li>
                <li>Verein oder Initiative mit konkretem Software-Bedarf</li>
                <li>Stiftung mit Digitalisierungs-Förderprogramm</li>
                <li>Bildungseinrichtung, Kulturhaus, Handwerksbetrieb</li>
                <li>Solo-Unternehmer:in mit konkretem Automations-/SaaS-Bedarf</li>
                <li>Produktverantwortliche aus mittelgroßer Firma mit Sonderbedarf</li>
              </ul>
            </article>
            <article className="example-card">
              <span className="label">Bewusst nicht dafür</span>
              <h3>Kein Ort für Sammel-Ausschreibungen.</h3>
              <ul>
                <li>Drive-by-Ausschreibung mit &bdquo;12 Angebote bis Donnerstag&ldquo;</li>
                <li>Stellenanzeigen für Festanstellung</li>
                <li>anonymes Auftreten oder Strohleute</li>
                <li>reine Lead-Generierung ohne ehrliche Vergabeabsicht</li>
                <li>Sales-Funnel auf Macher:innen ausgerichtet</li>
              </ul>
            </article>
          </div>
        </div>
      </section>

      <section className="section" id="ablauf">
        <div className="wrap">
          <div className="section-head">
            <h2>So funktioniert das.</h2>
            <p>
              Drei Schritte vom ersten Kontakt bis zur Vergabe. Keine Plattform-Vermittlung, keine
              Provision, kein Treuhandkonto — Werkzirkel macht sichtbar, die Verhandlung machst du
              offline.
            </p>
          </div>
          <div className="product-split">
            <div>
              <ul className="explain-list">
                <li>
                  <span className="step-number">01</span>
                  <div>
                    <strong>Werkstattbeitrag wählen</strong>
                    <p>
                      Bevor dein Bedarf öffentlich wird, leistest du einen Werkstattbeitrag — als
                      Anwesenheit auf einem Schauabend, als Geldbeitrag oder als dokumentierte
                      Sachleistung. Das schützt den Kreis vor Drive-by-Ausschreibungen.
                    </p>
                  </div>
                </li>
                <li>
                  <span className="step-number">02</span>
                  <div>
                    <strong>Bedarf strukturiert einbringen</strong>
                    <p>
                      Du beschreibst Problem, Nutzen, Größenordnung und Frist. Geldrahmen optional.
                      Die Kurator:in prüft sprachlich und auf Werkstatt-Passung, danach geht der
                      Bedarf öffentlich an die Hamburger Macher:innen.
                    </p>
                  </div>
                </li>
                <li>
                  <span className="step-number">03</span>
                  <div>
                    <strong>Werkangebote sichten, offline besprechen</strong>
                    <p>
                      Macher:innen antworten mit strukturierten Werkangeboten — bezogen auf ein
                      konkretes bestehendes Werk, nicht mit Bewerbungsmappen. Du sprichst mit ein
                      bis drei direkt, schließt offline, markierst den Bedarf als erfüllt.
                    </p>
                  </div>
                </li>
              </ul>
              <div className="callout">
                <strong>Spende statt Provision.</strong> Wird ein Bedarf erfüllt, ist ein
                freiwilliger Erfolgsbeitrag von etwa 5 % an die Werkstatt-Kasse Hamburg üblich.
                Werkzirkel stellt keine Rechnung und nimmt nichts vom Honorar der Macher:innen.
                Die Kasse ist quartalsweise öffentlich.
              </div>
            </div>

            <div className="work-card">
              <div className="frame-topbar">
                <div className="window-dots" aria-hidden="true">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
                <span>Bedarf · Werkzirkel Hamburg</span>
              </div>
              <div className="work-body">
                <span className="status-pill warm">Status: öffentlich</span>
                <h3>Schichtplanung für eine kleine Hamburger Backstube</h3>
                <p>
                  Wir suchen eine schlanke digitale Schichtplanung für vier Filialen mit wechselnden
                  Aushilfen. Tabellen reichen nicht mehr.
                </p>
                <div className="work-meta">
                  <div className="meta-box">
                    <span>Größenordnung</span>
                    <strong>4–8 Wochen, ca. 5.000–10.000 €</strong>
                  </div>
                  <div className="meta-box">
                    <span>Frist</span>
                    <strong>Werkangebote bis 30.06.</strong>
                  </div>
                  <div className="meta-box">
                    <span>Werkstattbeitrag</span>
                    <strong>Anwesend Schauabend Mai</strong>
                  </div>
                  <div className="meta-box">
                    <span>Kreis</span>
                    <strong>Hamburg</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section compact" aria-label="Werkstattbeitrag-Pfade">
        <div className="wrap">
          <div className="section-head">
            <h2>Drei Wege, den Beitrag zu leisten.</h2>
            <p>
              Der Werkstattbeitrag ist die Eintrittskarte in den Kreis — und der Schutz davor, dass
              Werkzirkel zur Ausschreibungs-Plattform mutiert. Du wählst, was zu dir passt. Eine
              Sache reicht.
            </p>
          </div>
          <div className="path-grid">
            <article className="path-card">
              <div>
                <span className="badge">Pfad A</span>
                <h3>Persönlich da sein</h3>
                <p>
                  Du kommst zu einem Hamburger Schauabend, lernst die Macher:innen kennen, lässt
                  dich von der Kurator:in vorstellen. Anwesenheit wird dokumentiert, Bedarf danach
                  freigeschaltet.
                </p>
              </div>
              <span className="amount">0 €</span>
            </article>
            <article className="path-card">
              <div>
                <span className="badge">Pfad B</span>
                <h3>Geldbeitrag</h3>
                <p>
                  Wenn dir kein Termin passt: ein einmaliger Beitrag an die Werkstatt-Kasse Hamburg.
                  Selbsteinschätzung in drei Stufen — keine Rechnung, transparente Verwendung.
                </p>
              </div>
              <span className="amount">50 / 100 / 150 €</span>
            </article>
            <article className="path-card">
              <div>
                <span className="badge">Pfad C</span>
                <h3>Sachleistung</h3>
                <p>
                  Raum-Spende für einen Schauabend, Mentor:innen-Stunde, Testnutzer-Recruiting,
                  Material — die Kurator:in trägt deine Leistung ein und gibt frei.
                </p>
              </div>
              <span className="amount">nach Absprache</span>
            </article>
          </div>
          <div className="callout">
            <strong>Gültigkeit.</strong> Ein Beitrag deckt vier Bedarfe oder sechs Monate — je
            nachdem was zuerst eintritt. Härtefälle für Vereine ohne Mittel klärt die Hamburger
            Kurator:in im Einzelgespräch.
          </div>
        </div>
      </section>

      <section className="section" id="schutz">
        <div className="wrap">
          <div className="section-head">
            <h2>Was Werkzirkel nicht zulässt.</h2>
            <p>
              Wir haben fünf Kulturverluste identifiziert, die jede gemischte Plattform bedrohen.
              Für jeden gibt es eine technische oder kulturelle Schutzregel. Wenn du das nicht
              mitträgst, bist du hier falsch.
            </p>
          </div>
          <div className="protect-band">
            <ul className="protect-list">
              <li>
                <div>
                  <strong>Keine Drive-by-Ausschreibung.</strong>
                  <p>
                    Werkstattbeitrag ist Pflicht. Wer Sammel-Angebote einholen will, findet hier
                    nicht statt.
                  </p>
                </div>
              </li>
              <li>
                <div>
                  <strong>Kein Cold-Sales auf dich.</strong>
                  <p>
                    Macher:innen können dich nicht direkt anschreiben. Kontakt entsteht nur über
                    das strukturierte Werkangebot oder bei Bedarfsschau und Schauabend persönlich.
                  </p>
                </div>
              </li>
              <li>
                <div>
                  <strong>Kein Pitch-Wettbewerb.</strong>
                  <p>
                    Werkangebote sind nicht öffentlich. Niemand sieht, wer noch eingereicht hat —
                    auch du siehst keine Bewerber-Zahl, sondern strukturierte Vorschläge.
                  </p>
                </div>
              </li>
              <li>
                <div>
                  <strong>Keine Plattform-Vermittlung.</strong>
                  <p>
                    Verträge, Zahlungen und Beteiligungen laufen ausschließlich offline zwischen
                    dir und der Macher:in. Werkzirkel kennt keinen Vertrag und keinen Cent zwischen
                    euch.
                  </p>
                </div>
              </li>
              <li>
                <div>
                  <strong>Keine Provision.</strong>
                  <p>
                    Der optionale Erfolgsbeitrag ist eine Spende an die Werkstatt-Kasse, keine
                    Vermittlungsgebühr. Macher:innen bekommen ihr Honorar in voller Höhe —
                    verhandelt mit dir.
                  </p>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className="cta-section" id="zugang">
        <div className="wrap cta-box">
          <div>
            <p className="eyebrow">Hamburger Bedarf</p>
            <h2>Bedarf vormerken.</h2>
            <p>
              Skizziere uns dein digitales Problem in zwei Sätzen. Die Hamburger Kurator:in meldet
              sich persönlich, bespricht den passenden Werkstattbeitrag-Pfad und lädt dich zur
              nächsten Bedarfsschau oder zu einem Schauabend ein.
            </p>
          </div>
          <form className="waitlist" action="#" method="post">
            <label htmlFor="mail-bedarf">E-Mail</label>
            <input
              id="mail-bedarf"
              name="mail"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="dein-name@firma.de"
              aria-label="E-Mail-Adresse"
              required
            />
            <label htmlFor="bedarf-skizze">Skizze deines Bedarfs</label>
            <textarea
              id="bedarf-skizze"
              name="skizze"
              placeholder="Zwei Sätze: Was ist das Problem? Welche Organisation?"
              aria-label="Skizze deines Bedarfs"
              required
            ></textarea>
            <button className="button primary" type="submit">
              Bedarf einreichen
            </button>
            <p className="small-note">
              Eingaben werden vertraulich behandelt und nur intern an die Hamburger Kurator:in
              weitergegeben.
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
