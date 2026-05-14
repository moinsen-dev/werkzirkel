/**
 * /impressum — Pflicht-Angaben nach § 5 TMG und § 18 Abs. 2 MStV.
 *
 * Quelle: PRD §40 Rechtliche Seiten. Entwurfsfassung — anwaltliche Pruefung
 * ist externe User-Aufgabe (siehe open-question 'external-anwaltliche-pruefung').
 *
 * Server Component, rein statisch.
 */

import type { Metadata } from 'next';

import SiteFooter from '@/components/ui/site-footer';
import SiteNav from '@/components/ui/site-nav';

export const metadata: Metadata = {
  title: 'Impressum',
  description:
    'Impressum und Anbieterkennzeichnung der Werkzirkel-Plattform nach § 5 TMG und § 18 Abs. 2 MStV.',
};

export default function ImpressumPage() {
  return (
    <div className="page-shell">
      <SiteNav />
      <main className="legal-page">
        <div className="wrap">
          <p className="legal-eyebrow">Rechtliches</p>
          <h1>Impressum</h1>
          <p className="legal-meta">
            Angaben gemäß § 5 TMG sowie verantwortliche:r Anbieter:in nach § 18 Abs. 2 MStV.
          </p>

          <h2>Diensteanbieter</h2>
          <p>
            Moinsen
            <br />
            Ulrich Diedrichsen
            <br />
            Hamburg, Deutschland
          </p>
          <p>
            Die genaue Postanschrift wird auf schriftliche Anfrage mitgeteilt; sie liegt für die
            Zwecke der Diensteanbieter-Kennzeichnung den zuständigen Behörden vor.
          </p>

          <h2>Kontakt</h2>
          <p>
            E-Mail:{' '}
            <a href="mailto:developer@moinsen.dev">developer@moinsen.dev</a>
          </p>

          <h2>Umsatzsteuer-Identifikationsnummer</h2>
          <p>
            Eine Umsatzsteuer-Identifikationsnummer nach § 27a UStG wird ergänzt, sobald sie
            erteilt ist. Bis dahin: nicht vorhanden / Kleinunternehmer-Regelung nach § 19 UStG
            (Platzhalter — anwaltlich zu prüfen).
          </p>

          <h2>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2>
          <p>
            Ulrich Diedrichsen
            <br />
            Hamburg, Deutschland
            <br />
            E-Mail: <a href="mailto:developer@moinsen.dev">developer@moinsen.dev</a>
          </p>

          <h2>Streitschlichtung</h2>
          <p>
            Hinweise zur Verbraucherstreitbeilegung finden sich auf der Seite{' '}
            <a href="/streitschlichtung">Streitschlichtung</a>.
          </p>

          <h2>Haftung für Inhalte</h2>
          <p>
            Werkzirkel ist eine Plattform für nutzergenerierte Inhalte (Werkpässe, Werke, Bedarfe,
            Förderprofile, Hilfegesuche). Für eigene Inhalte sind wir nach den allgemeinen
            Gesetzen verantwortlich. Für nutzergenerierte Inhalte gelten die §§ 7 ff. TMG sowie
            die einschlägigen Regelungen des Digital Services Act. Werkzirkel ist nicht
            verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen
            oder nach Umständen zu forschen, die auf eine rechtswidrige Tätigkeit hinweisen.
          </p>

          <h2>Haftung für Links</h2>
          <p>
            Auf Werkzirkel verlinkte externe Webseiten unterliegen ausschließlich der Verantwortung
            der jeweiligen Betreiber:innen. Zum Zeitpunkt der Verlinkung waren keine rechtswidrigen
            Inhalte erkennbar. Eine permanente inhaltliche Kontrolle ist ohne konkreten Anlass auf
            Rechtsverstöße nicht zumutbar.
          </p>

          <h2>Urheberrecht</h2>
          <p>
            Inhalte der Plattform unterliegen dem deutschen Urheberrecht. Nutzergenerierte Inhalte
            verbleiben beim jeweiligen Urheber bzw. der jeweiligen Urheberin. Mit dem Einstellen
            räumen Nutzer:innen Werkzirkel das einfache, nicht-ausschließliche Nutzungsrecht zur
            Anzeige im Rahmen des Plattform-Betriebs ein.
          </p>

          <p className="legal-note">
            Dieses Impressum ist ein anwaltlich noch nicht freigegebener Entwurf. Die finale
            Fassung wird vor dem öffentlichen Launch durch eine:n Anwält:in für Medien-/
            Plattformrecht geprüft.
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
