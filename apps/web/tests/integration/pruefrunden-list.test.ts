/**
 * Integration-Tests fuer GET /api/v1/pruefrunden (Liste).
 *
 * Deckt PRD §15.4 (Liste mit Filtern), §14.2 (Entwuerfe sind privat).
 */

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createId } from '@paralleldrive/cuid2';
import { eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import {
  nutzer,
  pruefrunde,
  session as sessionTable,
  werk,
} from '@/lib/db/schema';
import { env } from '@/lib/env';
import { buildSessionCookie } from '@/lib/auth/session';

import { GET as pruefrundenGet } from '@/app/api/v1/pruefrunden/route';

import { truncateAll } from '../_helpers/db-cleanup';

const APP_ORIGIN = new URL(env.APP_URL).origin;

function buildRequest(opts: {
  path: string;
  sessionId?: string;
}): Request {
  const headers: Record<string, string> = {
    origin: APP_ORIGIN,
    'x-forwarded-for': '127.0.0.1',
  };
  if (opts.sessionId) {
    headers.cookie = buildSessionCookie(opts.sessionId).split(';')[0]!;
  }
  return new Request(`${APP_ORIGIN}${opts.path}`, {
    method: 'GET',
    headers,
  });
}

async function nutzerAnlegen(email: string, stadtId = 'hh'): Promise<string> {
  const id = createId();
  await db.insert(nutzer).values({
    id,
    email,
    klarname: `Klar ${email}`,
    anzeigename: `anz-${id.slice(0, 6)}`,
    stadtId,
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

async function werkAnlegen(nutzerId: string, name = 'Build'): Promise<string> {
  const id = createId();
  await db.insert(werk).values({
    id,
    nutzerId,
    name,
    kurzbeschreibung: 'k',
    problem: 'p',
    zielgruppe: 'z',
    werkstand: 'idee',
  });
  return id;
}

async function pruefrundeAnlegen(opts: {
  werkId: string;
  titel: string;
  status: 'entwurf' | 'oeffentlich' | 'geschlossen' | 'abgeschlossen';
  fristOffsetTage?: number;
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
    frist: new Date(Date.now() + (opts.fristOffsetTage ?? 7) * 24 * 60 * 60 * 1000),
    status: opts.status,
  });
  return id;
}

describe('GET /api/v1/pruefrunden (Liste)', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  it('anonym → nur oeffentliche/geschlossene/abgeschlossene Statuus', async () => {
    const userId = await nutzerAnlegen('list-1@test.werkzirkel.de');
    const werkId = await werkAnlegen(userId);
    await pruefrundeAnlegen({
      werkId,
      titel: 'Entwurf',
      status: 'entwurf',
      fristOffsetTage: 5,
    });
    await pruefrundeAnlegen({
      werkId,
      titel: 'Oeffentlich',
      status: 'oeffentlich',
      fristOffsetTage: 6,
    });
    await pruefrundeAnlegen({
      werkId,
      titel: 'Geschlossen',
      status: 'geschlossen',
      fristOffsetTage: 7,
    });
    await pruefrundeAnlegen({
      werkId,
      titel: 'Abgeschlossen',
      status: 'abgeschlossen',
      fristOffsetTage: 8,
    });

    const res = await pruefrundenGet(
      buildRequest({ path: '/api/v1/pruefrunden' }),
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      pruefrunden: Array<{ titel: string; status: string }>;
    };
    const titels = data.pruefrunden.map((p) => p.titel).sort();
    expect(titels).toEqual(['Abgeschlossen', 'Geschlossen', 'Oeffentlich']);
  });

  it('Filter status=oeffentlich → nur oeffentliche', async () => {
    const userId = await nutzerAnlegen('list-status@test.werkzirkel.de');
    const werkId = await werkAnlegen(userId);
    await pruefrundeAnlegen({
      werkId,
      titel: 'Oef',
      status: 'oeffentlich',
      fristOffsetTage: 3,
    });
    await pruefrundeAnlegen({
      werkId,
      titel: 'Gesch',
      status: 'geschlossen',
      fristOffsetTage: 4,
    });

    const res = await pruefrundenGet(
      buildRequest({ path: '/api/v1/pruefrunden?status=oeffentlich' }),
    );
    const data = (await res.json()) as {
      pruefrunden: Array<{ titel: string; status: string }>;
    };
    expect(data.pruefrunden.length).toBe(1);
    expect(data.pruefrunden[0]?.status).toBe('oeffentlich');
  });

  it('Filter status=entwurf ohne nur_eigene → leer (Privacy)', async () => {
    const userId = await nutzerAnlegen('list-leak@test.werkzirkel.de');
    const werkId = await werkAnlegen(userId);
    await pruefrundeAnlegen({
      werkId,
      titel: 'Geheim',
      status: 'entwurf',
      fristOffsetTage: 2,
    });

    const res = await pruefrundenGet(
      buildRequest({ path: '/api/v1/pruefrunden?status=entwurf' }),
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { pruefrunden: unknown[] };
    expect(data.pruefrunden.length).toBe(0);
  });

  it('Filter werk_id → nur dieses Werk', async () => {
    const userId = await nutzerAnlegen('list-werk@test.werkzirkel.de');
    const werkA = await werkAnlegen(userId, 'Werk A');
    const werkB = await werkAnlegen(userId, 'Werk B');
    await pruefrundeAnlegen({
      werkId: werkA,
      titel: 'A1',
      status: 'oeffentlich',
      fristOffsetTage: 3,
    });
    await pruefrundeAnlegen({
      werkId: werkB,
      titel: 'B1',
      status: 'oeffentlich',
      fristOffsetTage: 4,
    });

    const res = await pruefrundenGet(
      buildRequest({ path: `/api/v1/pruefrunden?werk_id=${werkA}` }),
    );
    const data = (await res.json()) as {
      pruefrunden: Array<{ titel: string; werk_id: string }>;
    };
    expect(data.pruefrunden.length).toBe(1);
    expect(data.pruefrunden[0]?.werk_id).toBe(werkA);
  });

  it('Filter stadt_id → nur Werke aus dieser Stadt', async () => {
    const hhUser = await nutzerAnlegen('list-hh@test.werkzirkel.de', 'hh');
    const beUser = await nutzerAnlegen('list-be@test.werkzirkel.de', 'b');
    const hhWerk = await werkAnlegen(hhUser, 'Werk HH');
    const beWerk = await werkAnlegen(beUser, 'Werk BE');
    await pruefrundeAnlegen({
      werkId: hhWerk,
      titel: 'HH-Test',
      status: 'oeffentlich',
      fristOffsetTage: 3,
    });
    await pruefrundeAnlegen({
      werkId: beWerk,
      titel: 'BE-Test',
      status: 'oeffentlich',
      fristOffsetTage: 4,
    });

    const res = await pruefrundenGet(
      buildRequest({ path: '/api/v1/pruefrunden?stadt_id=hh' }),
    );
    const data = (await res.json()) as {
      pruefrunden: Array<{ titel: string }>;
    };
    expect(data.pruefrunden.length).toBe(1);
    expect(data.pruefrunden[0]?.titel).toBe('HH-Test');
  });

  it('nur_eigene=1 ohne Session → 401', async () => {
    const res = await pruefrundenGet(
      buildRequest({ path: '/api/v1/pruefrunden?nur_eigene=1' }),
    );
    expect(res.status).toBe(401);
  });

  it('nur_eigene=1 mit Session → eigene Entwuerfe sichtbar', async () => {
    const userId = await nutzerAnlegen('list-self@test.werkzirkel.de');
    const sid = await sessionAnlegen(userId);
    const werkId = await werkAnlegen(userId);
    await pruefrundeAnlegen({
      werkId,
      titel: 'MeinEntwurf',
      status: 'entwurf',
      fristOffsetTage: 2,
    });

    const res = await pruefrundenGet(
      buildRequest({
        path: '/api/v1/pruefrunden?nur_eigene=1',
        sessionId: sid,
      }),
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      pruefrunden: Array<{ titel: string; status: string }>;
    };
    expect(data.pruefrunden.length).toBe(1);
    expect(data.pruefrunden[0]?.titel).toBe('MeinEntwurf');
    expect(data.pruefrunden[0]?.status).toBe('entwurf');
  });

  it('nur_eigene=1 zeigt keine fremden Entwuerfe', async () => {
    const meId = await nutzerAnlegen('list-me@test.werkzirkel.de');
    const sid = await sessionAnlegen(meId);
    const otherId = await nutzerAnlegen('list-other@test.werkzirkel.de');
    const otherWerk = await werkAnlegen(otherId);
    await pruefrundeAnlegen({
      werkId: otherWerk,
      titel: 'FremderEntwurf',
      status: 'entwurf',
      fristOffsetTage: 2,
    });

    const res = await pruefrundenGet(
      buildRequest({
        path: '/api/v1/pruefrunden?nur_eigene=1',
        sessionId: sid,
      }),
    );
    const data = (await res.json()) as { pruefrunden: unknown[] };
    expect(data.pruefrunden.length).toBe(0);
  });

  it('sortiert frist ASC (laufende zuerst)', async () => {
    const userId = await nutzerAnlegen('list-sort@test.werkzirkel.de');
    const werkId = await werkAnlegen(userId);
    await pruefrundeAnlegen({
      werkId,
      titel: 'Spaet',
      status: 'oeffentlich',
      fristOffsetTage: 20,
    });
    await pruefrundeAnlegen({
      werkId,
      titel: 'Frueh',
      status: 'oeffentlich',
      fristOffsetTage: 3,
    });
    await pruefrundeAnlegen({
      werkId,
      titel: 'Mitte',
      status: 'oeffentlich',
      fristOffsetTage: 10,
    });

    const res = await pruefrundenGet(
      buildRequest({ path: '/api/v1/pruefrunden' }),
    );
    const data = (await res.json()) as {
      pruefrunden: Array<{ titel: string }>;
    };
    expect(data.pruefrunden.map((p) => p.titel)).toEqual([
      'Frueh',
      'Mitte',
      'Spaet',
    ]);
  });

  it('Cursor-Pagination: limit=2, nextCursor zeigt auf die letzte Row', async () => {
    const userId = await nutzerAnlegen('list-pag@test.werkzirkel.de');
    const werkId = await werkAnlegen(userId);
    for (let i = 1; i <= 5; i++) {
      await pruefrundeAnlegen({
        werkId,
        titel: `P${i}`,
        status: 'oeffentlich',
        fristOffsetTage: i + 1, // 2..6 days
      });
    }

    const res1 = await pruefrundenGet(
      buildRequest({ path: '/api/v1/pruefrunden?limit=2' }),
    );
    const data1 = (await res1.json()) as {
      pruefrunden: Array<{ id: string; titel: string }>;
      nextCursor: string | null;
    };
    expect(data1.pruefrunden.length).toBe(2);
    expect(data1.pruefrunden.map((p) => p.titel)).toEqual(['P1', 'P2']);
    expect(data1.nextCursor).toBeTruthy();

    const res2 = await pruefrundenGet(
      buildRequest({
        path: `/api/v1/pruefrunden?limit=2&cursor=${data1.nextCursor}`,
      }),
    );
    const data2 = (await res2.json()) as {
      pruefrunden: Array<{ titel: string }>;
      nextCursor: string | null;
    };
    expect(data2.pruefrunden.map((p) => p.titel)).toEqual(['P3', 'P4']);
    expect(data2.nextCursor).toBeTruthy();

    const res3 = await pruefrundenGet(
      buildRequest({
        path: `/api/v1/pruefrunden?limit=2&cursor=${data2.nextCursor}`,
      }),
    );
    const data3 = (await res3.json()) as {
      pruefrunden: Array<{ titel: string }>;
      nextCursor: string | null;
    };
    expect(data3.pruefrunden.map((p) => p.titel)).toEqual(['P5']);
    expect(data3.nextCursor).toBeNull();
  });
});

// Anker fuer ungenutzte Imports.
void eq;
