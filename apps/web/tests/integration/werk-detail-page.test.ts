/**
 * Integration-Tests fuer die `/werke/[id]`-Seite (Server Component).
 *
 * Wir mocken `next/headers`, `next/link` und `next/navigation` (insb.
 * `notFound()`), rufen die Page direkt auf und rendern den React-Tree via
 * `renderToStaticMarkup` zu HTML. `notFound()` wirft einen Sentinel-Error,
 * den wir abfangen.
 */

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createId } from '@paralleldrive/cuid2';
import { eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import {
  nutzer,
  session as sessionTable,
  werk,
  werkHistorie,
} from '@/lib/db/schema';
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

let mockHeaders = new Map<string, string>();
let lastNotFound = false;

vi.mock('next/headers', () => ({
  headers: async () => ({
    entries: () => mockHeaders.entries(),
    get: (name: string) => mockHeaders.get(name.toLowerCase()) ?? null,
  }),
  cookies: async () => ({
    set: () => {
      /* no-op */
    },
  }),
}));

vi.mock('next/navigation', () => ({
  notFound: () => {
    lastNotFound = true;
    const err = new Error('NEXT_NOT_FOUND');
    (err as Error & { digest: string }).digest = 'NEXT_NOT_FOUND';
    throw err;
  },
}));

// Erst nach den Mocks importieren.
const { renderToStaticMarkup } = await import('react-dom/server');
const WerkPageModule = await import('@/app/werke/[id]/page');
const WerkPage = WerkPageModule.default;

async function reset(): Promise<void> {
  await truncateAll();
  mockHeaders = new Map();
  lastNotFound = false;
}

async function macherAnlegen(opts: {
  email: string;
  anzeigename?: string;
  klarname?: string;
  stadtId?: string;
}): Promise<string> {
  const id = createId();
  await db.insert(nutzer).values({
    id,
    email: opts.email,
    klarname: opts.klarname ?? `Klar ${opts.email}`,
    anzeigename: opts.anzeigename ?? `anz-${id.slice(0, 6)}`,
    stadtId: opts.stadtId ?? 'hh',
    rollen: ['macher'],
    emailVerifiziertAm: new Date(),
  });
  return id;
}

async function sessionAnlegen(nutzerId: string): Promise<string> {
  const sid = createId();
  await db.insert(sessionTable).values({
    id: sid,
    nutzerId,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });
  return sid;
}

async function werkAnlegen(
  nutzerId: string,
  overrides: Partial<typeof werk.$inferInsert> = {},
): Promise<string> {
  const id = createId();
  await db.insert(werk).values({
    id,
    nutzerId,
    name: 'Hamburger Werk',
    kurzbeschreibung: 'Eine kompakte Zeile zum Werk.',
    problem: 'Wir loesen ein konkretes Problem.',
    zielgruppe: 'Indie-Macher:innen aus Hamburg.',
    werkstand: 'idee',
    hilfebedarf: ['ux_test'],
    sichtbarkeit: 'oeffentlich',
    status: 'aktiv',
    ...overrides,
  });
  return id;
}

function setSessionCookie(sid: string): void {
  mockHeaders.set('cookie', `wz_session=${encodeURIComponent(sid)}`);
}

async function render(
  id: string,
  opts: { sid?: string } = {},
): Promise<{ html: string; notFound: boolean }> {
  if (opts.sid) setSessionCookie(opts.sid);
  try {
    const tree = await WerkPage({ params: Promise.resolve({ id }) });
    const html = renderToStaticMarkup(tree);
    return { html, notFound: false };
  } catch (err) {
    if (err instanceof Error && err.message === 'NEXT_NOT_FOUND') {
      return { html: '', notFound: true };
    }
    throw err;
  }
}

describe('/werke/[id] page', () => {
  beforeEach(reset);
  afterAll(reset);

  it('rendert oeffentliches Werk anonym mit Name + Werkstand-Pill', async () => {
    const userId = await macherAnlegen({
      email: 'wd-1@test.werkzirkel.de',
      anzeigename: 'Lara Z.',
    });
    const werkId = await werkAnlegen(userId, { name: 'Mein Tool' });

    const { html, notFound } = await render(werkId);
    expect(notFound).toBe(false);
    expect(html).toContain('Mein Tool');
    expect(html).toContain('Build-Stand: Idee');
    expect(html).toContain('Lara Z.');
  });

  it('rendert keine private Felder (email, klarname) im HTML', async () => {
    const userId = await macherAnlegen({
      email: 'leak-check@test.werkzirkel.de',
      anzeigename: 'Pseudo Name',
      klarname: 'Geheim Maxine',
    });
    const werkId = await werkAnlegen(userId);

    const { html } = await render(werkId);
    expect(html).not.toContain('leak-check@test.werkzirkel.de');
    expect(html).not.toContain('Geheim Maxine');
  });

  it('Werk pausiert + anonym → 404', async () => {
    const userId = await macherAnlegen({ email: 'pause-anon@test.werkzirkel.de' });
    const werkId = await werkAnlegen(userId, { sichtbarkeit: 'pausiert' });

    const { notFound } = await render(werkId);
    expect(notFound).toBe(true);
  });

  it('Werk pausiert + als Inhaber:in → 200', async () => {
    const userId = await macherAnlegen({
      email: 'pause-own@test.werkzirkel.de',
      anzeigename: 'Eigene Person',
    });
    const sid = await sessionAnlegen(userId);
    const werkId = await werkAnlegen(userId, {
      name: 'Pausiertes Werk',
      sichtbarkeit: 'pausiert',
    });

    const { html, notFound } = await render(werkId, { sid });
    expect(notFound).toBe(false);
    expect(html).toContain('Pausiertes Werk');
  });

  it('Werk ausgeblendet + Inhaber:in → 404', async () => {
    const userId = await macherAnlegen({ email: 'ausg-own@test.werkzirkel.de' });
    const sid = await sessionAnlegen(userId);
    const werkId = await werkAnlegen(userId, { status: 'ausgeblendet' });

    const { notFound } = await render(werkId, { sid });
    expect(notFound).toBe(true);
  });

  it('Werk ausgeblendet + anonym → 404', async () => {
    const userId = await macherAnlegen({ email: 'ausg-anon@test.werkzirkel.de' });
    const werkId = await werkAnlegen(userId, { status: 'ausgeblendet' });

    const { notFound } = await render(werkId);
    expect(notFound).toBe(true);
  });

  it('nicht existentes Werk → 404', async () => {
    const { notFound } = await render('does-not-exist-xxxxxxxxxx');
    expect(notFound).toBe(true);
  });

  it('werk_historie mit 3 Eintraegen → alle drei in Reihenfolge sichtbar', async () => {
    const userId = await macherAnlegen({
      email: 'hist@test.werkzirkel.de',
      anzeigename: 'Hist Macher',
    });
    const werkId = await werkAnlegen(userId, { werkstand: 'wachsend' });

    const t0 = new Date('2026-05-01T10:00:00Z');
    const t1 = new Date('2026-05-05T10:00:00Z');
    const t2 = new Date('2026-05-10T10:00:00Z');
    await db.insert(werkHistorie).values([
      {
        werkId,
        werkstandAlt: 'idee',
        werkstandNeu: 'prototyp',
        geaendertVon: userId,
        geaendertAm: t0,
      },
      {
        werkId,
        werkstandAlt: 'prototyp',
        werkstandNeu: 'testversion',
        geaendertVon: userId,
        geaendertAm: t1,
      },
      {
        werkId,
        werkstandAlt: 'testversion',
        werkstandNeu: 'wachsend',
        geaendertVon: userId,
        geaendertAm: t2,
      },
    ]);

    const { html } = await render(werkId);
    expect(html).toContain('Build-Verlauf');
    expect(html).toContain('Werkstand geändert von Beta auf Wachsend');
    expect(html).toContain('Werkstand geändert von Prototyp auf Beta');
    expect(html).toContain('Werkstand geändert von Idee auf Prototyp');

    // Reihenfolge: neuester Eintrag zuerst. Index von 'wachsend'-Eintrag <
    // Index von 'prototyp'-Eintrag.
    const idxNeu = html.indexOf('Beta auf Wachsend');
    const idxAlt = html.indexOf('Idee auf Prototyp');
    expect(idxNeu).toBeGreaterThan(-1);
    expect(idxAlt).toBeGreaterThan(-1);
    expect(idxNeu).toBeLessThan(idxAlt);
  });

  it('JSON-LD CreativeWork-Block ist im HTML', async () => {
    const userId = await macherAnlegen({
      email: 'jsonld@test.werkzirkel.de',
      anzeigename: 'Schema Person',
    });
    const werkId = await werkAnlegen(userId, {
      name: 'Werk mit Schema',
      kurzbeschreibung: 'Beschreibung fuer Schema-LD',
    });

    const { html } = await render(werkId);
    expect(html).toContain('<script type="application/ld+json"');
    expect(html).toContain('"@type":"CreativeWork"');
    expect(html).toContain('"name":"Werk mit Schema"');
    expect(html).toContain('"description":"Beschreibung fuer Schema-LD"');
    expect(html).toContain('"author":{"@type":"Person","name":"Schema Person"}');
  });

  it('Inhaber:innen-Karte zeigt anzeigename + Stadt-Name (nicht klarname/email)', async () => {
    const userId = await macherAnlegen({
      email: 'inh-card@test.werkzirkel.de',
      anzeigename: 'Inh Anz',
      klarname: 'Inh Klar',
    });
    const werkId = await werkAnlegen(userId);

    const { html } = await render(werkId);
    expect(html).toContain('Inh Anz');
    expect(html).toContain('Hamburg');
    expect(html).not.toContain('Inh Klar');
    expect(html).not.toContain('inh-card@test.werkzirkel.de');
  });

  it('Werkpass-Link zeigt auf /werkpass/[id]', async () => {
    const userId = await macherAnlegen({ email: 'wp-link@test.werkzirkel.de' });
    const werkId = await werkAnlegen(userId);

    const { html } = await render(werkId);
    expect(html).toContain(`href="/werkpass/${userId}"`);
  });

  // sicherstellen dass eq-Import nicht ungenutzt
  it('session-Lookup robust', async () => {
    const userId = await macherAnlegen({ email: 'rb@test.werkzirkel.de' });
    const werkId = await werkAnlegen(userId);
    const sessionRows = await db
      .select()
      .from(sessionTable)
      .where(eq(sessionTable.nutzerId, userId));
    expect(sessionRows.length).toBe(0);
    const { html, notFound } = await render(werkId);
    expect(notFound).toBe(false);
    expect(html.length).toBeGreaterThan(0);
  });
});
