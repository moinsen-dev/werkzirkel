/**
 * Integration-Tests fuer den Werkstattbeitrag-Geldbeitrag-Pfad:
 *   POST /api/v1/werkstattbeitrag/geldbeitrag (Stripe Checkout, Dev-Fallback)
 *   handleCheckoutSessionCompleted (Webhook-Business-Logik)
 *
 * Deckt PRD §10.5, §18 (Pfad B), §11A (Werkstattbeitrag-Pflicht).
 */

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createId } from '@paralleldrive/cuid2';
import { eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import {
  emailBenachrichtigungLog,
  nutzer,
  session as sessionTable,
  werkstattbeitrag,
  werkstattKasseEintrag,
} from '@/lib/db/schema';
import { env } from '@/lib/env';
import { buildSessionCookie } from '@/lib/auth/session';

import { POST as geldbeitragPost } from '@/app/api/v1/werkstattbeitrag/geldbeitrag/route';
import { GET as meWerkstattbeitragGet } from '@/app/api/v1/me/werkstattbeitrag/route';
import { handleCheckoutSessionCompleted } from '@/lib/stripe/webhook';

import { truncateAll } from '../_helpers/db-cleanup';

const APP_ORIGIN = new URL(env.APP_URL).origin;

type Rolle = 'macher' | 'bedarfstraeger' | 'foerderer' | 'kurator' | 'admin';

async function userAnlegen(opts: {
  email: string;
  stadtId?: string;
  rollen?: Rolle[];
}): Promise<string> {
  const id = createId();
  await db.insert(nutzer).values({
    id,
    email: opts.email,
    klarname: `Klar ${opts.email}`,
    anzeigename: `anz-${id.slice(0, 6)}`,
    stadtId: opts.stadtId ?? 'hh',
    rollen: opts.rollen ?? ['bedarfstraeger'],
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

function buildRequest(opts: {
  method: 'GET' | 'POST';
  path: string;
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
  return new Request(`${APP_ORIGIN}${opts.path}`, {
    method: opts.method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

describe('POST /api/v1/werkstattbeitrag/geldbeitrag — Dev-Fallback (kein Stripe)', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  it('Bedarfstraeger:in, gueltige Hoehe, kein STRIPE_SECRET_KEY → 422 stripe_nicht_konfiguriert', async () => {
    // env.STRIPE_SECRET_KEY ist in der Test-Umgebung nur Praefix (siehe isStripeConfigured-Heuristik).
    const { isStripeConfigured } = await import('@/lib/stripe/client');
    expect(isStripeConfigured()).toBe(false);

    const userId = await userAnlegen({
      email: 'wb-geld-1@test.werkzirkel.de',
      rollen: ['bedarfstraeger'],
    });
    const sid = await sessionAnlegen(userId);

    const res = await geldbeitragPost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/werkstattbeitrag/geldbeitrag',
        sessionId: sid,
        body: { hoehe_euro_cent: 5000 },
      }),
    );
    expect(res.status).toBe(422);
    const data = (await res.json()) as { error: { code: string } };
    expect(data.error.code).toBe('stripe_nicht_konfiguriert');

    // KEINE Werkstattbeitrag-Row erstellt im Fallback-Pfad.
    const rows = await db
      .select()
      .from(werkstattbeitrag)
      .where(eq(werkstattbeitrag.nutzerId, userId));
    expect(rows.length).toBe(0);
  });

  it('Ungueltige Hoehe (12345) → 422 Validator-Fehler', async () => {
    const userId = await userAnlegen({
      email: 'wb-geld-2@test.werkzirkel.de',
      rollen: ['bedarfstraeger'],
    });
    const sid = await sessionAnlegen(userId);
    const res = await geldbeitragPost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/werkstattbeitrag/geldbeitrag',
        sessionId: sid,
        body: { hoehe_euro_cent: 12345 },
      }),
    );
    expect(res.status).toBe(422);
    const data = (await res.json()) as { fehler: string };
    expect(data.fehler).toBe('validierung');
  });

  it('Ohne bedarfstraeger-Rolle (nur macher) → 403', async () => {
    const userId = await userAnlegen({
      email: 'wb-geld-3@test.werkzirkel.de',
      rollen: ['macher'],
    });
    const sid = await sessionAnlegen(userId);
    const res = await geldbeitragPost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/werkstattbeitrag/geldbeitrag',
        sessionId: sid,
        body: { hoehe_euro_cent: 10000 },
      }),
    );
    expect(res.status).toBe(403);
  });

  it('Ohne Session → 401', async () => {
    const res = await geldbeitragPost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/werkstattbeitrag/geldbeitrag',
        body: { hoehe_euro_cent: 5000 },
      }),
    );
    expect(res.status).toBe(401);
  });
});

describe('handleCheckoutSessionCompleted — Webhook-Business-Logik', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  it('Verifiziert Werkstattbeitrag, schreibt Kasse-Eintrag, sendet T-601', async () => {
    const userId = await userAnlegen({
      email: 'wb-wh-1@test.werkzirkel.de',
      rollen: ['bedarfstraeger'],
    });

    // Simuliere: vorher angelegte Werkstattbeitrag-Row in Status 'erfasst'.
    const beitragId = createId();
    const stripeSessionId = 'cs_test_simulated_' + createId();
    await db.insert(werkstattbeitrag).values({
      id: beitragId,
      nutzerId: userId,
      art: 'geldbeitrag',
      hoeheEuroCent: 5000,
      status: 'erfasst',
      stripeSessionId,
    });

    // Webhook-Payload nachbauen (Stripe-Format).
    const session = {
      id: stripeSessionId,
      object: 'checkout.session',
      amount_total: 5000,
      currency: 'eur',
      metadata: {
        zweck: 'werkstattbeitrag',
        nutzer_id: userId,
        werkstattbeitrag_id: beitragId,
      },
    } as unknown as Parameters<typeof handleCheckoutSessionCompleted>[0];

    await handleCheckoutSessionCompleted(session);

    // Werkstattbeitrag ist verifiziert.
    const beitragRows = await db
      .select()
      .from(werkstattbeitrag)
      .where(eq(werkstattbeitrag.id, beitragId));
    expect(beitragRows[0]?.status).toBe('verifiziert');
    expect(beitragRows[0]?.verifiziertAm).toBeTruthy();
    expect(beitragRows[0]?.gueltigBis).toBeTruthy();
    // Gueltig bis ~ 6 Monate.
    const gueltigDate = beitragRows[0]!.gueltigBis!;
    const monateDiff =
      (gueltigDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30);
    expect(monateDiff).toBeGreaterThan(5);
    expect(monateDiff).toBeLessThan(7);

    // Kasse-Eintrag erstellt mit kategorie='werkstattbeitraege'.
    const kasseRows = await db
      .select()
      .from(werkstattKasseEintrag)
      .where(eq(werkstattKasseEintrag.referenzId, beitragId));
    expect(kasseRows.length).toBe(1);
    expect(kasseRows[0]?.kategorie).toBe('werkstattbeitraege');
    expect(kasseRows[0]?.typ).toBe('eingang');
    expect(kasseRows[0]?.hoeheEuroCent).toBe(5000);

    // T-601 versendet.
    const mailRows = await db
      .select()
      .from(emailBenachrichtigungLog)
      .where(eq(emailBenachrichtigungLog.template, 'T-601'));
    expect(mailRows.length).toBe(1);
    expect(mailRows[0]?.status).toBe('gesendet');
  });

  it('Idempotent: zweimal aufgerufen → nur EIN Kasse-Eintrag, EINE Mail', async () => {
    const userId = await userAnlegen({
      email: 'wb-wh-idem@test.werkzirkel.de',
      rollen: ['bedarfstraeger'],
    });
    const beitragId = createId();
    const stripeSessionId = 'cs_idem_' + createId();
    await db.insert(werkstattbeitrag).values({
      id: beitragId,
      nutzerId: userId,
      art: 'geldbeitrag',
      hoeheEuroCent: 10000,
      status: 'erfasst',
      stripeSessionId,
    });
    const session = {
      id: stripeSessionId,
      object: 'checkout.session',
      amount_total: 10000,
      currency: 'eur',
      metadata: {
        zweck: 'werkstattbeitrag',
        nutzer_id: userId,
        werkstattbeitrag_id: beitragId,
      },
    } as unknown as Parameters<typeof handleCheckoutSessionCompleted>[0];

    await handleCheckoutSessionCompleted(session);
    await handleCheckoutSessionCompleted(session);

    const kasseRows = await db
      .select()
      .from(werkstattKasseEintrag)
      .where(eq(werkstattKasseEintrag.referenzId, beitragId));
    expect(kasseRows.length).toBe(1);

    const mailRows = await db
      .select()
      .from(emailBenachrichtigungLog)
      .where(eq(emailBenachrichtigungLog.template, 'T-601'));
    expect(mailRows.length).toBe(1);
  });

  it('Ignoriert Events ohne metadata.zweck=werkstattbeitrag', async () => {
    const userId = await userAnlegen({
      email: 'wb-wh-other@test.werkzirkel.de',
      rollen: ['bedarfstraeger'],
    });
    const beitragId = createId();
    await db.insert(werkstattbeitrag).values({
      id: beitragId,
      nutzerId: userId,
      art: 'geldbeitrag',
      hoeheEuroCent: 5000,
      status: 'erfasst',
    });

    const session = {
      id: 'cs_other',
      object: 'checkout.session',
      metadata: { zweck: 'andere_sache' },
    } as unknown as Parameters<typeof handleCheckoutSessionCompleted>[0];

    await handleCheckoutSessionCompleted(session);

    const rows = await db
      .select()
      .from(werkstattbeitrag)
      .where(eq(werkstattbeitrag.id, beitragId));
    expect(rows[0]?.status).toBe('erfasst'); // unveraendert
  });
});

describe('GET /api/v1/me/werkstattbeitrag', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  it('Liefert nur eigene Werkstattbeitraege', async () => {
    const userA = await userAnlegen({
      email: 'wb-me-a@test.werkzirkel.de',
      rollen: ['bedarfstraeger'],
    });
    const userB = await userAnlegen({
      email: 'wb-me-b@test.werkzirkel.de',
      rollen: ['bedarfstraeger'],
    });
    await db.insert(werkstattbeitrag).values({
      nutzerId: userA,
      art: 'sachleistung',
      nachweisText: 'Eigener',
      status: 'erfasst',
    });
    await db.insert(werkstattbeitrag).values({
      nutzerId: userB,
      art: 'sachleistung',
      nachweisText: 'Fremder',
      status: 'erfasst',
    });

    const sid = await sessionAnlegen(userA);
    const res = await meWerkstattbeitragGet(
      buildRequest({
        method: 'GET',
        path: '/api/v1/me/werkstattbeitrag',
        sessionId: sid,
      }),
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      werkstattbeitraege: Array<{ nachweis_text: string | null }>;
    };
    expect(data.werkstattbeitraege.length).toBe(1);
    expect(data.werkstattbeitraege[0]?.nachweis_text).toBe('Eigener');
  });

  it('Ohne Session → 401', async () => {
    const res = await meWerkstattbeitragGet(
      buildRequest({
        method: 'GET',
        path: '/api/v1/me/werkstattbeitrag',
      }),
    );
    expect(res.status).toBe(401);
  });
});
