/**
 * Integration-Tests fuer /termine (Server Component, public).
 *
 * - Hero mit Counter, Filter-Sidebar, Empty-State.
 * - Nur veroeffentlichte Termine in der Zukunft.
 * - Sprach-Check.
 */

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createId } from '@paralleldrive/cuid2';

import { db } from '@/lib/db';
import { nutzer, termin } from '@/lib/db/schema';
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

const { renderToStaticMarkup } = await import('react-dom/server');
const Page = (await import('@/app/termine/page')).default;

async function reset() {
  await truncateAll();
}

async function kuratorAnlegen(): Promise<string> {
  const id = createId();
  await db.insert(nutzer).values({
    id,
    email: `kurator-${id}@test.werkzirkel.de`,
    klarname: 'Kurator',
    anzeigename: `k-${id.slice(0, 6)}`,
    stadtId: 'hh',
    rollen: ['kurator'],
    emailVerifiziertAm: new Date(),
  });
  return id;
}

async function terminAnlegen(opts: {
  kuratorId: string;
  status?: 'geplant' | 'veroeffentlicht' | 'abgesagt' | 'durchgefuehrt';
  inDerZukunft?: boolean;
  titel?: string;
  stadtId?: string;
  typ?: 'pruefabend' | 'schauabend' | 'bedarfsschau';
}): Promise<string> {
  const id = createId();
  const datum = opts.inDerZukunft === false
    ? new Date(Date.now() - 24 * 60 * 60 * 1000)
    : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await db.insert(termin).values({
    id,
    stadtId: opts.stadtId ?? 'hh',
    typ: opts.typ ?? 'schauabend',
    titel: opts.titel ?? 'Schauabend Mai',
    beschreibung: 'Drei Werke stellen sich vor.',
    ortText: 'Werkstatt St. Pauli',
    datumUhrzeit: datum,
    maxTeilnehmer: 20,
    erstelltVon: opts.kuratorId,
    status: opts.status ?? 'veroeffentlicht',
  });
  return id;
}

async function render(sp: Record<string, string | string[]> = {}): Promise<string> {
  const tree = await Page({ searchParams: Promise.resolve(sp) });
  return renderToStaticMarkup(tree);
}

describe('/termine Liste page', () => {
  beforeEach(reset);
  afterAll(reset);

  it('rendert Hero und Empty-State auf Deutsch', async () => {
    const html = await render({});
    expect(html).toContain('Termine im Werkzirkel');
    expect(html).toContain('Noch keine veröffentlichten Termine');
  });

  it('zeigt nur veroeffentlichte und nur zukuenftige Termine', async () => {
    const kid = await kuratorAnlegen();
    await terminAnlegen({ kuratorId: kid, titel: 'Termin Sichtbar' });
    await terminAnlegen({
      kuratorId: kid,
      titel: 'Termin Geplant',
      status: 'geplant',
    });
    await terminAnlegen({
      kuratorId: kid,
      titel: 'Termin Vergangenheit',
      inDerZukunft: false,
    });
    const html = await render({});
    expect(html).toContain('Termin Sichtbar');
    expect(html).not.toContain('Termin Geplant');
    expect(html).not.toContain('Termin Vergangenheit');
  });

  it('filtert nach typ-Searchparam', async () => {
    const kid = await kuratorAnlegen();
    await terminAnlegen({
      kuratorId: kid,
      titel: 'Demo Night X',
      typ: 'schauabend',
    });
    await terminAnlegen({
      kuratorId: kid,
      titel: 'Pruefabend Y',
      typ: 'pruefabend',
    });
    const html = await render({ typ: 'schauabend' });
    expect(html).toContain('Demo Night X');
    expect(html).not.toContain('Pruefabend Y');
  });

  it('Sprach-Check: keine englischen UI-Strings', async () => {
    const kid = await kuratorAnlegen();
    await terminAnlegen({ kuratorId: kid });
    const html = await render({});
    const verboten = [
      'Sign in',
      'Login',
      'Click here',
      'Submit',
      'Coming soon',
      'In preparation',
    ];
    for (const w of verboten) expect(html).not.toContain(w);
  });
});
