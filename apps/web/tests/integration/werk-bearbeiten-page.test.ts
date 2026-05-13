/**
 * Integration-Tests fuer /werke/[id]/bearbeiten.
 *
 * - GET als Inhaber → 200 mit vorgefuellten Werten.
 * - GET vom fremden Nutzer → 404 (notFound).
 * - Server Action `werkAktualisierenAction` mit Werkstand-Wechsel → werk_historie-Insert.
 * - Server Action `werkLoeschenAction` → DB-Loesch + redirect.
 */

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createId } from '@paralleldrive/cuid2';
import { eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import {
  nutzer,
  session as sessionTable,
  werk,
  werkHistorie,
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
    lastNotFound = true;
    const err = new Error('NEXT_NOT_FOUND');
    (err as Error & { digest: string }).digest = 'NEXT_NOT_FOUND';
    throw err;
  },
}));

const { renderToStaticMarkup } = await import('react-dom/server');
const PageModule = await import('@/app/werke/[id]/bearbeiten/page');
const WerkBearbeitenPage = PageModule.default;
const werkAktualisierenAction = PageModule.werkAktualisierenAction;
const werkLoeschenAction = PageModule.werkLoeschenAction;

async function reset(): Promise<void> {
  await truncateAll();
  mockHeaders = new Map();
  lastRedirect = null;
  lastNotFound = false;
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
    name: 'Original-Werk',
    kurzbeschreibung: 'Original kurz',
    problem: 'Original problem',
    zielgruppe: 'Original zielgruppe',
    werkstand: 'idee',
    hilfebedarf: ['ux_test'],
    sichtbarkeit: 'oeffentlich',
    status: 'aktiv',
    ...overrides,
  });
  return id;
}

function setSessionCookie(sid: string): void {
  mockHeaders.set('cookie', `wz_session=${encodeURIComponent(sid)}`);
}

async function render(
  werkId: string,
  opts: { sid?: string; searchParams?: Record<string, string> } = {},
): Promise<{ html: string; redirect: string | null; notFound: boolean }> {
  if (opts.sid) setSessionCookie(opts.sid);
  try {
    const tree = await WerkBearbeitenPage({
      params: Promise.resolve({ id: werkId }),
      searchParams: Promise.resolve(opts.searchParams ?? {}),
    });
    const html = renderToStaticMarkup(tree);
    return { html, redirect: lastRedirect, notFound: lastNotFound };
  } catch (err) {
    if (err instanceof Error) {
      if (err.message.startsWith('NEXT_REDIRECT')) {
        return { html: '', redirect: lastRedirect, notFound: false };
      }
      if (err.message === 'NEXT_NOT_FOUND') {
        return { html: '', redirect: null, notFound: true };
      }
    }
    throw err;
  }
}

describe('/werke/[id]/bearbeiten page', () => {
  beforeEach(reset);
  afterAll(reset);

  it('ohne Session → redirect zu /anmelden', async () => {
    const ownerId = await createUser('owner-edit-1@test.werkzirkel.de');
    const wId = await createWerk(ownerId);
    const { redirect } = await render(wId);
    expect(redirect).toMatch(/^\/anmelden\?next=\/werke\/.+\/bearbeiten$/);
  });

  it('als Inhaber:in → 200 mit vorgefuellten Werten', async () => {
    const ownerId = await createUser('owner-edit-2@test.werkzirkel.de');
    const sid = await createSessionFor(ownerId);
    const wId = await createWerk(ownerId, {
      name: 'Anzeigetest Werk',
      kurzbeschreibung: 'Sehr eigen kurz',
      problem: 'Anzeige Problem',
    });
    const { html, notFound } = await render(wId, { sid });
    expect(notFound).toBe(false);
    expect(html).toContain('Anzeigetest Werk');
    expect(html).toContain('Sehr eigen kurz');
    expect(html).toContain('Anzeige Problem');
    expect(html).toContain('name="werkstand"');
    expect(html).toContain('name="sichtbarkeit"');
  });

  it('fremder Nutzer:in → notFound', async () => {
    const ownerId = await createUser('owner-fremd@test.werkzirkel.de');
    const wId = await createWerk(ownerId);
    const fremdId = await createUser('fremd-edit@test.werkzirkel.de');
    const fremdSid = await createSessionFor(fremdId);
    const { notFound } = await render(wId, { sid: fremdSid });
    expect(notFound).toBe(true);
  });

  it('nicht-existentes Werk → notFound', async () => {
    const userId = await createUser('userx@test.werkzirkel.de');
    const sid = await createSessionFor(userId);
    const { notFound } = await render('does-not-exist-xxx', { sid });
    expect(notFound).toBe(true);
  });

  it('frisch=1 → Erfolgs-Banner sichtbar', async () => {
    const ownerId = await createUser('owner-frisch@test.werkzirkel.de');
    const sid = await createSessionFor(ownerId);
    const wId = await createWerk(ownerId);
    const { html } = await render(wId, { sid, searchParams: { frisch: '1' } });
    expect(html).toMatch(/Werk angelegt/i);
  });
});

describe('werkAktualisierenAction', () => {
  beforeEach(reset);
  afterAll(reset);

  function buildFormData(
    overrides: Record<string, string | string[]> = {},
  ): FormData {
    const fd = new FormData();
    const base: Record<string, string | string[]> = {
      name: 'Updated Werk',
      kurzbeschreibung: 'Updated kurz',
      problem: 'Updated problem',
      zielgruppe: 'Updated zielgruppe',
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

  async function runUpdate(
    werkId: string,
    fd: FormData,
  ): Promise<string | null> {
    try {
      await werkAktualisierenAction(werkId, fd);
      return lastRedirect;
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('NEXT_REDIRECT')) {
        return lastRedirect;
      }
      if (err instanceof Error && err.message === 'NEXT_NOT_FOUND') {
        return 'NEXT_NOT_FOUND';
      }
      throw err;
    }
  }

  it('Werkstand-Wechsel idee → prototyp erzeugt werk_historie-Eintrag', async () => {
    const ownerId = await createUser('upd-werkstand@test.werkzirkel.de');
    const sid = await createSessionFor(ownerId);
    setSessionCookie(sid);
    const wId = await createWerk(ownerId, { werkstand: 'idee' });

    const target = await runUpdate(
      wId,
      buildFormData({ werkstand: 'prototyp' }),
    );
    expect(target).toMatch(/^\/werke\/.+\/bearbeiten\?gespeichert=1$/);

    const updatedRows = await db.select().from(werk).where(eq(werk.id, wId));
    expect(updatedRows[0]?.werkstand).toBe('prototyp');

    const historie = await db
      .select()
      .from(werkHistorie)
      .where(eq(werkHistorie.werkId, wId));
    expect(historie.length).toBe(1);
    expect(historie[0]?.werkstandAlt).toBe('idee');
    expect(historie[0]?.werkstandNeu).toBe('prototyp');
    expect(historie[0]?.geaendertVon).toBe(ownerId);
  });

  it('selber Werkstand → KEIN werk_historie-Eintrag', async () => {
    const ownerId = await createUser('upd-same@test.werkzirkel.de');
    const sid = await createSessionFor(ownerId);
    setSessionCookie(sid);
    const wId = await createWerk(ownerId, { werkstand: 'idee' });

    await runUpdate(wId, buildFormData({ werkstand: 'idee', name: 'Neuer Name' }));

    const updatedRows = await db.select().from(werk).where(eq(werk.id, wId));
    expect(updatedRows[0]?.name).toBe('Neuer Name');

    const historie = await db
      .select()
      .from(werkHistorie)
      .where(eq(werkHistorie.werkId, wId));
    expect(historie.length).toBe(0);
  });

  it('fremder Nutzer → notFound', async () => {
    const ownerId = await createUser('upd-owner@test.werkzirkel.de');
    const wId = await createWerk(ownerId);
    const fremdId = await createUser('upd-fremd@test.werkzirkel.de');
    const fremdSid = await createSessionFor(fremdId);
    setSessionCookie(fremdSid);
    const target = await runUpdate(wId, buildFormData());
    expect(target).toBe('NEXT_NOT_FOUND');
  });
});

describe('werkLoeschenAction', () => {
  beforeEach(reset);
  afterAll(reset);

  async function runDelete(werkId: string): Promise<string | null> {
    try {
      await werkLoeschenAction(werkId);
      return lastRedirect;
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('NEXT_REDIRECT')) {
        return lastRedirect;
      }
      if (err instanceof Error && err.message === 'NEXT_NOT_FOUND') {
        return 'NEXT_NOT_FOUND';
      }
      throw err;
    }
  }

  it('eigenes Werk loeschen → redirect /uebersicht/werke + DB-Row weg', async () => {
    const ownerId = await createUser('del-owner@test.werkzirkel.de');
    const sid = await createSessionFor(ownerId);
    setSessionCookie(sid);
    const wId = await createWerk(ownerId);

    const target = await runDelete(wId);
    expect(target).toBe('/uebersicht/werke');

    const rows = await db.select().from(werk).where(eq(werk.id, wId));
    expect(rows.length).toBe(0);
  });

  it('fremdes Werk loeschen → notFound, DB unveraendert', async () => {
    const ownerId = await createUser('del-owner-2@test.werkzirkel.de');
    const wId = await createWerk(ownerId);
    const fremdId = await createUser('del-fremd@test.werkzirkel.de');
    const fremdSid = await createSessionFor(fremdId);
    setSessionCookie(fremdSid);

    const target = await runDelete(wId);
    expect(target).toBe('NEXT_NOT_FOUND');

    const rows = await db.select().from(werk).where(eq(werk.id, wId));
    expect(rows.length).toBe(1);
  });
});
