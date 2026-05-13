/**
 * Globale 404-Seite (deutsch).
 *
 * Next.js rendert diese Komponente automatisch fuer alle nicht existierenden
 * Routen und fuer explizite `notFound()`-Aufrufe. Wir uebersteuern damit das
 * englische Next-Default ("This page could not be found.").
 *
 * Server Component, kein Client-State. Layout im Hero-Stil der LP, mit dem
 * Werkzirkel-Brand-Mark und drei Buttons als Sekundaer-Navigation, damit
 * Besuche:innen einen weichen Wiedereinstieg in die Plattform haben.
 *
 * Strings kommen aus `i18n/de.ts` — Sprach-Check-Tests pruefen das HTML
 * gegen eine Verbots-Liste englischer Default-404-Begriffe.
 */

import type { Metadata } from 'next';
import Link from 'next/link';

import { de } from '@/i18n/de';

export const metadata: Metadata = {
  title: 'Nicht gefunden',
  robots: { index: false, follow: false },
};

const t = de.not_found;

export default function NotFoundPage() {
  return (
    <div className="page-shell">
      <header className="hero" id="top">
        <div className="wrap hero-grid single">
          <div>
            <Link
              href="/"
              className="brand"
              aria-label="Werkzirkel Start"
              style={{ marginBottom: '24px', display: 'inline-flex' }}
            >
              <span className="brand-mark" aria-hidden="true">
                <span></span>
                <span></span>
                <span></span>
                <span></span>
              </span>
              <span>Werkzirkel</span>
            </Link>
            <p className="eyebrow">{t.eyebrow}</p>
            <h1>{t.titel}</h1>
            <p className="hero-copy">{t.untertitel}</p>
            <div
              className="hero-actions"
              style={{ marginTop: '20px', flexWrap: 'wrap' }}
            >
              <Link className="button primary" href="/">
                {t.link_start}
              </Link>
              <Link className="button secondary" href="/bedarf">
                {t.link_bedarf}
              </Link>
              <Link className="button secondary" href="/foerdern">
                {t.link_foerdern}
              </Link>
            </div>
          </div>
        </div>
      </header>
    </div>
  );
}
