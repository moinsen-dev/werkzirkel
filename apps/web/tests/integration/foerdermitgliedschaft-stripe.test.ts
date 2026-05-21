/**
 * Integration-Tests fuer die Foerdermitgliedschaft (PRD §8.13 + §20):
 *  - POST /api/v1/me/foerdermitgliedschaft/start (Dev-Fallback ohne Stripe)
 *  - POST /api/v1/me/foerdermitgliedschaft/portal (Dev-Fallback ohne Stripe)
 *  - GET /api/v1/me/foerdermitgliedschaft
 *  - Webhook checkout.session.completed (Stufe-Bestaetigung)
 *  - Webhook invoice.payment_succeeded (Kasse-Eintrag + period_end)
 *  - Webhook invoice.payment_failed (status='zahlung_fehlt')
 *  - Webhook customer.subscription.updated (Cancel-at-period-end Sync)
 *  - Webhook customer.subscription.deleted (status='gekuendigt')
 *  - Werk-Limit-Override: aktive Mitgliedschaft → mehr als 5 Werke moeglich
 */

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createId } from '@paralleldrive/cuid2';
import { eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import {
  foerdermitgliedschaft,
  nutzer,
  session as sessionTable,
  werk,
  werkstattKasseEintrag,
} from '@/lib/db/schema';
import { env } from '@/lib/env';
import { buildSessionCookie } from '@/lib/auth/session';
import { pruefeWerkAnlegenLimit, MAX_WERKE_FREI } from '@/lib/werk/limit';

import { GET as foerderMeGet } from '@/app/api/v1/me/foerdermitgliedschaft/route';
import { POST as foerderStartPost } from '@/app/api/v1/me/foerdermitgliedschaft/start/route';
import { POST as foerderPortalPost } from '@/app/api/v1/me/foerdermitgliedschaft/portal/route';
import {
  handleFoerdermitgliedschaftCheckoutCompleted,
  handleInvoicePaymentFailed,
  handleInvoicePaymentSucceeded,
  handleSubscriptionDeleted,
  handleSubscriptionUpdated,
} from '@/lib/stripe/webhook';

import { truncateAll } from '../_helpers/db-cleanup';

const APP_ORIGIN = new URL(env.APP_URL).origin;

async function userAnlegen(email: string): Promise<string> {
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

function buildRequest(opts: {
  method: 'POST' | 'GET';
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

describe('POST /api/v1/me/foerdermitgliedschaft/start — Dev-Fallback (kein Stripe)', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  it('Gueltige Stufe, aber STRIPE_SECRET_KEY fehlt → 422 stripe_nicht_konfiguriert', async () => {
    const { isStripeConfigured } = await import('@/lib/stripe/client');
    expect(isStripeConfigured()).toBe(false);

    const userId = await userAnlegen('foer-1@test.werkzirkel.de');
    const sid = await sessionAnlegen(userId);

    const res = await foerderStartPost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/me/foerdermitgliedschaft/start',
        sessionId: sid,
        body: { stufe: 'monatlich' },
      }),
    );
    expect(res.status).toBe(422);
    const data = (await res.json()) as { error: { code: string } };
    expect(data.error.code).toBe('stripe_nicht_konfiguriert');

    const rows = await db
      .select()
      .from(foerdermitgliedschaft)
      .where(eq(foerdermitgliedschaft.nutzerId, userId));
    expect(rows.length).toBe(0);
  });

  it('Ungueltige Stufe → 422 validierung', async () => {
    const userId = await userAnlegen('foer-2@test.werkzirkel.de');
    const sid = await sessionAnlegen(userId);

    const res = await foerderStartPost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/me/foerdermitgliedschaft/start',
        sessionId: sid,
        body: { stufe: 'gold' },
      }),
    );
    expect(res.status).toBe(422);
    const data = (await res.json()) as { fehler: string };
    expect(data.fehler).toBe('validierung');
  });

  it('Ohne Session → 401', async () => {
    const res = await foerderStartPost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/me/foerdermitgliedschaft/start',
        body: { stufe: 'monatlich' },
      }),
    );
    expect(res.status).toBe(401);
  });

  it('Bereits aktive Mitgliedschaft → 422 bereits_aktiv', async () => {
    const userId = await userAnlegen('foer-3@test.werkzirkel.de');
    const sid = await sessionAnlegen(userId);
    await db.insert(foerdermitgliedschaft).values({
      nutzerId: userId,
      stufe: 'monatlich',
      stripeCustomerId: 'cus_test',
      stripeSubscriptionId: 'sub_test',
      beginn: new Date(),
      status: 'aktiv',
    });

    const res = await foerderStartPost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/me/foerdermitgliedschaft/start',
        sessionId: sid,
        body: { stufe: 'jaehrlich' },
      }),
    );
    expect(res.status).toBe(422);
    const data = (await res.json()) as { error: { code: string } };
    expect(data.error.code).toBe('bereits_aktiv');
  });
});

describe('POST /api/v1/me/foerdermitgliedschaft/portal — Dev-Fallback', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  it('Ohne Mitgliedschaft → 404 keine_mitgliedschaft', async () => {
    const userId = await userAnlegen('foer-p-1@test.werkzirkel.de');
    const sid = await sessionAnlegen(userId);

    const res = await foerderPortalPost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/me/foerdermitgliedschaft/portal',
        sessionId: sid,
      }),
    );
    expect(res.status).toBe(404);
    const data = (await res.json()) as { error: { code: string } };
    expect(data.error.code).toBe('keine_mitgliedschaft');
  });

  it('Ohne Session → 401', async () => {
    const res = await foerderPortalPost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/me/foerdermitgliedschaft/portal',
      }),
    );
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/me/foerdermitgliedschaft', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  it('Ohne Mitgliedschaft → foerdermitgliedschaft=null', async () => {
    const userId = await userAnlegen('foer-g-1@test.werkzirkel.de');
    const sid = await sessionAnlegen(userId);

    const res = await foerderMeGet(
      buildRequest({
        method: 'GET',
        path: '/api/v1/me/foerdermitgliedschaft',
        sessionId: sid,
      }),
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { foerdermitgliedschaft: unknown };
    expect(data.foerdermitgliedschaft).toBeNull();
  });

  it('Mit aktiver Mitgliedschaft → liefert Row', async () => {
    const userId = await userAnlegen('foer-g-2@test.werkzirkel.de');
    const sid = await sessionAnlegen(userId);
    await db.insert(foerdermitgliedschaft).values({
      nutzerId: userId,
      stufe: 'jaehrlich',
      stripeCustomerId: 'cus_g',
      stripeSubscriptionId: 'sub_g',
      beginn: new Date(),
      status: 'aktiv',
    });

    const res = await foerderMeGet(
      buildRequest({
        method: 'GET',
        path: '/api/v1/me/foerdermitgliedschaft',
        sessionId: sid,
      }),
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      foerdermitgliedschaft: { stufe: string; status: string } | null;
    };
    expect(data.foerdermitgliedschaft).not.toBeNull();
    expect(data.foerdermitgliedschaft?.stufe).toBe('jaehrlich');
    expect(data.foerdermitgliedschaft?.status).toBe('aktiv');
  });

  it('Ohne Session → 401', async () => {
    const res = await foerderMeGet(
      buildRequest({
        method: 'GET',
        path: '/api/v1/me/foerdermitgliedschaft',
      }),
    );
    expect(res.status).toBe(401);
  });
});

describe('handleFoerdermitgliedschaftCheckoutCompleted', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  it('Legt foerdermitgliedschaft + setzt nutzer.foerdermitglied_seit', async () => {
    const userId = await userAnlegen('foer-wh-checkout@test.werkzirkel.de');

    const session = {
      id: 'cs_test_' + createId(),
      object: 'checkout.session',
      customer: 'cus_test_x',
      subscription: 'sub_test_x',
      metadata: {
        zweck: 'foerdermitgliedschaft',
        nutzer_id: userId,
        stufe: 'monatlich',
      },
    } as unknown as Parameters<
      typeof handleFoerdermitgliedschaftCheckoutCompleted
    >[0];

    await handleFoerdermitgliedschaftCheckoutCompleted(session);

    const rows = await db
      .select()
      .from(foerdermitgliedschaft)
      .where(eq(foerdermitgliedschaft.nutzerId, userId));
    expect(rows.length).toBe(1);
    expect(rows[0]?.stufe).toBe('monatlich');
    expect(rows[0]?.status).toBe('aktiv');
    expect(rows[0]?.stripeCustomerId).toBe('cus_test_x');
    expect(rows[0]?.stripeSubscriptionId).toBe('sub_test_x');

    const userRows = await db
      .select()
      .from(nutzer)
      .where(eq(nutzer.id, userId));
    expect(userRows[0]?.foerdermitgliedSeit).toBeTruthy();
  });
});

describe('handleInvoicePaymentSucceeded', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  it('Aktualisiert foerdermitglied_bis und schreibt EINEN Kasse-Eintrag', async () => {
    const userId = await userAnlegen('foer-wh-inv-ok@test.werkzirkel.de');
    const subId = 'sub_inv_' + createId();
    await db.insert(foerdermitgliedschaft).values({
      nutzerId: userId,
      stufe: 'jaehrlich',
      stripeCustomerId: 'cus_inv_ok',
      stripeSubscriptionId: subId,
      beginn: new Date(),
      status: 'aktiv',
    });

    const periodEndTs = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
    const invoiceId = 'in_' + createId();
    const invoice = {
      id: invoiceId,
      object: 'invoice',
      amount_paid: 9000,
      amount_due: 9000,
      subscription: subId,
      period_end: periodEndTs,
      lines: { data: [{ period: { end: periodEndTs } }] },
    } as unknown as Parameters<typeof handleInvoicePaymentSucceeded>[0];

    await handleInvoicePaymentSucceeded(invoice);

    const kasseRows = await db
      .select()
      .from(werkstattKasseEintrag)
      .where(eq(werkstattKasseEintrag.referenzId, invoiceId));
    expect(kasseRows.length).toBe(1);
    expect(kasseRows[0]?.kategorie).toBe('foerder_mitgliedsbeitraege');
    expect(kasseRows[0]?.typ).toBe('eingang');
    expect(kasseRows[0]?.hoeheEuroCent).toBe(9000);

    const userRows = await db
      .select()
      .from(nutzer)
      .where(eq(nutzer.id, userId));
    expect(userRows[0]?.foerdermitgliedBis).toBeTruthy();

    // Idempotenz — zweiter Replay erzeugt KEINEN doppelten Kasse-Eintrag.
    await handleInvoicePaymentSucceeded(invoice);
    const kasseRows2 = await db
      .select()
      .from(werkstattKasseEintrag)
      .where(eq(werkstattKasseEintrag.referenzId, invoiceId));
    expect(kasseRows2.length).toBe(1);
  });
});

describe('handleInvoicePaymentFailed', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  it('Setzt status auf zahlung_fehlt', async () => {
    const userId = await userAnlegen('foer-wh-fail@test.werkzirkel.de');
    const subId = 'sub_fail_' + createId();
    await db.insert(foerdermitgliedschaft).values({
      nutzerId: userId,
      stufe: 'monatlich',
      stripeCustomerId: 'cus_fail',
      stripeSubscriptionId: subId,
      beginn: new Date(),
      status: 'aktiv',
    });

    const invoice = {
      id: 'in_fail',
      object: 'invoice',
      amount_paid: 0,
      amount_due: 900,
      subscription: subId,
    } as unknown as Parameters<typeof handleInvoicePaymentFailed>[0];

    await handleInvoicePaymentFailed(invoice);

    const rows = await db
      .select()
      .from(foerdermitgliedschaft)
      .where(eq(foerdermitgliedschaft.stripeSubscriptionId, subId));
    expect(rows[0]?.status).toBe('zahlung_fehlt');
  });
});

describe('handleSubscriptionUpdated', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  it('cancel_at_period_end=true → status=gekuendigt, ende=period_end', async () => {
    const userId = await userAnlegen('foer-wh-upd@test.werkzirkel.de');
    const subId = 'sub_upd_' + createId();
    await db.insert(foerdermitgliedschaft).values({
      nutzerId: userId,
      stufe: 'monatlich',
      stripeCustomerId: 'cus_upd',
      stripeSubscriptionId: subId,
      beginn: new Date(),
      status: 'aktiv',
    });

    const periodEndTs = Math.floor(Date.now() / 1000) + 15 * 24 * 60 * 60;
    const sub = {
      id: subId,
      object: 'subscription',
      cancel_at_period_end: true,
      status: 'active',
      current_period_end: periodEndTs,
      items: { data: [{ current_period_end: periodEndTs }] },
    } as unknown as Parameters<typeof handleSubscriptionUpdated>[0];

    await handleSubscriptionUpdated(sub);

    const rows = await db
      .select()
      .from(foerdermitgliedschaft)
      .where(eq(foerdermitgliedschaft.stripeSubscriptionId, subId));
    expect(rows[0]?.status).toBe('gekuendigt');
    expect(rows[0]?.ende).toBeTruthy();
  });
});

describe('handleSubscriptionDeleted', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  it('Setzt status=gekuendigt, ende=canceled_at', async () => {
    const userId = await userAnlegen('foer-wh-del@test.werkzirkel.de');
    const subId = 'sub_del_' + createId();
    await db.insert(foerdermitgliedschaft).values({
      nutzerId: userId,
      stufe: 'monatlich',
      stripeCustomerId: 'cus_del',
      stripeSubscriptionId: subId,
      beginn: new Date(),
      status: 'aktiv',
    });

    const canceledAtTs = Math.floor(Date.now() / 1000);
    const sub = {
      id: subId,
      object: 'subscription',
      status: 'canceled',
      canceled_at: canceledAtTs,
      current_period_end: canceledAtTs,
      items: { data: [{ current_period_end: canceledAtTs }] },
    } as unknown as Parameters<typeof handleSubscriptionDeleted>[0];

    await handleSubscriptionDeleted(sub);

    const rows = await db
      .select()
      .from(foerdermitgliedschaft)
      .where(eq(foerdermitgliedschaft.stripeSubscriptionId, subId));
    expect(rows[0]?.status).toBe('gekuendigt');
    expect(rows[0]?.ende).toBeTruthy();
  });
});

describe('Werk-Limit-Override durch aktive Foerdermitgliedschaft', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  it('Build anlegen', async () => {
    const userId = await userAnlegen('foer-limit-ok@test.werkzirkel.de');
    for (let i = 1; i <= MAX_WERKE_FREI; i++) {
      await db.insert(werk).values({
        nutzerId: userId,
        name: `Werk ${i}`,
        kurzbeschreibung: `K ${i}`,
        problem: 'P',
        zielgruppe: 'Z',
        werkstand: 'idee',
        hilfebedarf: [],
      });
    }
    await db.insert(foerdermitgliedschaft).values({
      nutzerId: userId,
      stufe: 'monatlich',
      stripeCustomerId: 'cus_limit',
      stripeSubscriptionId: 'sub_limit',
      beginn: new Date(),
      status: 'aktiv',
    });

    const r = await pruefeWerkAnlegenLimit(userId);
    expect(r.erlaubt).toBe(true);
    expect(r.foerdermitgliedAktiv).toBe(true);
  });

  it('Nutzer mit 5 Werken ohne Mitgliedschaft blockiert', async () => {
    const userId = await userAnlegen('foer-limit-block@test.werkzirkel.de');
    for (let i = 1; i <= MAX_WERKE_FREI; i++) {
      await db.insert(werk).values({
        nutzerId: userId,
        name: `Werk ${i}`,
        kurzbeschreibung: `K ${i}`,
        problem: 'P',
        zielgruppe: 'Z',
        werkstand: 'idee',
        hilfebedarf: [],
      });
    }

    const r = await pruefeWerkAnlegenLimit(userId);
    expect(r.erlaubt).toBe(false);
    expect(r.foerdermitgliedAktiv).toBe(false);
  });
});
