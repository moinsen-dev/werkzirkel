/**
 * POST /api/v1/me/foerdermitgliedschaft/start
 *
 * Startet eine Foerdermitgliedschaft als Stripe-Subscription. Body:
 *   { stufe: 'monatlich' | 'jaehrlich' | 'foerderer_privat' | 'foerderer_organisation' }
 *
 * Vorbedingungen:
 *  - Auth (Cookie-Session).
 *  - Origin-Check (CSRF).
 *  - Body validiert per Zod (foerdermitgliedschaftStartSchema).
 *  - Keine aktive Mitgliedschaft (sonst 422 — Update geht via Stripe-Customer-
 *    Portal, siehe `/portal`-Endpoint).
 *
 * Effekt:
 *  - Stripe Checkout Session (mode='subscription') mit price aus
 *    env.STRIPE_PRICE_<stufe>. Metadata.zweck='foerdermitgliedschaft', nutzer_id,
 *    stufe.
 *  - Antwort: `{ checkoutUrl }`.
 *
 * Die foerdermitgliedschaft-Row wird ERST im Webhook
 * (checkout.session.completed) angelegt — die stripe_customer_id und
 * stripe_subscription_id stehen vor dem Checkout-Abschluss noch nicht fest.
 *
 * Dev-Fallback: ohne STRIPE_SECRET_KEY oder ohne hinterlegte Price-ID gibt
 * der Endpoint 422 mit klarem Hinweis zurueck statt zu crashen.
 *
 * PRD-Referenz: §8.13 (Stufen) + §20 (Modell v1 + Foerder-Mitgliedschaft).
 */

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { auditLog, foerdermitgliedschaft } from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';
import { rejectIfBadOrigin } from '@/lib/auth/csrf';
import { foerdermitgliedschaftStartSchema } from '@/lib/validators/foerdermitgliedschaft';
import { getStripe, isStripeConfigured } from '@/lib/stripe/client';
import { priceIdForStufe } from '@/lib/foerdermitgliedschaft/stufen';
import { env } from '@/lib/env';

const APP_URL = env.APP_URL.replace(/\/+$/, '');

export async function POST(req: Request): Promise<Response> {
  const originResp = rejectIfBadOrigin(req);
  if (originResp) return originResp;

  const sess = await getSessionFromRequest(req);
  if (!sess) {
    return Response.json({ fehler: 'unauthenticated' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ fehler: 'ungueltiger_body' }, { status: 400 });
  }

  const parsed = foerdermitgliedschaftStartSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { fehler: 'validierung', details: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }
  const { stufe } = parsed.data;

  // Aktive Mitgliedschaft? Dann KEINE zweite Subscription starten.
  const bestehend = await db
    .select({ id: foerdermitgliedschaft.id, status: foerdermitgliedschaft.status })
    .from(foerdermitgliedschaft)
    .where(eq(foerdermitgliedschaft.nutzerId, sess.nutzerId))
    .limit(1);
  if (bestehend[0]?.status === 'aktiv') {
    return Response.json(
      {
        error: {
          code: 'bereits_aktiv',
          message:
            'Du hast bereits eine aktive Foerdermitgliedschaft. Aenderungen verwaltest du ueber das Stripe-Customer-Portal.',
        },
      },
      { status: 422 },
    );
  }

  // Dev-Fallback: ohne Stripe-Konfiguration KEIN Crash, 422 mit Hinweis.
  if (!isStripeConfigured()) {
    return Response.json(
      {
        error: {
          code: 'stripe_nicht_konfiguriert',
          message:
            'Stripe ist nicht konfiguriert — die Foerdermitgliedschaft steht in der lokalen Dev-Umgebung nicht zur Verfuegung.',
        },
      },
      { status: 422 },
    );
  }

  const priceId = priceIdForStufe(stufe);
  if (!priceId) {
    return Response.json(
      {
        error: {
          code: 'preis_id_fehlt',
          message: `Fuer die Stufe '${stufe}' ist keine Stripe-Price-ID konfiguriert.`,
        },
      },
      { status: 422 },
    );
  }

  let checkoutUrl: string;
  let stripeSessionId: string;
  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card', 'sepa_debit', 'paypal'],
      line_items: [{ quantity: 1, price: priceId }],
      customer_email: sess.nutzer.email,
      metadata: {
        zweck: 'foerdermitgliedschaft',
        nutzer_id: sess.nutzerId,
        stufe,
      },
      subscription_data: {
        metadata: {
          zweck: 'foerdermitgliedschaft',
          nutzer_id: sess.nutzerId,
          stufe,
        },
      },
      success_url: `${APP_URL}/einstellungen?tab=foerdermitgliedschaft&ok=foerdermitgliedschaft_aktiv`,
      cancel_url: `${APP_URL}/einstellungen?tab=foerdermitgliedschaft&fehler=foerdermitgliedschaft_abgebrochen`,
    });
    if (!session.url) {
      throw new Error('Stripe-Session ohne URL.');
    }
    checkoutUrl = session.url;
    stripeSessionId = session.id;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[foerdermitgliedschaft-start] Stripe failed:', message);
    return Response.json(
      {
        error: {
          code: 'stripe_fehler',
          message: 'Stripe-Checkout konnte nicht erstellt werden.',
        },
      },
      { status: 502 },
    );
  }

  try {
    await db.insert(auditLog).values({
      nutzerId: sess.nutzerId,
      aktion: 'foerdermitgliedschaft.initiiert',
      referenzTyp: 'foerdermitgliedschaft',
      referenzId: null,
      metadaten: {
        stufe,
        stripe_session_id: stripeSessionId,
      },
    });
  } catch {
    // Audit-Failure darf den Erfolg nicht blockieren.
  }

  return Response.json({ checkoutUrl }, { status: 201 });
}
