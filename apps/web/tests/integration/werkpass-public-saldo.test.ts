/**
 * Integration-Tests fuer das oeffentliche Feedback-Saldo auf /werkpass/[id].
 *
 *  - Werkpass eines Nutzers ohne test_saldo-Row → 0/0/0.
 *  - Werkpass eines Nutzers mit 5/3/1 → echte Werte sichtbar.
 *  - Hinweis 'Hat eine offene Feedback-Schuld bis ...' rendert,
 *    wenn `offene_verpflichtung_anzahl > 0`.
 *
 * PRD-Referenz: §F-209, §8.2.
 */

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createId } from '@paralleldrive/cuid2';

import { db } from '@/lib/db';
import { nutzer, testSaldo } from '@/lib/db/schema';
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

let lastNotFound = false;
vi.mock('next/navigation', () => ({
  notFound: () => {
    lastNotFound = true;
    const err = new Error('NEXT_NOT_FOUND');
    (err as Error & { digest: string }).digest = 'NEXT_NOT_FOUND';
    throw err;
  },
}));

const { renderToStaticMarkup } = await import('react-dom/server');
const WerkpassModule = await import('@/app/werkpass/[id]/page');
const WerkpassPage = WerkpassModule.default;

async function reset(): Promise<void> {
  await truncateAll();
  lastNotFound = false;
}

async function userAnlegen(email: string): Promise<string> {
  const id = createId();
  await db.insert(nutzer).values({
    id,
    email,
    klarname: 'Public Saldo Tester',
    anzeigename: `pub-${id.slice(0, 6)}`,
    stadtId: 'hh',
    rollen: ['macher'],
    emailVerifiziertAm: new Date(),
  });
  return id;
}

async function render(id: string): Promise<string> {
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

describe('/werkpass/[id] — oeffentlicher Feedback-Saldo', () => {
  beforeEach(reset);
  afterAll(reset);

  it('ohne test_saldo-Row → 0/0/0', async () => {
    const id = await userAnlegen('wp-saldo-0@test.werkzirkel.de');
    const html = await render(id);
    expect(html).toContain('0 gegeben');
    expect(html).toContain('0 erhalten');
    expect(html).toContain('0 offen');
    // Keine offene Verpflichtungs-Notiz.
    expect(html).not.toContain('Hat eine offene Feedback-Schuld');
  });

  it('mit 5 gegeben / 3 erhalten / 1 offen → echte Werte', async () => {
    const id = await userAnlegen('wp-saldo-531@test.werkzirkel.de');
    const frist = new Date('2026-08-15T12:00:00Z');
    await db.insert(testSaldo).values({
      nutzerId: id,
      testsGegeben: 5,
      testsErhalten: 3,
      offeneVerpflichtungAnzahl: 1,
      naechsteVerpflichtungFrist: frist,
    });
    const html = await render(id);
    expect(html).toContain('5 gegeben');
    expect(html).toContain('3 erhalten');
    expect(html).toContain('1 offen');
  });

  it('mit offen=1 → Hinweis "Hat eine offene Feedback-Schuld bis <datum>."', async () => {
    const id = await userAnlegen('wp-saldo-hinweis@test.werkzirkel.de');
    const frist = new Date('2026-09-01T00:00:00Z');
    await db.insert(testSaldo).values({
      nutzerId: id,
      testsGegeben: 0,
      testsErhalten: 0,
      offeneVerpflichtungAnzahl: 1,
      naechsteVerpflichtungFrist: frist,
    });
    const html = await render(id);
    expect(html).toContain('Hat eine offene Feedback-Schuld');
    expect(html).toContain('01.09.2026');
  });

  it('mit offen=0 → KEIN Hinweis', async () => {
    const id = await userAnlegen('wp-saldo-kein-hinweis@test.werkzirkel.de');
    await db.insert(testSaldo).values({
      nutzerId: id,
      testsGegeben: 3,
      testsErhalten: 2,
      offeneVerpflichtungAnzahl: 0,
    });
    const html = await render(id);
    expect(html).not.toContain('Hat eine offene Feedback-Schuld');
  });
});
