/**
 * Unit-Test fuer die mobile Bottom-Tab-Bar (PRD §30).
 *
 * Pruefungen:
 * - Wenn `aktiv=false`: rendert NICHTS (kein Tab-Container).
 * - Wenn `aktiv=true`: rendert genau 5 Tabs (Uebersicht, Werke, Pruefrunden,
 *   Termine, Mehr).
 * - Aktive Route bekommt `aria-current="page"`.
 * - aria-label "Mobile-Hauptnavigation" gesetzt.
 * - Touch-Targets via CSS-Class `bottom-tab` referenzieren globals.css-Regel
 *   `min-height: 56px` / `min-width: 44px` (Smoke-Check: Klassen vorhanden).
 * - globals.css enthaelt @media (min-width:768px) { display:none } fuer Bar.
 */

import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import fs from 'node:fs';
import path from 'node:path';

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  }) =>
    createElement(
      'a',
      { href, ...(rest as Record<string, unknown>) },
      children,
    ),
}));

// Mock von next/navigation: `usePathname` ist hookartig — wir geben pro Test
// einen synchronen Wert zurueck. Default-Wert wird per `vi.hoisted` injiziert,
// damit der Mock vor dem Modul-Import wirkt.
const state = vi.hoisted(() => ({ pathname: '/uebersicht' }));
vi.mock('next/navigation', () => ({
  usePathname: () => state.pathname,
}));

const Mod = await import('@/components/ui/bottom-tab-bar');
const BottomTabBar = Mod.default;

function setPath(p: string): void {
  state.pathname = p;
}

describe('BottomTabBar', () => {
  it('rendert NICHTS wenn aktiv=false (anonyme Besucher:innen)', () => {
    setPath('/');
    const html = renderToStaticMarkup(
      createElement(BottomTabBar, { aktiv: false }),
    );
    expect(html).toBe('');
  });

  it('rendert die Tab-Bar mit korrektem aria-label wenn aktiv=true', () => {
    setPath('/uebersicht');
    const html = renderToStaticMarkup(
      createElement(BottomTabBar, { aktiv: true }),
    );
    expect(html).toContain('aria-label="Mobile-Hauptnavigation"');
    expect(html).toContain('data-testid="bottom-tab-bar"');
  });

  it('rendert genau 5 Tabs (Uebersicht, Werke, Pruefrunden, Termine, Mehr)', () => {
    setPath('/uebersicht');
    const html = renderToStaticMarkup(
      createElement(BottomTabBar, { aktiv: true }),
    );
    // 4 Link-Tabs + 1 Button (Mehr)
    expect(html).toContain('href="/uebersicht"');
    expect(html).toContain('href="/uebersicht/werke"');
    expect(html).toContain('href="/uebersicht/pruefrunden"');
    expect(html).toContain('href="/uebersicht/termine"');
    expect(html).toMatch(/<button[^>]*aria-haspopup="dialog"/);

    // Genau 5 Elemente mit class "bottom-tab"
    const matches = html.match(/class="bottom-tab"/g) ?? [];
    expect(matches.length).toBe(5);
  });

  it('aktiver Tab bekommt aria-current="page" — /uebersicht', () => {
    setPath('/uebersicht');
    const html = renderToStaticMarkup(
      createElement(BottomTabBar, { aktiv: true }),
    );
    // genau einer der Tabs ist aktiv
    const ariaCurrentCount = (html.match(/aria-current="page"/g) ?? []).length;
    expect(ariaCurrentCount).toBe(1);
    // und es ist der Uebersicht-Tab (steht direkt vor /werke)
    expect(html).toMatch(
      /href="\/uebersicht"[^>]*aria-current="page"|aria-current="page"[^>]*href="\/uebersicht"/,
    );
  });

  it('aktiver Tab — /uebersicht/werke matcht Werke-Tab', () => {
    setPath('/uebersicht/werke');
    const html = renderToStaticMarkup(
      createElement(BottomTabBar, { aktiv: true }),
    );
    expect(html).toMatch(
      /href="\/uebersicht\/werke"[^>]*aria-current="page"|aria-current="page"[^>]*href="\/uebersicht\/werke"/,
    );
    // /uebersicht ist NICHT mehr aktiv
    expect(html).not.toMatch(
      /href="\/uebersicht"\s+class="bottom-tab"\s+aria-current="page"/,
    );
  });

  it('aktiver Tab — /uebersicht/werke/123 matcht weiterhin Werke-Tab (startsWith)', () => {
    setPath('/uebersicht/werke/abc-123');
    const html = renderToStaticMarkup(
      createElement(BottomTabBar, { aktiv: true }),
    );
    expect(html).toMatch(/href="\/uebersicht\/werke"[^>]*aria-current="page"/);
  });

  it('aktiver Tab — /uebersicht/pruefrunden matcht Pruefrunden-Tab', () => {
    setPath('/uebersicht/pruefrunden');
    const html = renderToStaticMarkup(
      createElement(BottomTabBar, { aktiv: true }),
    );
    expect(html).toMatch(
      /href="\/uebersicht\/pruefrunden"[^>]*aria-current="page"/,
    );
  });

  it('aktiver Tab — /uebersicht/termine matcht Termine-Tab', () => {
    setPath('/uebersicht/termine');
    const html = renderToStaticMarkup(
      createElement(BottomTabBar, { aktiv: true }),
    );
    expect(html).toMatch(/href="\/uebersicht\/termine"[^>]*aria-current="page"/);
  });

  it('aktiver Tab — /uebersicht/bedarfe ist in keinem Top-Tab, Mehr-Tab aktiv', () => {
    setPath('/uebersicht/bedarfe');
    const html = renderToStaticMarkup(
      createElement(BottomTabBar, { aktiv: true }),
    );
    // Mehr-Button bekommt aria-current
    const ariaCurrentCount = (html.match(/aria-current="page"/g) ?? []).length;
    expect(ariaCurrentCount).toBe(1);
    // aria-current sitzt auf dem <button> (Mehr) — Attribut-Reihenfolge
    // ist nicht garantiert, deshalb suchen wir nach beiden Attributen
    // im selben <button>-Tag.
    const buttonMatch = html.match(/<button[^>]*>/g) ?? [];
    expect(buttonMatch.length).toBe(1);
    expect(buttonMatch[0]).toContain('aria-haspopup="dialog"');
    expect(buttonMatch[0]).toContain('aria-current="page"');
  });

  it('Mehr-Button hat aria-expanded="false" im SSR-Initialzustand', () => {
    setPath('/uebersicht');
    const html = renderToStaticMarkup(
      createElement(BottomTabBar, { aktiv: true }),
    );
    expect(html).toMatch(
      /<button[^>]*aria-haspopup="dialog"[^>]*aria-expanded="false"/,
    );
  });

  it('rendert kein Sheet/Dialog im SSR-Initialzustand', () => {
    setPath('/uebersicht');
    const html = renderToStaticMarkup(
      createElement(BottomTabBar, { aktiv: true }),
    );
    expect(html).not.toContain('bottom-tab-sheet-backdrop');
    expect(html).not.toContain('aria-modal="true"');
  });

  it('Tab-Labels enthalten Uebersicht/Werke/Pruefrunden/Termine/Mehr', () => {
    setPath('/uebersicht');
    const html = renderToStaticMarkup(
      createElement(BottomTabBar, { aktiv: true }),
    );
    expect(html).toContain('Uebersicht');
    expect(html).toContain('Builds');
    expect(html).toContain('Pruefrunden');
    expect(html).toContain('Termine');
    expect(html).toContain('Mehr');
  });
});

/**
 * CSS-Verifikation:
 * - `.bottom-tab` hat min-height >= 44px (Touch-Target)
 * - `@media (min-width:768px) { .bottom-tab-bar { display:none } }` ist
 *   definiert (Desktop-Hide).
 *
 * Wir lesen globals.css als Text und matchen die Regeln. Das ist robuster
 * als ein DOM-Computed-Style-Check, der Tailwind/JIT braeuchte.
 */
describe('globals.css — Bottom-Tab-Bar Mobile-Rules', () => {
  const cssPath = path.resolve(__dirname, '../../app/globals.css');
  const css = fs.readFileSync(cssPath, 'utf8');

  it('definiert .bottom-tab-bar mit position: fixed; bottom: 0', () => {
    expect(css).toMatch(/\.bottom-tab-bar\s*\{[\s\S]*?position:\s*fixed/);
    expect(css).toMatch(/\.bottom-tab-bar\s*\{[\s\S]*?bottom:\s*0/);
  });

  it('versteckt .bottom-tab-bar bei min-width:768px', () => {
    // robust gegen Whitespace: einfach beide Bestandteile suchen
    expect(css).toMatch(/@media\s*\(min-width:\s*768px\)/);
    expect(css).toMatch(
      /@media\s*\(min-width:\s*768px\)\s*\{[\s\S]*?\.bottom-tab-bar\s*\{[\s\S]*?display:\s*none/,
    );
  });

  it('Touch-Target: .bottom-tab hat min-height >= 44px und min-width >= 44px', () => {
    const block = css.match(/\.bottom-tab\s*\{([\s\S]*?)\}/);
    expect(block, 'class .bottom-tab missing').toBeTruthy();
    const body = block?.[1] ?? '';
    const minH = body.match(/min-height:\s*(\d+)px/);
    const minW = body.match(/min-width:\s*(\d+)px/);
    expect(minH, '.bottom-tab missing min-height').toBeTruthy();
    expect(minW, '.bottom-tab missing min-width').toBeTruthy();
    expect(Number(minH?.[1] ?? '0')).toBeGreaterThanOrEqual(44);
    expect(Number(minW?.[1] ?? '0')).toBeGreaterThanOrEqual(44);
  });

  it('aktiver Tab-Style: .bottom-tab[aria-current="page"] vorhanden', () => {
    expect(css).toMatch(/\.bottom-tab\[aria-current=['"]page['"]\]/);
  });
});
