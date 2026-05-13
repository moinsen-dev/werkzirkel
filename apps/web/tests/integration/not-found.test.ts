/**
 * Integration-Tests fuer die globale `not-found.tsx`.
 *
 * Wir rendern die Komponente direkt zu HTML (renderToStaticMarkup) und
 * pruefen die deutschen Strings sowie die drei Sekundaer-Navigations-Links.
 *
 * Hinweis: ein echter Fetch gegen `/diese-seite-gibt-es-nicht` braucht den
 * laufenden Next-Server. Den fahren wir hier nicht hoch — die Komponenten-
 * Rendering-Pruefung deckt die Acceptance-Criteria ab, und der `pnpm build`
 * im Quality-Gate verifiziert, dass Next die not-found.tsx auch tatsaechlich
 * als 404-Handler einbindet.
 */

import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import NotFoundPage from '@/app/not-found';

function renderPage(): string {
  const tree = NotFoundPage();
  return renderToStaticMarkup(tree);
}

describe('not-found page', () => {
  it('rendert die deutsche Headline', () => {
    const html = renderPage();
    expect(html).toContain('Diese Seite gibt es nicht.');
  });

  it('zeigt den 404-Eyebrow', () => {
    const html = renderPage();
    expect(html).toContain('404 — Nicht gefunden');
  });

  it('enthaelt die Erklaerungs-Untertitel', () => {
    const html = renderPage();
    expect(html).toContain('Vielleicht haben wir sie noch nicht gebaut');
  });

  it('enthaelt das Werkzirkel-Brand-Mark', () => {
    const html = renderPage();
    expect(html).toContain('class="brand-mark"');
    expect(html).toContain('Werkzirkel');
  });

  it('verlinkt zu /, /bedarf und /foerdern', () => {
    const html = renderPage();
    expect(html).toMatch(/href="\/"/);
    expect(html).toMatch(/href="\/bedarf"/);
    expect(html).toMatch(/href="\/foerdern"/);
    expect(html).toContain('Zum Werkzirkel');
    expect(html).toContain('Bedarf einbringen');
    expect(html).toContain('Werke fördern');
  });
});
