/**
 * Integration-Tests fuer POST /api/v1/me/pausieren + /reaktivieren.
 */

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createId } from '@paralleldrive/cuid2';
import { eq, inArray } from 'drizzle-orm';

import { db } from '@/lib/db';
import { nutzer, session as sessionTable } from '@/lib/db/schema';
import { env } from '@/lib/env';
import { buildSessionCookie } from '@/lib/auth/session';

import { POST as pausierenPost } from '@/app/api/v1/me/pausieren/route';
import { POST as reaktivierenPost } from '@/app/api/v1/me/reaktivieren/route';

const APP_ORIGIN = new URL(env.APP_URL).origin;
const PAUSE_EMAIL = 'pause@test.werkzirkel.de';

async function cleanup(): Promise<void> {
  const ids = (
    await db
      .select({ id: nutzer.id })
      .from(nutzer)
      .where(inArray(nutzer.email, [PAUSE_EMAIL]))
  ).map((n) => n.id);
  if (ids.length) {
    await db.delete(sessionTable).where(inArray(sessionTable.nutzerId, ids));
    await db.delete(nutzer).where(inArray(nutzer.id, ids));
  }
}

async function createUserAndSession(): Promise<{ userId: string; sid: string }> {
  const userId = createId();
  await db.insert(nutzer).values({
    id: userId,
    email: PAUSE_EMAIL,
    klarname: 'Pause Tester',
    anzeigename: 'pause-test',
    stadtId: 'hh',
    rollen: ['macher'],
    emailVerifiziertAm: new Date(),
  });
  const sid = createId();
  await db.insert(sessionTable).values({
    id: sid,
    nutzerId: userId,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });
  return { userId, sid };
}

function postRequest(path: string, sid: string): Request {
  return new Request(`${APP_ORIGIN}${path}`, {
    method: 'POST',
    headers: {
      origin: APP_ORIGIN,
      'x-forwarded-for': '127.0.0.1',
      cookie: buildSessionCookie(sid).split(';')[0]!,
    },
  });
}

describe('POST /api/v1/me/pausieren + /reaktivieren', () => {
  beforeEach(cleanup);
  afterAll(cleanup);

  it('/pausieren → 204, status=pausiert', async () => {
    const { userId, sid } = await createUserAndSession();
    const res = await pausierenPost(postRequest('/api/v1/me/pausieren', sid));
    expect(res.status).toBe(204);
    const row = await db
      .select({ status: nutzer.status })
      .from(nutzer)
      .where(eq(nutzer.id, userId))
      .limit(1);
    expect(row[0]?.status).toBe('pausiert');
  });

  it('/reaktivieren nach Pause → 204, status=aktiv', async () => {
    const { userId, sid } = await createUserAndSession();
    await pausierenPost(postRequest('/api/v1/me/pausieren', sid));
    const res = await reaktivierenPost(postRequest('/api/v1/me/reaktivieren', sid));
    expect(res.status).toBe(204);
    const row = await db
      .select({ status: nutzer.status })
      .from(nutzer)
      .where(eq(nutzer.id, userId))
      .limit(1);
    expect(row[0]?.status).toBe('aktiv');
  });
});
