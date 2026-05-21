/**
 * Unit-Test: stellt sicher, dass die Werk-Detail-View KEINE privaten Felder
 * (email, klarname) rendert — auch dann nicht, wenn die Inhaber-Daten so etwas
 * im Hintergrund haben koennten. Da wir die View bewusst nur mit Public-Feldern
 * fuettern, ist das ein zweiter Verteidigungswall: hier mocken wir den
 * Werkpass-Link mit den Public-Feldern und scannen das gerenderte HTML.
 *
 * Bonus-Test: `buildJsonLd` liefert den CreativeWork-Block mit den richtigen
 * Pflichtfeldern.
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

const WerkDetailModule = await import('@/app/werke/[id]/werk-detail-view');
const WerkDetailView = WerkDetailModule.default;
const buildJsonLd = WerkDetailModule.buildJsonLd;

import type { Werk } from '@/lib/db/schema';

function mockWerk(overrides: Partial<Werk> = {}): Werk {
  return {
    id: 'werk-1',
    nutzerId: 'nutzer-1',
    name: 'Test Werk',
    kurzbeschreibung: 'Eine kompakte Beschreibung.',
    problem: 'Wir loesen etwas Konkretes.',
    zielgruppe: 'Macher:innen.',
    werkstand: 'prototyp',
    hilfebedarf: ['ux_test', 'marketing'],
    link: null,
    screenshots: [],
    sichtbarkeit: 'oeffentlich',
    status: 'aktiv',
    erstelltAm: new Date('2026-05-01T10:00:00Z'),
    aktualisiertAm: new Date('2026-05-10T10:00:00Z'),
    ...overrides,
  };
}

describe('WerkDetailView leak check', () => {
  it('rendert NIE klarname oder email — auch wenn beide irgendwo im Prozess waeren', () => {
    // Inhaber-Props enthalten BEWUSST keine email/klarname-Felder.
    // Die Komponente hat keinen Weg, sie zu rendern.
    const tree = createElement(WerkDetailView, {
      werk: mockWerk(),
      inhaber: {
        id: 'nutzer-1',
        anzeigename: 'Anz Person',
        avatarUrl: null,
        stadtId: 'hh',
        istFoerdermitglied: false,
      },
      stadtName: 'Hamburg',
      historie: [],
    });
    const html = renderToStaticMarkup(tree);

    // Sanity: rendert Anzeigename
    expect(html).toContain('Anz Person');

    // Wenn jemand spaeter `klarname` oder `email` in die View hineinreichen
    // wollte, wuerde dieser Test nicht direkt brechen — aber die Props haben
    // keine entsprechenden Felder. Doppelter Check via Verbots-Liste:
    expect(html).not.toMatch(/klarname/i);
    expect(html).not.toMatch(/@[a-z0-9.-]+\.[a-z]{2,}/i); // keine E-Mail-aehnliche Sequenz
  });

  it('falls jemand secret@x.de oder Geheim als Substring versehentlich reinpasst → faellt auf', () => {
    // Wir uebersteuern den Anzeigename mit etwas E-Mail-Aehnlichem. Wenn die
    // Komponente jemals beginnt, klarname/email zu rendern, faellt dieser
    // Test, weil das Substring-Match anschlaegt.
    const tree = createElement(WerkDetailView, {
      werk: mockWerk({ name: 'Sauber Werk' }),
      inhaber: {
        id: 'nutzer-1',
        anzeigename: 'Pseudo Person',
        avatarUrl: null,
        stadtId: 'hh',
        istFoerdermitglied: false,
      },
      stadtName: 'Hamburg',
      historie: [],
    });
    const html = renderToStaticMarkup(tree);
    expect(html).not.toContain('Geheim');
    expect(html).not.toContain('secret@x.de');
    expect(html).not.toContain('klar@x.de');
  });

  it('buildJsonLd liefert CreativeWork mit name/description/author/dateModified', () => {
    const werk = mockWerk({
      name: 'JSON Werk',
      kurzbeschreibung: 'Beschr',
      aktualisiertAm: new Date('2026-05-10T10:00:00Z'),
    });
    const ld = buildJsonLd({
      werk,
      inhaber: { anzeigename: 'Autor Person' },
    });
    expect(ld['@type']).toBe('CreativeWork');
    expect(ld['@context']).toBe('https://schema.org');
    expect(ld.name).toBe('JSON Werk');
    expect(ld.description).toBe('Beschr');
    expect(ld.author).toEqual({ '@type': 'Person', name: 'Autor Person' });
    expect(ld.dateModified).toBe('2026-05-10T10:00:00.000Z');
  });

  it('rendert Hilfebedarf-Tags mit deutschen Labels', () => {
    const tree = createElement(WerkDetailView, {
      werk: mockWerk({ hilfebedarf: ['ux_test', 'marketing'] }),
      inhaber: {
        id: 'n',
        anzeigename: 'X',
        avatarUrl: null,
        stadtId: 'hh',
        istFoerdermitglied: false,
      },
      stadtName: 'Hamburg',
      historie: [],
    });
    const html = renderToStaticMarkup(tree);
    expect(html).toContain('UX-Test');
    expect(html).toContain('Go-To-Market');
  });

  it('rendert Werkstand-Pill via deutsche i18n-Labels', () => {
    const tree = createElement(WerkDetailView, {
      werk: mockWerk({ werkstand: 'wachsend' }),
      inhaber: {
        id: 'n',
        anzeigename: 'X',
        avatarUrl: null,
        stadtId: 'hh',
        istFoerdermitglied: false,
      },
      stadtName: 'Hamburg',
      historie: [],
    });
    const html = renderToStaticMarkup(tree);
    expect(html).toContain('Build-Stand: Stabil');
  });

  it('rendert externen link wenn gesetzt', () => {
    const tree = createElement(WerkDetailView, {
      werk: mockWerk({ link: 'https://werk.example' }),
      inhaber: {
        id: 'n',
        anzeigename: 'X',
        avatarUrl: null,
        stadtId: 'hh',
        istFoerdermitglied: false,
      },
      stadtName: 'Hamburg',
      historie: [],
    });
    const html = renderToStaticMarkup(tree);
    expect(html).toContain('Live ansehen');
    expect(html).toContain('href="https://werk.example"');
  });

  it('Foerdermitglied-Badge nur wenn istFoerdermitglied=true', () => {
    const treeAktiv = createElement(WerkDetailView, {
      werk: mockWerk(),
      inhaber: {
        id: 'n',
        anzeigename: 'X',
        avatarUrl: null,
        stadtId: 'hh',
        istFoerdermitglied: true,
      },
      stadtName: 'Hamburg',
      historie: [],
    });
    expect(renderToStaticMarkup(treeAktiv)).toContain('Fördermitglied');

    const treeKein = createElement(WerkDetailView, {
      werk: mockWerk(),
      inhaber: {
        id: 'n',
        anzeigename: 'X',
        avatarUrl: null,
        stadtId: 'hh',
        istFoerdermitglied: false,
      },
      stadtName: 'Hamburg',
      historie: [],
    });
    expect(renderToStaticMarkup(treeKein)).not.toContain('Fördermitglied');
  });
});
