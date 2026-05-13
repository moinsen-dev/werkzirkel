/**
 * Unit-Test: ZirkelStadtView in der `vorbereitung`-Variante darf KEINE
 * Mitglieder/Werke/Termine-Sektionen rendern — selbst wenn die Page-Schicht
 * trotzdem Daten reichen wuerde (z.B. Seed-Fehler). Defense in depth.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  }) => {
    return (require('react') as typeof import('react')).createElement(
      'a',
      { href, ...(rest as Record<string, unknown>) },
      children,
    );
  },
}));

const { renderToStaticMarkup } = await import('react-dom/server');
const ViewModule = await import('@/app/zirkel/[stadt]/zirkel-stadt-view');
const ZirkelStadtView = ViewModule.default;

describe('ZirkelStadtView (vorbereitung)', () => {
  it('rendert KEINE Mitglieder/Werke/Termine-Sektion fuer Berlin (status=vorbereitung)', () => {
    const tree = ZirkelStadtView({
      stadtRow: {
        id: 'b',
        name: 'Berlin',
        status: 'vorbereitung',
        beschreibung: 'In Vorbereitung — aktiv, sobald Hamburg trägt.',
      },
      // Daten werden trotzdem reingereicht — die View darf sie nicht anzeigen.
      mitglieder: [
        {
          id: 'soll-nicht-erscheinen',
          anzeigename: 'Geist Macher Berlin',
          avatarUrl: null,
        },
      ],
      werke: [
        {
          id: 'werk-soll-nicht-erscheinen',
          name: 'Geist Werk Berlin',
          kurzbeschreibung: 'Sollte nicht erscheinen.',
          werkstand: 'prototyp',
          hilfebedarf: [],
          screenshots: [],
          inhaberAnzeigename: 'Geist Macher',
          inhaberAvatarUrl: null,
        },
      ],
      termine: [
        {
          id: 'termin-soll-nicht-erscheinen',
          titel: 'Geist Termin Berlin',
          typ: 'schauabend',
          datumUhrzeit: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      ],
      stadtMail: 'berlin@werkzirkel.de',
    });

    const html = renderToStaticMarkup(tree);

    // Hero + Vorbereitung-Variante OK
    expect(html).toContain('Werkzirkel Berlin');
    expect(html).toContain('In Vorbereitung');

    // Mitglieder/Werke/Termine duerfen NIE im HTML auftauchen.
    expect(html).not.toContain('Geist Macher Berlin');
    expect(html).not.toContain('Geist Werk Berlin');
    expect(html).not.toContain('Geist Termin Berlin');
    expect(html).not.toContain('Aktive Macher:innen');
    expect(html).not.toContain('Werke aus dem Kreis');
    expect(html).not.toContain('Nächste Termine');
  });

  it('inaktiv-Variante hat kein Vormerken-CTA und keine Datenlisten', () => {
    const tree = ZirkelStadtView({
      stadtRow: {
        id: 'm',
        name: 'München',
        status: 'inaktiv',
        beschreibung: null,
      },
      mitglieder: [],
      werke: [],
      termine: [],
      stadtMail: 'muenchen@werkzirkel.de',
    });

    const html = renderToStaticMarkup(tree);
    expect(html).toContain('Werkzirkel München');
    expect(html).toContain('Ruhend');
    // KEIN Vormerken-Button bei inaktiv.
    expect(html).not.toContain('Eröffnung warten');
    expect(html).not.toContain('Aktive Macher:innen');
  });

  it('aktiv-Variante zeigt Mitglieder + Werke + Termine', () => {
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const tree = ZirkelStadtView({
      stadtRow: {
        id: 'hh',
        name: 'Hamburg',
        status: 'aktiv',
        beschreibung: 'Aktiver Hamburger Kreis.',
      },
      mitglieder: [
        { id: 'mid1', anzeigename: 'Aktiver Macher 1', avatarUrl: null },
      ],
      werke: [
        {
          id: 'wid1',
          name: 'Aktives Werk 1',
          kurzbeschreibung: 'Kurz.',
          werkstand: 'prototyp',
          hilfebedarf: ['ux_test'],
          screenshots: [],
          inhaberAnzeigename: 'Aktiver Macher 1',
          inhaberAvatarUrl: null,
        },
      ],
      termine: [
        {
          id: 'tid1',
          titel: 'Aktiver Schauabend',
          typ: 'schauabend',
          datumUhrzeit: future,
        },
      ],
      stadtMail: 'hamburg@werkzirkel.de',
    });
    const html = renderToStaticMarkup(tree);
    expect(html).toContain('Aktiver Kreis');
    expect(html).toContain('Aktiver Macher 1');
    expect(html).toContain('Aktives Werk 1');
    expect(html).toContain('Aktiver Schauabend');
    expect(html).toContain('/werkpass/mid1');
    expect(html).toContain('/werke/wid1');
  });
});
