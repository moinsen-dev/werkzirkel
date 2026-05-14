/**
 * Stripe-Webhook-Handler fuer alle Spendenzwecke der Werkstatt-Kasse.
 *
 * Wird vom /api/v1/stripe/webhook-Route nach Signatur-Verifikation
 * aufgerufen. Verteilt `checkout.session.completed` anhand der
 * `metadata.zweck`-Markierung an den jeweiligen Sub-Handler:
 *
 *  - `werkstattbeitrag` → Werkstattbeitrag-Pfad B (Geldbeitrag).
 *  - `erfolgsbeitrag`   → Freiwillige Spende bei Bedarf-Erfuellung.
 *
 * Beide Sub-Handler sind idempotent: wenn die zugehoerige Row bereits
 * im Endzustand ist (`verifiziert` bzw. `bezahlt`), wird kein zweites
 * Mal geschrieben — Stripe kann Events mehrfach senden, und auch ein
 * manueller Replay darf keinen doppelten Kasse-Eintrag erzeugen.
 *
 * PRD-Referenz: §10.5, §10.10, §18 (Pfad B), §21 (Erfolgsbeitrag), §11 (Kasse).
 */

import type Stripe from 'stripe';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  auditLog,
  bedarf,
  erfolgsbeitrag,
  foerdermitgliedschaft,
  nutzer,
  werkstattbeitrag,
  werkstattKasseEintrag,
} from '@/lib/db/schema';
import type { FoermitglStufe } from '@/lib/db/schema/enums';
import { sendMail } from '@/lib/email/send';
import { env } from '@/lib/env';
import { quartalOf } from '@/lib/kasse/quartal';

const APP_URL = env.APP_URL.replace(/\/+$/, '');
const GUELTIGKEIT_MONATE = 6;

export async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session,
): Promise<void> {
  const meta = session.metadata ?? {};
  if (meta.zweck === 'werkstattbeitrag') {
    await handleWerkstattbeitrag(session);
    return;
  }
  if (meta.zweck === 'erfolgsbeitrag') {
    await handleErfolgsbeitrag(session);
    return;
  }
  if (meta.zweck === 'foerdermitgliedschaft') {
    await handleFoerdermitgliedschaftCheckoutCompleted(session);
    return;
  }
}

async function handleWerkstattbeitrag(
  session: Stripe.Checkout.Session,
): Promise<void> {
  const meta = session.metadata ?? {};

  // Bevorzugt: explizite Beitrag-ID aus metadata. Fallback: session-id-Lookup.
  let beitragRow:
    | { id: string; nutzerId: string; status: string; hoeheEuroCent: number | null }
    | undefined;

  if (typeof meta.werkstattbeitrag_id === 'string' && meta.werkstattbeitrag_id) {
    const rows = await db
      .select({
        id: werkstattbeitrag.id,
        nutzerId: werkstattbeitrag.nutzerId,
        status: werkstattbeitrag.status,
        hoeheEuroCent: werkstattbeitrag.hoeheEuroCent,
      })
      .from(werkstattbeitrag)
      .where(eq(werkstattbeitrag.id, meta.werkstattbeitrag_id))
      .limit(1);
    beitragRow = rows[0];
  }
  if (!beitragRow) {
    const rows = await db
      .select({
        id: werkstattbeitrag.id,
        nutzerId: werkstattbeitrag.nutzerId,
        status: werkstattbeitrag.status,
        hoeheEuroCent: werkstattbeitrag.hoeheEuroCent,
      })
      .from(werkstattbeitrag)
      .where(eq(werkstattbeitrag.stripeSessionId, session.id))
      .limit(1);
    beitragRow = rows[0];
  }

  if (!beitragRow) {
    console.warn(
      '[stripe-webhook] Werkstattbeitrag fuer Stripe-Session nicht gefunden:',
      session.id,
    );
    return;
  }

  // Idempotenz: bereits verifiziert → kein Re-Run.
  if (beitragRow.status === 'verifiziert') return;

  const jetzt = new Date();
  const gueltigBis = new Date(
    jetzt.getTime() + GUELTIGKEIT_MONATE * 30 * 24 * 60 * 60 * 1000,
  );

  await db
    .update(werkstattbeitrag)
    .set({
      status: 'verifiziert',
      verifiziertAm: jetzt,
      gueltigBis,
      stripeSessionId: session.id,
    })
    .where(eq(werkstattbeitrag.id, beitragRow.id));

  // Owner laden fuer Kasse-Eintrag (stadt_id) und Mail.
  const ownerRows = await db
    .select({
      id: nutzer.id,
      email: nutzer.email,
      anzeigename: nutzer.anzeigename,
      stadtId: nutzer.stadtId,
    })
    .from(nutzer)
    .where(eq(nutzer.id, beitragRow.nutzerId))
    .limit(1);
  const owner = ownerRows[0];

  // Hoehe aus DB-Row oder aus session.amount_total fallbacken.
  const hoeheEuroCent =
    beitragRow.hoeheEuroCent ?? session.amount_total ?? 0;

  if (owner) {
    try {
      await db.insert(werkstattKasseEintrag).values({
        stadtId: owner.stadtId,
        typ: 'eingang',
        kategorie: 'werkstattbeitraege',
        hoeheEuroCent,
        beschreibung: `Werkstattbeitrag (Stripe) von ${owner.anzeigename}`,
        referenzTyp: 'werkstattbeitrag',
        referenzId: beitragRow.id,
        datum: jetzt.toISOString().slice(0, 10),
        quartal: quartalOf(jetzt),
        erfasstDurch: owner.id,
        // Stripe-Zahlung = Trust-Signal → automatisch freigegeben.
        freigegebenAm: jetzt,
      });
    } catch (err) {
      console.error('[stripe-webhook] Kasse-Eintrag fehlgeschlagen:', err);
    }

    try {
      const hoeheEuro = (hoeheEuroCent / 100).toFixed(0);
      await sendMail({
        to: owner.email,
        nutzerId: owner.id,
        template: 'T-601',
        props: {
          anzeigename: owner.anzeigename,
          hoeheEuro,
          gueltigBis: gueltigBis.toISOString().slice(0, 10),
          uebersichtUrl: `${APP_URL}/uebersicht/werkstattbeitrag`,
        },
      });
    } catch (err) {
      console.error('[stripe-webhook] sendMail T-601 fehlgeschlagen:', err);
    }
  }

  try {
    await db.insert(auditLog).values({
      nutzerId: beitragRow.nutzerId,
      aktion: 'werkstattbeitrag.geldbeitrag.bezahlt',
      referenzTyp: 'werkstattbeitrag',
      referenzId: beitragRow.id,
      metadaten: {
        stripe_session_id: session.id,
        hoehe_euro_cent: hoeheEuroCent,
      },
    });
  } catch {
    // Audit-Failure schluckt den Erfolg.
  }
}

/**
 * Sub-Handler fuer den Erfolgsbeitrag (freiwillige Spende bei Bedarf-
 * Erfuellung). Idempotent: zweiter Replay erzeugt KEINEN doppelten
 * Kasse-Eintrag.
 *
 * Lookup-Strategie:
 *  1. erfolgsbeitrag-Row per `stripe_session_id` (immer NOT NULL,
 *     genau eine Row pro Session).
 *  2. Wenn nicht gefunden, Event ignorieren (kein Crash).
 */
async function handleErfolgsbeitrag(
  session: Stripe.Checkout.Session,
): Promise<void> {
  const rows = await db
    .select({
      id: erfolgsbeitrag.id,
      bedarfId: erfolgsbeitrag.bedarfId,
      zahlerNutzerId: erfolgsbeitrag.zahlerNutzerId,
      hoeheEuroCent: erfolgsbeitrag.hoeheEuroCent,
      status: erfolgsbeitrag.status,
    })
    .from(erfolgsbeitrag)
    .where(eq(erfolgsbeitrag.stripeSessionId, session.id))
    .limit(1);
  const beitragRow = rows[0];

  if (!beitragRow) {
    console.warn(
      '[stripe-webhook] Erfolgsbeitrag fuer Stripe-Session nicht gefunden:',
      session.id,
    );
    return;
  }

  // Idempotenz: bereits bezahlt → kein zweites Update, kein zweiter
  // Kasse-Eintrag, keine zweite Mail.
  if (beitragRow.status === 'bezahlt') return;

  const jetzt = new Date();

  await db
    .update(erfolgsbeitrag)
    .set({
      status: 'bezahlt',
      gezahltAm: jetzt,
    })
    .where(eq(erfolgsbeitrag.id, beitragRow.id));

  // Stadt-ID via Bedarf laden — der Kasse-Eintrag haengt an der Stadt
  // des Bedarfs (nicht an der Stadt der Zahler:in, falls sie sich je
  // unterscheiden sollten).
  let stadtId: string | null = null;
  let erfasstDurch: string | null = beitragRow.zahlerNutzerId;
  let zahlerAnzeigename = 'anonym';

  if (beitragRow.bedarfId) {
    const bedarfRows = await db
      .select({
        stadtId: bedarf.stadtId,
        nutzerId: bedarf.nutzerId,
      })
      .from(bedarf)
      .where(eq(bedarf.id, beitragRow.bedarfId))
      .limit(1);
    const b = bedarfRows[0];
    if (b) {
      stadtId = b.stadtId;
      // erfasstDurch verlangt einen NOT-NULL nutzer.id — Zahler:in
      // bevorzugt, sonst Owner des Bedarfs als Fallback.
      if (!erfasstDurch) erfasstDurch = b.nutzerId;
    }
  }

  if (beitragRow.zahlerNutzerId) {
    const zRows = await db
      .select({ anzeigename: nutzer.anzeigename })
      .from(nutzer)
      .where(eq(nutzer.id, beitragRow.zahlerNutzerId))
      .limit(1);
    if (zRows[0]) zahlerAnzeigename = zRows[0].anzeigename;
  }

  const hoeheEuroCent = beitragRow.hoeheEuroCent ?? session.amount_total ?? 0;

  if (stadtId && erfasstDurch) {
    try {
      await db.insert(werkstattKasseEintrag).values({
        stadtId,
        typ: 'eingang',
        kategorie: 'erfolgsbeitraege',
        hoeheEuroCent,
        beschreibung: `Erfolgsbeitrag (Stripe) von ${zahlerAnzeigename}`,
        referenzTyp: 'erfolgsbeitrag',
        referenzId: beitragRow.id,
        datum: jetzt.toISOString().slice(0, 10),
        quartal: quartalOf(jetzt),
        erfasstDurch,
        // Stripe-Zahlung = Trust-Signal → automatisch freigegeben.
        freigegebenAm: jetzt,
      });
    } catch (err) {
      console.error(
        '[stripe-webhook] Kasse-Eintrag (erfolgsbeitrag) fehlgeschlagen:',
        err,
      );
    }
  } else {
    console.warn(
      '[stripe-webhook] erfolgsbeitrag ohne stadt_id/erfasstDurch — kein Kasse-Eintrag:',
      beitragRow.id,
    );
  }

  // Inline T-Dank: kein dediziertes Template; einfache Log-Spur, damit
  // wir spaeter ein echtes Template anschliessen koennen. Mail-Versand
  // bleibt bewusst opt-in fuer einen spaeteren Task.

  try {
    await db.insert(auditLog).values({
      nutzerId: beitragRow.zahlerNutzerId,
      aktion: 'erfolgsbeitrag.bezahlt',
      referenzTyp: 'erfolgsbeitrag',
      referenzId: beitragRow.id,
      metadaten: {
        stripe_session_id: session.id,
        hoehe_euro_cent: hoeheEuroCent,
        bedarf_id: beitragRow.bedarfId,
      },
    });
  } catch {
    // Audit-Failure schluckt den Erfolg.
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Foerdermitgliedschaft
// ────────────────────────────────────────────────────────────────────────────

/**
 * Stripe-Session, die nach Foerdermitgliedschaft-Checkout zurueckkommt.
 *
 * - `customer` (string) ist die Stripe-Customer-ID.
 * - `subscription` (string) ist die Stripe-Subscription-ID.
 * - `metadata.zweck = 'foerdermitgliedschaft'`, `nutzer_id`, `stufe`.
 *
 * Idempotent: wenn bereits eine Mitgliedschaft mit dieser
 * stripe_subscription_id existiert, wird KEIN zweiter INSERT versucht.
 */
export async function handleFoerdermitgliedschaftCheckoutCompleted(
  session: Stripe.Checkout.Session,
): Promise<void> {
  const meta = session.metadata ?? {};
  const nutzerId = meta.nutzer_id;
  const stufe = meta.stufe as FoermitglStufe | undefined;
  if (!nutzerId || !stufe) {
    console.warn(
      '[stripe-webhook] foerdermitgliedschaft checkout ohne nutzer_id/stufe-meta:',
      session.id,
    );
    return;
  }

  const stripeCustomerId =
    typeof session.customer === 'string'
      ? session.customer
      : session.customer?.id ?? null;
  const stripeSubscriptionId =
    typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id ?? null;

  if (!stripeCustomerId) {
    console.warn(
      '[stripe-webhook] foerdermitgliedschaft checkout ohne customer:',
      session.id,
    );
    return;
  }

  // Idempotenz: bestehende Mitgliedschaft fuer denselben Nutzer?
  const existing = await db
    .select()
    .from(foerdermitgliedschaft)
    .where(eq(foerdermitgliedschaft.nutzerId, nutzerId))
    .limit(1);

  const jetzt = new Date();

  if (existing[0]) {
    // bereits vorhanden — Status reaktivieren, Stripe-IDs aktualisieren.
    await db
      .update(foerdermitgliedschaft)
      .set({
        stufe,
        stripeCustomerId,
        stripeSubscriptionId,
        status: 'aktiv',
        beginn: jetzt,
        ende: null,
      })
      .where(eq(foerdermitgliedschaft.id, existing[0].id));
  } else {
    await db.insert(foerdermitgliedschaft).values({
      nutzerId,
      stufe,
      stripeCustomerId,
      stripeSubscriptionId,
      beginn: jetzt,
      status: 'aktiv',
    });
  }

  // nutzer.foerdermitglied_seit/bis aktualisieren — bis wird im
  // subscription.updated-Handler auf das echte period_end gesetzt.
  await db
    .update(nutzer)
    .set({
      foerdermitgliedSeit: jetzt,
      foerdermitgliedBis: null,
      aktualisiertAm: jetzt,
    })
    .where(eq(nutzer.id, nutzerId));

  try {
    await db.insert(auditLog).values({
      nutzerId,
      aktion: 'foerdermitgliedschaft.aktiv',
      referenzTyp: 'foerdermitgliedschaft',
      referenzId: null,
      metadaten: {
        stripe_session_id: session.id,
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: stripeSubscriptionId,
        stufe,
      },
    });
  } catch {
    // Audit-Fail darf den Erfolg nicht blockieren.
  }
}

/**
 * `customer.subscription.updated` — Status-Sync. period_end -> foerdermitglied_bis.
 * cancel_at_period_end=true -> status='gekuendigt'.
 */
export async function handleSubscriptionUpdated(
  sub: Stripe.Subscription,
): Promise<void> {
  const rows = await db
    .select()
    .from(foerdermitgliedschaft)
    .where(eq(foerdermitgliedschaft.stripeSubscriptionId, sub.id))
    .limit(1);
  const row = rows[0];
  if (!row) return;

  const periodEnd = subscriptionPeriodEnd(sub);
  const cancelAtPeriodEnd = sub.cancel_at_period_end === true;
  const nextStatus: 'aktiv' | 'gekuendigt' | 'zahlung_fehlt' =
    cancelAtPeriodEnd
      ? 'gekuendigt'
      : sub.status === 'active' || sub.status === 'trialing'
        ? 'aktiv'
        : sub.status === 'past_due' || sub.status === 'unpaid'
          ? 'zahlung_fehlt'
          : sub.status === 'canceled'
            ? 'gekuendigt'
            : row.status;

  await db
    .update(foerdermitgliedschaft)
    .set({
      status: nextStatus,
      ende: cancelAtPeriodEnd ? periodEnd : row.ende,
    })
    .where(eq(foerdermitgliedschaft.id, row.id));

  await db
    .update(nutzer)
    .set({
      foerdermitgliedBis: periodEnd,
      aktualisiertAm: new Date(),
    })
    .where(eq(nutzer.id, row.nutzerId));
}

/**
 * `invoice.payment_succeeded` — Verlaengerung erfolgreich. period_end
 * uebernehmen, status zurueck auf 'aktiv' wenn vorher 'zahlung_fehlt'.
 * Erstellt einen werkstatt_kasse_eintrag mit kategorie='foerder_mitgliedsbeitraege'.
 *
 * Idempotenz: pro invoice.id wird nur EIN Kasse-Eintrag erstellt (Lookup
 * ueber referenzTyp='foerdermitgliedschaft' + referenzId=invoice.id).
 */
export async function handleInvoicePaymentSucceeded(
  invoice: Stripe.Invoice,
): Promise<void> {
  const subId = invoiceSubscriptionId(invoice);
  if (!subId) return;

  const rows = await db
    .select()
    .from(foerdermitgliedschaft)
    .where(eq(foerdermitgliedschaft.stripeSubscriptionId, subId))
    .limit(1);
  const row = rows[0];
  if (!row) return;

  const periodEnd = invoicePeriodEnd(invoice);
  const jetzt = new Date();

  // Status auf aktiv heben, falls vorher zahlung_fehlt — und ende
  // bereinigen, weil eine erfolgreiche Zahlung das 'ende'-Datum
  // ueberschreibt.
  await db
    .update(foerdermitgliedschaft)
    .set({
      status: row.status === 'gekuendigt' ? row.status : 'aktiv',
      ende: row.status === 'gekuendigt' ? row.ende : null,
    })
    .where(eq(foerdermitgliedschaft.id, row.id));

  if (periodEnd) {
    await db
      .update(nutzer)
      .set({
        foerdermitgliedBis: periodEnd,
        aktualisiertAm: jetzt,
      })
      .where(eq(nutzer.id, row.nutzerId));
  }

  // Kasse-Eintrag — idempotent ueber invoice.id.
  const hoeheEuroCent = invoice.amount_paid ?? invoice.amount_due ?? 0;
  if (hoeheEuroCent > 0 && invoice.id) {
    // Vorhandener Eintrag fuer diese invoice?
    const existing = await db
      .select({ id: werkstattKasseEintrag.id })
      .from(werkstattKasseEintrag)
      .where(eq(werkstattKasseEintrag.referenzId, invoice.id))
      .limit(1);
    if (!existing[0]) {
      const ownerRows = await db
        .select({
          id: nutzer.id,
          stadtId: nutzer.stadtId,
          anzeigename: nutzer.anzeigename,
        })
        .from(nutzer)
        .where(eq(nutzer.id, row.nutzerId))
        .limit(1);
      const owner = ownerRows[0];
      if (owner) {
        try {
          await db.insert(werkstattKasseEintrag).values({
            stadtId: owner.stadtId,
            typ: 'eingang',
            kategorie: 'foerder_mitgliedsbeitraege',
            hoeheEuroCent,
            beschreibung: `Foerdermitgliedschaft (${row.stufe}) von ${owner.anzeigename}`,
            referenzTyp: 'foerdermitgliedschaft',
            referenzId: invoice.id,
            datum: jetzt.toISOString().slice(0, 10),
            quartal: quartalOf(jetzt),
            erfasstDurch: owner.id,
            // Stripe-Zahlung = Trust-Signal → automatisch freigegeben.
            freigegebenAm: jetzt,
          });
        } catch (err) {
          console.error(
            '[stripe-webhook] Kasse-Eintrag (foerdermitgliedschaft) fehlgeschlagen:',
            err,
          );
        }
      }
    }
  }

  try {
    await db.insert(auditLog).values({
      nutzerId: row.nutzerId,
      aktion: 'foerdermitgliedschaft.zahlung_erhalten',
      referenzTyp: 'foerdermitgliedschaft',
      referenzId: row.id,
      metadaten: {
        invoice_id: invoice.id,
        hoehe_euro_cent: hoeheEuroCent,
        period_end: periodEnd?.toISOString() ?? null,
      },
    });
  } catch {
    // Audit-Fail darf den Erfolg nicht blockieren.
  }
}

/**
 * `invoice.payment_failed` — Status auf 'zahlung_fehlt'.
 */
export async function handleInvoicePaymentFailed(
  invoice: Stripe.Invoice,
): Promise<void> {
  const subId = invoiceSubscriptionId(invoice);
  if (!subId) return;

  const rows = await db
    .select()
    .from(foerdermitgliedschaft)
    .where(eq(foerdermitgliedschaft.stripeSubscriptionId, subId))
    .limit(1);
  const row = rows[0];
  if (!row) return;

  await db
    .update(foerdermitgliedschaft)
    .set({ status: 'zahlung_fehlt' })
    .where(eq(foerdermitgliedschaft.id, row.id));

  try {
    await db.insert(auditLog).values({
      nutzerId: row.nutzerId,
      aktion: 'foerdermitgliedschaft.zahlung_fehlt',
      referenzTyp: 'foerdermitgliedschaft',
      referenzId: row.id,
      metadaten: { invoice_id: invoice.id },
    });
  } catch {
    // schlucken
  }
}

/**
 * `customer.subscription.deleted` — Subscription endgueltig beendet.
 * status='gekuendigt', ende auf canceled_at (oder current_period_end).
 * nutzer.foerdermitglied_bis bleibt stehen (Beleg, bis wann gefoerdert
 * wurde), nicht zuruecksetzen.
 */
export async function handleSubscriptionDeleted(
  sub: Stripe.Subscription,
): Promise<void> {
  const rows = await db
    .select()
    .from(foerdermitgliedschaft)
    .where(eq(foerdermitgliedschaft.stripeSubscriptionId, sub.id))
    .limit(1);
  const row = rows[0];
  if (!row) return;

  const ende = sub.canceled_at
    ? new Date(sub.canceled_at * 1000)
    : (subscriptionPeriodEnd(sub) ?? new Date());

  await db
    .update(foerdermitgliedschaft)
    .set({
      status: 'gekuendigt',
      ende,
    })
    .where(eq(foerdermitgliedschaft.id, row.id));

  await db
    .update(nutzer)
    .set({
      foerdermitgliedBis: ende,
      aktualisiertAm: new Date(),
    })
    .where(eq(nutzer.id, row.nutzerId));

  try {
    await db.insert(auditLog).values({
      nutzerId: row.nutzerId,
      aktion: 'foerdermitgliedschaft.gekuendigt',
      referenzTyp: 'foerdermitgliedschaft',
      referenzId: row.id,
      metadaten: { stripe_subscription_id: sub.id },
    });
  } catch {
    // schlucken
  }
}

// ── Stripe-API-Shape-Helpers ────────────────────────────────────────────────

/**
 * Stripe-API-Versionen verschoben `current_period_end` zwischen Top-Level
 * der Subscription und dem `items.data[0]`-Item. Wir greifen defensiv auf
 * beide Stellen zu und lesen ueber `unknown` aus, weil die TypeScript-
 * Definition des Stripe-SDKs nur die jeweils aktuelle Version kennt.
 */
function subscriptionPeriodEnd(sub: Stripe.Subscription): Date | null {
  const anySub = sub as unknown as {
    current_period_end?: number;
    items?: { data?: Array<{ current_period_end?: number }> };
  };
  const ts =
    anySub.current_period_end ??
    anySub.items?.data?.[0]?.current_period_end ??
    null;
  return typeof ts === 'number' ? new Date(ts * 1000) : null;
}

function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const any = invoice as unknown as {
    subscription?: string | { id: string } | null;
    parent?: { subscription_details?: { subscription?: string | { id: string } } };
  };
  const sub = any.subscription ?? any.parent?.subscription_details?.subscription;
  if (!sub) return null;
  if (typeof sub === 'string') return sub;
  return sub.id;
}

function invoicePeriodEnd(invoice: Stripe.Invoice): Date | null {
  const any = invoice as unknown as {
    period_end?: number;
    lines?: { data?: Array<{ period?: { end?: number } }> };
  };
  const ts = any.period_end ?? any.lines?.data?.[0]?.period?.end ?? null;
  return typeof ts === 'number' ? new Date(ts * 1000) : null;
}
