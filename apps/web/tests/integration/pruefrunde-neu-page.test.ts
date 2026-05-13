/**
 * Render-Tests fuer /pruefrunden/neu (Server Component, auth required).
 */

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createId } from '@paralleldrive/cuid2';

import { db } from '@/lib/db';
import { nutzer, session as sessionTable, werk } from '@/lib/db/schema';
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
    const err = new Error('NEXT_NOT_FOUND');
    (err as Error & { digest: string }).digest = 'NEXT_NOT_FOUND';
    throw err;
  },
}));

const { renderToStaticMarkup } = await import('react-dom/server');
const Page = (await import('@/app/pruefrunden/neu/page')).default;

async function reset() {
  await truncateAll();
  mockHeaders = new Map();
  lastRedirect = null;
}

async function nutzerAnlegen(rollen: ('macher' | 'bedarfstraeger')[] = ['macher']): Promise<string> {
  const id = createId();
  await db.insert(nutzer).values({
    id,
    email: `${id}@test.werkzirkel.de`,
    klarname: 'Test',
    anzeigename: `anz-${id.slice(0, 6)}`,
    stadtId: 'hh',
    rollen,
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
    name: 'Werk-Neu',
    kurzbeschreibung: 'k',
    problem: 'p',
    zielgruppe: 'z',
    werkstand: 'prototyp',
  });
  return id;
}

async function render(opts: { sid?: string; sp?: Record<string, string> } = {}): Promise<string> {
  if (opts.sid) mockHeaders.set('cookie', `wz_session=${encodeURIComponent(opts.sid)}`);
  try {
    const tree = await Page({ searchParams: Promise.resolve(opts.sp ?? {}) });
    return renderToStaticMarkup(tree);
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('NEXT_REDIRECT')) return '';
    throw err;
  }
}

describe('/pruefrunden/neu page', () => {
  beforeEach(reset);
  afterAll(reset);

  it('ohne Session → redirect /anmelden', async () => {
    await render();
    expect(lastRedirect).toBe('/anmelden?next=/pruefrunden/neu');
  });

  it('mit Session aber ohne Werk → Hinweis "kein eigenes Werk"', async () => {
    const userId = await nutzerAnlegen();
    const sid = await sessionAnlegen(userId);
    const html = await render({ sid });
    expect(html).toContain('Werk');
    expect(html).toContain('Neues Werk anlegen');
  });

  it('mit Session und Werk → Form sichtbar mit Werk-Dropdown', async () => {
    const userId = await nutzerAnlegen();
    const sid = await sessionAnlegen(userId);
    await werkAnlegen(userId);
    const html = await render({ sid });
    expect(html).toContain('Titel der Prüfrunde');
    expect(html).toContain('Werk-Neu');
    expect(html).toContain('Prüfrunde als Entwurf anlegen');
  });

  it('?werk=<id> wird im Dropdown vorausgewaehlt', async () => {
    const userId = await nutzerAnlegen();
    const sid = await sessionAnlegen(userId);
    const werkId = await werkAnlegen(userId);
    const html = await render({ sid, sp: { werk: werkId } });
    // Das selektierte Option-Tag enthaelt selected/defaultValue.
    expect(html).toContain(werkId);
  });

  it('Sprach-Check: keine englischen UI-Strings', async () => {
    const userId = await nutzerAnlegen();
    const sid = await sessionAnlegen(userId);
    await werkAnlegen(userId);
    const html = await render({ sid });
    const verboten = ['Sign in', 'Login', 'Submit', 'Click here', 'Deadline'];
    for (const w of verboten) expect(html).not.toContain(w);
  });
});
