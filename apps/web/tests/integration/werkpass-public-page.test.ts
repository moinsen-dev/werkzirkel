/**
 * Integration-Tests fuer die `/werkpass/[id]`-Seite (Server Component).
 *
 * Wir mocken `next/link` und `next/navigation` (insb. `notFound()`),
 * rufen die Page direkt auf und rendern den React-Tree via
 * `renderToStaticMarkup` zu HTML. `notFound()` wirft einen Sentinel-Error,
 * den wir abfangen.
 */

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createId } from '@paralleldrive/cuid2';

import { db } from '@/lib/db';
import {
  foerdermitgliedschaft,
  nutzer,
  testSaldo,
  werk,
} from '@/lib/db/schema';
import type { Rolle, NutzerStatus } from '@/lib/db/schema/enums';
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
const WerkpassPageModule = await import('@/app/werkpass/[id]/page');
const WerkpassPage = WerkpassPageModule.default;

async function reset(): Promise<void> {
  await truncateAll();
  lastNotFound = false;
}

interface MacherOpts {
  email: string;
  anzeigename?: string;
  klarname?: string;
  stadtId?: string;
  rollen?: Rolle[];
  status?: NutzerStatus;
  kurzbeschreibung?: string | null;
}

async function nutzerAnlegen(opts: MacherOpts): Promise<string> {
  const id = createId();
  await db.insert(nutzer).values({
    id,
    email: opts.email,
    klarname: opts.klarname ?? `Klar ${opts.email}`,
    anzeigename: opts.anzeigename ?? `anz-${id.slice(0, 6)}`,
    stadtId: opts.stadtId ?? 'hh',
    rollen: opts.rollen ?? ['macher'],
    status: opts.status ?? 'aktiv',
    kurzbeschreibung: opts.kurzbeschreibung ?? null,
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
    name: 'Werk vom Macher',
    kurzbeschreibung: 'Kompakte Beschreibung.',
    problem: 'Loest ein Problem.',
    zielgruppe: 'Macher:innen.',
    werkstand: 'prototyp',
    hilfebedarf: ['ux_test'],
    sichtbarkeit: 'oeffentlich',
    status: 'aktiv',
    ...overrides,
  });
  return id;
}

async function render(
  id: string,
): Promise<{ html: string; notFound: boolean }> {
  try {
    const tree = await WerkpassPage({ params: Promise.resolve({ id }) });
    const html = renderToStaticMarkup(tree);
    return { html, notFound: false };
  } catch (err) {
    if (err instanceof Error && err.message === 'NEXT_NOT_FOUND') {
      return { html: '', notFound: true };
    }
    throw err;
  }
}

describe('/werkpass/[id] page', () => {
  beforeEach(reset);
  afterAll(reset);

  it('rendert oeffentlichen Werkpass mit anzeigename', async () => {
    const userId = await nutzerAnlegen({
      email: 'wp-1@test.werkzirkel.de',
      anzeigename: 'Lara Macher',
    });

    const { html, notFound } = await render(userId);
    expect(notFound).toBe(false);
    expect(html).toContain('Lara Macher');
    expect(html).toContain('Werkpass im Werkzirkel');
  });

  it('unbekannte id → 404', async () => {
    const { notFound } = await render('does-not-exist-xxxxxxxxxx');
    expect(notFound).toBe(true);
  });

  it('reine Bedarfstraeger:in (ohne macher-Rolle) → 404', async () => {
    const userId = await nutzerAnlegen({
      email: 'bd-only@test.werkzirkel.de',
      rollen: ['bedarfstraeger'],
    });
    const { notFound } = await render(userId);
    expect(notFound).toBe(true);
  });

  it('Status gesperrt → 404', async () => {
    const userId = await nutzerAnlegen({
      email: 'sperr@test.werkzirkel.de',
      status: 'gesperrt',
    });
    const { notFound } = await render(userId);
    expect(notFound).toBe(true);
  });

  it('Status loeschung_anstehend → 404', async () => {
    const userId = await nutzerAnlegen({
      email: 'loesch@test.werkzirkel.de',
      status: 'loeschung_anstehend',
    });
    const { notFound } = await render(userId);
    expect(notFound).toBe(true);
  });

  it('zeigt Foerdermitglied-Badge wenn aktive Mitgliedschaft', async () => {
    const userId = await nutzerAnlegen({
      email: 'foerder@test.werkzirkel.de',
      anzeigename: 'Foerder Lara',
    });
    await db.insert(foerdermitgliedschaft).values({
      id: createId(),
      nutzerId: userId,
      stufe: 'jaehrlich',
      stripeCustomerId: 'cus_test123',
      beginn: new Date('2026-01-01T00:00:00Z'),
      status: 'aktiv',
    });

    const { html, notFound } = await render(userId);
    expect(notFound).toBe(false);
    expect(html).toContain('Fördermitglied');
    // Stripe-IDs duerfen NIE im HTML auftauchen.
    expect(html).not.toContain('cus_test123');
  });

  it('Test-Saldo: ohne test_saldo-Row → 0 gegeben · 0 erhalten · 0 offen', async () => {
    const userId = await nutzerAnlegen({
      email: 'saldo-0@test.werkzirkel.de',
    });

    const { html, notFound } = await render(userId);
    expect(notFound).toBe(false);
    expect(html).toContain('0 gegeben');
    expect(html).toContain('0 erhalten');
    expect(html).toContain('0 offen');
  });

  it('Test-Saldo: mit test_saldo-Row zeigt die Werte', async () => {
    const userId = await nutzerAnlegen({
      email: 'saldo-3@test.werkzirkel.de',
    });
    await db.insert(testSaldo).values({
      nutzerId: userId,
      testsGegeben: 5,
      testsErhalten: 3,
      offeneVerpflichtungAnzahl: 1,
      naechsteVerpflichtungFrist: new Date('2026-06-01T00:00:00Z'),
    });

    const { html } = await render(userId);
    expect(html).toContain('5 gegeben');
    expect(html).toContain('3 erhalten');
    expect(html).toContain('1 offen');
    // Frist wird angedeutet, wenn offen > 0.
    expect(html).toContain('Offene Verpflichtung');
  });

  it('Werke-Sektion: zeigt nur sichtbare Werke (oeffentlich/nur_zirkel + aktiv)', async () => {
    const userId = await nutzerAnlegen({
      email: 'werke-mix@test.werkzirkel.de',
      anzeigename: 'Werker Mix',
    });
    await werkAnlegen(userId, { name: 'Werk Sichtbar Public' });
    await werkAnlegen(userId, {
      name: 'Werk Sichtbar Zirkel',
      sichtbarkeit: 'nur_zirkel',
    });
    await werkAnlegen(userId, {
      name: 'Werk Pausiert',
      sichtbarkeit: 'pausiert',
    });
    await werkAnlegen(userId, {
      name: 'Werk Ausgeblendet',
      status: 'ausgeblendet',
    });

    const { html } = await render(userId);
    expect(html).toContain('Werk Sichtbar Public');
    expect(html).toContain('Werk Sichtbar Zirkel');
    expect(html).not.toContain('Werk Pausiert');
    expect(html).not.toContain('Werk Ausgeblendet');
    // Gesamt-Anzahl in der Heading: 2.
    expect(html).toContain('Werke von Werker Mix (2)');
  });

  it('Werke-Sektion: bei > 6 Werken erscheint der Mehr-Link', async () => {
    const userId = await nutzerAnlegen({
      email: 'werke-viele@test.werkzirkel.de',
      anzeigename: 'Viele Werker',
    });
    for (let i = 0; i < 7; i += 1) {
      await werkAnlegen(userId, { name: `Werk Nr ${i + 1}` });
    }

    const { html } = await render(userId);
    expect(html).toContain('Werke von Viele Werker (7)');
    expect(html).toContain(`href="/werke?inhaber=${userId}"`);
    expect(html).toContain('alle 7 Werke ansehen');
  });

  it('keine email/klarname im HTML', async () => {
    const userId = await nutzerAnlegen({
      email: 'leak-wp@test.werkzirkel.de',
      anzeigename: 'Pseudo Macher',
      klarname: 'Geheim Real Name',
    });
    await werkAnlegen(userId);
    const { html } = await render(userId);
    expect(html).not.toContain('leak-wp@test.werkzirkel.de');
    expect(html).not.toContain('Geheim Real Name');
  });

  it('Erklaerungs-Sektion Test-Saldo ist im HTML', async () => {
    const userId = await nutzerAnlegen({
      email: 'erkl@test.werkzirkel.de',
    });
    const { html } = await render(userId);
    expect(html).toContain('Was ist ein Test-Saldo?');
    expect(html).toContain('Reziprozität');
  });
});
