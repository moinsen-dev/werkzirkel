/**
 * Integration-Tests fuer den Erfolgsbeitrag-Flow:
 *   POST /api/v1/bedarfe/:id/erfolgsbeitrag (Dev-Fallback ohne Stripe)
 *   handleCheckoutSessionCompleted mit metadata.zweck='erfolgsbeitrag'
 *
 * Deckt PRD §10.10 (Erfolgsbeitrag freiwillig) und §21 (Erfolgsbeitrag-Flow).
 */

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createId } from '@paralleldrive/cuid2';
import { eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import {
  bedarf,
  erfolgsbeitrag,
  nutzer,
  session as sessionTable,
  werkstattKasseEintrag,
} from '@/lib/db/schema';
import { env } from '@/lib/env';
import { buildSessionCookie } from '@/lib/auth/session';

import { POST as erfolgsbeitragPost } from '@/app/api/v1/bedarfe/[id]/erfolgsbeitrag/route';
import { handleCheckoutSessionCompleted } from '@/lib/stripe/webhook';

import { truncateAll } from '../_helpers/db-cleanup';

const APP_ORIGIN = new URL(env.APP_URL).origin;

type Rolle = 'macher' | 'bedarfstraeger' | 'foerderer' | 'kurator' | 'admin';

async function userAnlegen(opts: {
  email: string;
  rollen?: Rolle[];
}): Promise<string> {
  const id = createId();
  await db.insert(nutzer).values({
    id,
    email: opts.email,
    klarname: `Klar ${opts.email}`,
    anzeigename: `anz-${id.slice(0, 6)}`,
    stadtId: 'hh',
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

async function bedarfAnlegen(opts: {
  nutzerId: string;
  status: 'oeffentlich' | 'erfuellt';
}): Promise<string> {
  const id = createId();
  await db.insert(bedarf).values({
    id,
    nutzerId: opts.nutzerId,
    organisation: 'Org GmbH',
    titel: 'Beispielbedarf',
    problem: 'Beispielproblem 1234',
    nutzen: 'Beispielnutzen 5678',
    stadtId: 'hh',
    frist: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    status: opts.status,
  });
  return id;
}

function buildRequest(opts: {
  method: 'POST';
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

describe('POST /api/v1/bedarfe/:id/erfolgsbeitrag — Dev-Fallback (kein Stripe)', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  it('Bedarf erfuellt + gueltige Hoehe, aber STRIPE_SECRET_KEY fehlt → 422 stripe_nicht_konfiguriert, KEINE erfolgsbeitrag-Row', async () => {
    const { isStripeConfigured } = await import('@/lib/stripe/client');
    expect(isStripeConfigured()).toBe(false);

    const userId = await userAnlegen({
      email: 'erf-1@test.werkzirkel.de',
    });
    const sid = await sessionAnlegen(userId);
    const bedarfId = await bedarfAnlegen({ nutzerId: userId, status: 'erfuellt' });

    const res = await erfolgsbeitragPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/bedarfe/${bedarfId}/erfolgsbeitrag`,
        sessionId: sid,
        body: { hoehe_euro_cent: 5000, prozent_satz: 5 },
      }),
      { params: Promise.resolve({ id: bedarfId }) },
    );
    expect(res.status).toBe(422);
    const data = (await res.json()) as { error: { code: string } };
    expect(data.error.code).toBe('stripe_nicht_konfiguriert');

    const rows = await db
      .select()
      .from(erfolgsbeitrag)
      .where(eq(erfolgsbeitrag.bedarfId, bedarfId));
    expect(rows.length).toBe(0);
  });

  it('Bedarf NICHT erfuellt (status oeffentlich) → 422 falscher_status', async () => {
    const userId = await userAnlegen({
      email: 'erf-2@test.werkzirkel.de',
    });
    const sid = await sessionAnlegen(userId);
    const bedarfId = await bedarfAnlegen({
      nutzerId: userId,
      status: 'oeffentlich',
    });

    const res = await erfolgsbeitragPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/bedarfe/${bedarfId}/erfolgsbeitrag`,
        sessionId: sid,
        body: { hoehe_euro_cent: 5000 },
      }),
      { params: Promise.resolve({ id: bedarfId }) },
    );
    expect(res.status).toBe(422);
    const data = (await res.json()) as { error: { code: string } };
    expect(data.error.code).toBe('falscher_status');
  });

  it('Fremder Bedarf (nicht Owner) → 403', async () => {
    const ownerId = await userAnlegen({
      email: 'erf-owner@test.werkzirkel.de',
    });
    const otherId = await userAnlegen({
      email: 'erf-other@test.werkzirkel.de',
    });
    const sid = await sessionAnlegen(otherId);
    const bedarfId = await bedarfAnlegen({ nutzerId: ownerId, status: 'erfuellt' });

    const res = await erfolgsbeitragPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/bedarfe/${bedarfId}/erfolgsbeitrag`,
        sessionId: sid,
        body: { hoehe_euro_cent: 5000 },
      }),
      { params: Promise.resolve({ id: bedarfId }) },
    );
    expect(res.status).toBe(403);
  });

  it('Ungueltige Hoehe (50 Cent) → 422 Validator-Fehler', async () => {
    const userId = await userAnlegen({
      email: 'erf-v@test.werkzirkel.de',
    });
    const sid = await sessionAnlegen(userId);
    const bedarfId = await bedarfAnlegen({ nutzerId: userId, status: 'erfuellt' });

    const res = await erfolgsbeitragPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/bedarfe/${bedarfId}/erfolgsbeitrag`,
        sessionId: sid,
        body: { hoehe_euro_cent: 50 },
      }),
      { params: Promise.resolve({ id: bedarfId }) },
    );
    expect(res.status).toBe(422);
    const data = (await res.json()) as { fehler: string };
    expect(data.fehler).toBe('validierung');
  });

  it('Ohne Session → 401', async () => {
    const bedarfId = createId();
    const res = await erfolgsbeitragPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/bedarfe/${bedarfId}/erfolgsbeitrag`,
        body: { hoehe_euro_cent: 5000 },
      }),
      { params: Promise.resolve({ id: bedarfId }) },
    );
    expect(res.status).toBe(401);
  });
});

describe('handleCheckoutSessionCompleted — Erfolgsbeitrag-Webhook', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  it('Setzt status=bezahlt + schreibt EINEN Kasse-Eintrag mit kategorie=erfolgsbeitraege', async () => {
    const userId = await userAnlegen({
      email: 'erf-wh-1@test.werkzirkel.de',
    });
    const bedarfId = await bedarfAnlegen({ nutzerId: userId, status: 'erfuellt' });

    const stripeSessionId = 'cs_erf_' + createId();
    const inserted = await db
      .insert(erfolgsbeitrag)
      .values({
        bedarfId,
        zahlerNutzerId: userId,
        hoeheEuroCent: 5000,
        prozentSatz: '5.00',
        stripeSessionId,
        status: 'initiiert',
      })
      .returning();
    const beitragId = inserted[0]!.id;

    const session = {
      id: stripeSessionId,
      object: 'checkout.session',
      amount_total: 5000,
      currency: 'eur',
      metadata: {
        zweck: 'erfolgsbeitrag',
        nutzer_id: userId,
        bedarf_id: bedarfId,
      },
    } as unknown as Parameters<typeof handleCheckoutSessionCompleted>[0];

    await handleCheckoutSessionCompleted(session);

    const updated = await db
      .select()
      .from(erfolgsbeitrag)
      .where(eq(erfolgsbeitrag.id, beitragId));
    expect(updated[0]?.status).toBe('bezahlt');
    expect(updated[0]?.gezahltAm).toBeTruthy();

    const kasseRows = await db
      .select()
      .from(werkstattKasseEintrag)
      .where(eq(werkstattKasseEintrag.referenzId, beitragId));
    expect(kasseRows.length).toBe(1);
    expect(kasseRows[0]?.kategorie).toBe('erfolgsbeitraege');
    expect(kasseRows[0]?.typ).toBe('eingang');
    expect(kasseRows[0]?.hoeheEuroCent).toBe(5000);
    expect(kasseRows[0]?.stadtId).toBe('hh');
  });

  it('Idempotent: zweiter Replay → KEIN doppelter Kasse-Eintrag', async () => {
    const userId = await userAnlegen({
      email: 'erf-wh-idem@test.werkzirkel.de',
    });
    const bedarfId = await bedarfAnlegen({ nutzerId: userId, status: 'erfuellt' });

    const stripeSessionId = 'cs_erf_idem_' + createId();
    const inserted = await db
      .insert(erfolgsbeitrag)
      .values({
        bedarfId,
        zahlerNutzerId: userId,
        hoeheEuroCent: 10000,
        stripeSessionId,
        status: 'initiiert',
      })
      .returning();
    const beitragId = inserted[0]!.id;

    const session = {
      id: stripeSessionId,
      object: 'checkout.session',
      amount_total: 10000,
      currency: 'eur',
      metadata: {
        zweck: 'erfolgsbeitrag',
        nutzer_id: userId,
        bedarf_id: bedarfId,
      },
    } as unknown as Parameters<typeof handleCheckoutSessionCompleted>[0];

    await handleCheckoutSessionCompleted(session);
    await handleCheckoutSessionCompleted(session);

    const kasseRows = await db
      .select()
      .from(werkstattKasseEintrag)
      .where(eq(werkstattKasseEintrag.referenzId, beitragId));
    expect(kasseRows.length).toBe(1);

    const updated = await db
      .select()
      .from(erfolgsbeitrag)
      .where(eq(erfolgsbeitrag.id, beitragId));
    expect(updated[0]?.status).toBe('bezahlt');
  });

  it('Ignoriert Sessions ohne passende erfolgsbeitrag-Row (kein Crash)', async () => {
    const session = {
      id: 'cs_unbekannt',
      object: 'checkout.session',
      amount_total: 5000,
      metadata: { zweck: 'erfolgsbeitrag', bedarf_id: 'foo', nutzer_id: 'bar' },
    } as unknown as Parameters<typeof handleCheckoutSessionCompleted>[0];

    await expect(handleCheckoutSessionCompleted(session)).resolves.toBeUndefined();

    const rows = await db.select().from(werkstattKasseEintrag);
    expect(rows.length).toBe(0);
  });
});
