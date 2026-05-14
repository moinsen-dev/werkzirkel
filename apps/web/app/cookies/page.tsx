/**
 * /cookies — Cookie-Hinweise.
 *
 * Quelle: PRD §40. Werkzirkel setzt nur funktional notwendige Cookies
 * (wz_session), kein Tracking → kein Cookie-Banner nach TTDSG erforderlich.
 *
 * Server Component.
 */

import type { Metadata } from 'next';

import SiteFooter from '@/components/ui/site-footer';
import SiteNav from '@/components/ui/site-nav';

export const metadata: Metadata = {
  title: 'Cookies',
  description:
    'Cookie-Übersicht der Werkzirkel-Plattform: nur ein technisch notwendiger Session-Cookie, kein Tracking, kein Banner.',
};

export default function CookiesPage() {
  return (
    <div className="page-shell">
      <SiteNav />
      <main className="legal-page">
        <div className="wrap">
          <p className="legal-eyebrow">Rechtliches</p>
          <h1>Cookies</h1>
          <p className="legal-meta">
            Übersicht über die wenigen Cookies, die Werkzirkel tatsächlich setzt.
          </p>

          <h2>Funktional notwendige Cookies</h2>
          <p>
            Werkzirkel verwendet ausschließlich funktional notwendige Cookies, die für den
            Betrieb der Plattform unverzichtbar sind. Diese Cookies sind nach § 25 Abs. 2 Nr. 2
            TTDSG einwilligungsfrei zulässig.
          </p>

          <table className="avv-table" aria-label="Funktionale Cookies">
            <thead>
              <tr>
                <th>Cookie</th>
                <th>Zweck</th>
                <th>Speicherdauer</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <code>wz_session</code>
                </td>
                <td>
                  Hält die Anmeldung nach dem Magic-Link-Login aufrecht. HttpOnly, Secure,
                  SameSite=Lax.
                </td>
                <td>30 Tage (Sliding Window), endet mit Abmeldung</td>
              </tr>
            </tbody>
          </table>

          <h2>Kein Tracking, kein Banner</h2>
          <p>
            Werkzirkel setzt <strong>kein Tracking</strong>, kein Marketing-Cookie, kein
            Drittanbieter-Cookie ein. Reichweiten-Statistiken erstellen wir mit{' '}
            <a href="https://plausible.io" rel="noopener noreferrer">
              Plausible Analytics
            </a>{' '}
            in IP-anonymisierter, cookie-freier Form. Daher zeigen wir auch keinen Cookie-Banner —
            die Plattform funktioniert auch dann, wenn dein Browser Drittanbieter-Cookies
            vollständig blockiert.
          </p>

          <h2>Weitere Informationen</h2>
          <p>
            Details zur Datenverarbeitung findest du in der{' '}
            <a href="/datenschutz">Datenschutzerklärung</a>.
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
