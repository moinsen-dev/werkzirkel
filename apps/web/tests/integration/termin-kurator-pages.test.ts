/**
 * Integration-Tests fuer die Kurator-Termin-Pages:
 *  - /kurator/termine/neu
 *  - /kurator/termine/[id]/bearbeiten
 *  - /kurator/termine/[id]/anwesenheit
 *  - /uebersicht/termine
 *
 * Pro Page mindestens: Auth-Redirect + Render mit gueltiger Session +
 * Permission-Check (Kurator vs. Macher).
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
let lastNotFound = false;

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
    lastNotFound = true;
    const err = new Error('NEXT_NOT_FOUND');
    (err as Error & { digest: string }).digest = 'NEXT_NOT_FOUND';
    throw err;
  },
}));

const { renderToStaticMarkup } = await import('react-dom/server');
const NeuPage = (await import('@/app/kurator/termine/neu/page')).default;
const BearbeitenPage = (
  await import('@/app/kurator/termine/[id]/bearbeiten/page')
).default;
const AnwesenheitPage = (
  await import('@/app/kurator/termine/[id]/anwesenheit/page')
).default;
const MeinePage = (await import('@/app/uebersicht/termine/page')).default;

async function reset() {
  await truncateAll();
  mockHeaders = new Map();
  lastRedirect = null;
  lastNotFound = false;
}

async function userAnlegen(opts: {
  rollen?: Array<
    'macher' | 'bedarfstraeger' | 'foerderer' | 'kurator' | 'admin'
  >;
}): Promise<string> {
  const id = createId();
  await db.insert(nutzer).values({
    id,
    email: `u-${id}@test.werkzirkel.de`,
    klarname: 'User',
    anzeigename: `u-${id.slice(0, 6)}`,
    stadtId: 'hh',
    rollen: opts.rollen ?? ['macher'],
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
  inDerVergangenheit?: boolean;
  titel?: string;
}): Promise<string> {
  const id = createId();
  const datum = opts.inDerVergangenheit
    ? new Date(Date.now() - 24 * 60 * 60 * 1000)
    : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await db.insert(termin).values({
    id,
    stadtId: 'hh',
    typ: 'schauabend',
    titel: opts.titel ?? 'Demo Night',
    beschreibung: 'Drei Werke stellen sich vor.',
    ortText: 'Werkstatt St. Pauli',
    datumUhrzeit: datum,
    maxTeilnehmer: 20,
    erstelltVon: opts.kuratorId,
    status: opts.status ?? 'veroeffentlicht',
  });
  return id;
}

function setSession(sid: string) {
  mockHeaders.set('cookie', `wz_session=${encodeURIComponent(sid)}`);
}

async function tryRender(fn: () => Promise<React.ReactElement>): Promise<string> {
  try {
    const tree = await fn();
    return renderToStaticMarkup(tree);
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('NEXT_REDIRECT')) return '';
    if (err instanceof Error && err.message === 'NEXT_NOT_FOUND') return '__notfound__';
    throw err;
  }
}

describe('/kurator/termine/neu page', () => {
  beforeEach(reset);
  afterAll(reset);

  it('ohne Session → redirect /anmelden', async () => {
    await tryRender(() =>
      NeuPage({ searchParams: Promise.resolve({}) }),
    );
    expect(lastRedirect).toBe('/anmelden?next=/kurator/termine/neu');
  });

  it('mit Macher (kein Kurator) → 403-Hinweis', async () => {
    const uid = await userAnlegen({ rollen: ['macher'] });
    const sid = await sessionAnlegen(uid);
    setSession(sid);
    const html = await tryRender(() =>
      NeuPage({ searchParams: Promise.resolve({}) }),
    );
    expect(html).toContain('Kurator');
    // Form sollte NICHT gerendert sein, da kein Kurator
    expect(html).not.toContain('name="titel"');
  });

  it('mit Kurator → Form sichtbar', async () => {
    const uid = await userAnlegen({ rollen: ['kurator'] });
    const sid = await sessionAnlegen(uid);
    setSession(sid);
    const html = await tryRender(() =>
      NeuPage({ searchParams: Promise.resolve({}) }),
    );
    expect(html).toContain('Termin anlegen');
    expect(html).toContain('name="titel"');
    expect(html).toContain('name="datum_uhrzeit"');
  });
});

describe('/kurator/termine/[id]/bearbeiten page', () => {
  beforeEach(reset);
  afterAll(reset);

  it('fremde Stadt → notFound', async () => {
    const kuratorAndere = await userAnlegen({ rollen: ['kurator'] });
    // Termin in 'b' (vorbereitung) statt 'hh'
    const tid = createId();
    await db.insert(termin).values({
      id: tid,
      stadtId: 'b',
      typ: 'schauabend',
      titel: 'Fremde Stadt',
      beschreibung: 'x',
      ortText: 'irgendwo',
      datumUhrzeit: new Date(Date.now() + 24 * 60 * 60 * 1000),
      maxTeilnehmer: 10,
      erstelltVon: kuratorAndere,
      status: 'geplant',
    });
    const uid = await userAnlegen({ rollen: ['kurator'] }); // stadtId 'hh'
    const sid = await sessionAnlegen(uid);
    setSession(sid);
    const out = await tryRender(() =>
      BearbeitenPage({
        params: Promise.resolve({ id: tid }),
        searchParams: Promise.resolve({}),
      }),
    );
    expect(out).toBe('__notfound__');
    expect(lastNotFound).toBe(true);
  });

  it('eigene Stadt → Form vorgefuellt', async () => {
    const uid = await userAnlegen({ rollen: ['kurator'] });
    const tid = await terminAnlegen({
      kuratorId: uid,
      titel: 'Bearbeite Mich',
    });
    const sid = await sessionAnlegen(uid);
    setSession(sid);
    const html = await tryRender(() =>
      BearbeitenPage({
        params: Promise.resolve({ id: tid }),
        searchParams: Promise.resolve({}),
      }),
    );
    expect(html).toContain('Bearbeite Mich');
    expect(html).toContain('Termin bearbeiten');
  });
});

describe('/kurator/termine/[id]/anwesenheit page', () => {
  beforeEach(reset);
  afterAll(reset);

  it('fremde Stadt → notFound', async () => {
    const kuratorAndere = await userAnlegen({ rollen: ['kurator'] });
    const tid = createId();
    await db.insert(termin).values({
      id: tid,
      stadtId: 'b',
      typ: 'schauabend',
      titel: 'Fremd',
      beschreibung: 'x',
      ortText: 'x',
      datumUhrzeit: new Date(Date.now() - 24 * 60 * 60 * 1000),
      maxTeilnehmer: 10,
      erstelltVon: kuratorAndere,
      status: 'durchgefuehrt',
    });
    const uid = await userAnlegen({ rollen: ['kurator'] });
    const sid = await sessionAnlegen(uid);
    setSession(sid);
    const out = await tryRender(() =>
      AnwesenheitPage({
        params: Promise.resolve({ id: tid }),
        searchParams: Promise.resolve({}),
      }),
    );
    expect(out).toBe('__notfound__');
  });

  it('mit Anmeldungen → Liste sichtbar', async () => {
    const uid = await userAnlegen({ rollen: ['kurator'] });
    const tid = await terminAnlegen({
      kuratorId: uid,
      inDerVergangenheit: true,
      status: 'durchgefuehrt',
    });
    const teilnehmerId = await userAnlegen({ rollen: ['macher'] });
    await db.insert(terminAnmeldung).values({
      terminId: tid,
      nutzerId: teilnehmerId,
      status: 'angemeldet',
    });
    const sid = await sessionAnlegen(uid);
    setSession(sid);
    const html = await tryRender(() =>
      AnwesenheitPage({
        params: Promise.resolve({ id: tid }),
        searchParams: Promise.resolve({}),
      }),
    );
    expect(html).toContain('Anwesenheit dokumentieren');
    expect(html).toContain('name="anwesend"');
  });
});

describe('/uebersicht/termine page', () => {
  beforeEach(reset);
  afterAll(reset);

  it('ohne Session → redirect /anmelden', async () => {
    await tryRender(() => MeinePage());
    expect(lastRedirect).toBe('/anmelden?next=/uebersicht/termine');
  });

  it('mit Session, keine Anmeldungen → Empty-States in beiden Sektionen', async () => {
    const uid = await userAnlegen({});
    const sid = await sessionAnlegen(uid);
    setSession(sid);
    const html = await tryRender(() => MeinePage());
    expect(html).toContain('Kommende Termine');
    expect(html).toContain('Vergangene Termine');
    expect(html).toContain('für keinen Termin angemeldet');
  });

  it('mit aktiver Anmeldung → Termin in kommend-Sektion', async () => {
    const kid = await userAnlegen({ rollen: ['kurator'] });
    const tid = await terminAnlegen({
      kuratorId: kid,
      titel: 'Mein Termin',
    });
    const uid = await userAnlegen({});
    await db.insert(terminAnmeldung).values({
      terminId: tid,
      nutzerId: uid,
      status: 'angemeldet',
    });
    const sid = await sessionAnlegen(uid);
    setSession(sid);
    const html = await tryRender(() => MeinePage());
    expect(html).toContain('Mein Termin');
    expect(html).toContain('Angemeldet');
  });

  it('Sprach-Check: keine englischen Strings', async () => {
    const uid = await userAnlegen({});
    const sid = await sessionAnlegen(uid);
    setSession(sid);
    const html = await tryRender(() => MeinePage());
    const verboten = ['Sign in', 'Login', 'Submit', 'Upcoming events'];
    for (const w of verboten) expect(html).not.toContain(w);
  });

  it('DB-Side-Effect: Anmeldung in kommend, dann Storno → in vergangen NICHT mehr (storniert filtert kommend, aber vergangenen-Sektion sieht es)', async () => {
    const kid = await userAnlegen({ rollen: ['kurator'] });
    const tid = await terminAnlegen({ kuratorId: kid });
    const uid = await userAnlegen({});
    await db.insert(terminAnmeldung).values({
      terminId: tid,
      nutzerId: uid,
      status: 'storniert',
    });
    const sid = await sessionAnlegen(uid);
    setSession(sid);
    const html = await tryRender(() => MeinePage());
    // Storniert filtert aus 'kommend', aber Datum > now → wird auch nicht in 'vergangen' angezeigt.
    expect(html).toContain('für keinen Termin angemeldet');
    // Sanity: Anmeldung-Row existiert
    const rows = await db
      .select()
      .from(terminAnmeldung)
      .where(eq(terminAnmeldung.nutzerId, uid));
    expect(rows.length).toBe(1);
    expect(rows[0]?.status).toBe('storniert');
  });
});
