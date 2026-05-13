/**
 * Token-Misuse-Prevention: ein Magic-Link-Token mit `zweck='login'` darf
 * niemals via GET /api/v1/me/delete-confirm eine Loeschung ausloesen.
 *
 * Wir legen einen Login-Token in die DB, schicken ihn an den
 * Delete-Confirm-Endpoint und erwarten:
 *   - 302 Redirect auf den Fehler-Pfad (?fehler=loeschung-token-ungueltig)
 *   - `nutzer.status` bleibt 'aktiv' (NICHT 'loeschung_anstehend')
 *
 * Test fuer das letzte Acceptance-Criterion in task-konto-loeschung.
 *
 * @vitest-environment node
 */

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createId } from '@paralleldrive/cuid2';
import { eq, inArray } from 'drizzle-orm';

import { db } from '@/lib/db';
import { magicLinkToken, nutzer } from '@/lib/db/schema';
import { env } from '@/lib/env';
import { generateMagicLinkToken } from '@/lib/auth/magic-link';

import { GET as deleteConfirmGet } from '@/app/api/v1/me/delete-confirm/route';

const APP_ORIGIN = new URL(env.APP_URL).origin;
const TARGET_EMAIL = 'zweck-validation@test.werkzirkel.de';

async function cleanup(): Promise<void> {
  await db.delete(magicLinkToken).where(eq(magicLinkToken.email, TARGET_EMAIL));
  await db.delete(nutzer).where(inArray(nutzer.email, [TARGET_EMAIL]));
}

describe('Magic-Link Zweck-Validierung im Delete-Confirm-Pfad', () => {
  beforeEach(cleanup);
  afterAll(cleanup);

  it('login-Token kann KEINE Konto-Loeschung bestaetigen', async () => {
    const userId = createId();
    await db.insert(nutzer).values({
      id: userId,
      email: TARGET_EMAIL,
      klarname: 'Zweck Tester',
      anzeigename: 'zweck-test',
      stadtId: 'hh',
      rollen: ['macher'],
      status: 'aktiv',
      emailVerifiziertAm: new Date(),
    });

    // Magic-Link-Token aber mit zweck='login' (NICHT konto_loeschen)
    const { clearToken, tokenHash } = generateMagicLinkToken();
    await db.insert(magicLinkToken).values({
      email: TARGET_EMAIL,
      tokenHash,
      zweck: 'login',
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });

    const res = await deleteConfirmGet(
      new Request(
        `${APP_ORIGIN}/api/v1/me/delete-confirm?token=${encodeURIComponent(clearToken)}`,
        { method: 'GET' },
      ),
    );

    // 1. Antwort: Fehler-Redirect.
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe(
      `${env.APP_URL}/anmelden?fehler=loeschung-token-ungueltig`,
    );

    // 2. Wirkung: Nutzer-Status unveraendert.
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

    // 3. Token bleibt unverbraucht (er war einfach falscher Zweck).
    const tokRow = await db
      .select({ verwendetAm: magicLinkToken.verwendetAm })
      .from(magicLinkToken)
      .where(eq(magicLinkToken.tokenHash, tokenHash))
      .limit(1);
    expect(tokRow[0]?.verwendetAm).toBeNull();
  });
});
