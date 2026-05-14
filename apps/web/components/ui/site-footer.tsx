/**
 * <SiteFooter> — gemeinsamer Footer fuer Landingpages und Rechtstexte-Pages.
 *
 * Quelle: PRD §40 (Rechtliche Seiten). Vorher waren die Rechts-Links auf
 * '#' mit aria-disabled gestubt ('in Arbeit'-Stubs); jetzt sind alle sechs
 * Pflicht-Pages live und werden hier verlinkt:
 *  - /impressum
 *  - /datenschutz
 *  - /agb
 *  - /regeln
 *  - /streitschlichtung
 *  - /cookies
 *
 * Server Component — kein Client-State, kein 'use client'.
 */

import Link from 'next/link';

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap footer-inner">
        <span>Werkzirkel — Gemeinsam digitale Produkte bauen.</span>
        <div className="footer-links" aria-label="Fußnavigation">
          <Link href="/">Macher:innen</Link>
          <Link href="/bedarf">Bedarf</Link>
          <Link href="/foerdern">Fördern</Link>
          <Link href="/regeln">Regeln</Link>
          <Link href="/impressum">Impressum</Link>
          <Link href="/datenschutz">Datenschutz</Link>
          <Link href="/agb">AGB</Link>
          <Link href="/streitschlichtung">Streitschlichtung</Link>
          <Link href="/cookies">Cookies</Link>
        </div>
      </div>
    </footer>
  );
}
