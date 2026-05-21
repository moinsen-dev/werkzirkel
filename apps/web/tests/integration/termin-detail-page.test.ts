/**
 * Integration-Tests fuer /termine/[id] (Detail-Page, public).
 *
 * - Public Render fuer veroeffentlichte Termine.
 * - 'geplant' → 404 fuer Anonyme.
 * - Anmelden-CTA fuer Anonyme.
 * - Server-Action terminAnmeldenAction → 201 in DB + iCal-Endpoint liefert text/calendar.
 *
 * Sprach-Check via Wortliste.
 */

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createId } from '@paralleldrive/cuid2';
import { eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import {
  nutzer,
  session as sessionTable,
  termin,
  terminAnmeldung,
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
  cookies: async () => ({ set: () => {} }),
}));

vi.mock('next/cache', () => ({
  revalidatePath: () => {
    /* no-op */
  },
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
const PageModule = await import('@/app/termine/[id]/page');
const Page = PageModule.default;
const { terminAnmeldenAction } = PageModule;

const { GET: icalGet } = await import('@/app/api/v1/termine/[id]/ical/route');

async function reset() {
  await truncateAll();
  mockHeaders = new Map();
  lastRedirect = null;
}

async function userAnlegen(opts: { rollen?: string[] } = {}): Promise<string> {
  const id = createId();
  await db.insert(nutzer).values({
    id,
    email: `u-${id}@test.werkzirkel.de`,
    klarname: 'User',
    anzeigename: `u-${id.slice(0, 6)}`,
    stadtId: 'hh',
    rollen: (opts.rollen ?? ['macher']) as Array<
      'macher' | 'bedarfstraeger' | 'foerderer' | 'kurator' | 'admin'
    >,
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

async function terminAnlegen(opts: {
  kuratorId: string;
  status?: 'geplant' | 'veroeffentlicht' | 'abgesagt' | 'durchgefuehrt';
  titel?: string;
}): Promise<string> {
  const id = createId();
  await db.insert(termin).values({
    id,
    stadtId: 'hh',
    typ: 'schauabend',
    titel: opts.titel ?? 'Schauabend Mai',
    beschreibung: 'Drei Werke stellen sich vor.',
    ortText: 'Werkstatt St. Pauli, Hamburg',
    datumUhrzeit: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    maxTeilnehmer: 20,
    erstelltVon: opts.kuratorId,
    status: opts.status ?? 'veroeffentlicht',
  });
  return id;
}

async function render(opts: {
  id: string;
  sid?: string;
  sp?: Record<string, string>;
}): Promise<string> {
  if (opts.sid) mockHeaders.set('cookie', `wz_session=${encodeURIComponent(opts.sid)}`);
  try {
    const tree = await Page({
      params: Promise.resolve({ id: opts.id }),
      searchParams: Promise.resolve(opts.sp ?? {}),
    });
    return renderToStaticMarkup(tree);
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('NEXT_REDIRECT')) return '';
    if (err instanceof Error && err.message === 'NEXT_NOT_FOUND') return '__notfound__';
    throw err;
  }
}

describe('/termine/[id] detail page', () => {
  beforeEach(reset);
  afterAll(reset);

  it('Termin nicht vorhanden → notFound', async () => {
    const out = await render({ id: 'nonexistent' });
    expect(out).toBe('__notfound__');
  });

  it('status=geplant + anonym → notFound', async () => {
    const kid = await userAnlegen({ rollen: ['kurator'] });
    const tid = await terminAnlegen({ kuratorId: kid, status: 'geplant' });
    const out = await render({ id: tid });
    expect(out).toBe('__notfound__');
  });

  it('public render fuer veroeffentlichten Termin zeigt Anonym-CTA', async () => {
    const kid = await userAnlegen({ rollen: ['kurator'] });
    const tid = await terminAnlegen({
      kuratorId: kid,
      titel: 'Demo Night Public',
    });
    const html = await render({ id: tid });
    expect(html).toContain('Demo Night Public');
    expect(html).toContain('Anmelden, um teilzunehmen');
  });

  it('abgesagter Termin zeigt Banner', async () => {
    const kid = await userAnlegen({ rollen: ['kurator'] });
    const tid = await terminAnlegen({
      kuratorId: kid,
      status: 'abgesagt',
    });
    const html = await render({ id: tid });
    expect(html).toContain('wurde abgesagt');
  });

  it('Sprach-Check: keine englischen UI-Strings', async () => {
    const kid = await userAnlegen({ rollen: ['kurator'] });
    const tid = await terminAnlegen({ kuratorId: kid });
    const html = await render({ id: tid });
    const verboten = ['Sign in', 'Login', 'Submit', 'Cancel', 'Edit'];
    for (const w of verboten) expect(html).not.toContain(w);
  });

  it('Server-Action: terminAnmeldenAction → Anmeldung in DB + iCal-Endpoint liefert text/calendar', async () => {
    const kid = await userAnlegen({ rollen: ['kurator'] });
    const tid = await terminAnlegen({ kuratorId: kid });

    const uid = await userAnlegen({ rollen: ['macher'] });
    const sid = await sessionAnlegen(uid);
    mockHeaders.set('cookie', `wz_session=${encodeURIComponent(sid)}`);

    try {
      await terminAnmeldenAction(tid);
    } catch (err) {
      // Server Action wirft via redirect — wir fangen den NEXT_REDIRECT.
      if (!(err instanceof Error) || !err.message.startsWith('NEXT_REDIRECT')) {
        throw err;
      }
    }

    // Anmeldung muss in der DB sein
    const anmeldungen = await db
      .select()
      .from(terminAnmeldung)
      .where(eq(terminAnmeldung.nutzerId, uid));
    expect(anmeldungen.length).toBe(1);
    expect(anmeldungen[0]?.status).toBe('angemeldet');

    // iCal-Endpoint liefert text/calendar
    const icalReq = new Request(`http://test/api/v1/termine/${tid}/ical`);
    const icalResp = await icalGet(icalReq, {
      params: Promise.resolve({ id: tid }),
    });
    expect(icalResp.status).toBe(200);
    expect(icalResp.headers.get('content-type')).toContain('text/calendar');
    const body = await icalResp.text();
    expect(body).toContain('BEGIN:VCALENDAR');
    expect(body).toContain('END:VCALENDAR');
  });
});
