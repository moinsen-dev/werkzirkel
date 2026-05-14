/**
 * <SiteNav> — schlanke Top-Navigation fuer statische Public-Pages
 * (Rechtstexte, weitere Marketing-Stubs). Spiegel des Headers aus
 * `/app/page.tsx` und `/app/bedarf/page.tsx`, aber als Komponente, damit
 * die sechs Rechtstexte-Pages nicht jedes Mal das gleiche Markup kopieren.
 *
 * Server Component — kein State, kein 'use client'.
 */

import Link from 'next/link';

export default function SiteNav() {
  return (
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
          <Link href="/foerdern">Werke fördern</Link>
        </div>
        <Link className="nav-cta" href="/anmelden">
          Anmelden
        </Link>
      </div>
    </nav>
  );
}
