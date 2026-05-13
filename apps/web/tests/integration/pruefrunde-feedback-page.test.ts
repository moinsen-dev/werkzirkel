/**
 * Render-Tests fuer /pruefrunden/[id]/feedback.
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

const { renderToStaticMarkup } = await import('react-dom/server');
const Page = (await import('@/app/pruefrunden/[id]/feedback/page')).default;

async function reset() {
  await truncateAll();
  mockHeaders = new Map();
  lastRedirect = null;
  lastNotFound = false;
}

async function nutzerAnlegen(prefix: string): Promise<string> {
  const id = createId();
  await db.insert(nutzer).values({
    id,
    email: `${prefix}-${id.slice(0, 4)}@test.werkzirkel.de`,
    klarname: `Klar ${prefix}`,
    anzeigename: `anz-${prefix}-${id.slice(0, 4)}`,
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
    name: 'Werk-F',
    kurzbeschreibung: 'k',
    problem: 'p',
    zielgruppe: 'z',
    werkstand: 'prototyp',
  });
  return id;
}

async function pruefrundeAnlegen(werkId: string): Promise<string> {
  const id = createId();
  await db.insert(pruefrunde).values({
    id,
    werkId,
    titel: 'Pruefrunde F',
    testziel: 'tz',
    testaufgabe: 'ta',
    zielgruppe: 'z',
    zeitbedarfMinuten: 30,
    gesuchteTester: 3,
    feedbackKategorien: ['erster_eindruck', 'nutzen'],
    frist: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    status: 'oeffentlich',
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
    if (err instanceof Error && err.message.startsWith('NEXT_REDIRECT')) return '';
    if (err instanceof Error && err.message === 'NEXT_NOT_FOUND') return '';
    throw err;
  }
}

describe('/pruefrunden/[id]/feedback page', () => {
  beforeEach(reset);
  afterAll(reset);

  it('ohne Session → redirect /anmelden', async () => {
    const o = await nutzerAnlegen('o');
    const w = await werkAnlegen(o);
    const p = await pruefrundeAnlegen(w);
    await render(p);
    expect(lastRedirect).toContain('/anmelden?next=/pruefrunden/');
  });

  it('Eingeloggt, NICHT angemeldet → 404', async () => {
    const o = await nutzerAnlegen('o');
    const w = await werkAnlegen(o);
    const p = await pruefrundeAnlegen(w);
    const t = await nutzerAnlegen('t');
    const sid = await sessionAnlegen(t);
    await render(p, { sid });
    expect(lastNotFound).toBe(true);
  });

  it('Eingeloggt + angemeldet → Form mit den 2 gewaehlten Kategorien gerendert', async () => {
    const o = await nutzerAnlegen('o');
    const w = await werkAnlegen(o);
    const p = await pruefrundeAnlegen(w);
    const t = await nutzerAnlegen('t');
    await db.insert(pruefrundenAnmeldung).values({
      pruefrundeId: p,
      testerId: t,
      status: 'angemeldet',
    });
    const sid = await sessionAnlegen(t);
    const html = await render(p, { sid });
    expect(html).toContain('Gesamteindruck');
    expect(html).toContain('Erster Eindruck');
    expect(html).toContain('Nutzen');
    // Bedienbarkeit ist NICHT in feedback_kategorien → soll NICHT als Feld erscheinen.
    expect(html).not.toMatch(/name="bedienbarkeit"/);
  });

  it('Eingeloggt + bereits Feedback gegeben → 404', async () => {
    const o = await nutzerAnlegen('o');
    const w = await werkAnlegen(o);
    const p = await pruefrundeAnlegen(w);
    const t = await nutzerAnlegen('t');
    await db.insert(pruefrundenAnmeldung).values({
      pruefrundeId: p,
      testerId: t,
      status: 'feedback_gegeben',
    });
    const sid = await sessionAnlegen(t);
    await render(p, { sid });
    expect(lastNotFound).toBe(true);
  });

  it('Sprach-Check: keine englischen UI-Strings', async () => {
    const o = await nutzerAnlegen('o');
    const w = await werkAnlegen(o);
    const p = await pruefrundeAnlegen(w);
    const t = await nutzerAnlegen('t');
    await db.insert(pruefrundenAnmeldung).values({
      pruefrundeId: p,
      testerId: t,
      status: 'angemeldet',
    });
    const sid = await sessionAnlegen(t);
    const html = await render(p, { sid });
    const verboten = ['Sign in', 'Login', 'Submit', 'Click here', 'Feedback submit'];
    for (const w of verboten) expect(html).not.toContain(w);
  });
});
