/**
 * POST /api/v1/bedarfe/:id/erfolgsbeitrag
 *
 * Erzeugt einen Stripe-Checkout fuer eine FREIWILLIGE Spende der
 * Bedarfstraeger:in an die Community-Pool, nachdem ein Bedarf als
 * erfuellt markiert wurde. KEINE Provision auf Vermittlungen — Werkzirkel
 * stellt nichts in Rechnung; der Beitrag ist eine Spende.
 *
 * Vorbedingungen:
 *  - Auth + Owner des Bedarfs.
 *  - Bedarf hat Status `erfuellt`, sonst 422 (`falscher_status`).
 *
 * Effekt:
 *  - INSERT erfolgsbeitrag (status='initiiert').
 *  - Stripe Checkout Session mit metadata.zweck='erfolgsbeitrag',
 *    bedarf_id, nutzer_id, erfolgsbeitrag_id.
 *  - Antwort: `{ checkoutUrl, erfolgsbeitrag_id }`.
 *
 * Dev-Fallback: wenn STRIPE_SECRET_KEY nicht plausibel gesetzt ist, gibt
 * der Endpoint 422 `stripe_nicht_konfiguriert` zurueck und legt KEINE
 * erfolgsbeitrag-Row an. Das haelt die lokale Dev-Umgebung lauffaehig
 * ohne Stripe-Konto.
 *
 * PRD-Referenz: §10.10 (Erfolgsbeitrag freiwillig), §21 (Erfolgsbeitrag-Flow).
 */

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { auditLog, bedarf, erfolgsbeitrag } from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';
import { rejectIfBadOrigin } from '@/lib/auth/csrf';
import { erfolgsbeitragSchema } from '@/lib/validators/erfolgsbeitrag';
import { getStripe, isStripeConfigured } from '@/lib/stripe/client';
import { env } from '@/lib/env';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const APP_URL = env.APP_URL.replace(/\/+$/, '');

export async function POST(req: Request, ctx: RouteContext): Promise<Response> {
  const originResp = rejectIfBadOrigin(req);
  if (originResp) return originResp;

  const sess = await getSessionFromRequest(req);
  if (!sess) {
    return Response.json({ fehler: 'unauthenticated' }, { status: 401 });
  }

  const { id } = await ctx.params;

  const rows = await db.select().from(bedarf).where(eq(bedarf.id, id)).limit(1);
  const row = rows[0];
  if (!row) {
    return Response.json({ fehler: 'nicht_gefunden' }, { status: 404 });
  }

  if (row.nutzerId !== sess.nutzerId) {
    return Response.json(
      {
        error: {
          code: 'kein_zugriff',
          message:
            'Nur die Bedarfstraeger:in dieses Bedarfs kann einen Erfolgsbeitrag leisten.',
        },
      },
      { status: 403 },
    );
  }

  if (row.status !== 'erfuellt') {
    return Response.json(
      {
        error: {
          code: 'falscher_status',
          message:
            'Der Erfolgsbeitrag ist nur nach Erfuellt-Markierung des Bedarfs moeglich.',
        },
      },
      { status: 422 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ fehler: 'ungueltiger_body' }, { status: 400 });
  }

  const parsed = erfolgsbeitragSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { fehler: 'validierung', details: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }
  const { hoehe_euro_cent, prozent_satz } = parsed.data;

  // Dev-Fallback: ohne Stripe-Konfiguration KEINE DB-Row anlegen, damit
  // wir keine 'initiiert'-Geister sammeln.
  if (!isStripeConfigured()) {
    return Response.json(
      {
        error: {
          code: 'stripe_nicht_konfiguriert',
          message:
            'Stripe ist nicht konfiguriert — der Erfolgsbeitrag steht in der lokalen Dev-Umgebung nicht zur Verfuegung.',
        },
      },
      { status: 422 },
    );
  }

  // Stripe-Session zuerst erstellen, damit wir die stripe_session_id direkt
  // in die erfolgsbeitrag-Row schreiben koennen (NOT NULL).
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
              name: 'Erfolgsbeitrag Community-Pool',
              description:
                'Freiwillige Spende an die Community-Pool Hamburg. Keine Provision — Werkzirkel vermittelt nicht.',
            },
            unit_amount: hoehe_euro_cent,
          },
        },
      ],
      customer_email: sess.nutzer.email,
      metadata: {
        zweck: 'erfolgsbeitrag',
        nutzer_id: sess.nutzerId,
        bedarf_id: row.id,
      },
      success_url: `${APP_URL}/bedarfe/${row.id}?erfolg=erfolgsbeitrag_bezahlt`,
      cancel_url: `${APP_URL}/bedarfe/${row.id}?fehler=erfolgsbeitrag_abgebrochen`,
    });
    if (!session.url) {
      throw new Error('Stripe-Session ohne URL.');
    }
    checkoutUrl = session.url;
    stripeSessionId = session.id;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[erfolgsbeitrag] Stripe failed:', message);
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

  // Erfolgsbeitrag-Row anlegen — Status 'initiiert', wird durch Webhook
  // auf 'bezahlt' gehoben.
  const inserted = await db
    .insert(erfolgsbeitrag)
    .values({
      bedarfId: row.id,
      zahlerNutzerId: sess.nutzerId,
      hoeheEuroCent: hoehe_euro_cent,
      prozentSatz:
        prozent_satz !== undefined ? prozent_satz.toFixed(2) : null,
      stripeSessionId,
      status: 'initiiert',
    })
    .returning();
  const beitrag = inserted[0];
  if (!beitrag) {
    return Response.json({ fehler: 'unbekannt' }, { status: 500 });
  }

  // Stripe-Session-ID jetzt nachtraeglich um die zusaetzliche
  // erfolgsbeitrag_id in den Metadaten zu erweitern — nicht zwingend, aber
  // hilft Operations beim Korrelieren.
  // (Wir bauen die metadata bewusst NICHT um, der Webhook arbeitet ueber
  //  stripe_session_id-Lookup.)

  try {
    await db.insert(auditLog).values({
      nutzerId: sess.nutzerId,
      aktion: 'erfolgsbeitrag.initiiert',
      referenzTyp: 'erfolgsbeitrag',
      referenzId: beitrag.id,
      metadaten: {
        bedarf_id: row.id,
        hoehe_euro_cent,
        stripe_session_id: stripeSessionId,
      },
    });
  } catch {
    // Audit-Failure darf den Erfolg nicht blockieren.
  }

  return Response.json(
    {
      checkoutUrl,
      erfolgsbeitrag_id: beitrag.id,
    },
    { status: 201 },
  );
}
