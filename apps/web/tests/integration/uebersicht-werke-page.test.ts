/**
 * Integration-Tests fuer /uebersicht/werke.
 *
 * - Ohne Session → redirect.
 * - Mit Session, ohne Werke → "leer"-Card sichtbar.
 * - Mit eigenen Werken → alle aufgelistet (auch pausiert/ausgeblendet).
 * - 5 Werke + keine Foerdermitgliedschaft → "Neues Werk anlegen"-Button disabled.
 */

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createId } from '@paralleldrive/cuid2';

import { db } from '@/lib/db';
import {
  nutzer,
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
  redirect: (target: string) => {
    lastRedirect = target;
    const err = new Error(`NEXT_REDIRECT: ${target}`);
    (err as Error & { digest: string }).digest = `NEXT_REDIRECT;replace;${target};307;`;
    throw err;
  },
}));

const { renderToStaticMarkup } = await import('react-dom/server');
const PageModule = await import('@/app/uebersicht/werke/page');
const UebersichtWerkePage = PageModule.default;

async function reset(): Promise<void> {
  await truncateAll();
  mockHeaders = new Map();
  lastRedirect = null;
}

async function createUser(email: string): Promise<string> {
  const id = createId();
  await db.insert(nutzer).values({
    id,
    email,
    klarname: `Klar ${email}`,
    anzeigename: `anz-${id.slice(0, 6)}`,
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

async function createWerk(
  nutzerId: string,
  overrides: Partial<typeof werk.$inferInsert> = {},
): Promise<string> {
  const id = createId();
  await db.insert(werk).values({
    id,
    nutzerId,
    name: `Werk-${id.slice(0, 4)}`,
    kurzbeschreibung: 'kb',
    problem: 'p',
    zielgruppe: 'z',
    werkstand: 'idee',
    hilfebedarf: [],
    sichtbarkeit: 'oeffentlich',
    status: 'aktiv',
    ...overrides,
  });
  return id;
}

function setSessionCookie(sid: string): void {
  mockHeaders.set('cookie', `wz_session=${encodeURIComponent(sid)}`);
}

async function render(opts: {
  sid?: string;
}): Promise<{ html: string; redirect: string | null }> {
  if (opts.sid) setSessionCookie(opts.sid);
  try {
    const tree = await UebersichtWerkePage();
    const html = renderToStaticMarkup(tree);
    return { html, redirect: lastRedirect };
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('NEXT_REDIRECT')) {
      return { html: '', redirect: lastRedirect };
    }
    throw err;
  }
}

describe('/uebersicht/werke page', () => {
  beforeEach(reset);
  afterAll(reset);

  it('ohne Session → redirect zu /anmelden?next=/uebersicht/werke', async () => {
    const { html, redirect } = await render({});
    expect(html).toBe('');
    expect(redirect).toBe('/anmelden?next=/uebersicht/werke');
  });

  it('mit Session, ohne Werke → leer-Card sichtbar', async () => {
    const userId = await createUser('werke-leer@test.werkzirkel.de');
    const sid = await createSessionFor(userId);
    const { html } = await render({ sid });
    expect(html).toContain('Du hast noch kein Werk angelegt.');
  });

  it('mit eigenen Werken → alle aufgelistet, inkl. pausiert/ausgeblendet', async () => {
    const userId = await createUser('werke-liste@test.werkzirkel.de');
    const sid = await createSessionFor(userId);
    await createWerk(userId, { name: 'Werk Oeffentlich' });
    await createWerk(userId, {
      name: 'Werk Pausiert',
      sichtbarkeit: 'pausiert',
    });
    await createWerk(userId, {
      name: 'Werk Ausgeblendet',
      status: 'ausgeblendet',
    });

    const { html } = await render({ sid });
    expect(html).toContain('Werk Oeffentlich');
    expect(html).toContain('Werk Pausiert');
    expect(html).toContain('Werk Ausgeblendet');
    // Badges
    expect(html).toContain('Pausiert');
    expect(html).toContain('Ausgeblendet');
  });

  it('"Neues Werk anlegen"-Link sichtbar wenn unter Limit', async () => {
    const userId = await createUser('werke-unter-limit@test.werkzirkel.de');
    const sid = await createSessionFor(userId);
    const { html } = await render({ sid });
    expect(html).toContain('href="/werke/neu"');
  });

  it('5 Werke + keine Foerdermitgliedschaft → Button disabled, Hinweis sichtbar', async () => {
    const userId = await createUser('werke-limit@test.werkzirkel.de');
    const sid = await createSessionFor(userId);
    for (let i = 1; i <= 5; i++) {
      await createWerk(userId, { name: `Werk ${i}` });
    }
    const { html } = await render({ sid });
    // Disabled-Button: kein Link zu /werke/neu, sondern <button disabled>
    expect(html).not.toContain('href="/werke/neu"');
    expect(html).toMatch(/<button[^>]*disabled[^>]*>/);
    expect(html).toContain('data-limit-hinweis');
    expect(html).toContain('Fördermitgliedschaft');
  });
});
