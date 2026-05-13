/**
 * Integration-Test fuer die `abmeldenAction` aus `/app/uebersicht/page.tsx`.
 *
 * Pruefung:
 *  - Mit gueltiger Session → Session-Row wird aus DB geloescht und die
 *    Action redirected zu `/`.
 *  - Nach Abmeldung findet `getSessionFromRequest` mit demselben Cookie
 *    keine Row mehr → die Page redirected zu `/anmelden`.
 */

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createId } from '@paralleldrive/cuid2';
import { eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import {
  nutzer,
  session as sessionTable,
} from '@/lib/db/schema';
import { truncateAll } from '../_helpers/db-cleanup';

let mockHeaders = new Map<string, string>();
let lastRedirect: string | null = null;
const cookieSets: Array<{ name: string; value: string; maxAge?: number }> = [];

vi.mock('next/headers', () => ({
  headers: async () => ({
    entries: () => mockHeaders.entries(),
    get: (name: string) => mockHeaders.get(name.toLowerCase()) ?? null,
  }),
  cookies: async () => ({
    set: (opts: { name: string; value: string; maxAge?: number }) => {
      cookieSets.push(opts);
    },
  }),
}));

vi.mock('next/navigation', () => ({
  redirect: (target: string) => {
    lastRedirect = target;
    const err = new Error(`NEXT_REDIRECT: ${target}`);
    (err as Error & { digest: string }).digest = `NEXT_REDIRECT;replace;${target};307;`;
    throw err;
  },
}));

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return (require('react') as typeof import('react')).createElement(
      'a',
      { href },
      children,
    );
  },
}));

const PageModule = await import('@/app/uebersicht/page');
const { abmeldenAction } = PageModule;
const UebersichtPage = PageModule.default;

const TEST_EMAIL = 'uebersicht-abmelden@test.werkzirkel.de';

async function reset(): Promise<void> {
  await truncateAll();
  mockHeaders = new Map();
  lastRedirect = null;
  cookieSets.length = 0;
}

async function createUser(email: string): Promise<string> {
  const id = createId();
  await db.insert(nutzer).values({
    id,
    email,
    klarname: 'Abmelden Tester',
    anzeigename: 'abmelden-test',
    stadtId: 'hh',
    rollen: ['macher'],
    emailVerifiziertAm: new Date(),
  });
  return id;
}

async function createSessionFor(nutzerId: string): Promise<string> {
  const id = createId();
  await db.insert(sessionTable).values({
    id,
    nutzerId,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });
  return id;
}

function setSessionCookie(sid: string): void {
  mockHeaders.set('cookie', `wz_session=${encodeURIComponent(sid)}`);
}

async function callAbmelden(): Promise<void> {
  try {
    await abmeldenAction();
  } catch (err) {
    if (!(err instanceof Error) || !err.message.startsWith('NEXT_REDIRECT')) {
      throw err;
    }
  }
}

describe('abmeldenAction', () => {
  beforeEach(reset);
  afterAll(reset);

  it('logged-in user → Session-Row weg, Redirect zu /', async () => {
    const userId = await createUser(TEST_EMAIL);
    const sid = await createSessionFor(userId);
    setSessionCookie(sid);

    await callAbmelden();

    expect(lastRedirect).toBe('/');
    const rows = await db
      .select()
      .from(sessionTable)
      .where(eq(sessionTable.id, sid));
    expect(rows.length).toBe(0);

    // Cookie wurde mit maxAge=0 zurueckgesetzt.
    const clearSet = cookieSets.find(
      (c) => c.name === 'wz_session' && c.maxAge === 0,
    );
    expect(clearSet).toBeTruthy();
  });

  it('nach Abmeldung → Page redirected mit demselben Cookie zu /anmelden', async () => {
    const userId = await createUser(TEST_EMAIL);
    const sid = await createSessionFor(userId);
    setSessionCookie(sid);

    await callAbmelden();
    lastRedirect = null;

    // Cookie ist im Browser noch da, aber DB-Row ist weg.
    setSessionCookie(sid);
    try {
      await UebersichtPage();
    } catch (err) {
      if (!(err instanceof Error) || !err.message.startsWith('NEXT_REDIRECT')) {
        throw err;
      }
    }
    expect(lastRedirect).toBe('/anmelden?next=/uebersicht');
  });

  it('ohne Session-Cookie → trotzdem Redirect zu / (idempotent)', async () => {
    await callAbmelden();
    expect(lastRedirect).toBe('/');
  });
});
