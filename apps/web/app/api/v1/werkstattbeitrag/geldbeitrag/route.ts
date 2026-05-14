/**
 * POST /api/v1/werkstattbeitrag/geldbeitrag
 *
 * Werkstattbeitrag-Pfad B: Bedarfstraeger:in zahlt einen Geldbeitrag
 * (50/100/150 EUR) ueber Stripe Checkout. Endpunkt legt eine
 * Werkstattbeitrag-Row mit Status 'erfasst' an und erstellt die
 * Checkout-Session; die endgueltige Verifikation passiert im Webhook
 * (siehe /api/v1/stripe/webhook).
 *
 * - Auth + Bedarfstraeger:innen-Rolle.
 * - Body: { hoehe_euro_cent: 5000 | 10000 | 15000 }.
 * - Dev-Fallback: ohne STRIPE_SECRET_KEY → 422 mit klarem Hinweis statt
 *   Crash. Damit laeuft Werkzirkel lokal auch ohne Stripe-Account.
 *
 * PRD-Referenz: §10.5, §18 (Pfad B).
 */

import { db } from '@/lib/db';
import { werkstattbeitrag } from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';
import { rejectIfBadOrigin } from '@/lib/auth/csrf';
import { istBedarfstraeger } from '@/lib/auth/permissions';
import { werkstattbeitragGeldbeitragSchema } from '@/lib/validators/werkstattbeitrag';
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

  if (!istBedarfstraeger(sess.nutzer)) {
    return Response.json(
      {
        error: {
          code: 'keine_bedarfstraeger_rolle',
          message:
            'Nur Bedarfstraeger:innen koennen einen Werkstattbeitrag leisten. Bitte erst die Rolle in den Einstellungen hinzufuegen.',
        },
      },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ fehler: 'ungueltiger_body' }, { status: 400 });
  }

  const parsed = werkstattbeitragGeldbeitragSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { fehler: 'validierung', details: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }
  const { hoehe_euro_cent } = parsed.data;

  // Dev-Fallback: ohne STRIPE_SECRET_KEY kein Crash, sondern 422 mit
  // Klartext-Hinweis. So bleiben Bedarf-Flows in lokaler Dev-Umgebung
  // bedienbar (Schauabend-Teilnahme + Sachleistung).
  if (!isStripeConfigured()) {
    return Response.json(
      {
        error: {
          code: 'stripe_nicht_konfiguriert',
          message:
            'Stripe ist nicht konfiguriert — bitte Schauabend-Teilnahme oder Sachleistung waehlen.',
        },
      },
      { status: 422 },
    );
  }

  // Werkstattbeitrag-Row als 'erfasst' anlegen — wird durch Webhook auf
  // 'verifiziert' gehoben.
  const inserted = await db
    .insert(werkstattbeitrag)
    .values({
      nutzerId: sess.nutzerId,
      art: 'geldbeitrag',
      hoeheEuroCent: hoehe_euro_cent,
      status: 'erfasst',
    })
    .returning();
  const beitrag = inserted[0];
  if (!beitrag) {
    return Response.json({ fehler: 'unbekannt' }, { status: 500 });
  }

  let checkoutUrl: string;
  let stripeSessionId: string;
  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card', 'klarna', 'sofort', 'sepa_debit', 'paypal'],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'eur',
            product_data: {
              name: 'Werkstattbeitrag Werkzirkel Hamburg',
              description:
                'Beitrag zur Werkstatt — gueltig 6 Monate fuer bis zu 4 Bedarfe.',
            },
            unit_amount: hoehe_euro_cent,
          },
        },
      ],
      customer_email: sess.nutzer.email,
      metadata: {
        zweck: 'werkstattbeitrag',
        nutzer_id: sess.nutzerId,
        werkstattbeitrag_id: beitrag.id,
      },
      success_url: `${APP_URL}/uebersicht/werkstattbeitrag?status=ok&session={CHECKOUT_SESSION_ID}`,
      cancel_url: `${APP_URL}/uebersicht/werkstattbeitrag?status=abgebrochen`,
    });
    if (!session.url) {
      throw new Error('Stripe-Session ohne URL.');
    }
    checkoutUrl = session.url;
    stripeSessionId = session.id;
  } catch (err) {
    // Stripe-Fehler — wir loeschen die angelegte Werkstattbeitrag-Row
    // wieder, damit kein 'erfasst'-Geist zurueckbleibt.
    try {
      const { eq } = await import('drizzle-orm');
      await db.delete(werkstattbeitrag).where(eq(werkstattbeitrag.id, beitrag.id));
    } catch {
      // Cleanup-Fehler schlucken — der eigentliche Fehler ist wichtiger.
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error('[werkstattbeitrag-geldbeitrag] Stripe failed:', message);
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

  // stripe_session_id nachtraeglich speichern (fuer Webhook-Korrelation).
  const { eq } = await import('drizzle-orm');
  await db
    .update(werkstattbeitrag)
    .set({ stripeSessionId })
    .where(eq(werkstattbeitrag.id, beitrag.id));

  return Response.json(
    {
      checkoutUrl,
      werkstattbeitrag_id: beitrag.id,
    },
    { status: 201 },
  );
}
