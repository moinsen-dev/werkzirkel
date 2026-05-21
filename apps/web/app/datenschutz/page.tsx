/**
 * /datenschutz — Datenschutzerklaerung nach Art. 13 DSGVO.
 *
 * Quelle: PRD §40 Rechtliche Seiten + §41 Datenverarbeitungsverzeichnis.
 * Enthaelt Verarbeitungen pro Zweck mit Rechtsgrundlage, AVV-Liste,
 * Speicherdauern und Betroffenenrechte-Self-Service-Links.
 *
 * Entwurfsfassung — anwaltliche Pruefung extern.
 *
 * Server Component.
 */

import type { Metadata } from 'next';

import SiteFooter from '@/components/ui/site-footer';
import SiteNav from '@/components/ui/site-nav';

export const metadata: Metadata = {
  title: 'Datenschutz',
  description:
    'Datenschutzerklärung der Werkzirkel-Plattform: welche Daten wir für welche Zwecke verarbeiten, auf welcher Rechtsgrundlage, mit welchen Auftragsverarbeitern und wie lange.',
};

export default function DatenschutzPage() {
  return (
    <div className="page-shell">
      <SiteNav />
      <main className="legal-page">
        <div className="wrap">
          <p className="legal-eyebrow">Rechtliches</p>
          <h1>Datenschutzerklärung</h1>
          <p className="legal-meta">
            Informationen nach Art. 13, 14 DSGVO. Stand: Entwurf vor Public-Launch.
          </p>

          <h2>1. Verantwortliche:r</h2>
          <p>
            Moinsen / Ulrich Diedrichsen, Hamburg, Deutschland. Kontakt:{' '}
            <a href="mailto:developer@moinsen.dev">developer@moinsen.dev</a>. Postanschrift siehe{' '}
            <a href="/impressum">Impressum</a>.
          </p>
          <p>
            Eine:n Datenschutzbeauftragte:n bestellen wir gemäß Art. 37 DSGVO, sobald die
            gesetzlichen Schwellen erreicht sind. Anfragen zum Datenschutz richten Sie bitte an
            obige E-Mail.
          </p>

          <h2>2. Verarbeitungen pro Zweck</h2>

          <h3>2.1 Konto und Anmeldung</h3>
          <ul>
            <li>
              <strong>Daten:</strong> E-Mail, Klarname, Anzeigename, Stadt-Zuordnung,
              Magic-Link-Token, Session-IDs, Login-Zeitstempel, gekürzte IP-Adresse für
              Rate-Limiting.
            </li>
            <li>
              <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung —
              Plattform-Zugang) und Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an
              Missbrauchsschutz beim Rate-Limiting).
            </li>
            <li>
              <strong>Speicherdauer:</strong> bis Konto-Löschung, Magic-Link-Token nach 15
              Minuten oder Verbrauch, IP nach 7 Tagen gekürzt-anonymisiert.
            </li>
          </ul>

          <h3>2.2 Werke, Builder-Profil, Feedback-Loops</h3>
          <ul>
            <li>
              <strong>Daten:</strong> Werk-Beschreibungen, Screenshots, Fähigkeiten, öffentliche
              Builder-Profil-Inhalte, Tester-Feedback.
            </li>
            <li>
              <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung).
            </li>
            <li>
              <strong>Speicherdauer:</strong> bis zur Löschung durch Nutzer:in (sofortige
              Entfernung aus öffentlicher Anzeige; Backups werden im üblichen Backup-Zyklus
              überschrieben).
            </li>
          </ul>

          <h3>2.3 Bedarfe und Werkangebote</h3>
          <ul>
            <li>
              <strong>Daten:</strong> Bedarfs-Texte, Organisation, Frist, Membership-Beiträge,
              Werkangebote, Status-Übergänge.
            </li>
            <li>
              <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung).
            </li>
            <li>
              <strong>Speicherdauer:</strong> bis 12 Monate nach Abschluss/Ablauf des Bedarfs,
              danach Anonymisierung der Werkangebote-Texte.
            </li>
          </ul>

          <h3>2.4 Termine und Anwesenheit</h3>
          <ul>
            <li>
              <strong>Daten:</strong> An-/Abmeldungen zu Demo Nightsn, Briefing Nights,
              Förder-Treffen; Anwesenheits-Logs für Förder-Verifizierung.
            </li>
            <li>
              <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung).
            </li>
            <li>
              <strong>Speicherdauer:</strong> 24 Monate nach Termin (für Builder-Profil-Historie),
              danach Aggregation auf Zähler ohne Personenbezug.
            </li>
          </ul>

          <h3>2.5 Zahlungen (Förder-Mitgliedschaft, Erfolgsbeitrag)</h3>
          <ul>
            <li>
              <strong>Daten:</strong> Stripe-Customer-ID, Subscription-IDs, Rechnungs-Belege,
              Buchungs-Status. Wir verarbeiten KEINE vollständigen Kreditkarten-Daten — diese
              liegen ausschließlich bei Stripe (PCI-DSS-Level-1).
            </li>
            <li>
              <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung)
              und Art. 6 Abs. 1 lit. c DSGVO (steuerliche Aufbewahrungspflichten nach § 147 AO).
            </li>
            <li>
              <strong>Speicherdauer:</strong> Buchhaltungs-relevante Belege 10 Jahre gemäß
              § 147 Abs. 3 AO.
            </li>
          </ul>

          <h2>3. Auftragsverarbeiter (AVV-Liste, Art. 28 DSGVO)</h2>
          <p>
            Wir setzen die folgenden Auftragsverarbeiter ein. Mit allen aufgeführten
            Dienstleistern bestehen Auftragsverarbeitungsverträge nach Art. 28 DSGVO.
          </p>
          <table className="avv-table" aria-label="Auftragsverarbeiter">
            <thead>
              <tr>
                <th>Dienst</th>
                <th>Zweck</th>
                <th>Sitz / Region</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Hetzner Online GmbH</td>
                <td>Server-Hosting der Plattform, Datenbank, Backups</td>
                <td>Deutschland (Falkenstein/Nürnberg)</td>
              </tr>
              <tr>
                <td>Cloudflare R2</td>
                <td>Speicherung von Screenshots/Bildern (S3-kompatibel)</td>
                <td>EU-Region (Frankfurt)</td>
              </tr>
              <tr>
                <td>Resend</td>
                <td>Transaktionale E-Mails (Magic-Link, Benachrichtigungen, Digest)</td>
                <td>EU-Region</td>
              </tr>
              <tr>
                <td>Stripe Payments Europe Ltd.</td>
                <td>Zahlungsabwicklung Förder-Mitgliedschaften und Erfolgsbeiträge</td>
                <td>Irland (EU)</td>
              </tr>
              <tr>
                <td>Sentry</td>
                <td>Fehler-Telemetrie ohne personenbezogene Inhalte</td>
                <td>EU-Region</td>
              </tr>
              <tr>
                <td>Plausible Analytics</td>
                <td>Cookie-freie, IP-anonymisierte Reichweiten-Statistik</td>
                <td>EU (Deutschland)</td>
              </tr>
            </tbody>
          </table>

          <h2>4. Betroffenenrechte</h2>
          <p>
            Sie haben jederzeit das Recht auf Auskunft (Art. 15), Berichtigung (Art. 16),
            Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit
            (Art. 20) und Widerspruch (Art. 21). Für die Plattform-Verarbeitung bieten wir
            Self-Service-Endpunkte:
          </p>
          <ul>
            <li>
              <strong>Auskunft / Datenexport:</strong>{' '}
              <a href="/api/v1/me/export">/api/v1/me/export</a> (eingeloggt, liefert eine
              JSON-Datei mit allen Konto-bezogenen Daten).
            </li>
            <li>
              <strong>Konto-Löschung:</strong> über{' '}
              <a href="/einstellungen">Einstellungen → Konto löschen</a> (HTTP DELETE auf{' '}
              <code>/api/v1/me</code>, 30-Tage-Karenzfrist mit Wiederherstellungs-Option).
            </li>
            <li>
              <strong>Werk-/Bedarf-/Sponsor-Profil-Löschung:</strong> jeweils direkt im
              Bearbeiten-Dialog des Objekts.
            </li>
          </ul>

          <h2>5. Beschwerderecht</h2>
          <p>
            Unbeschadet anderer Rechtsbehelfe steht Ihnen ein Beschwerderecht bei einer
            Datenschutz-Aufsichtsbehörde zu. Zuständig ist:
          </p>
          <p>
            Der Hamburgische Beauftragte für Datenschutz und Informationsfreiheit
            <br />
            Ludwig-Erhard-Straße 22, 20459 Hamburg
            <br />
            <a href="https://datenschutz-hamburg.de">datenschutz-hamburg.de</a>
          </p>

          <h2>6. Cookies und Tracking</h2>
          <p>
            Wir setzen ausschließlich technisch notwendige Cookies ein (Session-Cookie{' '}
            <code>wz_session</code>). Es findet kein Tracking durch Dritte statt, daher ist
            kein Cookie-Banner erforderlich. Details siehe <a href="/cookies">Cookies</a>.
          </p>

          <h2>7. Drittland-Übermittlungen</h2>
          <p>
            Alle eingesetzten Dienstleister hosten die für Werkzirkel verarbeiteten Daten in der
            EU. Sollte ein Anbieter US-Konzern sein (z.B. Stripe-Mutter, Cloudflare), erfolgt
            die Datenverarbeitung über die EU-Tochter mit Verarbeitung im EWR; Standard-
            vertragsklauseln und ggf. der EU-US-Data-Privacy-Framework-Beschluss bilden die
            zusätzliche Absicherung.
          </p>

          <p className="legal-note">
            Diese Datenschutzerklärung ist ein anwaltlich noch nicht freigegebener Entwurf. Die
            finale Fassung wird vor dem öffentlichen Launch durch eine:n Datenschutz-/
            Plattformrecht-Anwält:in geprüft.
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
