/**
 * Unit-Test: stellt sicher, dass die Werke-Uebersicht KEINE privaten Inhaber:innen-
 * Felder (email, klarname) rendert — auch dann nicht, wenn die View-Datenquelle
 * jemals so etwas versehentlich rein geben wuerde. Die View nimmt nur
 * `anzeigename`, `avatarUrl`, `stadtName` als Inhaber-Felder; die Server-Page
 * macht die Public-Field-Selektion.
 *
 * Strategie: wir rendern WerkeListView mit Items, deren Felder verbotene
 * Sequenzen enthalten — und scannen das HTML, dass diese nicht durchsickern.
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

const ListViewModule = await import('@/app/werke/werke-list-view');
const WerkeListView = ListViewModule.default;
import type { WerkeListItem, WerkeListFilterState } from '@/app/werke/werke-list-view';

const baseFilter: WerkeListFilterState = {
  stadt: 'hh',
  werkstand: [],
  hilfebedarf: [],
  sort: 'aktuell',
};

const stadtOptions = [
  { id: 'hh', name: 'Hamburg', status: 'aktiv' as const },
  { id: 'b', name: 'Berlin', status: 'vorbereitung' as const },
];

describe('WerkeListView leak check', () => {
  it('rendert NIE klarname/email — auch wenn Items "ungewollt" sowas im Hintergrund haben koennten', () => {
    // Die Props haben keine entsprechenden Felder. Doppelte Verteidigung via
    // Substring-Scan auf das gerenderte HTML.
    const items: WerkeListItem[] = [
      {
        id: 'werk-x',
        name: 'Sauberes Werk',
        kurzbeschreibung: 'Eine kompakte Beschreibung.',
        werkstand: 'prototyp',
        hilfebedarf: ['ux_test'],
        screenshots: [],
        // Wir setzen den Anzeigenamen auf etwas Neutrales — falls die View
        // jemals beginnt, weitere Felder zu rendern, faellt das auf.
        inhaberAnzeigename: 'Pseudo Person',
        inhaberAvatarUrl: null,
        inhaberStadtName: 'Hamburg',
      },
    ];
    const html = renderToStaticMarkup(
      createElement(WerkeListView, {
        items,
        filter: baseFilter,
        stadtOptions,
        stadtName: 'Hamburg',
        gesamtAktuell: 1,
        nextCursor: null,
      }),
    );

    // Sanity-Check: rendert Anzeigename
    expect(html).toContain('Pseudo Person');

    // Verbotene Strings (aus dem Task-Spec):
    expect(html).not.toContain('secret@x.de');
    expect(html).not.toContain('Geheim');

    // E-Mail-aehnliche Sequenz darf nirgends auftauchen (Anzeigenamen sind keine E-Mails).
    expect(html).not.toMatch(/@[a-z0-9.-]+\.[a-z]{2,}/i);

    // 'klarname' als Wort taucht nirgends auf.
    expect(html).not.toMatch(/klarname/i);
  });

  it('mehrere Items mit verschiedenen Anzeigenamen — keine private Felder leaken', () => {
    const items: WerkeListItem[] = [
      {
        id: 'w1',
        name: 'Werk Alpha',
        kurzbeschreibung: 'Kurz 1.',
        werkstand: 'idee',
        hilfebedarf: ['marketing'],
        screenshots: [],
        inhaberAnzeigename: 'Anna A.',
        inhaberAvatarUrl: null,
        inhaberStadtName: 'Hamburg',
      },
      {
        id: 'w2',
        name: 'Werk Beta',
        kurzbeschreibung: 'Kurz 2.',
        werkstand: 'wachsend',
        hilfebedarf: ['ux_test', 'mitstreiterinnen'],
        screenshots: ['/img/screenshot.png'],
        inhaberAnzeigename: 'Bert B.',
        inhaberAvatarUrl: '/img/avatar.png',
        inhaberStadtName: 'Hamburg',
      },
    ];
    const html = renderToStaticMarkup(
      createElement(WerkeListView, {
        items,
        filter: baseFilter,
        stadtOptions,
        stadtName: 'Hamburg',
        gesamtAktuell: 2,
        nextCursor: null,
      }),
    );

    expect(html).toContain('Anna A.');
    expect(html).toContain('Bert B.');
    expect(html).toContain('Werk Alpha');
    expect(html).toContain('Werk Beta');

    // Verlinkt auf /werke/<id>
    expect(html).toContain('href="/werke/w1"');
    expect(html).toContain('href="/werke/w2"');

    // Niemals private Felder
    expect(html).not.toMatch(/@[a-z0-9.-]+\.[a-z]{2,}/i);
    expect(html).not.toMatch(/klarname/i);
  });

  it('rendert Hilfebedarf-Tags via deutsche i18n-Labels (max 3 + mehr-Hinweis)', () => {
    const items: WerkeListItem[] = [
      {
        id: 'w-many',
        name: 'Werk mit vielen Hilfebedarfen',
        kurzbeschreibung: 'Kurz.',
        werkstand: 'prototyp',
        hilfebedarf: [
          'ux_test',
          'marketing',
          'positionierung',
          'mitstreiterinnen',
          'nutzerfeedback',
        ],
        screenshots: [],
        inhaberAnzeigename: 'Mehrer Person',
        inhaberAvatarUrl: null,
        inhaberStadtName: 'Hamburg',
      },
    ];
    const html = renderToStaticMarkup(
      createElement(WerkeListView, {
        items,
        filter: baseFilter,
        stadtOptions,
        stadtName: 'Hamburg',
        gesamtAktuell: 1,
        nextCursor: null,
      }),
    );
    // Mind. die ersten 3 deutschen Labels muessen vorhanden sein.
    expect(html).toContain('UX-Test');
    expect(html).toContain('Go-To-Market');
    expect(html).toContain('Positionierung');
    // 'mehr'-Hinweis bei >3.
    expect(html).toContain('… mehr');
  });

  it('rendert Werkstand-Pill via deutsche i18n-Labels', () => {
    const items: WerkeListItem[] = [
      {
        id: 'w-stand',
        name: 'Werk Wachsend',
        kurzbeschreibung: 'Kurz.',
        werkstand: 'wachsend',
        hilfebedarf: [],
        screenshots: [],
        inhaberAnzeigename: 'X',
        inhaberAvatarUrl: null,
        inhaberStadtName: 'Hamburg',
      },
    ];
    const html = renderToStaticMarkup(
      createElement(WerkeListView, {
        items,
        filter: baseFilter,
        stadtOptions,
        stadtName: 'Hamburg',
        gesamtAktuell: 1,
        nextCursor: null,
      }),
    );
    expect(html).toContain('Build-Stand: Stabil');
  });

  it('Werk-Name verlinkt auf /werke/<id>', () => {
    const items: WerkeListItem[] = [
      {
        id: 'cuid-abc',
        name: 'Verlinktes Werk',
        kurzbeschreibung: 'Kurz.',
        werkstand: 'prototyp',
        hilfebedarf: [],
        screenshots: [],
        inhaberAnzeigename: 'X',
        inhaberAvatarUrl: null,
        inhaberStadtName: 'Hamburg',
      },
    ];
    const html = renderToStaticMarkup(
      createElement(WerkeListView, {
        items,
        filter: baseFilter,
        stadtOptions,
        stadtName: 'Hamburg',
        gesamtAktuell: 1,
        nextCursor: null,
      }),
    );
    expect(html).toContain('href="/werke/cuid-abc"');
  });

  it('Stadt-Select rendert vorbereitende Stadt mit "(in Vorbereitung)"-Label', () => {
    const html = renderToStaticMarkup(
      createElement(WerkeListView, {
        items: [],
        filter: baseFilter,
        stadtOptions: [
          { id: 'hh', name: 'Hamburg', status: 'aktiv' },
          { id: 'b', name: 'Berlin', status: 'vorbereitung' },
          { id: 'inactive-x', name: 'Schliefen', status: 'inaktiv' },
        ],
        stadtName: 'Hamburg',
        gesamtAktuell: 0,
        nextCursor: null,
      }),
    );
    expect(html).toContain('Berlin (in Vorbereitung)');
    // Inaktive Stadt hat disabled-Attribut.
    expect(html).toMatch(/<option[^>]+value="inactive-x"[^>]+disabled/);
  });
});
