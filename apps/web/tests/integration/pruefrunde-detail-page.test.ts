/**
 * Render-Tests fuer /pruefrunden/[id] (Detail, Server Component, public).
 *
 * - 404 wenn Entwurf und nicht Inhaber.
 * - Anonym → CTA 'Anmelden, um Tester:in zu werden'.
 * - Tester:in eingeloggt + frei → 'Als Tester:in anmelden'-Button.
 * - Tester:in angemeldet → 'Feedback abgeben'-Link.
 * - Inhaber:in → Verwaltungs-Sektion.
 */

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createId } from '@paralleldrive/cuid2';

import { db } from '@/lib/db';
import {
  nutzer,
  pruefrunde,
  pruefrundenAnmeldung,
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
let lastNotFound = false;

vi.mock('next/headers', () => ({
  headers: async () => ({
    entries: () => mockHeaders.entries(),
    get: (name: string) => mockHeaders.get(name.toLowerCase()) ?? null,
  }),
  cookies: async () => ({
    set: () => {},
  }),
}));

vi.mock('next/navigation', () => ({
  notFound: () => {
    lastNotFound = true;
    const err = new Error('NEXT_NOT_FOUND');
    (err as Error & { digest: string }).digest = 'NEXT_NOT_FOUND';
    throw err;
  },
  redirect: (target: string) => {
    const err = new Error(`NEXT_REDIRECT: ${target}`);
    (err as Error & { digest: string }).digest = `NEXT_REDIRECT;replace;${target};307;`;
    throw err;
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: () => {},
}));

const { renderToStaticMarkup } = await import('react-dom/server');
const Page = (await import('@/app/pruefrunden/[id]/page')).default;

async function reset() {
  await truncateAll();
  mockHeaders = new Map();
  lastNotFound = false;
}

async function nutzerAnlegen(suffix: string, stadtId = 'hh'): Promise<string> {
  const id = createId();
  await db.insert(nutzer).values({
    id,
    email: `${suffix}-${id.slice(0, 6)}@test.werkzirkel.de`,
    klarname: `Klar ${suffix}`,
    anzeigename: `anz-${suffix}-${id.slice(0, 4)}`,
    stadtId,
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
    name: 'Werk',
    kurzbeschreibung: 'k',
    problem: 'p',
    zielgruppe: 'z',
    werkstand: 'prototyp',
  });
  return id;
}

async function pruefrundeAnlegen(opts: {
  werkId: string;
  status: 'entwurf' | 'oeffentlich' | 'geschlossen' | 'abgeschlossen';
  gesuchteTester?: number;
}): Promise<string> {
  const id = createId();
  await db.insert(pruefrunde).values({
    id,
    werkId: opts.werkId,
    titel: 'Pruefrunde Detail',
    testziel: 'Was wollen wir herausfinden?',
    testaufgabe: 'Bitte teste **die Sache**.',
    zielgruppe: 'Beta-Tester:innen',
    zeitbedarfMinuten: 30,
    gesuchteTester: opts.gesuchteTester ?? 3,
    feedbackKategorien: ['erster_eindruck', 'nutzen'],
    frist: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    status: opts.status,
  });
  return id;
}

async function render(id: string, opts: { sid?: string } = {}): Promise<string> {
  if (opts.sid) mockHeaders.set('cookie', `wz_session=${encodeURIComponent(opts.sid)}`);
  try {
    const tree = await Page({
      params: Promise.resolve({ id }),
      searchParams: Promise.resolve({}),
    });
    return renderToStaticMarkup(tree);
  } catch (err) {
    if (err instanceof Error && err.message === 'NEXT_NOT_FOUND') return '';
    throw err;
  }
}

describe('/pruefrunden/[id] Detail page', () => {
  beforeEach(reset);
  afterAll(reset);

  it('Entwurf + anonym → 404', async () => {
    const userId = await nutzerAnlegen('inhaber');
    const werkId = await werkAnlegen(userId);
    const prId = await pruefrundeAnlegen({ werkId, status: 'entwurf' });
    await render(prId);
    expect(lastNotFound).toBe(true);
  });

  it('Veroeffentlicht + anonym → 200 mit Anmelde-CTA', async () => {
    const userId = await nutzerAnlegen('inhaber');
    const werkId = await werkAnlegen(userId);
    const prId = await pruefrundeAnlegen({ werkId, status: 'oeffentlich' });
    const html = await render(prId);
    expect(html).toContain('Anmelden, um Tester:in zu werden');
    expect(html).toContain('Pruefrunde Detail');
    // Markdown gerendert (bold)
    expect(html).toContain('<strong>die Sache</strong>');
  });

  it('Eingeloggte:r Tester:in, Slot frei → Anmelden-Button', async () => {
    const inhaberId = await nutzerAnlegen('inhaber');
    const werkId = await werkAnlegen(inhaberId);
    const prId = await pruefrundeAnlegen({ werkId, status: 'oeffentlich' });
    const testerId = await nutzerAnlegen('tester');
    const sid = await sessionAnlegen(testerId);
    const html = await render(prId, { sid });
    expect(html).toContain('Als Tester:in anmelden');
  });

  it('Eingeloggte:r, schon angemeldet → Feedback-Link', async () => {
    const inhaberId = await nutzerAnlegen('inhaber');
    const werkId = await werkAnlegen(inhaberId);
    const prId = await pruefrundeAnlegen({ werkId, status: 'oeffentlich' });
    const testerId = await nutzerAnlegen('tester');
    await db.insert(pruefrundenAnmeldung).values({
      pruefrundeId: prId,
      testerId,
      status: 'angemeldet',
    });
    const sid = await sessionAnlegen(testerId);
    const html = await render(prId, { sid });
    expect(html).toContain('Du bist angemeldet');
    expect(html).toMatch(/href="\/pruefrunden\/[^"]+\/feedback"/);
  });

  it('Eingeloggte:r, schon Feedback gegeben → Danke-Text', async () => {
    const inhaberId = await nutzerAnlegen('inhaber');
    const werkId = await werkAnlegen(inhaberId);
    const prId = await pruefrundeAnlegen({ werkId, status: 'oeffentlich' });
    const testerId = await nutzerAnlegen('tester');
    await db.insert(pruefrundenAnmeldung).values({
      pruefrundeId: prId,
      testerId,
      status: 'feedback_gegeben',
    });
    const sid = await sessionAnlegen(testerId);
    const html = await render(prId, { sid });
    expect(html).toContain('Feedback');
    expect(html).toContain('Danke');
  });

  it('Slots voll → Hinweis', async () => {
    const inhaberId = await nutzerAnlegen('inhaber');
    const werkId = await werkAnlegen(inhaberId);
    const prId = await pruefrundeAnlegen({
      werkId,
      status: 'oeffentlich',
      gesuchteTester: 1,
    });
    const tester1 = await nutzerAnlegen('tester1');
    await db.insert(pruefrundenAnmeldung).values({
      pruefrundeId: prId,
      testerId: tester1,
      status: 'angemeldet',
    });
    const tester2 = await nutzerAnlegen('tester2');
    const sid = await sessionAnlegen(tester2);
    const html = await render(prId, { sid });
    expect(html).toContain('Plätze voll');
  });

  it('Inhaber:in eingeloggt → Verwaltungs-Sektion sichtbar', async () => {
    const inhaberId = await nutzerAnlegen('inhaber');
    const werkId = await werkAnlegen(inhaberId);
    const prId = await pruefrundeAnlegen({ werkId, status: 'oeffentlich' });
    const sid = await sessionAnlegen(inhaberId);
    const html = await render(prId, { sid });
    expect(html).toContain('Deine Prüfrunde verwalten');
    expect(html).toContain('Angemeldete Tester:innen');
  });

  it('Sprach-Check: keine englischen UI-Strings', async () => {
    const userId = await nutzerAnlegen('inhaber');
    const werkId = await werkAnlegen(userId);
    const prId = await pruefrundeAnlegen({ werkId, status: 'oeffentlich' });
    const html = await render(prId);
    const verboten = [
      'Sign in',
      'Login',
      'Sign up',
      'Click here',
      'Submit',
      'Deadline',
      'Reminder',
    ];
    for (const w of verboten) expect(html).not.toContain(w);
  });
});
