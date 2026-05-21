/**
 * /streitschlichtung — Hinweis nach VSBG / ODR-VO.
 *
 * Quelle: PRD §40. Standard-Formulierung: Werkzirkel nimmt nicht an
 * Verbraucherstreitbeilegung teil.
 *
 * Server Component.
 */

import type { Metadata } from 'next';

import SiteFooter from '@/components/ui/site-footer';
import SiteNav from '@/components/ui/site-nav';

export const metadata: Metadata = {
  title: 'Streitschlichtung',
  description:
    'Hinweise zur Online-Streitbeilegung und zum Verbraucherstreitbeilegungsgesetz (VSBG) für die Werkzirkel-Plattform.',
};

export default function StreitschlichtungPage() {
  return (
    <div className="page-shell">
      <SiteNav />
      <main className="legal-page">
        <div className="wrap">
          <p className="legal-eyebrow">Rechtliches</p>
          <h1>Streitschlichtung</h1>

          <h2>Online-Streitbeilegung (ODR)</h2>
          <p>
            Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS)
            bereit, die Sie unter{' '}
            <a href="https://ec.europa.eu/consumers/odr" rel="noopener noreferrer">
              ec.europa.eu/consumers/odr
            </a>{' '}
            finden. Verbraucher:innen haben die Möglichkeit, diese Plattform für die Beilegung
            ihrer Streitigkeiten zu nutzen.
          </p>

          <h2>Verbraucherstreitbeilegung nach VSBG</h2>
          <p>
            Werkzirkel ist <strong>nicht verpflichtet und nicht bereit</strong>, an
            Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle im Sinne des
            Verbraucherstreitbeilegungsgesetzes (VSBG) teilzunehmen.
          </p>

          <h2>Direkter Kontakt</h2>
          <p>
            Bei Unstimmigkeiten oder Beschwerden bitten wir um direkten Kontakt — wir versuchen,
            jedes Problem in der Build-Kultur einvernehmlich zu lösen:{' '}
            <a href="mailto:developer@moinsen.dev">developer@moinsen.dev</a>.
          </p>

          <p className="legal-note">
            Diese Hinweise sind ein Entwurf — finale anwaltliche Prüfung folgt vor dem
            öffentlichen Launch.
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
