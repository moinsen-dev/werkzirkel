'use client';

/**
 * Bottom-Tab-Bar — mobile App-Navigation (PRD §30).
 *
 * Quelle: PRD §30 (Mobile-Layout, Bottom-Tab-Bar bei viewport <768px), §29
 * (Touch-Targets ≥44x44px, aria-current='page' fuer aktive Routen).
 *
 * - Fixed bottom, fuenf Haupt-Tabs (Uebersicht, Werke, Pruefrunden, Termine,
 *   Mehr). Der Mehr-Tab oeffnet ein Sheet mit Bedarfe, Foerderprofile,
 *   Hilfegesuche, Einstellungen, Abmelden.
 * - Nur sichtbar wenn eingeloggt (Render-Gate via `aktiv`-Prop) UND viewport
 *   <768px (CSS-Media-Query: `@media (min-width:768px) { display:none }`).
 * - aria-current='page' auf dem aktiven Tab.
 * - Touch-Targets: jeder Tab-Button ist min. 56x56px (Inhalt 24x24px Icon +
 *   12px label-Text + Padding), weit ueber WCAG-2.5.5-Minimum von 44x44px.
 *
 * Abmelden ist als Server-Action im /uebersicht-Page-Modul definiert; das
 * Sheet rendert einen passenden `<form action={abmeldenAction}>`-Slot ueber
 * die Children-Prop, damit wir hier keinen direkten Action-Import brauchen
 * (Client-Component duerfte sonst keine Server-Action serialisieren).
 *
 * Pfad-Matching: Wir matchen den aktiven Tab anhand `pathname.startsWith()`,
 * damit `/uebersicht/werke/123` zum `Werke`-Tab passt.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';

export interface BottomTabBarProps {
  /**
   * Wenn `false`, rendert die Komponente NICHTS. Aufrufer (RootLayout)
   * setzt das anhand der Session — anonyme Besucher:innen sehen die
   * App-Navigation nicht.
   */
  aktiv: boolean;
  /**
   * Slot fuer den Abmelden-Form-Body (Server-Action). Wird im Mehr-Sheet
   * gerendert. Wenn `null`, rendert das Sheet keinen Abmelden-Eintrag.
   */
  abmeldenSlot?: React.ReactNode;
}

interface TabDef {
  href: string;
  label: string;
  /** Erkennt aktiven Tab anhand des Pfads (startsWith). */
  match: (pathname: string) => boolean;
  /** Inline-SVG-Pfad (24x24 viewBox). */
  icon: React.ReactNode;
}

const TABS: ReadonlyArray<TabDef> = [
  {
    href: '/uebersicht',
    label: 'Uebersicht',
    match: (p) =>
      p === '/uebersicht' ||
      (p.startsWith('/uebersicht') &&
        !p.startsWith('/uebersicht/werke') &&
        !p.startsWith('/uebersicht/pruefrunden') &&
        !p.startsWith('/uebersicht/termine') &&
        !p.startsWith('/uebersicht/bedarfe') &&
        !p.startsWith('/uebersicht/foerderprofil') &&
        !p.startsWith('/uebersicht/hilfegesuche') &&
        !p.startsWith('/uebersicht/werkstattbeitrag') &&
        !p.startsWith('/uebersicht/werkangebote')),
    icon: (
      <svg
        viewBox="0 0 24 24"
        width="24"
        height="24"
        aria-hidden="true"
        focusable="false"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 11.5 12 4l9 7.5" />
        <path d="M5 10v10h14V10" />
      </svg>
    ),
  },
  {
    href: '/uebersicht/werke',
    label: 'Builds',
    match: (p) => p.startsWith('/uebersicht/werke') || p.startsWith('/werke'),
    icon: (
      <svg
        viewBox="0 0 24 24"
        width="24"
        height="24"
        aria-hidden="true"
        focusable="false"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M3 9h18" />
        <path d="M9 9v11" />
      </svg>
    ),
  },
  {
    href: '/uebersicht/pruefrunden',
    label: 'Pruefrunden',
    match: (p) =>
      p.startsWith('/uebersicht/pruefrunden') || p.startsWith('/pruefrunden'),
    icon: (
      <svg
        viewBox="0 0 24 24"
        width="24"
        height="24"
        aria-hidden="true"
        focusable="false"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="8" />
        <path d="m8.5 12 2.5 2.5L16 9.5" />
      </svg>
    ),
  },
  {
    href: '/uebersicht/termine',
    label: 'Termine',
    match: (p) =>
      p.startsWith('/uebersicht/termine') || p.startsWith('/termine'),
    icon: (
      <svg
        viewBox="0 0 24 24"
        width="24"
        height="24"
        aria-hidden="true"
        focusable="false"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 9h18" />
        <path d="M8 3v4" />
        <path d="M16 3v4" />
      </svg>
    ),
  },
];

interface MehrLink {
  href: string;
  label: string;
}

const MEHR_LINKS: ReadonlyArray<MehrLink> = [
  { href: '/uebersicht/bedarfe', label: 'Bedarfe' },
  { href: '/uebersicht/foerderprofil', label: 'Foerderprofil' },
  { href: '/uebersicht/hilfegesuche', label: 'Quick-Helps' },
  { href: '/uebersicht/werkangebote', label: 'Match-Angebote' },
  { href: '/uebersicht/werkstattbeitrag', label: 'Membership-Beitrag' },
  { href: '/einstellungen', label: 'Einstellungen' },
];

/** True wenn der aktuelle Pfad zu einem der Mehr-Links gehoert. */
function istMehrAktiv(pathname: string): boolean {
  return MEHR_LINKS.some(
    (m) => pathname === m.href || pathname.startsWith(m.href + '/'),
  );
}

export default function BottomTabBar({
  aktiv,
  abmeldenSlot,
}: BottomTabBarProps) {
  const pathname = usePathname() ?? '';
  const [sheetOffen, setSheetOffen] = useState(false);
  const sheetTitleId = useId();
  const sheetRef = useRef<HTMLDivElement | null>(null);

  // Sheet bei Routenwechsel schliessen.
  useEffect(() => {
    setSheetOffen(false);
  }, [pathname]);

  // Escape schliesst Sheet.
  useEffect(() => {
    if (!sheetOffen) return;
    function onKey(ev: KeyboardEvent) {
      if (ev.key === 'Escape') setSheetOffen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sheetOffen]);

  if (!aktiv) return null;

  const mehrAktiv = istMehrAktiv(pathname);

  return (
    <>
      <nav
        className="bottom-tab-bar"
        aria-label="Mobile-Hauptnavigation"
        data-testid="bottom-tab-bar"
      >
        {TABS.map((tab) => {
          const ist = tab.match(pathname);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="bottom-tab"
              aria-current={ist ? 'page' : undefined}
              aria-label={tab.label}
            >
              <span className="bottom-tab-icon" aria-hidden="true">
                {tab.icon}
              </span>
              <span className="bottom-tab-label">{tab.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          className="bottom-tab"
          aria-current={mehrAktiv ? 'page' : undefined}
          aria-haspopup="dialog"
          aria-expanded={sheetOffen}
          aria-controls={sheetTitleId}
          onClick={() => setSheetOffen((v) => !v)}
        >
          <span className="bottom-tab-icon" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              width="24"
              height="24"
              aria-hidden="true"
              focusable="false"
              fill="currentColor"
            >
              <circle cx="6" cy="12" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="18" cy="12" r="2" />
            </svg>
          </span>
          <span className="bottom-tab-label">Mehr</span>
        </button>
      </nav>

      {sheetOffen ? (
        <div
          className="bottom-tab-sheet-backdrop"
          role="presentation"
          onClick={(ev) => {
            if (ev.target === ev.currentTarget) setSheetOffen(false);
          }}
        >
          <div
            ref={sheetRef}
            id={sheetTitleId}
            role="dialog"
            aria-modal="true"
            aria-label="Weitere Bereiche"
            className="bottom-tab-sheet"
          >
            <div className="bottom-tab-sheet-grip" aria-hidden="true" />
            <ul className="bottom-tab-sheet-list">
              {MEHR_LINKS.map((m) => {
                const ist =
                  pathname === m.href || pathname.startsWith(m.href + '/');
                return (
                  <li key={m.href}>
                    <Link
                      href={m.href}
                      className="bottom-tab-sheet-link"
                      aria-current={ist ? 'page' : undefined}
                      onClick={() => setSheetOffen(false)}
                    >
                      {m.label}
                    </Link>
                  </li>
                );
              })}
              {abmeldenSlot ? <li>{abmeldenSlot}</li> : null}
            </ul>
            <button
              type="button"
              className="bottom-tab-sheet-close"
              onClick={() => setSheetOffen(false)}
            >
              Schliessen
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
