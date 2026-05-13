/**
 * Sprach-Check fuer die globale 404-Seite.
 *
 * Acceptance-Criterion: keine englischen Default-404-Strings im HTML-Output.
 * Wir rendern die Page-Komponente zu HTML und pruefen gegen eine Verbots-Liste
 * mit den typischen englischen Next/Vercel-404-Strings.
 */

import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import NotFoundPage from '@/app/not-found';

const VERBOTENE_BEGRIFFE = [
  'Page not found',
  '404 Not Found',
  'Not Found',
  'Back to home',
  'Go home',
  'This page could not be found',
];

function renderPage(): string {
  const tree = NotFoundPage();
  return renderToStaticMarkup(tree);
}

describe('not-found Sprach-Check', () => {
  it('Snapshot des gerenderten HTML', () => {
    expect(renderPage()).toMatchSnapshot();
  });

  it('enthaelt keine englischen Default-404-Begriffe', () => {
    const html = renderPage();
    for (const begriff of VERBOTENE_BEGRIFFE) {
      expect(html, `verbotener Begriff "${begriff}" gefunden`).not.toContain(
        begriff,
      );
    }
  });
});
