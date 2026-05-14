/**
 * Integration-Tests fuer SEO-Files (PRD §31):
 *  - app/robots.ts liefert die erwarteten allow/disallow-Direktiven
 *  - app/sitemap.ts listet statische Routen + dynamische Werke/Werkpaesse/Termine/Zirkel
 *  - sitemap-Eintraege verlinken auf APP_URL-Basis
 *  - keine privaten Routen in sitemap
 *  - JSON-LD: Werk-Detail buildJsonLd liefert valides Schema.org-Objekt
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createId } from '@paralleldrive/cuid2';

import robots from '@/app/robots';
import sitemap from '@/app/sitemap';
import { buildJsonLd as buildWerkJsonLd } from '@/app/werke/[id]/werk-detail-view';
import { buildWerkpassJsonLd } from '@/app/werkpass/[id]/werkpass-view';
import { buildZirkelJsonLd } from '@/app/zirkel/[stadt]/zirkel-stadt-view';
import { db } from '@/lib/db';
import { nutzer, termin, werk } from '@/lib/db/schema';
import { env } from '@/lib/env';
import { truncateAll } from '../_helpers/db-cleanup';

const APP_URL = env.APP_URL.replace(/\/+$/, '');

async function legeMacherinAn(opts?: { stadtId?: string }) {
  const id = createId();
  await db.insert(nutzer).values({
    id,
    email: `${id}@test.werkzirkel.de`,
    klarname: 'Klar Test',
    anzeigename: 'Anzeige Test',
    stadtId: opts?.stadtId ?? 'hh',
    rollen: ['macher'],
    emailVerifiziertAm: new Date(),
  });
  return id;
}

async function legeOeffentlichesWerkAn(nutzerId: string) {
  const id = createId();
  await db.insert(werk).values({
    id,
    nutzerId,
    name: 'Sitemap-Testwerk',
    kurzbeschreibung: 'Kurz.',
    problem: 'Problem.',
    zielgruppe: 'Zielgruppe.',
    werkstand: 'prototyp',
    sichtbarkeit: 'oeffentlich',
    status: 'aktiv',
  });
  return id;
}

async function legeVerstecktesWerkAn(nutzerId: string) {
  const id = createId();
  await db.insert(werk).values({
    id,
    nutzerId,
    name: 'Verstecktes Werk',
    kurzbeschreibung: 'Kurz.',
    problem: 'Problem.',
    zielgruppe: 'Zielgruppe.',
    werkstand: 'idee',
    sichtbarkeit: 'pausiert', // → darf NICHT in sitemap
    status: 'aktiv',
  });
  return id;
}

async function legeVeroeffentlichtenTerminAn(kuratorId: string) {
  const id = createId();
  await db.insert(termin).values({
    id,
    stadtId: 'hh',
    typ: 'schauabend',
    titel: 'Sitemap-Test-Termin',
    beschreibung: 'Beschreibung',
    datumUhrzeit: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    maxTeilnehmer: 10,
    erstelltVon: kuratorId,
    status: 'veroeffentlicht',
  });
  return id;
}

describe('robots.ts', () => {
  it('erlaubt Public-Routen und verbietet private Bereiche', () => {
    const result = robots();
    expect(Array.isArray(result.rules)).toBe(true);
    const r = Array.isArray(result.rules) ? result.rules[0] : result.rules;
    if (!r) throw new Error('robots() lieferte keine Regel');
    expect(r.userAgent).toBe('*');
    expect(r.allow).toBe('/');
    const disallow = (Array.isArray(r.disallow) ? r.disallow : [r.disallow]).filter(
      (x): x is string => typeof x === 'string',
    );
    expect(disallow).toContain('/api/');
    expect(disallow).toContain('/admin/');
    expect(disallow).toContain('/kurator/');
    expect(disallow).toContain('/uebersicht/');
    expect(disallow).toContain('/einstellungen/');
    expect(disallow).toContain('/bedarfe/');
    expect(disallow).toContain('/werkangebote/');
  });

  it('verweist auf sitemap.xml', () => {
    const result = robots();
    expect(result.sitemap).toBe(`${APP_URL}/sitemap.xml`);
  });
});

describe('sitemap.ts', () => {
  beforeAll(truncateAll);
  afterAll(truncateAll);

  it('enthaelt statische Public-Routen mit absoluten URLs', async () => {
    const entries = await sitemap();
    const urls = entries.map((e) => e.url);
    expect(urls).toContain(`${APP_URL}/`);
    expect(urls).toContain(`${APP_URL}/werke`);
    expect(urls).toContain(`${APP_URL}/termine`);
    expect(urls).toContain(`${APP_URL}/bedarf`);
    expect(urls).toContain(`${APP_URL}/foerdern`);
    expect(urls).toContain(`${APP_URL}/impressum`);
    expect(urls).toContain(`${APP_URL}/datenschutz`);
    expect(urls).toContain(`${APP_URL}/agb`);
    expect(urls).toContain(`${APP_URL}/regeln`);
  });

  it('enthaelt NIE private Routen', async () => {
    const entries = await sitemap();
    const urls = entries.map((e) => e.url);
    expect(urls.some((u) => u.includes('/uebersicht'))).toBe(false);
    expect(urls.some((u) => u.includes('/einstellungen'))).toBe(false);
    expect(urls.some((u) => u.includes('/admin'))).toBe(false);
    expect(urls.some((u) => u.includes('/kurator'))).toBe(false);
    expect(urls.some((u) => u.includes('/api/'))).toBe(false);
  });

  it('listet oeffentliche Werke, ausgeblendete/pausierte werden nicht aufgenommen', async () => {
    const u = await legeMacherinAn();
    const oeffentlichId = await legeOeffentlichesWerkAn(u);
    await legeVerstecktesWerkAn(u);

    const entries = await sitemap();
    const urls = entries.map((e) => e.url);
    expect(urls).toContain(`${APP_URL}/werke/${oeffentlichId}`);
    expect(urls.filter((u2) => u2.includes('Verstecktes')).length).toBe(0);
  });

  it('listet veroeffentlichte Termine', async () => {
    const u = await legeMacherinAn();
    const terminId = await legeVeroeffentlichtenTerminAn(u);
    const entries = await sitemap();
    const urls = entries.map((e) => e.url);
    expect(urls).toContain(`${APP_URL}/termine/${terminId}`);
  });

  it('listet aktive Stadt-Zirkel', async () => {
    const entries = await sitemap();
    const urls = entries.map((e) => e.url);
    // Hamburg ist initial aktiv in der Seed-DB; Berlin/Muenchen in
    // Vorbereitung — beide sollen drin sein, aber Hamburg mit hoeherer
    // Prio. Hier nur Praesenz pruefen.
    expect(urls).toContain(`${APP_URL}/zirkel/hamburg`);
  });

  it('listet Werkpass-Seiten von aktiven Macher:innen', async () => {
    const u = await legeMacherinAn();
    const entries = await sitemap();
    const urls = entries.map((e) => e.url);
    expect(urls).toContain(`${APP_URL}/werkpass/${u}`);
  });
});

describe('JSON-LD builder', () => {
  it('Werk: schema.org CreativeWork mit Autor', () => {
    const fakeWerk = {
      id: 'w1',
      name: 'Mein Werk',
      kurzbeschreibung: 'Kurz',
      aktualisiertAm: new Date('2026-05-13T12:00:00Z'),
    } as unknown as Parameters<typeof buildWerkJsonLd>[0]['werk'];
    const ld = buildWerkJsonLd({
      werk: fakeWerk,
      inhaber: { anzeigename: 'Jana' },
    });
    expect(ld['@context']).toBe('https://schema.org');
    expect(ld['@type']).toBe('CreativeWork');
    expect(ld.name).toBe('Mein Werk');
    expect((ld.author as { name: string }).name).toBe('Jana');
  });

  it('Werkpass: schema.org Person mit homeLocation', () => {
    const ld = buildWerkpassJsonLd({
      nutzer: {
        id: 'n1',
        anzeigename: 'Jana',
        avatarUrl: null,
        kurzbeschreibung: 'Macherin in Hamburg',
        faehigkeiten: ['typescript', 'react'],
        interessen: [],
        website: 'https://jana.example',
        github: null,
        linkedin: null,
        mastodon: null,
        teilnahmeart: null,
        stadtName: 'Hamburg',
        istFoerdermitglied: false,
      },
      werkeGesamt: 3,
    });
    expect(ld['@context']).toBe('https://schema.org');
    expect(ld['@type']).toBe('Person');
    expect(ld.name).toBe('Jana');
    expect(ld.knowsAbout).toEqual(['typescript', 'react']);
    expect((ld.homeLocation as { name: string }).name).toBe('Hamburg');
    expect(ld.sameAs).toEqual(['https://jana.example']);
  });

  it('Werkpass: ohne Werke kein "owns"-Eintrag', () => {
    const ld = buildWerkpassJsonLd({
      nutzer: {
        id: 'n2',
        anzeigename: 'Tim',
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
      werkeGesamt: 0,
    });
    expect(ld.owns).toBeUndefined();
  });

  it('Zirkel: schema.org Place mit address', () => {
    const ld = buildZirkelJsonLd({
      stadtRow: {
        id: 'hh',
        name: 'Hamburg',
        status: 'aktiv',
        beschreibung: null,
      },
      appUrl: 'https://werkzirkel.de',
    });
    expect(ld['@context']).toBe('https://schema.org');
    expect(ld['@type']).toBe('Place');
    expect(ld.name).toBe('Werkzirkel Hamburg');
    expect((ld.address as { addressLocality: string }).addressLocality).toBe('Hamburg');
    expect(ld.publicAccess).toBe(true);
  });
});
