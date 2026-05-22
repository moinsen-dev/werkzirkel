import type { Metadata } from 'next';
import Link from 'next/link';

import SiteFooter from '@/components/ui/site-footer';

export const metadata: Metadata = {
  title: 'Builds sponsorn',
  description:
    'Du willst lokale digitale Builds fördern — als Stiftung, Angel, Wirtschaftsförderung oder Pat:in eines Coworking-Spaces? Werkzirkel macht dich im Hamburger Kreis sichtbar. Klarname, verifiziert, ohne Pitch-Theater.',
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
            <Link href="/">Builder:innen</Link>
            <Link href="/bedarf">Bedarf einbringen</Link>
            <Link href="/foerdern" aria-current="page">
              Builds sponsorn
            </Link>
            <a href="#ablauf">Ablauf</a>
            <a href="#auflagen">Auflagen</a>
          </div>
          <a className="nav-cta" href="#zugang">
            Sponsor-Profil vormerken
          </a>
        </div>
      </nav>

      <header className="hero" id="top">
        <div className="wrap hero-grid single">
          <div>
            <p className="eyebrow">Sponsor:innen · Hamburg</p>
            <h1>Lokale Builds sehen, bevor sie pitchen müssen.</h1>
            <p className="hero-copy">
              Du willst Geld, Raum, Mentoring oder Vertriebszugang an Hamburger{' '}
              <strong>Builder:innen</strong> geben — aber ohne VC-Pitch-Decks, ohne Hockey-Sticks,
              ohne Equity-Theater? Werkzirkel zeigt dir verifizierte lokale Builds mit echtem
              Stand auf einer <strong>Briefing Night</strong>. Klarname, transparentes Budget,
              keine Vermittlung über die Plattform. Du entscheidest direkt, wen du unterstützt.
            </p>
            <div className="hero-actions">
              <Link className="button primary" href="/anmelden?zweck=registrierung-foerder">
                Sponsor-Profil anlegen
              </Link>
              <Link className="button secondary" href="/werke">
                Aktive Builds ansehen
              </Link>
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
                <h3>Builder-Profil anlegen</h3>
                <p>
                  Eigene digitale Produkte zeigen, testen lassen, weiterentwickeln. Auf
                  Demo Nights vorstellen.
                </p>
              </div>
              <span className="arrow">Zur Builder:innen-Seite →</span>
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
                <h3>Builds sponsorn</h3>
                <p>
                  Sponsor-Profil anlegen, vom City-Lead verifizieren lassen, in einer
                  Briefing Night persönlich sichtbar werden.
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
              Werkzirkel ist eine Sichtbarkeitsbühne für lokale Sponsor:innen mit Klarnamen und
              transparentem Sponsor-Budget. Anonyme Mittel, undurchsichtige Strohleute oder
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
                <li>nicht-lokale Sponsor:innen ohne DACH-Bezug</li>
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
                    <strong>Sponsor-Profil anlegen</strong>
                    <p>
                      Klarname, Organisation, Sponsor-Art (Geld, Raum, Mentoring, Sachmittel,
                      Vertriebszugang), Sponsor-Budget pro Jahr und je Einzelförderung, bevorzugte
                      Werke, Gegenleistung. Initial nicht öffentlich.
                    </p>
                  </div>
                </li>
                <li>
                  <span className="step-number">02</span>
                  <div>
                    <strong>City-Leads-Verifikation</strong>
                    <p>
                      Die Hamburger City-Lead prüft Klarname, Organisation und Mittelplausibilität
                      (Handels-, Vereins- oder Stiftungsregister, bei Privatpersonen
                      Personalausweis), führt ein Vorstellungsgespräch und stimmt deinen ersten
                      Briefing Night-Termin ab.
                    </p>
                  </div>
                </li>
                <li>
                  <span className="step-number">03</span>
                  <div>
                    <strong>Persönlich auf der Briefing Night</strong>
                    <p>
                      Du stellst dich und deinen Sponsor-Budget in 7–10 Minuten persönlich vor. Danach
                      ist dein Profil im Kreis öffentlich. Builder:innen sehen, wofür Mittel
                      verfügbar sind, ohne Pitches schreiben zu müssen — du sprichst aktiv an, wen
                      du fördern willst.
                    </p>
                  </div>
                </li>
              </ul>
              <div className="callout">
                <strong>Aktivitätspflicht.</strong> Verifizierte Sponsor-Profile bleiben öffentlich,
                solange du mindestens einmal pro Quartal persönlich an einer Briefing Night
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
                <span>Sponsor-Profil · Werkzirkel Hamburg</span>
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
                    <span>Sponsor-Art</span>
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
                    <span>Letzte Briefing Night</span>
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
            <h2>Auflagen für Sponsor:innen.</h2>
            <p>
              Damit Förderkapital im Kreis Vertrauen statt Schieflage erzeugt, hat die
              Sponsor:innen-Rolle eigene Pflichten. Diese sind nicht verhandelbar — sie sind der
              Grund, warum Builder:innen Sponsor-Profile ernst nehmen.
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
                  <strong>Transparenter Sponsor-Budget.</strong>
                  <p>
                    Förderhöhe pro Jahr und je Einzelförderung sind im Profil sichtbar — als
                    Bandbreite, nicht cent-genau. Builder:innen sollen abschätzen können, ob es
                    passt.
                  </p>
                </div>
              </li>
              <li>
                <div>
                  <strong>Persönliche Anwesenheit.</strong>
                  <p>
                    Mindestens einmal pro Quartal eine Briefing Night persönlich besuchen — sonst
                    pausiert das Profil automatisch. Sichtbarkeit gibt es nicht ohne Anwesenheit.
                  </p>
                </div>
              </li>
              <li>
                <div>
                  <strong>Keine Equity-Vermittlung.</strong>
                  <p>
                    Sponsor-Profile dürfen &bdquo;Equity&ldquo; als Gegenleistung markieren — aber Werkzirkel
                    vermittelt keine Beteiligungen. Verhandlungen laufen ausschließlich offline und
                    sind nicht Gegenstand der Plattform.
                  </p>
                </div>
              </li>
              <li>
                <div>
                  <strong>Kein Cold-Sales auf Builder:innen.</strong>
                  <p>
                    Ansprache erfolgt über die öffentlichen Builder-Profile — direkt, kollegial, nicht als
                    Vertriebs-Outreach. Beschwerden über kalten Outreach gehen an die City-Lead.
                  </p>
                </div>
              </li>
              <li>
                <div>
                  <strong>Beitrag zur Build-Kultur.</strong>
                  <p>
                    Förder-Mitgliedschaft (240 €/Jahr Privat &amp; Stiftung, 1.200 €/Jahr
                    Organisation) ist üblich — Beitrag zum Kreis, nicht Eintrittsticket. Härtefälle
                    klärt die City-Lead.
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
            <h2>Sponsor-Profil vormerken.</h2>
            <p>
              Skizziere uns Organisation und Sponsor-Budget in wenigen Sätzen. Die Hamburger
              City-Lead meldet sich persönlich für ein Vorgespräch und stimmt einen ersten
              Briefing Night-Termin mit dir ab — bevor dein Profil öffentlich wird.
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
            <label htmlFor="foerder-skizze">Organisation und Sponsor-Budget</label>
            <textarea
              id="foerder-skizze"
              name="skizze"
              placeholder="Wer fördert? Welche Sponsor-Art? Welche Größenordnung?"
              aria-label="Organisation und Sponsor-Budget"
              required
            ></textarea>
            <button className="button primary" type="submit">
              Profil vormerken
            </button>
            <p className="small-note">
              Eingaben werden vertraulich behandelt und nur intern an die Hamburger City-Lead
              weitergegeben.
            </p>
          </form>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
