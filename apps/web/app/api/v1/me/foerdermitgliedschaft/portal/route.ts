/**
 * POST /api/v1/me/foerdermitgliedschaft/portal
 *
 * Erstellt einen Stripe-Customer-Portal-Link fuer die Verwaltung der
 * Foerdermitgliedschaft (Kuendigung, Zahlungsmittel, Rechnungen). Erfordert
 * eine bestehende foerdermitgliedschaft-Row mit `stripe_customer_id`.
 *
 * Vorbedingungen:
 *  - Auth (Cookie-Session).
 *  - Origin-Check (CSRF).
 *  - Foerdermitgliedschaft-Row existiert mit stripe_customer_id.
 *  - Stripe konfiguriert.
 *
 * Antwort: `{ portalUrl }`.
 *
 * PRD-Referenz: §8.13 (Foerdermitgliedschaft), §20.
 */

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { foerdermitgliedschaft } from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';
import { rejectIfBadOrigin } from '@/lib/auth/csrf';
import { getStripe, isStripeConfigured } from '@/lib/stripe/client';
import { env } from '@/lib/env';

const APP_URL = env.APP_URL.replace(/\/+$/, '');

export async function POST(req: Request): Promise<Response> {
  const originResp = rejectIfBadOrigin(req);
  if (originResp) return originResp;

  const sess = await getSessionFromRequest(req);
  if (!sess) {
    return Response.json({ fehler: 'unauthenticated' }, { status: 401 });
  }

  const rows = await db
    .select({
      stripeCustomerId: foerdermitgliedschaft.stripeCustomerId,
    })
    .from(foerdermitgliedschaft)
    .where(eq(foerdermitgliedschaft.nutzerId, sess.nutzerId))
    .limit(1);
  const row = rows[0];

  if (!row?.stripeCustomerId) {
    return Response.json(
      {
        error: {
          code: 'keine_mitgliedschaft',
          message:
            'Es existiert noch keine Foerdermitgliedschaft fuer dein Konto.',
        },
      },
      { status: 404 },
    );
  }

  if (!isStripeConfigured()) {
    return Response.json(
      {
        error: {
          code: 'stripe_nicht_konfiguriert',
          message: 'Stripe ist nicht konfiguriert.',
        },
      },
      { status: 422 },
    );
  }

  let portalUrl: string;
  try {
    const stripe = getStripe();
    const portal = await stripe.billingPortal.sessions.create({
      customer: row.stripeCustomerId,
      return_url: `${APP_URL}/einstellungen?tab=foerdermitgliedschaft`,
    });
    portalUrl = portal.url;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[foerdermitgliedschaft-portal] Stripe failed:', message);
    return Response.json(
      {
        error: {
          code: 'stripe_fehler',
          message: 'Customer-Portal-Link konnte nicht erstellt werden.',
        },
      },
      { status: 502 },
    );
  }

  return Response.json({ portalUrl }, { status: 200 });
}
