/**
 * Integration-Tests fuer GET /api/v1/termine (Liste).
 *
 * Deckt PRD §15.8:
 *  - Filter: stadt_id, typ (mehrfach), ab_datum, bis_datum, status
 *  - Public sieht nur 'veroeffentlicht' + 'durchgefuehrt'
 *  - City-Lead der Stadt sieht zusaetzlich 'geplant' der eigenen Stadt
 *  - Admin sieht alles
 *  - Cursor-Pagination konsistent
 *  - Sortierung datum_uhrzeit ASC
 */

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createId } from '@paralleldrive/cuid2';

import { db } from '@/lib/db';
import {
  nutzer,
  session as sessionTable,
  termin,
} from '@/lib/db/schema';
import type { TerminTyp, TerminStatus } from '@/lib/db/schema/enums';
import { env } from '@/lib/env';
import { buildSessionCookie } from '@/lib/auth/session';

import { GET as termineGet } from '@/app/api/v1/termine/route';

import { truncateAll } from '../_helpers/db-cleanup';

const APP_ORIGIN = new URL(env.APP_URL).origin;

async function userAnlegen(opts: {
  email: string;
  stadtId?: string;
  rollen?: Array<'macher' | 'kurator' | 'admin'>;
}): Promise<string> {
  const id = createId();
  await db.insert(nutzer).values({
    id,
    email: opts.email,
    klarname: `Klar ${opts.email}`,
    anzeigename: `anz-${id.slice(0, 6)}`,
    stadtId: opts.stadtId ?? 'hh',
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
  stadtId?: string;
  typ?: TerminTyp;
  status?: TerminStatus;
  datumUhrzeit?: Date;
  erstelltVon: string;
  titel?: string;
}): Promise<string> {
  const id = createId();
  await db.insert(termin).values({
    id,
    stadtId: opts.stadtId ?? 'hh',
    typ: opts.typ ?? 'schauabend',
    titel: opts.titel ?? `T-${id.slice(0, 4)}`,
    beschreibung: 'Beschreibung.',
    ortText: 'Werkstatt',
    datumUhrzeit: opts.datumUhrzeit ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    maxTeilnehmer: 20,
    erstelltVon: opts.erstelltVon,
    status: opts.status ?? 'veroeffentlicht',
  });
  return id;
}

function buildRequest(opts: {
  method: 'GET';
  path: string;
  sessionId?: string;
}): Request {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    origin: APP_ORIGIN,
    'x-forwarded-for': '127.0.0.1',
  };
  if (opts.sessionId) {
    headers.cookie = buildSessionCookie(opts.sessionId).split(';')[0]!;
  }
  return new Request(`${APP_ORIGIN}${opts.path}`, {
    method: opts.method,
    headers,
  });
}

describe('GET /api/v1/termine (Liste)', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  it('public sieht nur veroeffentlicht + durchgefuehrt', async () => {
    const owner = await userAnlegen({ email: 'l-owner@test.werkzirkel.de', rollen: ['kurator'] });
    await terminAnlegen({ erstelltVon: owner, status: 'geplant' });
    await terminAnlegen({ erstelltVon: owner, status: 'veroeffentlicht' });
    await terminAnlegen({
      erstelltVon: owner,
      status: 'durchgefuehrt',
      datumUhrzeit: new Date(Date.now() - 24 * 60 * 60 * 1000),
    });
    await terminAnlegen({ erstelltVon: owner, status: 'abgesagt' });

    const res = await termineGet(
      buildRequest({ method: 'GET', path: '/api/v1/termine' }),
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      termine: Array<{ status: string }>;
    };
    const stati = new Set(data.termine.map((t) => t.status));
    expect(stati).toEqual(new Set(['veroeffentlicht', 'durchgefuehrt']));
    expect(data.termine.length).toBe(2);
  });

  it('City-Lead der Stadt sieht zusaetzlich geplant der eigenen Stadt', async () => {
    const owner = await userAnlegen({ email: 'l-owner2@test.werkzirkel.de', rollen: ['kurator'] });
    const sid = await sessionAnlegen(owner);
    await terminAnlegen({ erstelltVon: owner, status: 'geplant' });
    await terminAnlegen({ erstelltVon: owner, status: 'veroeffentlicht' });

    const res = await termineGet(
      buildRequest({
        method: 'GET',
        path: '/api/v1/termine?stadt_id=hh',
        sessionId: sid,
      }),
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { termine: Array<{ status: string }> };
    const stati = data.termine.map((t) => t.status).sort();
    expect(stati).toContain('geplant');
    expect(stati).toContain('veroeffentlicht');
  });

  it('City-Lead fremder Stadt sieht KEINE geplant der anderen Stadt', async () => {
    const ownerHH = await userAnlegen({ email: 'l-ownerHH@test.werkzirkel.de', rollen: ['kurator'] });
    const kuratorB = await userAnlegen({
      email: 'l-kurB@test.werkzirkel.de',
      stadtId: 'b',
      rollen: ['kurator'],
    });
    const sid = await sessionAnlegen(kuratorB);
    await terminAnlegen({ stadtId: 'hh', erstelltVon: ownerHH, status: 'geplant' });
    await terminAnlegen({ stadtId: 'hh', erstelltVon: ownerHH, status: 'veroeffentlicht' });

    const res = await termineGet(
      buildRequest({
        method: 'GET',
        path: '/api/v1/termine?stadt_id=hh',
        sessionId: sid,
      }),
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { termine: Array<{ status: string }> };
    const stati = new Set(data.termine.map((t) => t.status));
    expect(stati.has('geplant')).toBe(false);
    expect(stati.has('veroeffentlicht')).toBe(true);
  });

  it('Admin sieht alle Status', async () => {
    const owner = await userAnlegen({ email: 'l-owner3@test.werkzirkel.de', rollen: ['kurator'] });
    const admin = await userAnlegen({
      email: 'l-admin@test.werkzirkel.de',
      rollen: ['admin'],
    });
    const sid = await sessionAnlegen(admin);
    await terminAnlegen({ erstelltVon: owner, status: 'geplant' });
    await terminAnlegen({ erstelltVon: owner, status: 'abgesagt' });
    await terminAnlegen({ erstelltVon: owner, status: 'veroeffentlicht' });

    const res = await termineGet(
      buildRequest({
        method: 'GET',
        path: '/api/v1/termine',
        sessionId: sid,
      }),
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { termine: Array<{ status: string }> };
    const stati = new Set(data.termine.map((t) => t.status));
    expect(stati.has('geplant')).toBe(true);
    expect(stati.has('abgesagt')).toBe(true);
    expect(stati.has('veroeffentlicht')).toBe(true);
  });

  it('Filter typ (Mehrfach) funktioniert', async () => {
    const owner = await userAnlegen({ email: 'l-typ@test.werkzirkel.de', rollen: ['kurator'] });
    await terminAnlegen({ erstelltVon: owner, typ: 'schauabend' });
    await terminAnlegen({ erstelltVon: owner, typ: 'pruefabend' });
    await terminAnlegen({ erstelltVon: owner, typ: 'baurunde' });

    const res = await termineGet(
      buildRequest({
        method: 'GET',
        path: '/api/v1/termine?typ=schauabend&typ=baurunde',
      }),
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { termine: Array<{ typ: string }> };
    const typen = data.termine.map((t) => t.typ).sort();
    expect(typen).toEqual(['baurunde', 'schauabend']);
  });

  it('Filter ab_datum / bis_datum funktioniert', async () => {
    const owner = await userAnlegen({ email: 'l-dat@test.werkzirkel.de', rollen: ['kurator'] });
    await terminAnlegen({
      erstelltVon: owner,
      datumUhrzeit: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      titel: 'in_2_tagen',
    });
    await terminAnlegen({
      erstelltVon: owner,
      datumUhrzeit: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      titel: 'in_10_tagen',
    });
    await terminAnlegen({
      erstelltVon: owner,
      datumUhrzeit: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
      titel: 'in_20_tagen',
    });

    const ab = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
    const bis = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString();
    const res = await termineGet(
      buildRequest({
        method: 'GET',
        path: `/api/v1/termine?ab_datum=${encodeURIComponent(ab)}&bis_datum=${encodeURIComponent(bis)}`,
      }),
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { termine: Array<{ titel: string }> };
    expect(data.termine.length).toBe(1);
    expect(data.termine[0]?.titel).toBe('in_10_tagen');
  });

  it('Filter stadt_id funktioniert', async () => {
    const ownerHH = await userAnlegen({ email: 'l-shh@test.werkzirkel.de', rollen: ['kurator'] });
    const ownerB = await userAnlegen({
      email: 'l-sb@test.werkzirkel.de',
      stadtId: 'b',
      rollen: ['admin'], // Admin damit alle Staedte ok sind
    });
    await terminAnlegen({ erstelltVon: ownerHH, stadtId: 'hh' });
    await terminAnlegen({ erstelltVon: ownerB, stadtId: 'b' });

    const res = await termineGet(
      buildRequest({
        method: 'GET',
        path: '/api/v1/termine?stadt_id=b',
      }),
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { termine: Array<{ stadt_id: string }> };
    expect(data.termine.length).toBe(1);
    expect(data.termine[0]?.stadt_id).toBe('b');
  });

  it('Cursor-Pagination konsistent', async () => {
    const owner = await userAnlegen({ email: 'l-cur@test.werkzirkel.de', rollen: ['kurator'] });
    // 5 Termine mit gestaffelten Datums-Werten.
    for (let i = 0; i < 5; i++) {
      await terminAnlegen({
        erstelltVon: owner,
        datumUhrzeit: new Date(Date.now() + (i + 1) * 24 * 60 * 60 * 1000),
        titel: `seq-${i}`,
      });
    }

    const first = await termineGet(
      buildRequest({ method: 'GET', path: '/api/v1/termine?limit=2' }),
    );
    expect(first.status).toBe(200);
    const firstData = (await first.json()) as {
      termine: Array<{ id: string; titel: string }>;
      nextCursor: string | null;
    };
    expect(firstData.termine.length).toBe(2);
    expect(firstData.nextCursor).toBeTruthy();

    const second = await termineGet(
      buildRequest({
        method: 'GET',
        path: `/api/v1/termine?limit=2&cursor=${firstData.nextCursor}`,
      }),
    );
    const secondData = (await second.json()) as {
      termine: Array<{ id: string; titel: string }>;
      nextCursor: string | null;
    };
    expect(secondData.termine.length).toBe(2);
    // Keine Ueberlappung.
    const firstIds = new Set(firstData.termine.map((t) => t.id));
    for (const t of secondData.termine) {
      expect(firstIds.has(t.id)).toBe(false);
    }
  });

  it('Sortierung datum_uhrzeit ASC', async () => {
    const owner = await userAnlegen({ email: 'l-sort@test.werkzirkel.de', rollen: ['kurator'] });
    await terminAnlegen({
      erstelltVon: owner,
      datumUhrzeit: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      titel: 'spaeter',
    });
    await terminAnlegen({
      erstelltVon: owner,
      datumUhrzeit: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      titel: 'frueher',
    });

    const res = await termineGet(
      buildRequest({ method: 'GET', path: '/api/v1/termine' }),
    );
    const data = (await res.json()) as { termine: Array<{ titel: string }> };
    expect(data.termine[0]?.titel).toBe('frueher');
    expect(data.termine[1]?.titel).toBe('spaeter');
  });
});
