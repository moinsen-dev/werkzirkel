/**
 * Integration-Tests fuer /api/v1/auth/magic-link*.
 *
 * Verifiziert die Acceptance-Criteria aus PRD §15.1 + §16:
 * - POST mit gueltiger E-Mail → 204 + Token-Row mit SHA-256-Hash
 * - 6. Treffer pro E-Mail/Stunde → 429
 * - 31. Treffer pro IP/Stunde → 429
 * - POST mit unbekannter E-Mail (zweck=login) → 204 (User-Enumeration-Schutz)
 * - GET verify mit ungueltigem Token → 302 → /anmelden?fehler=token-ungueltig
 * - GET verify mit gueltigem Token → 302 → /uebersicht + wz_session-Cookie
 * - POST ohne Origin-Header → 403
 * - GET /me ohne Session → 401
 *
 * Methode: Route-Handler werden direkt importiert und mit synthetischen
 * `Request`-Objekten aufgerufen (Next-15-Pattern).
 */

import { beforeEach, describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import {
  magicLinkToken,
  nutzer,
  session as sessionTable,
} from '@/lib/db/schema/nutzer';
import { rateLimitBucket } from '@/lib/db/schema/rate-limit';
import { env } from '@/lib/env';

import { POST as magicLinkPost } from '@/app/api/v1/auth/magic-link/route';
import { GET as magicLinkVerifyGet } from '@/app/api/v1/auth/magic-link/verify/route';
import { GET as meGet } from '@/app/api/v1/auth/me/route';
import { generateMagicLinkToken } from '@/lib/auth/magic-link';

const APP_ORIGIN = new URL(env.APP_URL).origin;
const TEST_EMAIL = 'jana@test.werkzirkel.de';

function jsonRequest(
  path: string,
  body: unknown,
  opts: {
    origin?: string | null;
    ip?: string;
    method?: string;
  } = {},
): Request {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'x-forwarded-for': opts.ip ?? '1.2.3.4',
  };
  const origin = opts.origin === undefined ? APP_ORIGIN : opts.origin;
  if (origin !== null) {
    headers['origin'] = origin;
  }
  return new Request(`${APP_ORIGIN}${path}`, {
    method: opts.method ?? 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

function getRequest(path: string, cookie?: string): Request {
  const headers: Record<string, string> = {
    'x-forwarded-for': '1.2.3.4',
  };
  if (cookie) headers['cookie'] = cookie;
  return new Request(`${APP_ORIGIN}${path}`, {
    method: 'GET',
    headers,
  });
}

async function resetMagicLinkState(): Promise<void> {
  await db.delete(magicLinkToken);
  await db.delete(rateLimitBucket);
  await db.delete(sessionTable);
  await db.delete(nutzer).where(eq(nutzer.email, TEST_EMAIL));
}

describe('POST /api/v1/auth/magic-link', () => {
  beforeEach(async () => {
    await resetMagicLinkState();
  });

  it('legt Token mit SHA-256-Hash an (nicht im Klartext)', async () => {
    const req = jsonRequest('/api/v1/auth/magic-link', {
      email: TEST_EMAIL,
      zweck: 'registrierung',
    });
    const res = await magicLinkPost(req);
    expect(res.status).toBe(204);

    const rows = await db
      .select()
      .from(magicLinkToken)
      .where(eq(magicLinkToken.email, TEST_EMAIL));
    expect(rows.length).toBe(1);
    const row = rows[0]!;

    // Hash ist ein Hex-String von 64 Zeichen (SHA-256) — niemals der Klartext.
    expect(row.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.zweck).toBe('registrierung');
    expect(row.verwendetAm).toBeNull();
    // Expiry liegt zwischen jetzt+10min und jetzt+20min (Soll: 15min).
    const diffMin = (row.expiresAt.getTime() - Date.now()) / 60_000;
    expect(diffMin).toBeGreaterThan(10);
    expect(diffMin).toBeLessThan(20);
  });

  it('6. Aufruf pro E-Mail in einer Stunde → 429', async () => {
    for (let i = 0; i < 5; i++) {
      const res = await magicLinkPost(
        jsonRequest('/api/v1/auth/magic-link', {
          email: TEST_EMAIL,
          zweck: 'registrierung',
        }),
      );
      expect(res.status).toBe(204);
    }
    const sixth = await magicLinkPost(
      jsonRequest('/api/v1/auth/magic-link', {
        email: TEST_EMAIL,
        zweck: 'registrierung',
      }),
    );
    expect(sixth.status).toBe(429);
  });

  it(
    '31. Aufruf pro IP in einer Stunde → 429',
    async () => {
      // 30 verschiedene Mails, gleiche IP → 30 Treffer ok, 31. blockiert.
      for (let i = 0; i < 30; i++) {
        const res = await magicLinkPost(
          jsonRequest(
            '/api/v1/auth/magic-link',
            {
              email: `seed${i}@test.werkzirkel.de`,
              zweck: 'registrierung',
            },
            { ip: '9.9.9.9' },
          ),
        );
        expect(res.status).toBe(204);
      }
      const thirtyFirst = await magicLinkPost(
        jsonRequest(
          '/api/v1/auth/magic-link',
          {
            email: 'over@test.werkzirkel.de',
            zweck: 'registrierung',
          },
          { ip: '9.9.9.9' },
        ),
      );
      expect(thirtyFirst.status).toBe(429);
    },
    30_000,
  );

  it('unbekannte E-Mail beim Login → still 204 (User-Enumeration-Schutz)', async () => {
    const res = await magicLinkPost(
      jsonRequest('/api/v1/auth/magic-link', {
        email: 'gibt-es-nicht@test.werkzirkel.de',
        zweck: 'login',
      }),
    );
    expect(res.status).toBe(204);
    // Kein Token wurde angelegt — das ist das Signal an die Mail-Pipeline,
    // gar nichts zu tun.
    const rows = await db
      .select()
      .from(magicLinkToken)
      .where(eq(magicLinkToken.email, 'gibt-es-nicht@test.werkzirkel.de'));
    expect(rows.length).toBe(0);
  });

  it('ohne Origin-Header → 403', async () => {
    const res = await magicLinkPost(
      jsonRequest(
        '/api/v1/auth/magic-link',
        { email: TEST_EMAIL, zweck: 'registrierung' },
        { origin: null },
      ),
    );
    expect(res.status).toBe(403);
  });

  it('mit falschem Origin → 403', async () => {
    const res = await magicLinkPost(
      jsonRequest(
        '/api/v1/auth/magic-link',
        { email: TEST_EMAIL, zweck: 'registrierung' },
        { origin: 'https://boese.example' },
      ),
    );
    expect(res.status).toBe(403);
  });
});

describe('GET /api/v1/auth/magic-link/verify', () => {
  beforeEach(async () => {
    await resetMagicLinkState();
  });

  it('ungueltiger Token → 302 → /anmelden?fehler=token-ungueltig', async () => {
    const res = await magicLinkVerifyGet(
      getRequest('/api/v1/auth/magic-link/verify?token=quatsch1234567890'),
    );
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe(
      `${env.APP_URL}/anmelden?fehler=token-ungueltig`,
    );
  });

  it('gueltiger Token → 302 → /uebersicht + wz_session-Cookie + Token verwendet', async () => {
    // Token manuell in der DB platzieren.
    const { clearToken, tokenHash } = generateMagicLinkToken();
    await db.insert(magicLinkToken).values({
      email: TEST_EMAIL,
      tokenHash,
      zweck: 'registrierung',
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });

    const res = await magicLinkVerifyGet(
      getRequest(
        `/api/v1/auth/magic-link/verify?token=${encodeURIComponent(clearToken)}`,
      ),
    );
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe(`${env.APP_URL}/uebersicht`);

    const setCookie = res.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain('wz_session=');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Lax');

    // Token ist als verwendet markiert.
    const after = await db
      .select()
      .from(magicLinkToken)
      .where(eq(magicLinkToken.tokenHash, tokenHash));
    expect(after[0]?.verwendetAm).toBeTruthy();

    // Neuer Nutzer wurde angelegt (zweck=registrierung).
    const created = await db
      .select()
      .from(nutzer)
      .where(eq(nutzer.email, TEST_EMAIL));
    expect(created.length).toBe(1);
    expect(created[0]!.emailVerifiziertAm).toBeTruthy();
  });

  it('abgelaufener Token → 302 → /anmelden?fehler=token-ungueltig', async () => {
    const clear = 'abcdef-some-clear-token-1234567890';
    const tokenHash = createHash('sha256').update(clear).digest('hex');
    await db.insert(magicLinkToken).values({
      email: TEST_EMAIL,
      tokenHash,
      zweck: 'login',
      expiresAt: new Date(Date.now() - 60 * 1000),
    });

    const res = await magicLinkVerifyGet(
      getRequest(`/api/v1/auth/magic-link/verify?token=${encodeURIComponent(clear)}`),
    );
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe(
      `${env.APP_URL}/anmelden?fehler=token-ungueltig`,
    );
  });

  it('bereits verwendeter Token → 302 → /anmelden?fehler=token-ungueltig', async () => {
    const clear = 'abcdef-some-clear-token-99999';
    const tokenHash = createHash('sha256').update(clear).digest('hex');
    await db.insert(magicLinkToken).values({
      email: TEST_EMAIL,
      tokenHash,
      zweck: 'login',
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      verwendetAm: new Date(),
    });

    const res = await magicLinkVerifyGet(
      getRequest(`/api/v1/auth/magic-link/verify?token=${encodeURIComponent(clear)}`),
    );
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe(
      `${env.APP_URL}/anmelden?fehler=token-ungueltig`,
    );
  });
});

describe('GET /api/v1/auth/me', () => {
  beforeEach(async () => {
    await resetMagicLinkState();
  });

  it('ohne Session-Cookie → 401', async () => {
    const res = await meGet(getRequest('/api/v1/auth/me'));
    expect(res.status).toBe(401);
  });

  it('mit gueltigem Session-Cookie → 200 + nutzer + sessions', async () => {
    // Erst Verify durchlaufen, um sauber einen Nutzer + Session anzulegen.
    const { clearToken, tokenHash } = generateMagicLinkToken();
    await db.insert(magicLinkToken).values({
      email: TEST_EMAIL,
      tokenHash,
      zweck: 'registrierung',
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });
    const verifyRes = await magicLinkVerifyGet(
      getRequest(
        `/api/v1/auth/magic-link/verify?token=${encodeURIComponent(clearToken)}`,
      ),
    );
    const cookie = verifyRes.headers.get('set-cookie') ?? '';
    // Cookie-Name+Value rauslesen (alles vor dem ersten Semikolon).
    const sessionCookieKV = cookie.split(';')[0];
    expect(sessionCookieKV).toMatch(/^wz_session=/);

    const meRes = await meGet(getRequest('/api/v1/auth/me', sessionCookieKV));
    expect(meRes.status).toBe(200);
    const data = (await meRes.json()) as {
      nutzer: { email: string; rollen: string[] };
      sessions: Array<{ id: string; current: boolean }>;
    };
    expect(data.nutzer.email).toBe(TEST_EMAIL);
    expect(data.nutzer.rollen).toEqual(['macher']);
    expect(data.sessions.length).toBeGreaterThan(0);
    expect(data.sessions.some((s) => s.current === true)).toBe(true);
  });
});
