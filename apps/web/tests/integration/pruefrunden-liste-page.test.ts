/**
 * Render-Tests fuer /pruefrunden (Liste, Server Component, public).
 *
 * Sprach-Check via Wortliste — keine englischen UI-Strings.
 */

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createId } from '@paralleldrive/cuid2';

import { db } from '@/lib/db';
import { nutzer, pruefrunde, werk } from '@/lib/db/schema';
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
const Page = (await import('@/app/pruefrunden/page')).default;

async function reset() {
  await truncateAll();
}

async function nutzerAnlegen(stadtId = 'hh'): Promise<string> {
  const id = createId();
  await db.insert(nutzer).values({
    id,
    email: `${id}@test.werkzirkel.de`,
    klarname: 'Test',
    anzeigename: `anz-${id.slice(0, 6)}`,
    stadtId,
    rollen: ['macher'],
    emailVerifiziertAm: new Date(),
  });
  return id;
}

async function werkAnlegen(nutzerId: string, name = 'Werk-X'): Promise<string> {
  const id = createId();
  await db.insert(werk).values({
    id,
    nutzerId,
    name,
    kurzbeschreibung: 'k',
    problem: 'p',
    zielgruppe: 'z',
    werkstand: 'prototyp',
  });
  return id;
}

async function pruefrundeAnlegen(opts: {
  werkId: string;
  titel: string;
  status: 'entwurf' | 'oeffentlich' | 'geschlossen' | 'abgeschlossen';
  fristOffsetTage?: number;
}) {
  const id = createId();
  await db.insert(pruefrunde).values({
    id,
    werkId: opts.werkId,
    titel: opts.titel,
    testziel: 'tz',
    testaufgabe: 'ta',
    zielgruppe: 'z',
    zeitbedarfMinuten: 30,
    gesuchteTester: 3,
    feedbackKategorien: ['erster_eindruck'],
    frist: new Date(Date.now() + (opts.fristOffsetTage ?? 7) * 24 * 60 * 60 * 1000),
    status: opts.status,
  });
  return id;
}

async function render(sp: Record<string, string | string[]> = {}): Promise<string> {
  const tree = await Page({ searchParams: Promise.resolve(sp) });
  return renderToStaticMarkup(tree);
}

describe('/pruefrunden Liste page', () => {
  beforeEach(reset);
  afterAll(reset);

  it('rendert Hero mit Hamburg-Default und Counter', async () => {
    const html = await render({});
    expect(html).toContain('Feedback-Loops im Werkzirkel');
    // Wir koennen den Stadtnamen "Hamburg" erwarten, weil die stadt-Seeds das vorsehen.
    expect(html).toMatch(/Hamburg/);
  });

  it('zeigt nur veroeffentlichte/geschlossene/abgeschlossene Pruefrunden — keine Entwuerfe', async () => {
    const userId = await nutzerAnlegen();
    const werkId = await werkAnlegen(userId, 'Mein Build');
    await pruefrundeAnlegen({
      werkId,
      titel: 'Oeffentliche Runde Sichtbar',
      status: 'oeffentlich',
    });
    await pruefrundeAnlegen({
      werkId,
      titel: 'Entwurf Versteckt',
      status: 'entwurf',
    });
    const html = await render({});
    expect(html).toContain('Oeffentliche Runde Sichtbar');
    expect(html).not.toContain('Entwurf Versteckt');
  });

  it('Empty-State auf Deutsch wenn keine Pruefrunden', async () => {
    const html = await render({});
    expect(html).toContain('Noch keine offenen Feedback-Loops in Hamburg');
  });

  it('zeigt Werk-Link in Card', async () => {
    const userId = await nutzerAnlegen();
    const werkId = await werkAnlegen(userId, 'Werk-Y');
    await pruefrundeAnlegen({
      werkId,
      titel: 'Runde A',
      status: 'oeffentlich',
    });
    const html = await render({});
    expect(html).toMatch(/href="\/werke\/[^"]+"[^>]*>Werk-Y</);
  });

  it('Sprach-Check: keine englischen UI-Strings', async () => {
    const userId = await nutzerAnlegen();
    const werkId = await werkAnlegen(userId);
    await pruefrundeAnlegen({
      werkId,
      titel: 'Runde Sprach',
      status: 'oeffentlich',
    });
    const html = await render({});
    const verboten = [
      'Sign in',
      'Login',
      'Sign up',
      'Click here',
      'Submit',
      'Page not found',
      'Deadline',
      'Reminder',
    ];
    for (const w of verboten) {
      expect(html).not.toContain(w);
    }
  });
});
