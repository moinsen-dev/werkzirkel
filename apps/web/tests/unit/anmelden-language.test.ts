/**
 * Sprach-Check fuer die `/anmelden`-Seite.
 *
 * Acceptance-Criterion: kein englischer String im HTML-Output. Wir rendern
 * die Page-Komponente zu HTML und pruefen gegen eine Verbots-Liste.
 */

import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import AnmeldenPage from '@/app/anmelden/page';

const VERBOTENE_BEGRIFFE = [
  'Sign in',
  'Sign up',
  'Sign-in',
  'Sign-up',
  'Submit',
  'Login',
  'Register',
  'Continue',
  'Password',
  'Email address',
  'Magic link',
];

async function renderPage(
  search: Record<string, string> = {},
): Promise<string> {
  const tree = await AnmeldenPage({
    searchParams: Promise.resolve(search),
  });
  return renderToStaticMarkup(tree);
}

describe('/anmelden Sprach-Check', () => {
  it('Default-State enthaelt keine englischen Begriffe', async () => {
    const html = await renderPage();
    for (const begriff of VERBOTENE_BEGRIFFE) {
      expect(html, `verbotener Begriff "${begriff}" gefunden`).not.toContain(
        begriff,
      );
    }
  });

  it('Erfolgs-State enthaelt keine englischen Begriffe', async () => {
    const html = await renderPage({ gesendet: '1' });
    for (const begriff of VERBOTENE_BEGRIFFE) {
      expect(html, `verbotener Begriff "${begriff}" gefunden`).not.toContain(
        begriff,
      );
    }
  });

  it('Fehler-States enthalten keine englischen Begriffe', async () => {
    for (const fehler of [
      'token-ungueltig',
      'loeschung-token-ungueltig',
      'rate-limit',
      'ungueltige-email',
    ]) {
      const html = await renderPage({ fehler });
      for (const begriff of VERBOTENE_BEGRIFFE) {
        expect(
          html,
          `verbotener Begriff "${begriff}" in fehler=${fehler} gefunden`,
        ).not.toContain(begriff);
      }
    }
  });
});
