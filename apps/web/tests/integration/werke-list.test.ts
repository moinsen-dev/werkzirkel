/**
 * Integration-Tests fuer GET /api/v1/werke mit Filtern + Cursor-Pagination.
 *
 * Seedet 25 Werke verschiedener Werkstaende/Hilfebedarf/Stadt und prueft:
 * - Default-Pagination liefert 20 + nextCursor.
 * - stadt_id-Filter wirkt.
 * - werkstand-Filter (Mehrfach) wirkt.
 * - hilfebedarf-Filter (overlaps) wirkt.
 * - Cursor liefert die naechste Seite ohne Doppel.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createId } from '@paralleldrive/cuid2';
import { sql } from 'drizzle-orm';

import { db } from '@/lib/db';
import { nutzer, werk } from '@/lib/db/schema';
import { env } from '@/lib/env';

import { GET as werkeGet } from '@/app/api/v1/werke/route';
import { truncateAll } from '../_helpers/db-cleanup';

const APP_ORIGIN = new URL(env.APP_URL).origin;

function buildRequest(path: string): Request {
  return new Request(`${APP_ORIGIN}${path}`, {
    method: 'GET',
    headers: {
      origin: APP_ORIGIN,
      'x-forwarded-for': '127.0.0.1',
    },
  });
}

interface ListResp {
  werke: Array<{
    id: string;
    name: string;
    werkstand: string;
    hilfebedarf: string[];
    inhaber: { stadt_id: string };
  }>;
  nextCursor: string | null;
}

async function jsonOf(res: Response): Promise<ListResp> {
  return (await res.json()) as ListResp;
}

const WERKSTAENDE = ['idee', 'prototyp', 'testversion', 'oeffentlich', 'wachsend'];
const HILFEN = ['ux_test', 'marketing', 'mitstreiterinnen'];

async function seed(): Promise<void> {
  // 25 Werke: 15 in HH, 10 in B (Berlin). Wir muessen Berlin-Stadt fuer Tests
  // benutzbar machen — es existiert mit status='vorbereitung' aus dem Seed.
  // Werke in Berlin sind erlaubt, nur das Stadt-UI weist drauf hin.
  const hhUser = createId();
  const bUser = createId();
  await db.insert(nutzer).values([
    {
      id: hhUser,
      email: 'list-hh@test.werkzirkel.de',
      klarname: 'HH',
      anzeigename: 'hh-macher',
      stadtId: 'hh',
      rollen: ['macher'],
      emailVerifiziertAm: new Date(),
    },
    {
      id: bUser,
      email: 'list-b@test.werkzirkel.de',
      klarname: 'B',
      anzeigename: 'b-macher',
      stadtId: 'b',
      rollen: ['macher'],
      emailVerifiziertAm: new Date(),
    },
  ]);

  // Wir staffeln aktualisiert_am, damit die Sortier-Reihenfolge deterministisch ist.
  const now = Date.now();
  for (let i = 0; i < 25; i++) {
    const ownerId = i < 15 ? hhUser : bUser;
    const werkstandWahl = WERKSTAENDE[i % WERKSTAENDE.length]!;
    const hilfeWahl = [HILFEN[i % HILFEN.length]!];
    const ts = new Date(now - i * 1000); // i=0 → neuestes, i=24 → aeltestes
    await db.insert(werk).values({
      nutzerId: ownerId,
      name: `Werk ${i}`,
      kurzbeschreibung: `Beschreibung ${i}`,
      problem: 'Problem.',
      zielgruppe: 'Zielgruppe.',
      werkstand: werkstandWahl as
        | 'idee'
        | 'prototyp'
        | 'testversion'
        | 'oeffentlich'
        | 'wachsend',
      hilfebedarf: hilfeWahl as ('ux_test' | 'marketing' | 'mitstreiterinnen')[],
    });
  }

  // Manuell aktualisiert_am setzen, damit die Sortierung deterministisch ist
  // — Drizzle setzt defaultNow() pro Row, was bei schnellen Inserts kollidiert.
  await db.execute(sql`
    UPDATE werk SET aktualisiert_am = NOW() - (
      (regexp_replace(name, '\\D', '', 'g'))::int * INTERVAL '1 second'
    )
  `);
}

describe('GET /api/v1/werke — Filter + Pagination', () => {
  beforeAll(async () => {
    await truncateAll();
    await seed();
  });
  afterAll(truncateAll);

  it('ohne Filter → 20 Werke + nextCursor (25 insgesamt)', async () => {
    const res = await werkeGet(buildRequest('/api/v1/werke'));
    expect(res.status).toBe(200);
    const data = await jsonOf(res);
    expect(data.werke.length).toBe(20);
    expect(data.nextCursor).not.toBeNull();
  });

  it('stadt_id=hh → nur Hamburg-Werke (15 insgesamt)', async () => {
    const res = await werkeGet(buildRequest('/api/v1/werke?stadt_id=hh'));
    const data = await jsonOf(res);
    expect(data.werke.length).toBe(15);
    expect(data.werke.every((w) => w.inhaber.stadt_id === 'hh')).toBe(true);
    expect(data.nextCursor).toBeNull();
  });

  it('werkstand=prototyp&werkstand=oeffentlich → genau diese Werkstaende', async () => {
    const res = await werkeGet(
      buildRequest('/api/v1/werke?werkstand=prototyp&werkstand=oeffentlich'),
    );
    const data = await jsonOf(res);
    expect(data.werke.length).toBeGreaterThan(0);
    expect(
      data.werke.every(
        (w) => w.werkstand === 'prototyp' || w.werkstand === 'oeffentlich',
      ),
    ).toBe(true);
  });

  it('hilfebedarf=ux_test → nur Werke mit ux_test im Array', async () => {
    const res = await werkeGet(buildRequest('/api/v1/werke?hilfebedarf=ux_test'));
    const data = await jsonOf(res);
    expect(data.werke.length).toBeGreaterThan(0);
    expect(data.werke.every((w) => w.hilfebedarf.includes('ux_test'))).toBe(true);
  });

  it('Cursor liefert die naechsten 5 ohne Doppel', async () => {
    const firstRes = await werkeGet(buildRequest('/api/v1/werke'));
    const first = await jsonOf(firstRes);
    expect(first.werke.length).toBe(20);
    expect(first.nextCursor).toBeTruthy();

    const secondRes = await werkeGet(
      buildRequest(`/api/v1/werke?cursor=${first.nextCursor}`),
    );
    const second = await jsonOf(secondRes);
    expect(second.werke.length).toBe(5);
    expect(second.nextCursor).toBeNull();

    const firstIds = new Set(first.werke.map((w) => w.id));
    const secondIds = second.werke.map((w) => w.id);
    expect(secondIds.some((id) => firstIds.has(id))).toBe(false);
  });
});
