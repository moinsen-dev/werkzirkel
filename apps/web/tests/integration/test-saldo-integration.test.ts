/**
 * Integration-Tests fuer task-test-saldo-integration:
 *
 *  - /uebersicht zeigt echte test_saldo-Werte (nicht hardcoded 0/0/0).
 *  - /werkpass/[id] zeigt dieselben echten Werte.
 *  - Wenn `offene_verpflichtung_anzahl > 0` UND Frist < 3 Tage:
 *    rotes Top-Banner direkt unter der Begruessung mit deutscher Erklaerung
 *    + Frist-Datum + Pruefrunden-Link (?stadt=<user-stadt>).
 *  - Engine-Integration: `feedbackGegeben` aktualisiert `test_saldo` (UNIT).
 *
 * PRD-Referenzen: §F-209, §8.2 (Werkpass Feedback-Saldo), §8.4 (Reziprozitaet).
 */

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createId } from '@paralleldrive/cuid2';
import { eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import {
  nutzer,
  session as sessionTable,
  testSaldo,
} from '@/lib/db/schema';
import { feedbackGegeben } from '@/lib/reziprozitaet/engine';
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
const UebersichtModule = await import('@/app/uebersicht/page');
const UebersichtPage = UebersichtModule.default;
const WerkpassModule = await import('@/app/werkpass/[id]/page');
const WerkpassPage = WerkpassModule.default;

async function reset(): Promise<void> {
  await truncateAll();
  mockHeaders = new Map();
  lastRedirect = null;
  lastNotFound = false;
}

async function userAnlegen(opts: {
  email: string;
  stadtId?: string;
  anzeigename?: string;
}): Promise<string> {
  const id = createId();
  await db.insert(nutzer).values({
    id,
    email: opts.email,
    klarname: 'Saldo Tester',
    anzeigename: opts.anzeigename ?? `saldo-${id.slice(0, 6)}`,
    stadtId: opts.stadtId ?? 'hh',
    rollen: ['macher'],
    emailVerifiziertAm: new Date(),
  });
  return id;
}

async function sessionAnlegen(userId: string): Promise<string> {
  const sid = createId();
  await db.insert(sessionTable).values({
    id: sid,
    nutzerId: userId,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });
  return sid;
}

function setSessionCookie(sid: string): void {
  mockHeaders.set('cookie', `wz_session=${encodeURIComponent(sid)}`);
}

async function renderUebersicht(sid: string): Promise<string> {
  setSessionCookie(sid);
  try {
    const tree = await UebersichtPage();
    return renderToStaticMarkup(tree);
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('NEXT_REDIRECT')) {
      return '';
    }
    throw err;
  }
}

async function renderWerkpass(id: string): Promise<string> {
  try {
    const tree = await WerkpassPage({ params: Promise.resolve({ id }) });
    return renderToStaticMarkup(tree);
  } catch (err) {
    if (err instanceof Error && err.message === 'NEXT_NOT_FOUND') {
      return '';
    }
    throw err;
  }
}

describe('Feedback-Saldo Integration: echte Werte auf /uebersicht', () => {
  beforeEach(reset);
  afterAll(reset);

  it('/uebersicht zeigt tests_gegeben aus der DB (nicht 0)', async () => {
    const userId = await userAnlegen({ email: 'saldo-int-1@test.werkzirkel.de' });
    await db.insert(testSaldo).values({
      nutzerId: userId,
      testsGegeben: 2,
      testsErhalten: 0,
      offeneVerpflichtungAnzahl: 0,
    });
    const sid = await sessionAnlegen(userId);
    const html = await renderUebersicht(sid);
    // Die Zahl '2' muss in einer der Saldo-<strong>-Boxen erscheinen.
    expect(html).toMatch(/<strong>2<\/strong>/);
    // Mit Saldo 2/0/0 ist es nicht „leer" → die Erklaerungs-Box darf NICHT
    // erscheinen.
    expect(html).not.toContain('Du hast noch keine Prüfrunden gegeben');
  });

  it('/uebersicht mit echtem Saldo: 5/3/0', async () => {
    const userId = await userAnlegen({ email: 'saldo-int-5@test.werkzirkel.de' });
    await db.insert(testSaldo).values({
      nutzerId: userId,
      testsGegeben: 5,
      testsErhalten: 3,
      offeneVerpflichtungAnzahl: 0,
    });
    const sid = await sessionAnlegen(userId);
    const html = await renderUebersicht(sid);
    expect(html).toMatch(/<strong>5<\/strong>/);
    expect(html).toMatch(/<strong>3<\/strong>/);
  });

  it('/uebersicht: Frist < 3 Tagen → rotes Top-Banner mit Link', async () => {
    const userId = await userAnlegen({
      email: 'saldo-banner@test.werkzirkel.de',
      stadtId: 'hh',
    });
    const fristIn2Tagen = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    await db.insert(testSaldo).values({
      nutzerId: userId,
      testsGegeben: 0,
      testsErhalten: 0,
      offeneVerpflichtungAnzahl: 1,
      naechsteVerpflichtungFrist: fristIn2Tagen,
    });
    const sid = await sessionAnlegen(userId);
    const html = await renderUebersicht(sid);
    expect(html).toContain('Feedback-Schuld läuft bald ab');
    expect(html).toContain('Jetzt einen Build testen');
    // Link mit Stadt-Param.
    expect(html).toMatch(/href="\/pruefrunden\?stadt=hh"/);
    // Deutsche Frist-Formatierung dd.mm.jjjj.
    const dd = String(fristIn2Tagen.getDate()).padStart(2, '0');
    const mm = String(fristIn2Tagen.getMonth() + 1).padStart(2, '0');
    const yyyy = fristIn2Tagen.getFullYear();
    expect(html).toContain(`${dd}.${mm}.${yyyy}`);
  });

  it('/uebersicht: Frist > 3 Tagen → KEIN Top-Banner', async () => {
    const userId = await userAnlegen({
      email: 'saldo-kein-banner@test.werkzirkel.de',
    });
    const fristIn10Tagen = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
    await db.insert(testSaldo).values({
      nutzerId: userId,
      testsGegeben: 0,
      testsErhalten: 0,
      offeneVerpflichtungAnzahl: 1,
      naechsteVerpflichtungFrist: fristIn10Tagen,
    });
    const sid = await sessionAnlegen(userId);
    const html = await renderUebersicht(sid);
    expect(html).not.toContain('Feedback-Schuld läuft bald ab');
    expect(html).not.toContain('Jetzt einen Build testen');
  });

  it('/uebersicht: keine offene Verpflichtung → kein Top-Banner', async () => {
    const userId = await userAnlegen({
      email: 'saldo-keine-verpflichtung@test.werkzirkel.de',
    });
    await db.insert(testSaldo).values({
      nutzerId: userId,
      testsGegeben: 4,
      testsErhalten: 4,
      offeneVerpflichtungAnzahl: 0,
    });
    const sid = await sessionAnlegen(userId);
    const html = await renderUebersicht(sid);
    expect(html).not.toContain('Feedback-Schuld läuft bald ab');
  });
});

describe('Feedback-Saldo Integration: echte Werte auf /werkpass/[id]', () => {
  beforeEach(reset);
  afterAll(reset);

  it('/werkpass/[id] zeigt die echten Saldo-Werte', async () => {
    const userId = await userAnlegen({
      email: 'wp-saldo-real@test.werkzirkel.de',
      anzeigename: 'Werker Real',
    });
    await db.insert(testSaldo).values({
      nutzerId: userId,
      testsGegeben: 2,
      testsErhalten: 1,
      offeneVerpflichtungAnzahl: 0,
    });
    const html = await renderWerkpass(userId);
    expect(html).toContain('2 gegeben');
    expect(html).toContain('1 erhalten');
    expect(html).toContain('0 offen');
  });
});

describe('Feedback-Saldo Integration: feedbackGegeben aktualisiert test_saldo', () => {
  beforeEach(reset);
  afterAll(reset);

  it('UNIT: feedbackGegeben inkrementiert tests_gegeben', async () => {
    const userId = await userAnlegen({
      email: 'engine-gegeben@test.werkzirkel.de',
    });
    // Engine-Call mit synthetischer feedback_id — wir testen NUR die
    // Saldo-Materialisierung, kein DB-FK-Constraint auf feedback (die Tabelle
    // ist leer; erfuellt_durch_feedback_id ist `null`-able, also unkritisch).
    await feedbackGegeben(userId, createId());
    const rows = await db
      .select()
      .from(testSaldo)
      .where(eq(testSaldo.nutzerId, userId))
      .limit(1);
    expect(rows[0]?.testsGegeben).toBe(1);
    await feedbackGegeben(userId, createId());
    const rows2 = await db
      .select()
      .from(testSaldo)
      .where(eq(testSaldo.nutzerId, userId))
      .limit(1);
    expect(rows2[0]?.testsGegeben).toBe(2);
  });
});
