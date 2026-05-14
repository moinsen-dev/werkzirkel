/**
 * Integration-Tests fuer das Hinzufuegen einer Bedarfstraeger:in- oder
 * Foerder:in-Rolle ueber den `/einstellungen`-Profil-Tab.
 *
 * Verifiziert PRD §13.2 — Klarname-Pflicht beim Rollen-Wechsel.
 *
 * Methode: Wir testen den effektiven Validator-Pfad (PATCH /api/v1/me) und
 * die Permission-Helper direkt — die Server-Action im Page-Modul wendet
 * dieselbe Validator-Regel an, daher reichen Validator + API als
 * Acceptance-Test fuer die Kern-Logik.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createId } from '@paralleldrive/cuid2';
import { eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import {
  nutzer,
  session as sessionTable,
} from '@/lib/db/schema/nutzer';
import { env } from '@/lib/env';
import { truncateAll } from '../_helpers/db-cleanup';
import { buildSessionCookie } from '@/lib/auth/session';

import { PATCH as mePatch } from '@/app/api/v1/me/route';

const APP_ORIGIN = new URL(env.APP_URL).origin;
const TEST_EMAIL = 'rolle-hinzufuegen@test.werkzirkel.de';

async function resetState(): Promise<void> {
  await truncateAll();
}

async function createUser(opts: {
  klarname: string;
  rollen: Array<'macher' | 'bedarfstraeger' | 'foerderer'>;
}): Promise<string> {
  const id = createId();
  await db.insert(nutzer).values({
    id,
    email: TEST_EMAIL,
    klarname: opts.klarname,
    anzeigename: 'rolle-test',
    stadtId: 'hh',
    rollen: opts.rollen,
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

function patchRequest(sessionId: string, body: unknown): Request {
  return new Request(`${APP_ORIGIN}/api/v1/me`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      origin: APP_ORIGIN,
      'x-forwarded-for': '1.2.3.4',
      cookie: buildSessionCookie(sessionId).split(';')[0]!,
    },
    body: JSON.stringify(body),
  });
}

beforeEach(resetState);
afterEach(resetState);

describe('Rolle hinzufuegen — Klarname-Pflicht (PRD §13.2)', () => {
  it('User mit rollen=[macher] + klarname="" → PATCH bedarfstraeger hinzufuegen ohne klarname → 422', async () => {
    const userId = await createUser({ klarname: '', rollen: ['macher'] });
    const sid = await createSession(userId);

    const res = await mePatch(
      patchRequest(sid, {
        rollen: ['macher', 'bedarfstraeger'],
      }),
    );
    expect(res.status).toBe(422);

    const json = (await res.json()) as {
      fehler: string;
      details: Record<string, string[]>;
    };
    expect(json.fehler).toBe('validierung');
    expect(json.details.klarname?.[0]).toMatch(/Klarname/i);

    // Nutzer-Rollen unveraendert.
    const after = await db
      .select({ rollen: nutzer.rollen })
      .from(nutzer)
      .where(eq(nutzer.id, userId));
    expect(after[0]!.rollen).toEqual(['macher']);
  });

  it('User mit rollen=[macher] + klarname="Max Mustermann" → PATCH bedarfstraeger hinzufuegen → 200', async () => {
    const userId = await createUser({
      klarname: 'Max Mustermann',
      rollen: ['macher'],
    });
    const sid = await createSession(userId);

    const res = await mePatch(
      patchRequest(sid, {
        rollen: ['macher', 'bedarfstraeger'],
      }),
    );
    expect(res.status).toBe(200);

    const after = await db
      .select({ rollen: nutzer.rollen })
      .from(nutzer)
      .where(eq(nutzer.id, userId));
    expect(after[0]!.rollen).toEqual(['macher', 'bedarfstraeger']);
  });

  it('User mit rollen=[macher] → PATCH foerderer hinzufuegen mit klarname-leer → 422', async () => {
    const userId = await createUser({ klarname: '', rollen: ['macher'] });
    const sid = await createSession(userId);

    const res = await mePatch(
      patchRequest(sid, {
        rollen: ['macher', 'foerderer'],
        klarname: '',
      }),
    );
    expect(res.status).toBe(422);
  });
});

describe('Permission-Helper hasRolle/istBedarfstraeger/istFoerderer', () => {
  it('hasRolle: prueft Rolle in nutzer.rollen', async () => {
    const { hasRolle } = await import('@/lib/auth/permissions');
    expect(hasRolle({ rollen: ['macher', 'bedarfstraeger'] }, 'bedarfstraeger')).toBe(
      true,
    );
    expect(hasRolle({ rollen: ['macher'] }, 'bedarfstraeger')).toBe(false);
  });

  it('istBedarfstraeger: true wenn rolle bedarfstraeger', async () => {
    const { istBedarfstraeger } = await import('@/lib/auth/permissions');
    expect(istBedarfstraeger({ rollen: ['bedarfstraeger'] })).toBe(true);
    expect(istBedarfstraeger({ rollen: ['macher', 'kurator'] })).toBe(false);
  });

  it('istFoerderer: true wenn rolle foerderer', async () => {
    const { istFoerderer } = await import('@/lib/auth/permissions');
    expect(istFoerderer({ rollen: ['foerderer'] })).toBe(true);
    expect(istFoerderer({ rollen: ['macher'] })).toBe(false);
  });
});
