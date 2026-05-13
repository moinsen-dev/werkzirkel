/**
 * Integration-Tests fuer POST /api/v1/me/avatar.
 *
 * Pfade:
 * - ohne Session → 401
 * - falscher MIME → 422
 * - gueltiger PNG (Dev-Stub-Pfad mit data: URL, da R2_* in Tests leer) → 200 mit
 *   gesetztem avatar_url.
 */

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createId } from '@paralleldrive/cuid2';
import { eq, inArray } from 'drizzle-orm';

import { db } from '@/lib/db';
import { nutzer, session as sessionTable } from '@/lib/db/schema';
import { env } from '@/lib/env';
import { buildSessionCookie } from '@/lib/auth/session';

import { POST as avatarPost } from '@/app/api/v1/me/avatar/route';

const APP_ORIGIN = new URL(env.APP_URL).origin;
const AVATAR_EMAIL = 'avatar@test.werkzirkel.de';

// Smallest valid PNG: 1×1 red pixel. Base64-decoded.
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
  'base64',
);

async function cleanup(): Promise<void> {
  const ids = (
    await db
      .select({ id: nutzer.id })
      .from(nutzer)
      .where(inArray(nutzer.email, [AVATAR_EMAIL]))
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
    email: AVATAR_EMAIL,
    klarname: 'Avatar Tester',
    anzeigename: 'avatar-test',
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

function avatarRequest(opts: {
  sessionId?: string;
  blob?: Blob;
  fileName?: string;
}): Request {
  const headers: Record<string, string> = {
    origin: APP_ORIGIN,
    'x-forwarded-for': '127.0.0.1',
  };
  if (opts.sessionId) {
    headers.cookie = buildSessionCookie(opts.sessionId).split(';')[0]!;
  }
  const fd = new FormData();
  if (opts.blob) {
    fd.append('file', opts.blob, opts.fileName ?? 'avatar.png');
  }
  return new Request(`${APP_ORIGIN}/api/v1/me/avatar`, {
    method: 'POST',
    headers,
    body: fd,
  });
}

describe('POST /api/v1/me/avatar', () => {
  beforeEach(cleanup);
  afterAll(cleanup);

  it('ohne Session → 401', async () => {
    const blob = new Blob([TINY_PNG], { type: 'image/png' });
    const res = await avatarPost(avatarRequest({ blob }));
    expect(res.status).toBe(401);
  });

  it('mit Nicht-Bild-MIME → 422', async () => {
    const userId = await createUser();
    const sid = await createSession(userId);
    const blob = new Blob([Buffer.from('plain text content')], { type: 'text/plain' });
    const res = await avatarPost(
      avatarRequest({ sessionId: sid, blob, fileName: 'note.txt' }),
    );
    expect(res.status).toBe(422);
    const json = (await res.json()) as { fehler: string };
    expect(json.fehler).toBe('validierung');
  });

  it('mit gueltigem PNG → 200, avatar_url gesetzt', async () => {
    const userId = await createUser();
    const sid = await createSession(userId);
    const blob = new Blob([TINY_PNG], { type: 'image/png' });
    const res = await avatarPost(
      avatarRequest({ sessionId: sid, blob, fileName: 'tiny.png' }),
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { avatar_url: string };
    expect(data.avatar_url).toBeTruthy();
    // Dev-Stub-Pfad: data: URL (R2_* nicht gesetzt im Test-Env).
    // Produktion: https://... — beide Formen sind hier OK, wir pruefen nur,
    // dass die DB den Wert persistiert hat.
    const dbRow = await db
      .select({ avatarUrl: nutzer.avatarUrl })
      .from(nutzer)
      .where(eq(nutzer.id, userId))
      .limit(1);
    expect(dbRow[0]?.avatarUrl).toBe(data.avatar_url);
    expect(dbRow[0]?.avatarUrl).toMatch(/^(data:|https?:)/);
  });
});
