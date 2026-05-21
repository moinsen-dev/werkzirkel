/**
 * Unit-Test: stellt sicher, dass die Werke-Uebersicht KEINEN Suchschlitz hat.
 * Das ist die Hard-Rule aus PRD-Prinzip P4 (Verbindlichkeit statt Rauschen).
 *
 * Wir rendern die `WerkeListView` mit Minimal-Mock-Daten und scannen das HTML:
 * - keine `<input type="search">`
 * - kein Input mit name='q', name='query', name='suche' oder name='search'
 * - kein `role="searchbox"`
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
  { id: 'm', name: 'München', status: 'vorbereitung' as const },
];

function makeItem(overrides: Partial<WerkeListItem> = {}): WerkeListItem {
  return {
    id: 'werk-1',
    name: 'Beispiel-Werk',
    kurzbeschreibung: 'Eine kompakte Beschreibung des Werks.',
    werkstand: 'prototyp',
    hilfebedarf: ['ux_test'],
    screenshots: [],
    inhaberAnzeigename: 'Anz Person',
    inhaberAvatarUrl: null,
    inhaberStadtName: 'Hamburg',
    ...overrides,
  };
}

describe('WerkeListView — no search input (P4)', () => {
  it('rendert KEIN <input type="search">', () => {
    const html = renderToStaticMarkup(
      createElement(WerkeListView, {
        items: [makeItem()],
        filter: baseFilter,
        stadtOptions,
        stadtName: 'Hamburg',
        gesamtAktuell: 1,
        nextCursor: null,
      }),
    );
    expect(html).not.toMatch(/<input[^>]+type="search"/i);
  });

  it('rendert KEIN Input mit name="q", "query", "suche", "search"', () => {
    const html = renderToStaticMarkup(
      createElement(WerkeListView, {
        items: [makeItem()],
        filter: baseFilter,
        stadtOptions,
        stadtName: 'Hamburg',
        gesamtAktuell: 1,
        nextCursor: null,
      }),
    );
    expect(html).not.toMatch(/<input[^>]+name="q"/i);
    expect(html).not.toMatch(/<input[^>]+name="query"/i);
    expect(html).not.toMatch(/<input[^>]+name="suche"/i);
    expect(html).not.toMatch(/<input[^>]+name="search"/i);
  });

  it('rendert kein role="searchbox"', () => {
    const html = renderToStaticMarkup(
      createElement(WerkeListView, {
        items: [makeItem()],
        filter: baseFilter,
        stadtOptions,
        stadtName: 'Hamburg',
        gesamtAktuell: 1,
        nextCursor: null,
      }),
    );
    expect(html).not.toMatch(/role="searchbox"/i);
  });

  it('rendert Filter via Checkbox/Radio/Select (positiver Check)', () => {
    const html = renderToStaticMarkup(
      createElement(WerkeListView, {
        items: [],
        filter: baseFilter,
        stadtOptions,
        stadtName: 'Hamburg',
        gesamtAktuell: 0,
        nextCursor: null,
      }),
    );
    // Checkbox-Filter fuer Werkstand
    expect(html).toMatch(/<input[^>]+type="checkbox"[^>]+name="werkstand"/);
    // Checkbox-Filter fuer Hilfebedarf
    expect(html).toMatch(/<input[^>]+type="checkbox"[^>]+name="hilfebedarf"/);
    // Radio-Filter fuer Sortierung
    expect(html).toMatch(/<input[^>]+type="radio"[^>]+name="sort"/);
    // Select fuer Stadt
    expect(html).toMatch(/<select[^>]+name="stadt"/);
  });

  it('rendert hero-Eyebrow + H1 + Stadt-Hinweis', () => {
    const html = renderToStaticMarkup(
      createElement(WerkeListView, {
        items: [makeItem()],
        filter: baseFilter,
        stadtOptions,
        stadtName: 'Hamburg',
        gesamtAktuell: 7,
        nextCursor: null,
      }),
    );
    expect(html).toContain('Werke im Werkzirkel Hamburg');
    expect(html).toContain('Werke aus der Region.');
    expect(html).toContain('7 Builds gerade aktiv');
  });

  it('rendert deutschen Singular bei genau 1 Werk', () => {
    const html = renderToStaticMarkup(
      createElement(WerkeListView, {
        items: [makeItem()],
        filter: baseFilter,
        stadtOptions,
        stadtName: 'Hamburg',
        gesamtAktuell: 1,
        nextCursor: null,
      }),
    );
    expect(html).toContain('1 Build gerade aktiv');
  });

  it('Berlin-Empty-State zeigt den Hamburg-Trag-Hinweis', () => {
    const html = renderToStaticMarkup(
      createElement(WerkeListView, {
        items: [],
        filter: { ...baseFilter, stadt: 'b' },
        stadtOptions,
        stadtName: 'Berlin',
        gesamtAktuell: 0,
        nextCursor: null,
      }),
    );
    expect(html).toContain('Berlin startet, sobald Hamburg trägt');
    expect(html).toContain('Hamburger Werke ansehen');
  });

  it('Normal-Empty-State (Hamburg, keine Werke) zeigt Filter-Reset-Hinweis', () => {
    const html = renderToStaticMarkup(
      createElement(WerkeListView, {
        items: [],
        filter: { ...baseFilter, werkstand: ['idee'] },
        stadtOptions,
        stadtName: 'Hamburg',
        gesamtAktuell: 0,
        nextCursor: null,
      }),
    );
    expect(html).toContain('Probier weniger restriktive Filter');
  });

  it('Pagination-Link erscheint wenn nextCursor gesetzt', () => {
    const html = renderToStaticMarkup(
      createElement(WerkeListView, {
        items: [makeItem()],
        filter: baseFilter,
        stadtOptions,
        stadtName: 'Hamburg',
        gesamtAktuell: 25,
        nextCursor: 'werk-cursor-xyz',
      }),
    );
    expect(html).toContain('Weitere 20 Werke ansehen');
    expect(html).toContain('cursor=werk-cursor-xyz');
  });

  it('buildCursorHref haengt Filter + Cursor an URL an', () => {
    const href = ListViewModule.buildCursorHref(
      {
        stadt: 'hh',
        werkstand: ['prototyp', 'oeffentlich'],
        hilfebedarf: ['ux_test'],
        sort: 'aktuell',
      },
      'cursor-abc',
    );
    // 'hh' + 'aktuell' sind Defaults und werden nicht angehaengt.
    expect(href).toMatch(/^\/werke\?/);
    expect(href).toContain('werkstand=prototyp');
    expect(href).toContain('werkstand=oeffentlich');
    expect(href).toContain('hilfebedarf=ux_test');
    expect(href).toContain('cursor=cursor-abc');
    expect(href).not.toContain('stadt=');
    expect(href).not.toContain('sort=');
  });

  it('buildCursorHref schreibt non-default stadt + sort', () => {
    const href = ListViewModule.buildCursorHref(
      {
        stadt: 'b',
        werkstand: [],
        hilfebedarf: [],
        sort: 'neu',
      },
      'c1',
    );
    expect(href).toContain('stadt=b');
    expect(href).toContain('sort=neu');
    expect(href).toContain('cursor=c1');
  });
});
