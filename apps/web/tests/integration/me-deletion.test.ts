/**
 * Integration-Tests fuer den Konto-Loeschungs-Flow (PRD §10, §34):
 *
 *   POST /api/v1/me/delete-request    — fordert Bestaetigung an
 *   GET  /api/v1/me/delete-confirm    — bestaetigt + startet 7-Tage-Karenz
 *   POST /api/v1/me/cancel-deletion   — widerruft die Loeschung
 *
 * Wir umgehen das Mail-System nicht: send.ts schreibt im Test-Mode (kein
 * RESEND_API_KEY) einfach ein Mock-Log und legt einen Eintrag in
 * `email_benachrichtigung_log` an — beides ist im Test akzeptabel.
 */

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createId } from '@paralleldrive/cuid2';
import { and, desc, eq, inArray } from 'drizzle-orm';

import { db } from '@/lib/db';
import {
  emailBenachrichtigungLog,
  magicLinkToken,
  nutzer,
  session as sessionTable,
} from '@/lib/db/schema';
import { env } from '@/lib/env';
import { buildSessionCookie } from '@/lib/auth/session';
import {
  generateMagicLinkToken,
  hashMagicLinkToken,
} from '@/lib/auth/magic-link';

import { POST as deleteRequestPost } from '@/app/api/v1/me/delete-request/route';
import { GET as deleteConfirmGet } from '@/app/api/v1/me/delete-confirm/route';
import { POST as cancelDeletionPost } from '@/app/api/v1/me/cancel-deletion/route';

const APP_ORIGIN = new URL(env.APP_URL).origin;
const DEL_EMAIL = 'me-deletion@test.werkzirkel.de';

async function cleanup(): Promise<void> {
  const ids = (
    await db
      .select({ id: nutzer.id })
      .from(nutzer)
      .where(inArray(nutzer.email, [DEL_EMAIL]))
  ).map((n) => n.id);
  if (ids.length) {
    await db.delete(sessionTable).where(inArray(sessionTable.nutzerId, ids));
    await db
      .delete(emailBenachrichtigungLog)
      .where(inArray(emailBenachrichtigungLog.nutzerId, ids));
    await db.delete(nutzer).where(inArray(nutzer.id, ids));
  }
  await db.delete(magicLinkToken).where(eq(magicLinkToken.email, DEL_EMAIL));
}

async function createUserAndSession(): Promise<{ userId: string; sid: string }> {
  const userId = createId();
  await db.insert(nutzer).values({
    id: userId,
    email: DEL_EMAIL,
    klarname: 'Loeschung Tester',
    anzeigename: 'del-test',
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

function authedRequest(opts: {
  method: 'GET' | 'POST';
  path: string;
  sid?: string;
}): Request {
  const headers: Record<string, string> = {
    origin: APP_ORIGIN,
    'x-forwarded-for': '127.0.0.1',
  };
  if (opts.sid) {
    headers.cookie = buildSessionCookie(opts.sid).split(';')[0]!;
  }
  return new Request(`${APP_ORIGIN}${opts.path}`, {
    method: opts.method,
    headers,
  });
}

describe('Konto-Loeschungs-Flow', () => {
  beforeEach(cleanup);
  afterAll(cleanup);

  it('POST /api/v1/me/delete-request → 204 + Magic-Link-Row + Hash', async () => {
    const { sid } = await createUserAndSession();

    const res = await deleteRequestPost(
      authedRequest({ method: 'POST', path: '/api/v1/me/delete-request', sid }),
    );
    expect(res.status).toBe(204);

    const rows = await db
      .select()
      .from(magicLinkToken)
      .where(
        and(
          eq(magicLinkToken.email, DEL_EMAIL),
          eq(magicLinkToken.zweck, 'konto_loeschen_bestaetigung'),
        ),
      );
    expect(rows.length).toBe(1);
    const row = rows[0]!;
    expect(row.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(row.verwendetAm).toBeNull();
    expect(row.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('zweimaliger POST delete-request → erster Token ist invalidiert', async () => {
    const { sid } = await createUserAndSession();

    await deleteRequestPost(
      authedRequest({ method: 'POST', path: '/api/v1/me/delete-request', sid }),
    );
    await deleteRequestPost(
      authedRequest({ method: 'POST', path: '/api/v1/me/delete-request', sid }),
    );

    const rows = await db
      .select()
      .from(magicLinkToken)
      .where(
        and(
          eq(magicLinkToken.email, DEL_EMAIL),
          eq(magicLinkToken.zweck, 'konto_loeschen_bestaetigung'),
        ),
      )
      .orderBy(desc(magicLinkToken.erstelltAm));
    expect(rows.length).toBe(2);
    const [neuer, alter] = rows;
    expect(alter!.verwendetAm).not.toBeNull();
    expect(neuer!.verwendetAm).toBeNull();
  });

  it('GET /api/v1/me/delete-confirm?token=<valid> → 302 + status=loeschung_anstehend', async () => {
    const { userId } = await createUserAndSession();

    // Token direkt einfuegen (umgehen Mail-Pfad fuer Test-Stabilitaet)
    const { clearToken, tokenHash } = generateMagicLinkToken();
    await db.insert(magicLinkToken).values({
      email: DEL_EMAIL,
      tokenHash,
      zweck: 'konto_loeschen_bestaetigung',
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });

    const res = await deleteConfirmGet(
      new Request(
        `${APP_ORIGIN}/api/v1/me/delete-confirm?token=${encodeURIComponent(clearToken)}`,
        { method: 'GET' },
      ),
    );
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe(
      `${env.APP_URL}/einstellungen?tab=datenschutz&loeschung=bestaetigt`,
    );

    const userRow = await db
      .select({
        status: nutzer.status,
        loeschungAnstehendBis: nutzer.loeschungAnstehendBis,
      })
      .from(nutzer)
      .where(eq(nutzer.id, userId))
      .limit(1);
    expect(userRow[0]?.status).toBe('loeschung_anstehend');

    const bis = userRow[0]?.loeschungAnstehendBis;
    expect(bis).not.toBeNull();
    if (bis) {
      const erwartet = Date.now() + 7 * 24 * 60 * 60 * 1000;
      // Toleranz: 60 Sekunden
      expect(Math.abs(bis.getTime() - erwartet)).toBeLessThan(60_000);
    }
  });

  it('POST /api/v1/me/cancel-deletion waehrend loeschung_anstehend → 204 + status=aktiv', async () => {
    const { userId, sid } = await createUserAndSession();
    // Loeschung simulieren
    await db
      .update(nutzer)
      .set({
        status: 'loeschung_anstehend',
        loeschungAnstehendBis: new Date(Date.now() + 7 * 86400 * 1000),
      })
      .where(eq(nutzer.id, userId));

    const res = await cancelDeletionPost(
      authedRequest({ method: 'POST', path: '/api/v1/me/cancel-deletion', sid }),
    );
    expect(res.status).toBe(204);

    const row = await db
      .select({
        status: nutzer.status,
        loeschungAnstehendBis: nutzer.loeschungAnstehendBis,
      })
      .from(nutzer)
      .where(eq(nutzer.id, userId))
      .limit(1);
    expect(row[0]?.status).toBe('aktiv');
    expect(row[0]?.loeschungAnstehendBis).toBeNull();
  });

  it('GET delete-confirm mit abgelaufenem Token → Redirect mit Fehler', async () => {
    await createUserAndSession();
    const { clearToken, tokenHash } = generateMagicLinkToken();
    await db.insert(magicLinkToken).values({
      email: DEL_EMAIL,
      tokenHash,
      zweck: 'konto_loeschen_bestaetigung',
      expiresAt: new Date(Date.now() - 60_000),
    });

    const res = await deleteConfirmGet(
      new Request(
        `${APP_ORIGIN}/api/v1/me/delete-confirm?token=${encodeURIComponent(clearToken)}`,
        { method: 'GET' },
      ),
    );
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe(
      `${env.APP_URL}/anmelden?fehler=loeschung-token-ungueltig`,
    );

    // Hash wird zur Verifikation der Token-Identifikation genutzt
    expect(hashMagicLinkToken(clearToken)).toBe(tokenHash);
  });
});
