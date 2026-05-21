/**
 * /agb — Allgemeine Geschaeftsbedingungen.
 *
 * Quelle: PRD §40 + §11A Build-Kultur-Schutz. Kern-Aussagen:
 *  - KEINE Provision
 *  - KEINE Vermittlung
 *  - KEINE Equity-Vermittlung ueber die Plattform
 *  - deutsches Recht, Gerichtsstand Hamburg
 *
 * Entwurfsfassung — anwaltliche Pruefung extern.
 *
 * Server Component.
 */

import type { Metadata } from 'next';

import SiteFooter from '@/components/ui/site-footer';
import SiteNav from '@/components/ui/site-nav';

export const metadata: Metadata = {
  title: 'AGB',
  description:
    'Allgemeine Geschäftsbedingungen der Werkzirkel-Plattform: Build-Kultur statt Marktplatz, keine Provision, keine Vermittlung, keine Equity über die Plattform.',
};

export default function AgbPage() {
  return (
    <div className="page-shell">
      <SiteNav />
      <main className="legal-page">
        <div className="wrap">
          <p className="legal-eyebrow">Rechtliches</p>
          <h1>Allgemeine Geschäftsbedingungen</h1>
          <p className="legal-meta">
            Geltend für die Nutzung der Werkzirkel-Plattform. Stand: Entwurf vor Public-Launch.
          </p>

          <h2>§ 1 Geltungsbereich</h2>
          <p>
            Diese AGB gelten zwischen der/dem Diensteanbieter:in (siehe{' '}
            <a href="/impressum">Impressum</a>) und allen natürlichen oder juristischen Personen,
            die einen Werkzirkel-Account anlegen oder die Plattform aktiv nutzen
            („Nutzer:innen“). Abweichende Bedingungen der Nutzer:innen werden nicht anerkannt,
            es sei denn, der/die Diensteanbieter:in stimmt ihrer Geltung ausdrücklich zu.
          </p>

          <h2>§ 2 Selbstverständnis der Plattform</h2>
          <p>
            Werkzirkel ist eine kuratierte Werkstatt-Plattform für lokale digitale Arbeit. Sie ist
            <strong>kein Marktplatz</strong>, <strong>kein Freelancer-Portal</strong> und{' '}
            <strong>keine Vermittlungsagentur</strong>. Werkzirkel:
          </p>
          <ul>
            <li>
              <strong>nimmt keine Provision</strong> auf Aufträge, Werkangebote,
              Membership-Beiträge oder daraus entstehende Geschäftsbeziehungen,
            </li>
            <li>
              <strong>vermittelt nicht</strong> im rechtlichen Sinne zwischen Auftraggeber:innen
              und Builder:innen — Werkzirkel stellt nur die Bühne (Demo Nights, Builder-Profile,
              Briefing Nights) bereit; Vertragsschlüsse erfolgen offline und außerhalb der
              Plattform,
            </li>
            <li>
              <strong>vermittelt keine Beteiligungen, Equity, Anteile oder
              Investorenverhältnisse</strong> über die Plattform. Sponsor-Profile sind sichtbar
              gemacht; jede Form von Investment/Beteiligung wird ausschließlich offline und in
              eigener Verantwortung der Beteiligten verhandelt.
            </li>
          </ul>

          <h2>§ 3 Vertragsschluss / Registrierung</h2>
          <p>
            Mit der Registrierung über einen Magic-Link-Login kommt zwischen Nutzer:in und
            Werkzirkel ein Nutzungsvertrag zustande. Voraussetzung ist Volljährigkeit
            (mindestens 18 Jahre), eine gültige E-Mail-Adresse und die Zustimmung zu diesen AGB
            sowie zur <a href="/datenschutz">Datenschutzerklärung</a>.
          </p>

          <h2>§ 4 Pflichten der Nutzer:innen</h2>
          <ul>
            <li>Wahrheitsgemäße Angaben in Builder-Profil, Werken, Bedarfen und Sponsor-Profilen.</li>
            <li>
              Einhaltung der <a href="/regeln">Werkstatt-Regeln</a> (insbesondere: kein Cold-
              Outreach, keine unaufgeforderten DMs an die Nachfrage-Seite, keine
              Pitch-Wettbewerbs-Mentalität).
            </li>
            <li>
              Keine Veröffentlichung rechtswidriger, beleidigender, diskriminierender,
              irreführender oder urheberrechtlich geschützter Inhalte ohne Berechtigung.
            </li>
            <li>Keine automatisierten Anfragen oder Scraping ohne ausdrückliche Zustimmung.</li>
            <li>Sorgfältige Verwahrung des eigenen E-Mail-Zugangs (Magic-Link-Anmeldung).</li>
          </ul>

          <h2>§ 5 Kein Provisions-/Erfolgsbeitrags-Anspruch der Plattform</h2>
          <p>
            Aus über die Plattform sichtbar gemachten Kontakten entsteht{' '}
            <strong>kein Provisions- oder Vergütungsanspruch</strong> gegenüber Werkzirkel.
            Optional angebotene freiwillige Erfolgsbeiträge sind explizit als freiwillige Spende
            zur Plattform-Erhaltung ausgestaltet und niemals Voraussetzung für die Nutzung.
          </p>

          <h2>§ 6 Förder-Mitgliedschaft</h2>
          <p>
            Die Förder-Mitgliedschaft ist ein freiwilliges, monatlich kündbares Abonnement zur
            Unterstützung der Plattform und zur Verifizierung als Sponsor:in (Anwesenheit bei
            mindestens einer Briefing Night pro Quartal). Abrechnung über Stripe; Widerrufsrecht
            für Verbraucher:innen gemäß § 8 dieser AGB.
          </p>

          <h2>§ 7 Haftungsausschluss für Inhalte Dritter</h2>
          <p>
            Werkzirkel haftet nicht für die Inhalte, die Nutzer:innen einstellen (Werke,
            Builder-Profile, Bedarfe, Sponsor-Profile, Hilfegesuche, Feedback). Wir prüfen Inhalte nicht
            anlasslos. Werden uns rechtswidrige Inhalte bekannt, entfernen wir diese unverzüglich
            (Notice-and-Action gemäß DSA). Meldungen über den Melden-Button oder per E-Mail an
            den Impressum-Kontakt.
          </p>

          <h2>§ 8 Widerrufsrecht (Verbraucher:innen)</h2>
          <p>
            Verbraucher:innen haben bei kostenpflichtigen Verträgen (Förder-Mitgliedschaft) ein
            14-tägiges Widerrufsrecht ohne Begründung. Die Widerrufsfrist beginnt mit dem Tag
            des Vertragsschlusses. Widerruf per E-Mail an{' '}
            <a href="mailto:developer@moinsen.dev">developer@moinsen.dev</a>. Eine Muster-
            Widerrufsbelehrung wird auf Anfrage zugesendet.
          </p>

          <h2>§ 9 Kündigung und Konto-Löschung</h2>
          <p>
            Der Nutzungsvertrag ist jederzeit kündbar — Konto-Löschung über{' '}
            <a href="/einstellungen">Einstellungen</a>. Die Plattform behält sich vor, Konten bei
            schweren Regelverstößen (z.B. systematischem Cold-Outreach, mehrfacher Bedarfs-
            Verfälschung, beleidigendem Verhalten gegenüber City-Leads) mit Frist von 14 Tagen
            zu kündigen; in besonders schweren Fällen (Strafrecht, akute Gefährdung) auch
            fristlos.
          </p>

          <h2>§ 10 Haftung der Plattform</h2>
          <p>
            Werkzirkel haftet unbeschränkt nur bei Vorsatz und grober Fahrlässigkeit sowie bei
            Verletzung von Leben, Körper und Gesundheit. Bei einfacher Fahrlässigkeit haften wir
            nur bei Verletzung wesentlicher Vertragspflichten (Kardinalpflichten) und nur in Höhe
            des vorhersehbaren, vertragstypischen Schadens. Die Haftung nach dem
            Produkthaftungsgesetz bleibt unberührt.
          </p>

          <h2>§ 11 Salvatorische Klausel</h2>
          <p>
            Sollten einzelne Bestimmungen dieser AGB ganz oder teilweise unwirksam sein oder
            werden, bleibt die Wirksamkeit der übrigen Bestimmungen unberührt.
          </p>

          <h2>§ 12 Anwendbares Recht und Gerichtsstand</h2>
          <p>
            Es gilt ausschließlich deutsches Recht unter Ausschluss des UN-Kaufrechts.
            Ausschließlicher Gerichtsstand für alle Streitigkeiten aus oder im Zusammenhang mit
            diesem Vertrag ist <strong>Hamburg</strong>, soweit die Nutzer:in Kaufperson,
            juristische Person des öffentlichen Rechts oder öffentlich-rechtliches
            Sondervermögen ist oder keinen allgemeinen Gerichtsstand im Inland hat.
          </p>

          <p className="legal-note">
            Diese AGB sind ein anwaltlich noch nicht freigegebener Entwurf. Insbesondere die
            Abgrenzung „Plattform stellt nur Bühne / keine Vermittlung“ im Sinne des Digital
            Services Act wird vor dem öffentlichen Launch durch eine:n Plattformrecht-Anwält:in
            geprüft.
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
