/**
 * Integration-Test fuer Server Action `pruefrundeVeroeffentlichenAction`.
 *
 * Quelle: PRD §F-201, §17.
 *
 * Wir testen die zwei kritischen Pfade:
 *
 *  A) **neue Verpflichtung** — saldo=0, keine offene Verpflichtung
 *     → veroeffentlicht, redirected mit modus=neue_verpflichtung + frist.
 *
 *  B) **Reziprozitaets-Block** — saldo=0 + abgelaufene offene Verpflichtung
 *     → blockiert, redirected mit fehler=reziprozitaet.
 */

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createId } from '@paralleldrive/cuid2';
import { eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import {
  nutzer,
  pruefrunde,
  pruefrundenVerpflichtung,
  session as sessionTable,
  werk,
} from '@/lib/db/schema';
import { truncateAll } from '../_helpers/db-cleanup';

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
  notFound: () => {
    const err = new Error('NEXT_NOT_FOUND');
    (err as Error & { digest: string }).digest = 'NEXT_NOT_FOUND';
    throw err;
  },
  redirect: (target: string) => {
    lastRedirect = target;
    const err = new Error(`NEXT_REDIRECT: ${target}`);
    (err as Error & { digest: string }).digest = `NEXT_REDIRECT;replace;${target};307;`;
    throw err;
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: () => {},
}));

const {
  pruefrundeVeroeffentlichenAction,
  pruefrundeMitVerpflichtungVeroeffentlichenAction,
} = await import('@/app/pruefrunden/[id]/bearbeiten/page');

async function reset(): Promise<void> {
  await truncateAll();
  mockHeaders = new Map();
  lastRedirect = null;
}

async function nutzerAnlegen(): Promise<string> {
  const id = createId();
  await db.insert(nutzer).values({
    id,
    email: `${id}@test.werkzirkel.de`,
    klarname: 'Test',
    anzeigename: `anz-${id.slice(0, 6)}`,
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
    name: 'Werk-V',
    kurzbeschreibung: 'k',
    problem: 'p',
    zielgruppe: 'z',
    werkstand: 'prototyp',
  });
  return id;
}

async function entwurfAnlegen(werkId: string): Promise<string> {
  const id = createId();
  await db.insert(pruefrunde).values({
    id,
    werkId,
    titel: 'Entwurf',
    testziel: 'tz',
    testaufgabe: 'ta',
    zielgruppe: 'z',
    zeitbedarfMinuten: 30,
    gesuchteTester: 3,
    feedbackKategorien: ['erster_eindruck'],
    frist: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    status: 'entwurf',
  });
  return id;
}

async function callAction(
  prId: string,
  mitVerpflichtung = false,
): Promise<string> {
  lastRedirect = null;
  try {
    if (mitVerpflichtung) {
      await pruefrundeMitVerpflichtungVeroeffentlichenAction(prId);
    } else {
      await pruefrundeVeroeffentlichenAction(prId);
    }
  } catch (err) {
    if (
      err instanceof Error &&
      err.message.startsWith('NEXT_REDIRECT')
    ) {
      // erwartet
    } else {
      throw err;
    }
  }
  if (!lastRedirect) throw new Error('Action hat nicht redirected.');
  return lastRedirect;
}

describe('pruefrundeVeroeffentlichenAction', () => {
  beforeEach(reset);
  afterAll(reset);

  it('Pfad A: kein Saldo, ohne Opt-In → redirected mit fehler=saldo_zu_niedrig, keine Verpflichtung', async () => {
    // PRD §8.4: Default-Action blockt bei Saldo<2 und führt den User auf
    // den Bearbeiten-Screen zurück, wo der Wahl-Block angezeigt wird.
    const userId = await nutzerAnlegen();
    const sid = await sessionAnlegen(userId);
    const werkId = await werkAnlegen(userId);
    const prId = await entwurfAnlegen(werkId);

    mockHeaders.set('cookie', `wz_session=${encodeURIComponent(sid)}`);

    const target = await callAction(prId);
    expect(target).toContain(`/pruefrunden/${prId}/bearbeiten`);
    expect(target).toContain('fehler=saldo_zu_niedrig');

    // DB: Status BLEIBT entwurf
    const rows = await db
      .select()
      .from(pruefrunde)
      .where(eq(pruefrunde.id, prId))
      .limit(1);
    expect(rows[0]?.status).toBe('entwurf');

    // DB: KEINE Verpflichtung angelegt
    const v = await db
      .select()
      .from(pruefrundenVerpflichtung)
      .where(eq(pruefrundenVerpflichtung.nutzerId, userId));
    expect(v.length).toBe(0);
  });

  it('Pfad A2: kein Saldo + expliziter Verpflichtungs-Opt-In → veroeffentlicht + neue Verpflichtung', async () => {
    const userId = await nutzerAnlegen();
    const sid = await sessionAnlegen(userId);
    const werkId = await werkAnlegen(userId);
    const prId = await entwurfAnlegen(werkId);

    mockHeaders.set('cookie', `wz_session=${encodeURIComponent(sid)}`);

    const target = await callAction(prId, true);
    expect(target).toContain(`/pruefrunden/${prId}/bearbeiten`);
    expect(target).toContain('veroeffentlicht=neue_verpflichtung');
    expect(target).toContain('frist=');

    // DB: Status hochgesetzt
    const rows = await db
      .select()
      .from(pruefrunde)
      .where(eq(pruefrunde.id, prId))
      .limit(1);
    expect(rows[0]?.status).toBe('oeffentlich');

    // DB: neue Verpflichtung angelegt
    const v = await db
      .select()
      .from(pruefrundenVerpflichtung)
      .where(eq(pruefrundenVerpflichtung.nutzerId, userId));
    expect(v.length).toBe(1);
    expect(v[0]?.status).toBe('offen');
    expect(v[0]?.ausPruefrundeId).toBe(prId);
  });

  it('Pfad B: abgelaufene offene Verpflichtung → blockiert', async () => {
    const userId = await nutzerAnlegen();
    const sid = await sessionAnlegen(userId);
    const werkId = await werkAnlegen(userId);
    // Eine "alte" Pruefrunde fuer die Verpflichtung anlegen (FK-Ziel).
    const altePruefrundeId = createId();
    await db.insert(pruefrunde).values({
      id: altePruefrundeId,
      werkId,
      titel: 'Alte',
      testziel: 'tz',
      testaufgabe: 'ta',
      zielgruppe: 'z',
      zeitbedarfMinuten: 30,
      gesuchteTester: 3,
      feedbackKategorien: ['erster_eindruck'],
      frist: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      status: 'oeffentlich',
    });
    // Abgelaufene Verpflichtung
    await db.insert(pruefrundenVerpflichtung).values({
      nutzerId: userId,
      ausPruefrundeId: altePruefrundeId,
      frist: new Date(Date.now() - 24 * 60 * 60 * 1000), // gestern
      status: 'offen',
    });

    const prId = await entwurfAnlegen(werkId);
    mockHeaders.set('cookie', `wz_session=${encodeURIComponent(sid)}`);

    const target = await callAction(prId);
    expect(target).toContain('fehler=reziprozitaet');

    // DB: Status NICHT geaendert
    const rows = await db
      .select()
      .from(pruefrunde)
      .where(eq(pruefrunde.id, prId))
      .limit(1);
    expect(rows[0]?.status).toBe('entwurf');
  });
});
