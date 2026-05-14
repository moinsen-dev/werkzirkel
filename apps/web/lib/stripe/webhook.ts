/**
 * Werkstattbeitrag-spezifischer Stripe-Webhook-Handler.
 *
 * Wird vom /api/v1/stripe/webhook-Route nach Signatur-Verifikation
 * aufgerufen. Behandelt `checkout.session.completed` mit
 * `metadata.zweck === 'werkstattbeitrag'`:
 *
 * 1. Lookup der Werkstattbeitrag-Row (per `metadata.werkstattbeitrag_id`
 *    oder per `stripe_session_id`).
 * 2. UPDATE auf status='verifiziert', verifiziert_am=now(),
 *    gueltig_bis=now()+6Monate.
 * 3. INSERT werkstatt_kasse_eintrag mit kategorie='werkstattbeitraege'.
 * 4. sendMail T-601.
 *
 * Idempotent: wenn Beitrag bereits 'verifiziert' ist, kein zweites Update,
 * kein zweiter Kasse-Eintrag, keine zweite Mail (Stripe kann Events
 * mehrfach senden).
 *
 * PRD-Referenz: §10.5, §18 (Pfad B Geldbeitrag), §11 (Kasse).
 */

import type Stripe from 'stripe';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  auditLog,
  nutzer,
  werkstattbeitrag,
  werkstattKasseEintrag,
} from '@/lib/db/schema';
import { sendMail } from '@/lib/email/send';
import { env } from '@/lib/env';

const APP_URL = env.APP_URL.replace(/\/+$/, '');
const GUELTIGKEIT_MONATE = 6;

function quartalOf(d: Date): string {
  const q = Math.floor(d.getUTCMonth() / 3) + 1;
  return `${d.getUTCFullYear()}-Q${q}`;
}

export async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session,
): Promise<void> {
  const meta = session.metadata ?? {};
  if (meta.zweck !== 'werkstattbeitrag') return;

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
