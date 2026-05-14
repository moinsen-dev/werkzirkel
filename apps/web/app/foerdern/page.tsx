import type { Metadata } from 'next';
import Link from 'next/link';

import SiteFooter from '@/components/ui/site-footer';

export const metadata: Metadata = {
  title: 'Werke fördern',
  description:
    'Du willst lokale digitale Werke fördern — als Stiftung, Angel, Wirtschaftsförderung oder Pat:in eines Coworking-Spaces? Werkzirkel macht dich im Hamburger Kreis sichtbar. Klarname, verifiziert, ohne Pitch-Theater.',
};

export default function FoerdernLandingpage() {
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
            <Link href="/bedarf">Bedarf einbringen</Link>
            <Link href="/foerdern" aria-current="page">
              Werke fördern
            </Link>
            <a href="#ablauf">Ablauf</a>
            <a href="#auflagen">Auflagen</a>
          </div>
          <a className="nav-cta" href="#zugang">
            Förderprofil vormerken
          </a>
        </div>
      </nav>

      <header className="hero" id="top">
        <div className="wrap hero-grid single">
          <div>
            <p className="eyebrow">Förder:innen · Hamburg</p>
            <h1>Lokale Werke fördern — ohne Pitch-Theater.</h1>
            <p className="hero-copy">
              Du willst Geld, Raum, Mentoring oder Vertriebszugang an unabhängige Hamburger
              Macher:innen geben? Werkzirkel macht dich im Kreis sichtbar — mit verifiziertem
              Förderprofil, transparentem Förderrahmen und persönlicher Vorstellung auf der
              Bedarfsschau. Keine Bewerbungs-Berge, keine Equity-Vermittlung über die Plattform.
            </p>
            <div className="hero-actions">
              <a className="button primary" href="#zugang">
                Förderprofil vormerken
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
            <Link className="role-card" href="/bedarf">
              <div>
                <p className="meta">Du brauchst</p>
                <h3>Bedarf einbringen</h3>
                <p>
                  Ein konkretes digitales Problem aus deiner Organisation in den Hamburger Kreis
                  stellen.
                </p>
              </div>
              <span className="arrow">Zur Bedarfsseite →</span>
            </Link>
            <article className="role-card" aria-current="page">
              <div>
                <p className="meta">Du förderst</p>
                <h3>Werke fördern</h3>
                <p>
                  Förderprofil anlegen, von der Kurator:in verifizieren lassen, in einer
                  Bedarfsschau persönlich sichtbar werden.
                </p>
              </div>
              <span className="arrow">Du bist hier →</span>
            </article>
          </div>
        </div>
      </section>

      <section className="section compact" aria-label="Beispiele">
        <div className="wrap">
          <div className="section-head">
            <h2>Wer hier richtig ist.</h2>
            <p>
              Werkzirkel ist eine Sichtbarkeitsbühne für lokale Förder:innen mit Klarnamen und
              transparentem Förderrahmen. Anonyme Mittel, undurchsichtige Strohleute oder
              Equity-Vermittlung über die Plattform sind ausgeschlossen.
            </p>
          </div>
          <div className="example-grid">
            <article className="example-card">
              <span className="label">Dafür gebaut</span>
              <h3>Lokal verankert, nicht anonym.</h3>
              <ul>
                <li>
                  Stiftungen mit Digitalisierungs-, Bildungs- oder Kulturbezug (z.B. Hamburgische
                  Kulturstiftung, ZEIT-Stiftung)
                </li>
                <li>
                  Hamburgische Investitions- und Förderbank (IFB), Hamburg Kreativ Gesellschaft
                </li>
                <li>Business-Angels mit klarem regionalen Bezug</li>
                <li>Coworking-Spaces mit Patenschafts-Modell (Raum + Sichtbarkeit)</li>
                <li>Lokale Tech-Unternehmen mit Mentor:innen-Budget</li>
                <li>Privatpersonen mit Mäzen:innen-Interesse (z.B. ehemalige Gründer:innen)</li>
              </ul>
            </article>
            <article className="example-card">
              <span className="label">Bewusst nicht dafür</span>
              <h3>Kein Ort für anonymes Kapital.</h3>
              <ul>
                <li>anonyme Mittelträger:innen oder Strohleute</li>
                <li>VC-Pitch-Funnel mit Equity-Forderungen über die Plattform</li>
                <li>Crowdfunding- oder Crowdinvesting-Aggregatoren</li>
                <li>Krypto-/Token-Förderung</li>
                <li>nicht-lokale Förder:innen ohne DACH-Bezug</li>
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
              Drei Schritte vom ersten Profil bis zur ersten Förderung. Keine Pitch-Decks, keine
              Bewerber-Berge — du wählst aktiv aus, wen du ansprichst.
            </p>
          </div>
          <div className="product-split">
            <div>
              <ul className="explain-list">
                <li>
                  <span className="step-number">01</span>
                  <div>
                    <strong>Förderprofil anlegen</strong>
                    <p>
                      Klarname, Organisation, Förderart (Geld, Raum, Mentoring, Sachmittel,
                      Vertriebszugang), Förderrahmen pro Jahr und je Einzelförderung, bevorzugte
                      Werke, Gegenleistung. Initial nicht öffentlich.
                    </p>
                  </div>
                </li>
                <li>
                  <span className="step-number">02</span>
                  <div>
                    <strong>Kurator:innen-Verifikation</strong>
                    <p>
                      Die Hamburger Kurator:in prüft Klarname, Organisation und Mittelplausibilität
                      (Handels-, Vereins- oder Stiftungsregister, bei Privatpersonen
                      Personalausweis), führt ein Vorstellungsgespräch und stimmt deinen ersten
                      Bedarfsschau-Termin ab.
                    </p>
                  </div>
                </li>
                <li>
                  <span className="step-number">03</span>
                  <div>
                    <strong>Persönlich auf der Bedarfsschau</strong>
                    <p>
                      Du stellst dich und deinen Förderrahmen in 7–10 Minuten persönlich vor. Danach
                      ist dein Profil im Kreis öffentlich. Macher:innen sehen, wofür Mittel
                      verfügbar sind, ohne Pitches schreiben zu müssen — du sprichst aktiv an, wen
                      du fördern willst.
                    </p>
                  </div>
                </li>
              </ul>
              <div className="callout">
                <strong>Aktivitätspflicht.</strong> Verifizierte Förderprofile bleiben öffentlich,
                solange du mindestens einmal pro Quartal persönlich an einer Bedarfsschau
                teilnimmst. Versäumst du das vier Quartale lang, pausiert dein Profil automatisch
                — und kann mit der nächsten Teilnahme reaktiviert werden.
              </div>
            </div>

            <div className="work-card">
              <div className="frame-topbar">
                <div className="window-dots" aria-hidden="true">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
                <span>Förderprofil · Werkzirkel Hamburg</span>
              </div>
              <div className="work-body">
                <span className="status-pill warm">Status: verifiziert</span>
                <h3>Stiftung für digitale Bildung Hamburg</h3>
                <p>
                  Wir fördern unabhängige Hamburger Werke mit Bildungsbezug — kleine SaaS-Tools,
                  Lernanwendungen, Open-Source-Werkzeuge. Bewusst klein, bewusst lokal.
                </p>
                <div className="work-meta">
                  <div className="meta-box">
                    <span>Förderart</span>
                    <strong>Geld &amp; Mentoring</strong>
                  </div>
                  <div className="meta-box">
                    <span>Rahmen je Werk</span>
                    <strong>bis 8.000 €</strong>
                  </div>
                  <div className="meta-box">
                    <span>Gegenleistung</span>
                    <strong>Sichtbarkeit, kein Equity</strong>
                  </div>
                  <div className="meta-box">
                    <span>Letzte Bedarfsschau</span>
                    <strong>April 2026</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section compact" id="auflagen" aria-label="Auflagen">
        <div className="wrap">
          <div className="section-head">
            <h2>Auflagen für Förder:innen.</h2>
            <p>
              Damit Förderkapital im Kreis Vertrauen statt Schieflage erzeugt, hat die
              Förder:innen-Rolle eigene Pflichten. Diese sind nicht verhandelbar — sie sind der
              Grund, warum Macher:innen Förderprofile ernst nehmen.
            </p>
          </div>
          <div className="protect-band">
            <ul className="protect-list">
              <li>
                <div>
                  <strong>Klarname statt Pseudonym.</strong>
                  <p>
                    Person oder Organisation muss benennbar sein — über Handels-, Vereins- oder
                    Stiftungsregister verifizierbar. Privatpersonen mit Personalausweis.
                  </p>
                </div>
              </li>
              <li>
                <div>
                  <strong>Transparenter Förderrahmen.</strong>
                  <p>
                    Förderhöhe pro Jahr und je Einzelförderung sind im Profil sichtbar — als
                    Bandbreite, nicht cent-genau. Macher:innen sollen abschätzen können, ob es
                    passt.
                  </p>
                </div>
              </li>
              <li>
                <div>
                  <strong>Persönliche Anwesenheit.</strong>
                  <p>
                    Mindestens einmal pro Quartal eine Bedarfsschau persönlich besuchen — sonst
                    pausiert das Profil automatisch. Sichtbarkeit gibt es nicht ohne Anwesenheit.
                  </p>
                </div>
              </li>
              <li>
                <div>
                  <strong>Keine Equity-Vermittlung.</strong>
                  <p>
                    Förderprofile dürfen &bdquo;Equity&ldquo; als Gegenleistung markieren — aber Werkzirkel
                    vermittelt keine Beteiligungen. Verhandlungen laufen ausschließlich offline und
                    sind nicht Gegenstand der Plattform.
                  </p>
                </div>
              </li>
              <li>
                <div>
                  <strong>Kein Cold-Sales auf Macher:innen.</strong>
                  <p>
                    Ansprache erfolgt über die öffentlichen Werkpässe — direkt, kollegial, nicht als
                    Vertriebs-Outreach. Beschwerden über kalten Outreach gehen an die Kurator:in.
                  </p>
                </div>
              </li>
              <li>
                <div>
                  <strong>Beitrag zur Werkstatt-Kultur.</strong>
                  <p>
                    Förder-Mitgliedschaft (240 €/Jahr Privat &amp; Stiftung, 1.200 €/Jahr
                    Organisation) ist üblich — Beitrag zum Kreis, nicht Eintrittsticket. Härtefälle
                    klärt die Kurator:in.
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
            <p className="eyebrow">Hamburger Förderkreis</p>
            <h2>Förderprofil vormerken.</h2>
            <p>
              Skizziere uns Organisation und Förderrahmen in wenigen Sätzen. Die Hamburger
              Kurator:in meldet sich persönlich für ein Vorgespräch und stimmt einen ersten
              Bedarfsschau-Termin mit dir ab — bevor dein Profil öffentlich wird.
            </p>
          </div>
          <form className="waitlist" action="#" method="post">
            <label htmlFor="mail-foerder">E-Mail</label>
            <input
              id="mail-foerder"
              name="mail"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="dein-name@organisation.de"
              aria-label="E-Mail-Adresse"
              required
            />
            <label htmlFor="foerder-skizze">Organisation und Förderrahmen</label>
            <textarea
              id="foerder-skizze"
              name="skizze"
              placeholder="Wer fördert? Welche Förderart? Welche Größenordnung?"
              aria-label="Organisation und Förderrahmen"
              required
            ></textarea>
            <button className="button primary" type="submit">
              Profil vormerken
            </button>
            <p className="small-note">
              Eingaben werden vertraulich behandelt und nur intern an die Hamburger Kurator:in
              weitergegeben.
            </p>
          </form>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
