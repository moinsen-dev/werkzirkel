/**
 * Render-Tests fuer /pruefrunden/[id]/bearbeiten.
 */

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createId } from '@paralleldrive/cuid2';
import { eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import {
  nutzer,
  pruefrunde,
  session as sessionTable,
  werk,
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
let lastRedirect: string | null = null;
let lastNotFound = false;

vi.mock('next/headers', () => ({
  headers: async () => ({
    entries: () => mockHeaders.entries(),
    get: (name: string) => mockHeaders.get(name.toLowerCase()) ?? null,
  }),
  cookies: async () => ({ set: () => {} }),
}));

vi.mock('next/navigation', () => ({
  redirect: (target: string) => {
    lastRedirect = target;
    const err = new Error(`NEXT_REDIRECT: ${target}`);
    (err as Error & { digest: string }).digest = `NEXT_REDIRECT;replace;${target};307;`;
    throw err;
  },
  notFound: () => {
    lastNotFound = true;
    const err = new Error('NEXT_NOT_FOUND');
    (err as Error & { digest: string }).digest = 'NEXT_NOT_FOUND';
    throw err;
  },
}));

vi.mock('next/cache', () => ({ revalidatePath: () => {} }));

const { renderToStaticMarkup } = await import('react-dom/server');
const Page = (await import('@/app/pruefrunden/[id]/bearbeiten/page')).default;

async function reset() {
  await truncateAll();
  mockHeaders = new Map();
  lastRedirect = null;
  lastNotFound = false;
}

async function nutzerAnlegen(): Promise<string> {
  const id = createId();
  await db.insert(nutzer).values({
    id,
    email: `${id}@test.werkzirkel.de`,
    klarname: 'Test',
    anzeigename: `anz-${id.slice(0, 6)}`,
    stadtId: 'hh',
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

async function werkAnlegen(nutzerId: string): Promise<string> {
  const id = createId();
  await db.insert(werk).values({
    id,
    nutzerId,
    name: 'W',
    kurzbeschreibung: 'k',
    problem: 'p',
    zielgruppe: 'z',
    werkstand: 'prototyp',
  });
  return id;
}

async function entwurfAnlegen(werkId: string): Promise<string> {
  const id = createId();
  await db.insert(pruefrunde).values({
    id,
    werkId,
    titel: 'Test-Pruefrunde-Bearbeiten',
    testziel: 'tz',
    testaufgabe: 'ta',
    zielgruppe: 'z',
    zeitbedarfMinuten: 30,
    gesuchteTester: 3,
    feedbackKategorien: ['erster_eindruck'],
    frist: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    status: 'entwurf',
  });
  return id;
}

async function render(id: string, opts: { sid?: string; sp?: Record<string, string> } = {}): Promise<string> {
  if (opts.sid) mockHeaders.set('cookie', `wz_session=${encodeURIComponent(opts.sid)}`);
  try {
    const tree = await Page({
      params: Promise.resolve({ id }),
      searchParams: Promise.resolve(opts.sp ?? {}),
    });
    return renderToStaticMarkup(tree);
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('NEXT_REDIRECT')) return '';
    if (err instanceof Error && err.message === 'NEXT_NOT_FOUND') return '';
    throw err;
  }
}

describe('/pruefrunden/[id]/bearbeiten page', () => {
  beforeEach(reset);
  afterAll(reset);

  it('ohne Session → redirect /anmelden', async () => {
    await render('does-not-matter');
    expect(lastRedirect).toBe('/anmelden?next=/pruefrunden/does-not-matter/bearbeiten');
  });

  it('Fremder Nutzer → 404', async () => {
    const owner = await nutzerAnlegen();
    const werkId = await werkAnlegen(owner);
    const prId = await entwurfAnlegen(werkId);
    const other = await nutzerAnlegen();
    const sid = await sessionAnlegen(other);
    await render(prId, { sid });
    expect(lastNotFound).toBe(true);
  });

  it('Inhaber:in + Entwurf → Form gerendert mit vorgefuellten Werten', async () => {
    const owner = await nutzerAnlegen();
    const sid = await sessionAnlegen(owner);
    const werkId = await werkAnlegen(owner);
    const prId = await entwurfAnlegen(werkId);
    const html = await render(prId, { sid });
    expect(html).toContain('Test-Pruefrunde-Bearbeiten');
    expect(html).toContain('Änderungen speichern');
    // Saldo=0 (frischer User) → Reziprozitäts-Wahl-Block erscheint statt
    // direkter Veröffentlichen-Knopf (PRD §8.4).
    expect(html).toContain('Reziprozitäts-Gate');
    expect(html).toContain('Veröffentlichen mit 14-Tage-Verpflichtung');
    expect(html).toContain('Entwurf löschen');
  });

  it('Inhaber:in + veroeffentlicht → Read-Only-Hinweis statt Form', async () => {
    const owner = await nutzerAnlegen();
    const sid = await sessionAnlegen(owner);
    const werkId = await werkAnlegen(owner);
    const prId = await entwurfAnlegen(werkId);
    // Status hochsetzen
    await db.update(pruefrunde).set({ status: 'oeffentlich' }).where(eq(pruefrunde.id, prId));
    const html = await render(prId, { sid });
    expect(html).toContain('bereits veröffentlicht');
    expect(html).not.toContain('Prüfrunde veröffentlichen');
  });

  it('fehler=reziprozitaet → Roter Banner mit Link zu /pruefrunden', async () => {
    const owner = await nutzerAnlegen();
    const sid = await sessionAnlegen(owner);
    const werkId = await werkAnlegen(owner);
    const prId = await entwurfAnlegen(werkId);
    const html = await render(prId, { sid, sp: { fehler: 'reziprozitaet' } });
    expect(html).toContain('abgelaufene Reziprozitäts-Verpflichtung');
    expect(html).toMatch(/href="\/pruefrunden"/);
  });

  it('Sprach-Check: keine englischen UI-Strings', async () => {
    const owner = await nutzerAnlegen();
    const sid = await sessionAnlegen(owner);
    const werkId = await werkAnlegen(owner);
    const prId = await entwurfAnlegen(werkId);
    const html = await render(prId, { sid });
    const verboten = ['Sign in', 'Login', 'Submit', 'Click here', 'Deadline'];
    for (const w of verboten) expect(html).not.toContain(w);
  });
});
