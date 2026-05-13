/**
 * Integration-Tests fuer POST/DELETE /api/v1/werke/:id/screenshots.
 *
 * Methode: Route-Handler direkt importieren und mit synthetischen
 * `Request`-Objekten aufrufen. Sessions werden direkt in der DB angelegt.
 *
 * Im Test-Env ist R2 nicht konfiguriert — der Dev-Fallback laeuft, screenshots
 * landen als data:-URLs in `werk.screenshots`. Das deckt die DB-Pfad-Logik
 * vollstaendig ab; der R2-Pfad selbst ist ein zusaetzlicher Branch.
 */

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createId } from '@paralleldrive/cuid2';
import { eq } from 'drizzle-orm';
import sharp from 'sharp';

import { db } from '@/lib/db';
import { nutzer, session as sessionTable, werk } from '@/lib/db/schema';
import { env } from '@/lib/env';
import { buildSessionCookie } from '@/lib/auth/session';

import {
  POST as screenshotsPost,
  DELETE as screenshotsDelete,
} from '@/app/api/v1/werke/[id]/screenshots/route';

import { truncateAll } from '../_helpers/db-cleanup';

const APP_ORIGIN = new URL(env.APP_URL).origin;

async function macherAnlegen(email: string): Promise<string> {
  const id = createId();
  await db.insert(nutzer).values({
    id,
    email,
    klarname: `Klar ${email}`,
    anzeigename: `anz-${id.slice(0, 6)}`,
    stadtId: 'hh',
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

async function werkAnlegen(nutzerId: string): Promise<string> {
  const id = createId();
  await db.insert(werk).values({
    id,
    nutzerId,
    name: 'Screenshot-Test-Werk',
    kurzbeschreibung: 'Kurz',
    problem: 'Wir testen.',
    zielgruppe: 'Tester:innen',
    werkstand: 'idee',
    hilfebedarf: ['ux_test'],
  });
  return id;
}

/**
 * Erzeugt einen synthetischen JPEG-`Uint8Array` der gewuenschten Pixel-Groesse.
 * Wir nehmen `Uint8Array` (nicht `Buffer`), weil der TS-DOM-`Blob`-Konstruktor
 * `SharedArrayBuffer`-Buffers (Node's Default) nicht akzeptiert.
 */
async function makeJpeg(width: number, height: number): Promise<Uint8Array<ArrayBuffer>> {
  const buf = await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 200, g: 100, b: 50 },
    },
  })
    .jpeg({ quality: 80 })
    .toBuffer();
  // Kopiere in einen frischen ArrayBuffer, damit TS' Blob-Konstruktor (der
  // SharedArrayBuffer-Backings ablehnt) zufrieden ist.
  const ab = new ArrayBuffer(buf.byteLength);
  new Uint8Array(ab).set(buf);
  return new Uint8Array(ab);
}

function buildScreenshotPost(opts: {
  werkId: string;
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
    fd.append('file', opts.blob, opts.fileName ?? 'shot.jpg');
  }
  return new Request(
    `${APP_ORIGIN}/api/v1/werke/${opts.werkId}/screenshots`,
    {
      method: 'POST',
      headers,
      body: fd,
    },
  );
}

function buildScreenshotDelete(opts: {
  werkId: string;
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
  return new Request(
    `${APP_ORIGIN}/api/v1/werke/${opts.werkId}/screenshots`,
    {
      method: 'DELETE',
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    },
  );
}

describe('POST /api/v1/werke/:id/screenshots', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  it('ohne Session → 401', async () => {
    // Werk anlegen + dann ohne Session POSTen.
    const owner = await macherAnlegen('ss-anon@test.werkzirkel.de');
    const wId = await werkAnlegen(owner);
    const jpeg = await makeJpeg(800, 600);
    const blob = new Blob([jpeg], { type: 'image/jpeg' });

    const res = await screenshotsPost(
      buildScreenshotPost({ werkId: wId, blob }),
      { params: Promise.resolve({ id: wId }) },
    );
    expect(res.status).toBe(401);
    const data = (await res.json()) as { error: { code: string } };
    expect(data.error.code).toBe('nicht_berechtigt');
  });

  it('fremder Nutzer → 403', async () => {
    const owner = await macherAnlegen('ss-owner@test.werkzirkel.de');
    const wId = await werkAnlegen(owner);
    const fremd = await macherAnlegen('ss-fremd@test.werkzirkel.de');
    const sid = await sessionAnlegen(fremd);

    const jpeg = await makeJpeg(800, 600);
    const blob = new Blob([jpeg], { type: 'image/jpeg' });

    const res = await screenshotsPost(
      buildScreenshotPost({ werkId: wId, sessionId: sid, blob }),
      { params: Promise.resolve({ id: wId }) },
    );
    expect(res.status).toBe(403);
    const data = (await res.json()) as { error: { code: string } };
    expect(data.error.code).toBe('nicht_berechtigt');
  });

  it('text/plain MIME → 422 mit deutscher Fehlermeldung', async () => {
    const owner = await macherAnlegen('ss-mime@test.werkzirkel.de');
    const sid = await sessionAnlegen(owner);
    const wId = await werkAnlegen(owner);

    const blob = new Blob([new Uint8Array(Buffer.from('nicht ein bild'))], {
      type: 'text/plain',
    });
    const res = await screenshotsPost(
      buildScreenshotPost({
        werkId: wId,
        sessionId: sid,
        blob,
        fileName: 'note.txt',
      }),
      { params: Promise.resolve({ id: wId }) },
    );
    expect(res.status).toBe(422);
    const data = (await res.json()) as { error: { code: string; message: string } };
    expect(data.error.code).toBe('mime_invalid');
    expect(data.error.message).toMatch(/JPG|PNG|WebP/);
  });

  it('6 MB Buffer → 422 mit datei_zu_gross', async () => {
    const owner = await macherAnlegen('ss-size@test.werkzirkel.de');
    const sid = await sessionAnlegen(owner);
    const wId = await werkAnlegen(owner);

    // 6 MB raw — ueber dem 5-MB-Limit. JPEG-Header mit gefuelltem Body.
    const big = new Uint8Array(6 * 1024 * 1024).fill(0xff);
    const blob = new Blob([big], { type: 'image/jpeg' });

    const res = await screenshotsPost(
      buildScreenshotPost({
        werkId: wId,
        sessionId: sid,
        blob,
        fileName: 'big.jpg',
      }),
      { params: Promise.resolve({ id: wId }) },
    );
    expect(res.status).toBe(422);
    const data = (await res.json()) as { error: { code: string } };
    expect(data.error.code).toBe('datei_zu_gross');
  });

  it('erster Upload → 200, screenshots Array hat 1 Eintrag', async () => {
    const owner = await macherAnlegen('ss-first@test.werkzirkel.de');
    const sid = await sessionAnlegen(owner);
    const wId = await werkAnlegen(owner);

    const jpeg = await makeJpeg(1200, 900);
    const blob = new Blob([jpeg], { type: 'image/jpeg' });

    const res = await screenshotsPost(
      buildScreenshotPost({ werkId: wId, sessionId: sid, blob }),
      { params: Promise.resolve({ id: wId }) },
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { screenshots: string[] };
    expect(data.screenshots.length).toBe(1);

    const dbRow = await db
      .select({ screenshots: werk.screenshots })
      .from(werk)
      .where(eq(werk.id, wId))
      .limit(1);
    expect(dbRow[0]?.screenshots.length).toBe(1);
  });

  it('3 Uploads OK, 4. → 422 mit screenshot_limit', async () => {
    const owner = await macherAnlegen('ss-limit@test.werkzirkel.de');
    const sid = await sessionAnlegen(owner);
    const wId = await werkAnlegen(owner);

    for (let i = 1; i <= 3; i++) {
      const jpeg = await makeJpeg(640, 480);
      const blob = new Blob([jpeg], { type: 'image/jpeg' });
      const res = await screenshotsPost(
        buildScreenshotPost({ werkId: wId, sessionId: sid, blob }),
        { params: Promise.resolve({ id: wId }) },
      );
      expect(res.status).toBe(200);
    }

    const jpeg = await makeJpeg(640, 480);
    const blob = new Blob([jpeg], { type: 'image/jpeg' });
    const res4 = await screenshotsPost(
      buildScreenshotPost({ werkId: wId, sessionId: sid, blob }),
      { params: Promise.resolve({ id: wId }) },
    );
    expect(res4.status).toBe(422);
    const data = (await res4.json()) as { error: { code: string; message: string } };
    expect(data.error.code).toBe('screenshot_limit');
    expect(data.error.message).toMatch(/3 Screenshots/);
  });
});

describe('DELETE /api/v1/werke/:id/screenshots', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  async function setupMitScreenshot(): Promise<{
    owner: string;
    sid: string;
    werkId: string;
    url: string;
  }> {
    const owner = await macherAnlegen('ss-del@test.werkzirkel.de');
    const sid = await sessionAnlegen(owner);
    const werkId = await werkAnlegen(owner);
    const jpeg = await makeJpeg(640, 480);
    const blob = new Blob([jpeg], { type: 'image/jpeg' });
    const postRes = await screenshotsPost(
      buildScreenshotPost({ werkId, sessionId: sid, blob }),
      { params: Promise.resolve({ id: werkId }) },
    );
    expect(postRes.status).toBe(200);
    const data = (await postRes.json()) as { screenshots: string[] };
    const url = data.screenshots[0];
    if (!url) throw new Error('setup: kein screenshot erzeugt');
    return { owner, sid, werkId, url };
  }

  it('eigener Screenshot → 200, Array um eins kuerzer', async () => {
    const { sid, werkId, url } = await setupMitScreenshot();

    const res = await screenshotsDelete(
      buildScreenshotDelete({
        werkId,
        sessionId: sid,
        body: { url },
      }),
      { params: Promise.resolve({ id: werkId }) },
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { screenshots: string[] };
    expect(data.screenshots.length).toBe(0);

    const dbRow = await db
      .select({ screenshots: werk.screenshots })
      .from(werk)
      .where(eq(werk.id, werkId))
      .limit(1);
    expect(dbRow[0]?.screenshots.length).toBe(0);
  });

  it('ohne Session → 401', async () => {
    const { werkId, url } = await setupMitScreenshot();
    const res = await screenshotsDelete(
      buildScreenshotDelete({ werkId, body: { url } }),
      { params: Promise.resolve({ id: werkId }) },
    );
    expect(res.status).toBe(401);
  });

  it('fremder Nutzer → 403', async () => {
    const { werkId, url } = await setupMitScreenshot();
    const fremd = await macherAnlegen('ss-del-fremd@test.werkzirkel.de');
    const fremdSid = await sessionAnlegen(fremd);

    const res = await screenshotsDelete(
      buildScreenshotDelete({
        werkId,
        sessionId: fremdSid,
        body: { url },
      }),
      { params: Promise.resolve({ id: werkId }) },
    );
    expect(res.status).toBe(403);
  });

  it('unbekannte URL → 404 mit screenshot_nicht_gefunden', async () => {
    const { sid, werkId } = await setupMitScreenshot();
    const res = await screenshotsDelete(
      buildScreenshotDelete({
        werkId,
        sessionId: sid,
        body: { url: 'https://example.com/nicht-zu-diesem-werk.jpg' },
      }),
      { params: Promise.resolve({ id: werkId }) },
    );
    expect(res.status).toBe(404);
    const data = (await res.json()) as { error: { code: string } };
    expect(data.error.code).toBe('screenshot_nicht_gefunden');
  });
});
