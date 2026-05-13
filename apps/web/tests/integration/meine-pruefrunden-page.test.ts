/**
 * Render-Tests fuer /uebersicht/pruefrunden (Server Component, auth).
 */

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createId } from '@paralleldrive/cuid2';

import { db } from '@/lib/db';
import {
  nutzer,
  pruefrunde,
  pruefrundenAnmeldung,
  session as sessionTable,
  testSaldo,
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
  cookies: async () => ({ set: () => {} }),
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
const Page = (await import('@/app/uebersicht/pruefrunden/page')).default;

async function reset() {
  await truncateAll();
  mockHeaders = new Map();
  lastRedirect = null;
}

async function nutzerAnlegen(prefix: string): Promise<string> {
  const id = createId();
  await db.insert(nutzer).values({
    id,
    email: `${prefix}-${id.slice(0, 4)}@test.werkzirkel.de`,
    klarname: 'Test',
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
    name: 'Werk-M',
    kurzbeschreibung: 'k',
    problem: 'p',
    zielgruppe: 'z',
    werkstand: 'prototyp',
  });
  return id;
}

async function pruefrundeAnlegen(opts: {
  werkId: string;
  titel: string;
  status: 'entwurf' | 'oeffentlich' | 'geschlossen' | 'abgeschlossen';
}): Promise<string> {
  const id = createId();
  await db.insert(pruefrunde).values({
    id,
    werkId: opts.werkId,
    titel: opts.titel,
    testziel: 'tz',
    testaufgabe: 'ta',
    zielgruppe: 'z',
    zeitbedarfMinuten: 30,
    gesuchteTester: 3,
    feedbackKategorien: ['erster_eindruck'],
    frist: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    status: opts.status,
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

describe('/uebersicht/pruefrunden page', () => {
  beforeEach(reset);
  afterAll(reset);

  it('ohne Session → redirect /anmelden', async () => {
    await render();
    expect(lastRedirect).toBe('/anmelden?next=/uebersicht/pruefrunden');
  });

  it('mit Session, kein Inhalt → beide Empty-States rendern', async () => {
    const userId = await nutzerAnlegen('u');
    const sid = await sessionAnlegen(userId);
    const html = await render({ sid });
    expect(html).toContain('Eigene Prüfrunden');
    expect(html).toContain('Als Tester:in angemeldet');
    expect(html).toContain('noch keine Prüfrunde angelegt');
  });

  it('Eigene Pruefrunde → Card sichtbar', async () => {
    const userId = await nutzerAnlegen('u');
    const sid = await sessionAnlegen(userId);
    const werkId = await werkAnlegen(userId);
    await pruefrundeAnlegen({
      werkId,
      titel: 'Meine eigene Runde',
      status: 'oeffentlich',
    });
    const html = await render({ sid });
    expect(html).toContain('Meine eigene Runde');
  });

  it('Als Tester:in angemeldet → Card mit Feedback-Link', async () => {
    const inhaberId = await nutzerAnlegen('inh');
    const werkId = await werkAnlegen(inhaberId);
    const prId = await pruefrundeAnlegen({
      werkId,
      titel: 'Pruefrunde wo ich Tester bin',
      status: 'oeffentlich',
    });
    const testerId = await nutzerAnlegen('t');
    await db.insert(pruefrundenAnmeldung).values({
      pruefrundeId: prId,
      testerId,
      status: 'angemeldet',
    });
    const sid = await sessionAnlegen(testerId);
    const html = await render({ sid });
    expect(html).toContain('Pruefrunde wo ich Tester bin');
    expect(html).toContain('Feedback abgeben');
  });

  it('Offene Reziprozitaets-Verpflichtung → Roter Top-Banner', async () => {
    const userId = await nutzerAnlegen('u');
    const sid = await sessionAnlegen(userId);
    await db.insert(testSaldo).values({
      nutzerId: userId,
      testsGegeben: 0,
      testsErhalten: 0,
      offeneVerpflichtungAnzahl: 1,
      naechsteVerpflichtungFrist: new Date('2026-07-01T12:00:00Z'),
    });
    const html = await render({ sid });
    expect(html).toContain('role="alert"');
    expect(html).toContain('Reziprozität');
    expect(html).toContain('01.07.2026');
  });

  it('erfolg=feedback-abgegeben → Erfolg-Banner', async () => {
    const userId = await nutzerAnlegen('u');
    const sid = await sessionAnlegen(userId);
    const html = await render({ sid, sp: { erfolg: 'feedback-abgegeben' } });
    expect(html).toContain('Danke für dein Feedback');
  });

  it('Sprach-Check: keine englischen UI-Strings', async () => {
    const userId = await nutzerAnlegen('u');
    const sid = await sessionAnlegen(userId);
    const html = await render({ sid });
    const verboten = ['Sign in', 'Login', 'Submit', 'Click here', 'Deadline'];
    for (const w of verboten) expect(html).not.toContain(w);
  });
});
