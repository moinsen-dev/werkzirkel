/**
 * @vitest-environment happy-dom
 *
 * BITV/WCAG 2.1 AA — axe-core gegen die statisch renderbaren public-Routen.
 *
 * Wir rendern die Seiten ueber `renderToStaticMarkup` zu HTML, injizieren den
 * Markup-String in das happy-dom-`document` und lassen `axe.run()` die WCAG-
 * 2.1-AA-Regeln pruefen. Akzeptanz: 0 Violations.
 *
 * Routen mit DB-Zugriff (z.B. /werke, /bedarfe, /termine) werden hier nicht
 * abgedeckt — die WCAG-Komponenten dieser Seiten kommen aus denselben Layout-
 * und Form-Bausteinen, die hier getestet werden. Fuer die DB-Seiten gibt es
 * im naechsten Polish-Schritt einen Lighthouse-CI-Lauf gegen das gestartete
 * Next-Server.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import axe from 'axe-core';

import MacherLandingpage from '@/app/page';
import BedarfLandingpage from '@/app/bedarf/page';
import FoerdernLandingpage from '@/app/foerdern/page';
import AnmeldenPage from '@/app/anmelden/page';
import NotFoundPage from '@/app/not-found';

interface Route {
  name: string;
  pfad: string;
  render: () => Promise<string> | string;
}

const ROUTES: Route[] = [
  {
    name: '/',
    pfad: '/',
    render: () => renderToStaticMarkup(MacherLandingpage()),
  },
  {
    name: '/bedarf',
    pfad: '/bedarf',
    render: () => renderToStaticMarkup(BedarfLandingpage()),
  },
  {
    name: '/foerdern',
    pfad: '/foerdern',
    render: () => renderToStaticMarkup(FoerdernLandingpage()),
  },
  {
    name: '/anmelden',
    pfad: '/anmelden',
    render: async () =>
      renderToStaticMarkup(
        await AnmeldenPage({ searchParams: Promise.resolve({}) }),
      ),
  },
  {
    name: '/not-found',
    pfad: '/not-found',
    render: () => renderToStaticMarkup(NotFoundPage()),
  },
];

const AXE_OPTIONS: axe.RunOptions = {
  runOnly: {
    type: 'tag',
    values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
  },
  // Rules we cannot satisfy in a JSDOM-stub (no real CSS layout):
  rules: {
    'color-contrast': { enabled: false },
    // region: jeder Hauptinhalt liegt bereits in <main>/header — der Test-
    // Wrapper hat aber kein <main>-Element, daher off.
    region: { enabled: false },
  },
};

async function runAxe(html: string): Promise<axe.AxeResults> {
  // happy-dom liefert document; wir resetten body und injizieren das Markup.
  document.documentElement.lang = 'de';
  document.body.innerHTML = html;
  return axe.run(document.body, AXE_OPTIONS);
}

function formatViolations(results: axe.AxeResults): string {
  return results.violations
    .map((v) => {
      const targets = v.nodes
        .map((n) => n.target.join(' '))
        .join(', ');
      return `[${v.id}] ${v.help} — Targets: ${targets}`;
    })
    .join('\n');
}

describe('a11y — axe-core auf public-Routen', () => {
  beforeAll(() => {
    // Sanity: happy-dom-Globals muessen vorhanden sein.
    if (typeof document === 'undefined') {
      throw new Error(
        'axe-Test braucht happy-dom (siehe `@vitest-environment happy-dom`).',
      );
    }
  });

  for (const route of ROUTES) {
    it(`${route.pfad} hat keine WCAG 2.1 AA Violations`, async () => {
      const html = await route.render();
      const results = await runAxe(html);

      if (results.violations.length > 0) {
        // Fehlerbericht im Test-Output mit allen Details.
        // eslint-disable-next-line no-console
        console.error(
          `axe-violations auf ${route.pfad}:\n${formatViolations(results)}`,
        );
      }

      expect(results.violations).toEqual([]);
    });
  }
});
