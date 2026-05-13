/**
 * Integration-Tests fuer /werke/neu (Server Component + Server Action).
 *
 * Wir mocken `next/headers` und `next/navigation` analog zu den anderen
 * page-Tests, rufen die Page direkt auf und rendern via
 * `renderToStaticMarkup`.
 */

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createId } from '@paralleldrive/cuid2';
import { eq } from 'drizzle-orm';

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
  notFound: () => {
    const err = new Error('NEXT_NOT_FOUND');
    (err as Error & { digest: string }).digest = 'NEXT_NOT_FOUND';
    throw err;
  },
}));

const { renderToStaticMarkup } = await import('react-dom/server');
const PageModule = await import('@/app/werke/neu/page');
const WerkAnlegenPage = PageModule.default;
const werkAnlegen = PageModule.werkAnlegen;

async function reset(): Promise<void> {
  await truncateAll();
  mockHeaders = new Map();
  lastRedirect = null;
}

async function createUser(
  email: string,
  rollen: ('macher' | 'bedarfstraeger' | 'foerderer' | 'kurator' | 'admin')[] = [
    'macher',
  ],
): Promise<string> {
  const id = createId();
  await db.insert(nutzer).values({
    id,
    email,
    klarname: `Klar ${email}`,
    anzeigename: `anz-${id.slice(0, 6)}`,
    stadtId: 'hh',
    rollen,
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

async function render(opts: {
  sid?: string;
  searchParams?: Record<string, string>;
}): Promise<{ html: string; redirect: string | null }> {
  if (opts.sid) setSessionCookie(opts.sid);
  try {
    const tree = await WerkAnlegenPage({
      searchParams: Promise.resolve(opts.searchParams ?? {}),
    });
    const html = renderToStaticMarkup(tree);
    return { html, redirect: lastRedirect };
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('NEXT_REDIRECT')) {
      return { html: '', redirect: lastRedirect };
    }
    throw err;
  }
}

describe('/werke/neu page', () => {
  beforeEach(reset);
  afterAll(reset);

  it('ohne Session → redirect zu /anmelden?next=/werke/neu', async () => {
    const { html, redirect } = await render({});
    expect(html).toBe('');
    expect(redirect).toBe('/anmelden?next=/werke/neu');
  });

  it('mit Session aber ohne macher-Rolle → 403-State im HTML (kein Form)', async () => {
    const userId = await createUser('rolle-fehlt@test.werkzirkel.de', [
      'bedarfstraeger',
    ]);
    const sid = await createSessionFor(userId);
    const { html, redirect } = await render({ sid });
    expect(redirect).toBeNull();
    expect(html).toContain('data-rolle-fehlt');
    expect(html).toContain('Macher:innen-Rolle');
    // Kein Form-Submit-Button mit "Werk anlegen"-Text
    expect(html).not.toMatch(/type="submit"[^>]*>[^<]*Werk anlegen/);
  });

  it('mit macher-Rolle → rendert Form mit allen Pflichtfeldern', async () => {
    const userId = await createUser('macher@test.werkzirkel.de');
    const sid = await createSessionFor(userId);
    const { html } = await render({ sid });
    expect(html).toContain('name="name"');
    expect(html).toContain('name="kurzbeschreibung"');
    expect(html).toContain('name="problem"');
    expect(html).toContain('name="zielgruppe"');
    expect(html).toContain('name="werkstand"');
    expect(html).toContain('name="hilfebedarf"');
    expect(html).toContain('name="sichtbarkeit"');
    // alle 6 Werkstand-Optionen
    expect(html).toContain('Idee');
    expect(html).toContain('Prototyp');
    expect(html).toContain('Testversion');
    expect(html).toContain('Wachsend');
  });
});

describe('werkAnlegen server action', () => {
  beforeEach(reset);
  afterAll(reset);

  function buildFormData(
    overrides: Record<string, string | string[]> = {},
  ): FormData {
    const fd = new FormData();
    const base: Record<string, string | string[]> = {
      name: 'Mein Werk',
      kurzbeschreibung: 'Eine kurze Beschreibung.',
      problem: 'Wir loesen Problem X.',
      zielgruppe: 'Indie Macher:innen',
      werkstand: 'idee',
      hilfebedarf: ['ux_test'],
      link: '',
      sichtbarkeit: 'oeffentlich',
    };
    const merged = { ...base, ...overrides };
    for (const [k, v] of Object.entries(merged)) {
      if (Array.isArray(v)) {
        for (const item of v) fd.append(k, item);
      } else {
        fd.append(k, v);
      }
    }
    return fd;
  }

  async function runAction(fd: FormData): Promise<string | null> {
    try {
      await werkAnlegen(fd);
      return lastRedirect;
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('NEXT_REDIRECT')) {
        return lastRedirect;
      }
      throw err;
    }
  }

  it('valide Daten → werk in DB + redirect zu /werke/<id>/bearbeiten?frisch=1', async () => {
    const userId = await createUser('action-ok@test.werkzirkel.de');
    const sid = await createSessionFor(userId);
    setSessionCookie(sid);

    const target = await runAction(buildFormData());
    expect(target).toMatch(/^\/werke\/[^/]+\/bearbeiten\?frisch=1$/);

    const rows = await db.select().from(werk).where(eq(werk.nutzerId, userId));
    expect(rows.length).toBe(1);
    expect(rows[0]?.name).toBe('Mein Werk');
  });

  it('kurzbeschreibung > 280 Zeichen → redirect mit ?fehler=validierung', async () => {
    const userId = await createUser('action-too-long@test.werkzirkel.de');
    const sid = await createSessionFor(userId);
    setSessionCookie(sid);

    const target = await runAction(
      buildFormData({ kurzbeschreibung: 'x'.repeat(281) }),
    );
    expect(target).toMatch(/^\/werke\/neu\?fehler=validierung/);
    expect(target).toContain('feld=kurzbeschreibung');

    const rows = await db.select().from(werk).where(eq(werk.nutzerId, userId));
    expect(rows.length).toBe(0);
  });

  it('ohne macher-Rolle → redirect mit ?fehler=keine_rolle', async () => {
    const userId = await createUser('action-keine-rolle@test.werkzirkel.de', [
      'bedarfstraeger',
    ]);
    const sid = await createSessionFor(userId);
    setSessionCookie(sid);

    const target = await runAction(buildFormData());
    expect(target).toBe('/werke/neu?fehler=keine_rolle');
  });

  it('Limit erreicht (5 Werke) → redirect mit ?fehler=limit', async () => {
    const userId = await createUser('action-limit@test.werkzirkel.de');
    const sid = await createSessionFor(userId);
    setSessionCookie(sid);

    // 5 Werke vorab in DB.
    for (let i = 1; i <= 5; i++) {
      await db.insert(werk).values({
        nutzerId: userId,
        name: `Werk ${i}`,
        kurzbeschreibung: 'kb',
        problem: 'p',
        zielgruppe: 'z',
        werkstand: 'idee',
        hilfebedarf: [],
        sichtbarkeit: 'oeffentlich',
      });
    }

    const target = await runAction(buildFormData());
    expect(target).toBe('/werke/neu?fehler=limit');
  });
});
