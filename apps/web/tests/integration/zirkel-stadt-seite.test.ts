/**
 * Integration-Tests fuer /zirkel/[stadt] (Server Component).
 *
 * Slug-Mapping, 404 bei unbekanntem Slug, aktive vs. vorbereitende Variante,
 * Mitglieder-Strip, Werke-Grid, Termine-Liste mit Empty-State.
 */

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createId } from '@paralleldrive/cuid2';

import { db } from '@/lib/db';
import { nutzer, termin, werk } from '@/lib/db/schema';
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

let lastNotFound = false;

vi.mock('next/navigation', () => ({
  notFound: () => {
    lastNotFound = true;
    const err = new Error('NEXT_NOT_FOUND');
    (err as Error & { digest: string }).digest = 'NEXT_NOT_FOUND';
    throw err;
  },
}));

const { renderToStaticMarkup } = await import('react-dom/server');
const ZirkelPageModule = await import('@/app/zirkel/[stadt]/page');
const ZirkelPage = ZirkelPageModule.default;

async function render(
  slug: string,
): Promise<{ html: string; notFound: boolean }> {
  lastNotFound = false;
  try {
    const tree = await ZirkelPage({ params: Promise.resolve({ stadt: slug }) });
    const html = renderToStaticMarkup(tree);
    return { html, notFound: false };
  } catch (err) {
    if (err instanceof Error && err.message === 'NEXT_NOT_FOUND') {
      return { html: '', notFound: true };
    }
    throw err;
  }
}

async function macherAnlegen(opts: {
  email: string;
  anzeigename: string;
  stadtId?: string;
}): Promise<string> {
  const id = createId();
  await db.insert(nutzer).values({
    id,
    email: opts.email,
    klarname: `Klar ${opts.email}`,
    anzeigename: opts.anzeigename,
    stadtId: opts.stadtId ?? 'hh',
    rollen: ['macher'],
    status: 'aktiv',
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
    werkstand: 'prototyp',
    hilfebedarf: [],
    sichtbarkeit: 'oeffentlich',
    status: 'aktiv',
    ...overrides,
  });
  return id;
}

describe('/zirkel/[stadt] page', () => {
  beforeEach(async () => {
    await truncateAll();
  });
  afterAll(async () => {
    await truncateAll();
  });

  it('GET /zirkel/hh → 200, "Werkzirkel Hamburg" + "Aktiver Kreis"', async () => {
    const { html, notFound } = await render('hh');
    expect(notFound).toBe(false);
    expect(html).toContain('Werkzirkel Hamburg');
    expect(html).toContain('Aktiver Kreis');
  });

  it('GET /zirkel/hamburg → ebenfalls 200 (Slug-Mapping)', async () => {
    const { html, notFound } = await render('hamburg');
    expect(notFound).toBe(false);
    expect(html).toContain('Werkzirkel Hamburg');
    expect(html).toContain('Aktiver Kreis');
  });

  it('GET /zirkel/b → 200, "In Vorbereitung" + Sub-Hinweis enthält "Hamburger Kreis trägt"', async () => {
    const { html, notFound } = await render('b');
    expect(notFound).toBe(false);
    expect(html).toContain('Werkzirkel Berlin');
    expect(html).toContain('In Vorbereitung');
    expect(html).toContain('Hamburger Kreis trägt');
  });

  it('GET /zirkel/berlin → ebenfalls Vorbereitung-Variante', async () => {
    const { html, notFound } = await render('berlin');
    expect(notFound).toBe(false);
    expect(html).toContain('Werkzirkel Berlin');
    expect(html).toContain('In Vorbereitung');
  });

  it('GET /zirkel/muenchen → München-Vorbereitung-Variante', async () => {
    const { html, notFound } = await render('muenchen');
    expect(notFound).toBe(false);
    expect(html).toContain('Werkzirkel München');
    expect(html).toContain('In Vorbereitung');
  });

  it('GET /zirkel/unknown → 404', async () => {
    const { notFound } = await render('unknown');
    expect(notFound).toBe(true);
  });

  it('Mitglieder: 3 Macher:innen in HH werden mit Avatar-Strip + Werkpass-Link gerendert', async () => {
    const u1 = await macherAnlegen({
      email: 'm1@test.werkzirkel.de',
      anzeigename: 'Macher Eins',
    });
    const u2 = await macherAnlegen({
      email: 'm2@test.werkzirkel.de',
      anzeigename: 'Macher Zwei',
    });
    const u3 = await macherAnlegen({
      email: 'm3@test.werkzirkel.de',
      anzeigename: 'Macher Drei',
    });

    const { html } = await render('hh');
    expect(html).toContain('Macher Eins');
    expect(html).toContain('Macher Zwei');
    expect(html).toContain('Macher Drei');
    // Avatare verlinken auf /werkpass/[id]
    expect(html).toContain(`/werkpass/${u1}`);
    expect(html).toContain(`/werkpass/${u2}`);
    expect(html).toContain(`/werkpass/${u3}`);
  });

  it('Werke: 4 Werke in HH werden in der Werke-Sektion gezeigt + "Alle Werke in Hamburg"-Link', async () => {
    const u = await macherAnlegen({
      email: 'macher-werke@test.werkzirkel.de',
      anzeigename: 'Werker Mit Werken',
    });
    await werkAnlegen(u, { name: 'Werk A' });
    await werkAnlegen(u, { name: 'Werk B' });
    await werkAnlegen(u, { name: 'Werk C' });
    await werkAnlegen(u, { name: 'Werk D' });

    const { html } = await render('hh');
    expect(html).toContain('Werk A');
    expect(html).toContain('Werk B');
    expect(html).toContain('Werk C');
    expect(html).toContain('Werk D');
    expect(html).toContain('Alle Werke in Hamburg');
    expect(html).toContain('/werke?stadt=hh');
  });

  it('Termin: future + status=veroeffentlicht in HH wird mit Datum + Titel + Typ-Pill gezeigt', async () => {
    const kuratorId = await macherAnlegen({
      email: 'termin-kurator@test.werkzirkel.de',
      anzeigename: 'Term Kurator',
    });
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // +7 Tage
    await db.insert(termin).values({
      id: createId(),
      stadtId: 'hh',
      typ: 'schauabend',
      titel: 'Hamburger Schauabend Mai',
      beschreibung: 'Werke aus dem Mai-Bau-Sprint.',
      datumUhrzeit: future,
      maxTeilnehmer: 20,
      erstelltVon: kuratorId,
      status: 'veroeffentlicht',
    });

    const { html } = await render('hh');
    expect(html).toContain('Hamburger Schauabend Mai');
    expect(html).toContain('Schauabend');
  });

  it('Termine: leer in HH → Empty-State mit Kurator-Mail "hamburg@werkzirkel.de"', async () => {
    const { html } = await render('hh');
    expect(html).toContain('Der nächste Schauabend steht noch nicht');
    expect(html).toContain('hamburg@werkzirkel.de');
  });

  it('Vergangene oder geplante Termine erscheinen NICHT', async () => {
    const k = await macherAnlegen({
      email: 'past-kurator@test.werkzirkel.de',
      anzeigename: 'Past Kurator',
    });
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await db.insert(termin).values([
      {
        id: createId(),
        stadtId: 'hh',
        typ: 'schauabend',
        titel: 'Vergangener Termin',
        beschreibung: 'past.',
        datumUhrzeit: past,
        maxTeilnehmer: 20,
        erstelltVon: k,
        status: 'veroeffentlicht',
      },
      {
        id: createId(),
        stadtId: 'hh',
        typ: 'schauabend',
        titel: 'Geplanter Entwurfs-Termin',
        beschreibung: 'draft.',
        datumUhrzeit: future,
        maxTeilnehmer: 20,
        erstelltVon: k,
        status: 'geplant',
      },
    ]);

    const { html } = await render('hh');
    expect(html).not.toContain('Vergangener Termin');
    expect(html).not.toContain('Geplanter Entwurfs-Termin');
  });

  it('Mitglieder ohne macher-Rolle (z.B. reine Bedarfstraeger:in) erscheinen NICHT', async () => {
    const id = createId();
    await db.insert(nutzer).values({
      id,
      email: 'bd-only@test.werkzirkel.de',
      klarname: 'Bd Klar',
      anzeigename: 'Reine Bedarfstraegerin',
      stadtId: 'hh',
      rollen: ['bedarfstraeger'],
      status: 'aktiv',
      emailVerifiziertAm: new Date(),
    });
    const { html } = await render('hh');
    expect(html).not.toContain('Reine Bedarfstraegerin');
  });

  it('Pausierte/gesperrte Nutzer:innen erscheinen NICHT', async () => {
    const id1 = createId();
    await db.insert(nutzer).values({
      id: id1,
      email: 'pausi@test.werkzirkel.de',
      klarname: 'P Klar',
      anzeigename: 'Pausierter Macher',
      stadtId: 'hh',
      rollen: ['macher'],
      status: 'pausiert',
      emailVerifiziertAm: new Date(),
    });
    const id2 = createId();
    await db.insert(nutzer).values({
      id: id2,
      email: 'gesperrt@test.werkzirkel.de',
      klarname: 'G Klar',
      anzeigename: 'Gesperrter Macher',
      stadtId: 'hh',
      rollen: ['macher'],
      status: 'gesperrt',
      emailVerifiziertAm: new Date(),
    });
    const { html } = await render('hh');
    expect(html).not.toContain('Pausierter Macher');
    expect(html).not.toContain('Gesperrter Macher');
  });

  it('Keine email/klarname von Mitgliedern im HTML', async () => {
    await macherAnlegen({
      email: 'geheim-leak@test.werkzirkel.de',
      anzeigename: 'Anon Macher',
    });
    const { html } = await render('hh');
    expect(html).not.toContain('geheim-leak@test.werkzirkel.de');
    expect(html).not.toContain('Klar geheim-leak@test.werkzirkel.de');
  });
});
