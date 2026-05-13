/**
 * Integration-Tests fuer GET + PATCH /api/v1/me.
 *
 * Methode: Route-Handler direkt importieren und mit synthetischen
 * `Request`-Objekten aufrufen (Next-15-Pattern). Session wird durch direktes
 * Anlegen einer Session-Row + Cookie hergestellt — die Magic-Link-Pipeline
 * ist hier nicht der Test-Gegenstand.
 */

import { beforeEach, afterAll, describe, it, expect } from 'vitest';
import { createId } from '@paralleldrive/cuid2';
import { inArray } from 'drizzle-orm';

import { db } from '@/lib/db';
import {
  nutzer,
  session as sessionTable,
} from '@/lib/db/schema';
import { env } from '@/lib/env';
import { buildSessionCookie } from '@/lib/auth/session';

import { GET as meGet, PATCH as mePatch } from '@/app/api/v1/me/route';
import { truncateAll } from '../_helpers/db-cleanup';

const APP_ORIGIN = new URL(env.APP_URL).origin;
const ME_EMAIL = 'me-crud@test.werkzirkel.de';

async function cleanup(): Promise<void> {
  await truncateAll();
  // Folgende Spezial-Deletes sind nach truncateAll No-ops, dokumentieren
  // aber die urspruengliche Aufraeum-Intention pro Suite.
  const ids = (
    await db
      .select({ id: nutzer.id })
      .from(nutzer)
      .where(inArray(nutzer.email, [ME_EMAIL]))
  ).map((n) => n.id);
  if (ids.length) {
    await db.delete(sessionTable).where(inArray(sessionTable.nutzerId, ids));
    await db.delete(nutzer).where(inArray(nutzer.id, ids));
  }
}

async function createUser(): Promise<string> {
  const id = createId();
  await db.insert(nutzer).values({
    id,
    email: ME_EMAIL,
    klarname: 'Crud Tester',
    anzeigename: 'crud-test',
    stadtId: 'hh',
    rollen: ['macher'],
    emailVerifiziertAm: new Date(),
  });
  return id;
}

async function createSession(nutzerId: string): Promise<string> {
  const id = createId();
  await db.insert(sessionTable).values({
    id,
    nutzerId,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });
  return id;
}

function meRequest(opts: {
  method: 'GET' | 'PATCH';
  sessionId?: string;
  body?: unknown;
}): Request {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    origin: APP_ORIGIN,
    'x-forwarded-for': '127.0.0.1',
  };
  if (opts.sessionId) {
    headers.cookie = buildSessionCookie(opts.sessionId).split(';')[0]!;
  }
  return new Request(`${APP_ORIGIN}/api/v1/me`, {
    method: opts.method,
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
}

describe('GET /api/v1/me', () => {
  beforeEach(cleanup);
  afterAll(cleanup);

  it('ohne Session → 401', async () => {
    const res = await meGet(meRequest({ method: 'GET' }));
    expect(res.status).toBe(401);
  });

  it('mit Session → 200 + Profil', async () => {
    const userId = await createUser();
    const sid = await createSession(userId);
    const res = await meGet(meRequest({ method: 'GET', sessionId: sid }));
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      nutzer: { email: string; rollen: string[] };
      foerdermitgliedschaft: null | object;
    };
    expect(data.nutzer.email).toBe(ME_EMAIL);
    expect(data.nutzer.rollen).toEqual(['macher']);
    expect(data.foerdermitgliedschaft).toBeNull();
  });
});

describe('PATCH /api/v1/me', () => {
  beforeEach(cleanup);
  afterAll(cleanup);

  it('mit ungueltigem Body (Zod) → 422 mit deutscher Fehlermeldung', async () => {
    const userId = await createUser();
    const sid = await createSession(userId);
    const res = await mePatch(
      meRequest({
        method: 'PATCH',
        sessionId: sid,
        body: { anzeigename: '' }, // leerer Anzeigename → Validierung
      }),
    );
    expect(res.status).toBe(422);
    const json = (await res.json()) as {
      fehler: string;
      details: Record<string, string[]>;
    };
    expect(json.fehler).toBe('validierung');
    // German error message present.
    const firstMsg = Object.values(json.details).flat()[0] ?? '';
    expect(firstMsg).toMatch(/(darf nicht leer|zu lang|Pflicht)/i);
  });

  it('mit gueltigem Body → 200 + persistiert', async () => {
    const userId = await createUser();
    const sid = await createSession(userId);
    const res = await mePatch(
      meRequest({
        method: 'PATCH',
        sessionId: sid,
        body: {
          anzeigename: 'crud-test-neu',
          kurzbeschreibung: 'Hello world',
          faehigkeiten: ['typescript', 'next'],
          website: 'https://werkzirkel.de',
        },
      }),
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      nutzer: {
        anzeigename: string;
        kurzbeschreibung: string;
        faehigkeiten: string[];
        website: string;
      };
    };
    expect(data.nutzer.anzeigename).toBe('crud-test-neu');
    expect(data.nutzer.kurzbeschreibung).toBe('Hello world');
    expect(data.nutzer.faehigkeiten).toEqual(['typescript', 'next']);
    expect(data.nutzer.website).toBe('https://werkzirkel.de');
  });

  it("Rolle 'bedarfstraeger' + klarname=leer → 422", async () => {
    const userId = await createUser();
    const sid = await createSession(userId);
    const res = await mePatch(
      meRequest({
        method: 'PATCH',
        sessionId: sid,
        // Wir setzen klarname explizit '' und schalten rolle auf bedarfstraeger.
        // Das Schema selbst lehnt klarname='' bereits via min(1) ab — der
        // Test deckt damit doppelt: Schema-Refinement + Cross-Check.
        body: { rollen: ['bedarfstraeger'], klarname: '' },
      }),
    );
    expect(res.status).toBe(422);
  });

  it('ohne Session → 401', async () => {
    const res = await mePatch(
      meRequest({ method: 'PATCH', body: { anzeigename: 'x' } }),
    );
    expect(res.status).toBe(401);
  });
});
