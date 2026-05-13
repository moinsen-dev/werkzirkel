/**
 * Integration-Tests fuer die `/werke`-Seite (Werke-Uebersicht, Server Component).
 *
 * Seedet Werke verschiedener Werkstaende/Hilfebedarf/Stadt und prueft, dass die
 * Server-Page die Filter aus searchParams uebernimmt und die richtigen Werke
 * rendert. Pagination-Smoketest inklusive.
 *
 * Wir mocken nur `next/link`. `searchParams` werden direkt als Promise
 * uebergeben — kein Next-Routing-Mock noetig.
 */

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createId } from '@paralleldrive/cuid2';
import { sql } from 'drizzle-orm';

import { db } from '@/lib/db';
import { nutzer, werk } from '@/lib/db/schema';
import { truncateAll } from '../_helpers/db-cleanup';

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
const WerkePageModule = await import('@/app/werke/page');
const WerkePage = WerkePageModule.default;

type SearchParams = {
  stadt?: string;
  werkstand?: string | string[];
  hilfebedarf?: string | string[];
  sort?: string;
  cursor?: string;
};

async function renderPage(sp: SearchParams = {}): Promise<string> {
  const tree = await WerkePage({ searchParams: Promise.resolve(sp) });
  return renderToStaticMarkup(tree);
}

async function macherAnlegen(opts: {
  email: string;
  anzeigename: string;
  klarname?: string;
  stadtId?: string;
}): Promise<string> {
  const id = createId();
  await db.insert(nutzer).values({
    id,
    email: opts.email,
    klarname: opts.klarname ?? `Klar ${opts.email}`,
    anzeigename: opts.anzeigename,
    stadtId: opts.stadtId ?? 'hh',
    rollen: ['macher'],
    emailVerifiziertAm: new Date(),
  });
  return id;
}

async function werkAnlegen(
  nutzerId: string,
  overrides: Partial<typeof werk.$inferInsert> = {},
): Promise<string> {
  const id = createId();
  await db.insert(werk).values({
    id,
    nutzerId,
    name: 'Standard Werk',
    kurzbeschreibung: 'Kurz.',
    problem: 'Problem.',
    zielgruppe: 'Zielgruppe.',
    werkstand: 'idee',
    hilfebedarf: [],
    sichtbarkeit: 'oeffentlich',
    status: 'aktiv',
    ...overrides,
  });
  return id;
}

describe('/werke — Werke-Uebersicht', () => {
  beforeEach(async () => {
    await truncateAll();
  });
  afterAll(async () => {
    await truncateAll();
  });

  it('default (keine Params) → 200, stadt=hh, listet Hamburg-Werke', async () => {
    const hhUser = await macherAnlegen({
      email: 'over-hh-1@test.werkzirkel.de',
      anzeigename: 'HH Person',
      stadtId: 'hh',
    });
    await werkAnlegen(hhUser, { name: 'Hamburg-Werk 1' });
    await werkAnlegen(hhUser, { name: 'Hamburg-Werk 2' });

    const bUser = await macherAnlegen({
      email: 'over-b-1@test.werkzirkel.de',
      anzeigename: 'B Person',
      stadtId: 'b',
    });
    await werkAnlegen(bUser, { name: 'Berlin-Werk 1' });

    const html = await renderPage();
    expect(html).toContain('Hamburg-Werk 1');
    expect(html).toContain('Hamburg-Werk 2');
    expect(html).not.toContain('Berlin-Werk 1');
    // Eyebrow nennt Hamburg
    expect(html).toContain('Werke im Werkzirkel Hamburg');
  });

  it('werkstand=prototyp&werkstand=oeffentlich → nur diese Werkstaende', async () => {
    const u = await macherAnlegen({
      email: 'over-ws@test.werkzirkel.de',
      anzeigename: 'WS Person',
    });
    await werkAnlegen(u, { name: 'Idee-Werk', werkstand: 'idee' });
    await werkAnlegen(u, { name: 'Prototyp-Werk', werkstand: 'prototyp' });
    await werkAnlegen(u, { name: 'Oeffentlich-Werk', werkstand: 'oeffentlich' });
    await werkAnlegen(u, { name: 'Wachsend-Werk', werkstand: 'wachsend' });

    const html = await renderPage({ werkstand: ['prototyp', 'oeffentlich'] });
    expect(html).toContain('Prototyp-Werk');
    expect(html).toContain('Oeffentlich-Werk');
    expect(html).not.toContain('Idee-Werk');
    expect(html).not.toContain('Wachsend-Werk');
  });

  it('hilfebedarf=ux_test → nur Werke mit ux_test im Array', async () => {
    const u = await macherAnlegen({
      email: 'over-hb@test.werkzirkel.de',
      anzeigename: 'HB Person',
    });
    await werkAnlegen(u, {
      name: 'UX-Werk',
      hilfebedarf: ['ux_test', 'marketing'],
    });
    await werkAnlegen(u, {
      name: 'Marketing-Werk',
      hilfebedarf: ['marketing'],
    });

    const html = await renderPage({ hilfebedarf: 'ux_test' });
    expect(html).toContain('UX-Werk');
    expect(html).not.toContain('Marketing-Werk');
  });

  it('stadt=b → Berlin-Empty-State-Hinweis', async () => {
    // Auch wenn Berlin keine Werke hat (oder welche, je nach Test-Seed).
    // Wir seeden keine Berlin-Werke und erwarten den Hinweis-Text.
    const html = await renderPage({ stadt: 'b' });
    expect(html).toContain('Berlin startet, sobald Hamburg trägt');
    expect(html).toContain('Hamburger Werke ansehen');
  });

  it('stadt=unknown → faellt auf hh zurueck', async () => {
    const u = await macherAnlegen({
      email: 'over-unk@test.werkzirkel.de',
      anzeigename: 'Unbekannt-Stadt Person',
      stadtId: 'hh',
    });
    await werkAnlegen(u, { name: 'Fallback-Werk' });

    const html = await renderPage({ stadt: 'unknown' });
    expect(html).toContain('Fallback-Werk');
    expect(html).toContain('Werke im Werkzirkel Hamburg');
  });

  it('rendert KEINE private Felder (email, klarname) im HTML', async () => {
    await macherAnlegen({
      email: 'secret@x.de',
      klarname: 'Geheim Person',
      anzeigename: 'Pseudo-Anz',
      stadtId: 'hh',
    }).then(async (uid) => {
      await werkAnlegen(uid, { name: 'Leak-Test-Werk' });
    });

    const html = await renderPage();
    expect(html).toContain('Leak-Test-Werk');
    expect(html).toContain('Pseudo-Anz');
    expect(html).not.toContain('secret@x.de');
    expect(html).not.toContain('Geheim Person');
  });

  it('KEIN Suchschlitz im gerenderten HTML', async () => {
    const u = await macherAnlegen({
      email: 'no-search@test.werkzirkel.de',
      anzeigename: 'NoSearch Person',
    });
    await werkAnlegen(u, { name: 'Egal-Werk' });

    const html = await renderPage();
    expect(html).not.toMatch(/<input[^>]+type="search"/i);
    expect(html).not.toMatch(/<input[^>]+name="q"/i);
    expect(html).not.toMatch(/<input[^>]+name="suche"/i);
    expect(html).not.toMatch(/<input[^>]+name="query"/i);
    expect(html).not.toMatch(/role="searchbox"/i);
  });

  it('pausierte Werke (sichtbarkeit=pausiert) erscheinen NICHT', async () => {
    const u = await macherAnlegen({
      email: 'paused@test.werkzirkel.de',
      anzeigename: 'Pausiert Person',
    });
    await werkAnlegen(u, { name: 'Aktives Werk', sichtbarkeit: 'oeffentlich' });
    await werkAnlegen(u, {
      name: 'Pausiertes Werk',
      sichtbarkeit: 'pausiert',
    });

    const html = await renderPage();
    expect(html).toContain('Aktives Werk');
    expect(html).not.toContain('Pausiertes Werk');
  });

  it('ausgeblendete Werke (status=ausgeblendet) erscheinen NICHT', async () => {
    const u = await macherAnlegen({
      email: 'hidden@test.werkzirkel.de',
      anzeigename: 'Versteckt Person',
    });
    await werkAnlegen(u, { name: 'Aktives Werk 2', status: 'aktiv' });
    await werkAnlegen(u, {
      name: 'Ausgeblendetes Werk',
      status: 'ausgeblendet',
    });

    const html = await renderPage();
    expect(html).toContain('Aktives Werk 2');
    expect(html).not.toContain('Ausgeblendetes Werk');
  });

  it('Cursor-Pagination: erste Seite gibt cursor, zweite liefert Rest ohne Doppel', async () => {
    const u = await macherAnlegen({
      email: 'paging@test.werkzirkel.de',
      anzeigename: 'Paging Person',
    });
    // 25 Werke, mit deterministisch gestaffelten aktualisiert_am.
    for (let i = 0; i < 25; i++) {
      await werkAnlegen(u, {
        name: `Paging-Werk ${String(i).padStart(2, '0')}`,
      });
    }
    // Staffelung manuell setzen (Default-NOW() kollidiert bei schnellen Inserts).
    await db.execute(sql`
      UPDATE werk SET aktualisiert_am = NOW() - (
        (regexp_replace(name, '\\D', '', 'g'))::int * INTERVAL '1 second'
      )
    `);

    // Erste Seite: 20 Werke + Cursor.
    const firstHtml = await renderPage();
    expect(firstHtml).toContain('Paging-Werk 00');
    // Spaeteste Werke (i=0) sind oben, i=19 ist die unterste auf Seite 1.
    expect(firstHtml).toContain('Paging-Werk 19');
    // Werk 20..24 darf NICHT auf Seite 1 sein.
    expect(firstHtml).not.toContain('Paging-Werk 20');
    // Pagination-Link
    expect(firstHtml).toContain('Weitere 20 Werke ansehen');
    // Cursor-Param: wir extrahieren den Cursor-Wert aus dem Link.
    const m = firstHtml.match(/cursor=([a-z0-9-]+)/i);
    expect(m).toBeTruthy();
    const cursor = m![1]!;

    // Zweite Seite mit Cursor:
    const secondHtml = await renderPage({ cursor });
    expect(secondHtml).toContain('Paging-Werk 20');
    expect(secondHtml).toContain('Paging-Werk 24');
    // Erste-Seiten-Werke sollten nicht auf der zweiten Seite landen.
    expect(secondHtml).not.toContain('Paging-Werk 00');
    expect(secondHtml).not.toContain('Paging-Werk 10');
    // Keine weitere Seite mehr — kein Cursor-Link.
    expect(secondHtml).not.toContain('Weitere 20 Werke ansehen');
  });

  it('sort=neu → ORDER BY erstellt_am DESC (deterministisches Beispiel)', async () => {
    const u = await macherAnlegen({
      email: 'sort-neu@test.werkzirkel.de',
      anzeigename: 'Sort Person',
    });
    await werkAnlegen(u, { name: 'Sort-Alt' });
    await werkAnlegen(u, { name: 'Sort-Neu' });
    // erstellt_am manuell setzen — Sort-Alt soll aelter sein.
    await db.execute(sql`
      UPDATE werk SET erstellt_am = NOW() - INTERVAL '2 hours'
      WHERE name = 'Sort-Alt'
    `);
    await db.execute(sql`
      UPDATE werk SET erstellt_am = NOW() - INTERVAL '1 minute'
      WHERE name = 'Sort-Neu'
    `);

    const html = await renderPage({ sort: 'neu' });
    const idxNeu = html.indexOf('Sort-Neu');
    const idxAlt = html.indexOf('Sort-Alt');
    expect(idxNeu).toBeGreaterThan(-1);
    expect(idxAlt).toBeGreaterThan(-1);
    // Sort-Neu erscheint im HTML vor Sort-Alt.
    expect(idxNeu).toBeLessThan(idxAlt);
  });
});
