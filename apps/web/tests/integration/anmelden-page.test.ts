/**
 * Integration-Tests fuer die `/anmelden`-Seite (Server Component).
 *
 * Statt einen Next-Server hochzufahren, importieren wir die Page-Komponente
 * direkt und rendern sie zu HTML via `renderToStaticMarkup`. Die Acceptance-
 * Criteria pruefen wir auf dem resultierenden HTML-String — schnell und
 * ohne Next-Lifecycle-Overhead.
 */

import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import AnmeldenPage from '@/app/anmelden/page';

async function renderPage(
  search: Record<string, string> = {},
): Promise<string> {
  const tree = await AnmeldenPage({
    searchParams: Promise.resolve(search),
  });
  return renderToStaticMarkup(tree);
}

describe('/anmelden page', () => {
  it('ohne Params rendert Formular mit beiden Buttons', async () => {
    const html = await renderPage();
    expect(html).toContain('Anmelden oder Builder-Profil anlegen');
    expect(html).toContain('Hamburger Werkzirkel');
    expect(html).toContain('name="email"');
    expect(html).toContain('value="login"');
    expect(html).toContain('value="registrierung"');
    expect(html).toContain('Anmelden');
    expect(html).toContain('Builder-Profil anlegen');
    expect(html).toContain('name="next"');
  });

  it('?fehler=token-ungueltig zeigt den entsprechenden Banner', async () => {
    const html = await renderPage({ fehler: 'token-ungueltig' });
    expect(html).toContain('Der Anmelde-Link ist abgelaufen');
    expect(html).toContain('role="alert"');
  });

  it('?fehler=loeschung-token-ungueltig zeigt den Loeschungs-Banner', async () => {
    const html = await renderPage({ fehler: 'loeschung-token-ungueltig' });
    expect(html).toContain('Der Bestätigungs-Link für die Konto-Löschung');
    expect(html).toContain('role="alert"');
  });

  it('?fehler=rate-limit zeigt den Rate-Limit-Banner', async () => {
    const html = await renderPage({ fehler: 'rate-limit' });
    expect(html).toContain('Zu viele Anfragen');
  });

  it('?gesendet=1 zeigt Erfolgs-Banner und kein Formular', async () => {
    const html = await renderPage({ gesendet: '1' });
    expect(html).toContain('Wir haben dir eine E-Mail geschickt');
    expect(html).toContain('role="status"');
    // Formular ist weg.
    expect(html).not.toContain('name="email"');
  });

  it('?next-Param wird in das versteckte Feld geschrieben', async () => {
    const html = await renderPage({ next: '/uebersicht' });
    expect(html).toMatch(/name="next"[^>]*value="\/uebersicht"/);
  });
});
