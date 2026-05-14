/**
 * POST /api/v1/stripe/webhook
 *
 * Stripe-Webhook-Endpoint. Verifiziert die Signatur via
 * `STRIPE_WEBHOOK_SECRET` und delegiert behandelte Event-Types an die
 * jeweiligen Handler.
 *
 * Behandelt:
 *  - `checkout.session.completed` mit metadata.zweck='werkstattbeitrag'
 *    → siehe `lib/stripe/webhook.ts#handleCheckoutSessionCompleted`.
 *
 * Andere Events werden mit 200 quittiert, damit Stripe keine Retries
 * triggert.
 *
 * WICHTIG: dieser Route-Handler MUSS den Raw-Body verarbeiten, NICHT
 * `req.json()` aufrufen — die Signaturpruefung haengt am unveraenderten
 * Bytestream.
 *
 * PRD-Referenz: §10.5, §18 (Pfad B Webhook-Verifikation).
 */

import { getStripe, isStripeConfigured } from '@/lib/stripe/client';
import {
  handleCheckoutSessionCompleted,
  handleInvoicePaymentFailed,
  handleInvoicePaymentSucceeded,
  handleSubscriptionDeleted,
  handleSubscriptionUpdated,
} from '@/lib/stripe/webhook';
import { env } from '@/lib/env';

export async function POST(req: Request): Promise<Response> {
  if (!isStripeConfigured() || !env.STRIPE_WEBHOOK_SECRET) {
    return Response.json(
      { error: { code: 'stripe_nicht_konfiguriert' } },
      { status: 422 },
    );
  }

  const sig = req.headers.get('stripe-signature');
  if (!sig) {
    return Response.json({ error: { code: 'fehlende_signatur' } }, { status: 400 });
  }

  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return Response.json({ error: { code: 'ungueltiger_body' } }, { status: 400 });
  }

  const stripe = getStripe();
  let event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn('[stripe-webhook] Signatur-Verifikation fehlgeschlagen:', message);
    return Response.json(
      { error: { code: 'signatur_ungueltig', message } },
      { status: 400 },
    );
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        await handleCheckoutSessionCompleted(event.data.object);
        break;
      }
      case 'customer.subscription.updated': {
        await handleSubscriptionUpdated(event.data.object);
        break;
      }
      case 'customer.subscription.deleted': {
        await handleSubscriptionDeleted(event.data.object);
        break;
      }
      case 'invoice.payment_succeeded': {
        await handleInvoicePaymentSucceeded(event.data.object);
        break;
      }
      case 'invoice.payment_failed': {
        await handleInvoicePaymentFailed(event.data.object);
        break;
      }
      default:
        // Andere Events: stillschweigend OK quittieren.
        break;
    }
  } catch (err) {
    console.error(
      '[stripe-webhook] Handler-Fehler fuer event',
      event.type,
      err,
    );
    // Immer 200, damit Stripe nicht endlos retried.
  }

  return Response.json({ received: true });
}
