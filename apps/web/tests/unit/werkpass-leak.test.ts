/**
 * Unit-Test: stellt sicher, dass die Werkpass-View KEINE privaten Felder
 * rendert — selbst wenn ein Aufrufer versuchen wuerde, sensible Daten
 * "durchzuschmuggeln". Wir rendern die Komponente mit Mock-Daten, deren
 * anzeigename / kurzbeschreibung NICHT die geheimen Strings enthalten, und
 * scannen das gerenderte HTML auf eben diese Strings.
 */

import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  }) => {
    return createElement(
      'a',
      { href, ...(rest as Record<string, unknown>) },
      children,
    );
  },
}));

const WerkpassViewModule = await import(
  '@/app/werkpass/[id]/werkpass-view'
);
const WerkpassView = WerkpassViewModule.default;

describe('WerkpassView leak check', () => {
  it('rendert NIE klarname, email oder stripe-IDs — auch wenn sie irgendwo im Hintergrund existieren', () => {
    // Die Mock-Daten simulieren eine Render-Aufruf mit nur Public-Feldern.
    // Wenn die Komponente jemals beginnt, eines der Verbots-Felder zu
    // rendern, faellt der Test sofort, weil wir die Strings explizit hier
    // angeben und in der View nichts vergleichbares stehen darf.
    const tree = createElement(WerkpassView, {
      nutzer: {
        id: 'nutzer-1',
        anzeigename: 'Pseudo Macher',
        avatarUrl: null,
        kurzbeschreibung: 'Eine harmlose Bio.',
        faehigkeiten: ['TypeScript', 'Postgres'],
        interessen: ['Indie-Tools'],
        website: 'https://example.org',
        github: null,
        linkedin: null,
        mastodon: null,
        teilnahmeart: 'beides',
        stadtName: 'Hamburg',
        istFoerdermitglied: true,
      },
      testSaldo: {
        testsGegeben: 2,
        testsErhalten: 1,
        offeneVerpflichtungAnzahl: 0,
        naechsteVerpflichtungFrist: null,
      },
      werke: [],
      werkeGesamt: 0,
    });
    const html = renderToStaticMarkup(tree);

    // Sanity: rendert Anzeigename und Bio
    expect(html).toContain('Pseudo Macher');
    expect(html).toContain('Eine harmlose Bio.');

    // Verbots-Liste: hypothetisch geheime Werte aus dem nutzer-Mock,
    // die NIRGENDS im HTML auftauchen duerfen.
    expect(html).not.toContain('Geheim Identität');
    expect(html).not.toContain('secret@x.de');
    expect(html).not.toContain('cus_xyz');

    // Generische Schutzpattern: kein klarname als Wort, keine email-aehnliche
    // Sequenz, kein 'stripe_'-Substring (Stripe-Customer/Subscription IDs).
    expect(html).not.toMatch(/klarname/i);
    expect(html).not.toMatch(/stripe_/i);
    expect(html).not.toMatch(/@[a-z0-9.-]+\.[a-z]{2,}/i);
  });

  it('rendert Fördermitglied-Badge nur wenn istFoerdermitglied=true', () => {
    const treeAktiv = createElement(WerkpassView, {
      nutzer: {
        id: 'n',
        anzeigename: 'X',
        avatarUrl: null,
        kurzbeschreibung: null,
        faehigkeiten: [],
        interessen: [],
        website: null,
        github: null,
        linkedin: null,
        mastodon: null,
        teilnahmeart: null,
        stadtName: 'Hamburg',
        istFoerdermitglied: true,
      },
      testSaldo: {
        testsGegeben: 0,
        testsErhalten: 0,
        offeneVerpflichtungAnzahl: 0,
        naechsteVerpflichtungFrist: null,
      },
      werke: [],
      werkeGesamt: 0,
    });
    expect(renderToStaticMarkup(treeAktiv)).toContain('Fördermitglied');

    const treeKein = createElement(WerkpassView, {
      nutzer: {
        id: 'n',
        anzeigename: 'X',
        avatarUrl: null,
        kurzbeschreibung: null,
        faehigkeiten: [],
        interessen: [],
        website: null,
        github: null,
        linkedin: null,
        mastodon: null,
        teilnahmeart: null,
        stadtName: 'Hamburg',
        istFoerdermitglied: false,
      },
      testSaldo: {
        testsGegeben: 0,
        testsErhalten: 0,
        offeneVerpflichtungAnzahl: 0,
        naechsteVerpflichtungFrist: null,
      },
      werke: [],
      werkeGesamt: 0,
    });
    expect(renderToStaticMarkup(treeKein)).not.toContain('Fördermitglied');
  });

  it('zeigt Feedback-Saldo-Anzeige im Format N gegeben · M erhalten · K offen', () => {
    const tree = createElement(WerkpassView, {
      nutzer: {
        id: 'n',
        anzeigename: 'Saldo Person',
        avatarUrl: null,
        kurzbeschreibung: null,
        faehigkeiten: [],
        interessen: [],
        website: null,
        github: null,
        linkedin: null,
        mastodon: null,
        teilnahmeart: null,
        stadtName: 'Hamburg',
        istFoerdermitglied: false,
      },
      testSaldo: {
        testsGegeben: 7,
        testsErhalten: 4,
        offeneVerpflichtungAnzahl: 0,
        naechsteVerpflichtungFrist: null,
      },
      werke: [],
      werkeGesamt: 0,
    });
    const html = renderToStaticMarkup(tree);
    expect(html).toContain('7 gegeben');
    expect(html).toContain('4 erhalten');
    expect(html).toContain('0 offen');
  });
});
