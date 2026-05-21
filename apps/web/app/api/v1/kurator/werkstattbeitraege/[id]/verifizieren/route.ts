/**
 * POST /api/v1/kurator/werkstattbeitraege/:id/verifizieren
 *
 * City-Lead der Stadt der Bedarfstraeger:in setzt eine Sachleistung
 * (Membership-Beitrag-Pfad C) von 'erfasst' auf 'verifiziert'. Setzt
 * `gueltig_bis = now() + 6 Monate`. Versendet T-602 an die Inhaber:in.
 *
 * Kein Webhook-Pfad — Geldbeitrag (Pfad B) wird via Stripe-Webhook
 * verifiziert, nicht hier.
 *
 * PRD-Referenz: §10.5, §18 (Pfad C Gueltigkeitsdauer).
 */

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { auditLog, nutzer, werkstattbeitrag } from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';
import { rejectIfBadOrigin } from '@/lib/auth/csrf';
import { istKuratorVon } from '@/lib/auth/permissions';
import { sendMail } from '@/lib/email/send';
import { env } from '@/lib/env';
import { serializeWerkstattbeitrag } from '@/lib/werkstattbeitrag/serialize';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const APP_URL = env.APP_URL.replace(/\/+$/, '');
const GUELTIGKEIT_MONATE = 6;

export async function POST(req: Request, ctx: RouteContext): Promise<Response> {
  const originResp = rejectIfBadOrigin(req);
  if (originResp) return originResp;

  const sess = await getSessionFromRequest(req);
  if (!sess) {
    return Response.json({ fehler: 'unauthenticated' }, { status: 401 });
  }

  const { id } = await ctx.params;

  const rows = await db
    .select({
      beitrag: werkstattbeitrag,
      owner: {
        id: nutzer.id,
        email: nutzer.email,
        stadtId: nutzer.stadtId,
        anzeigename: nutzer.anzeigename,
      },
    })
    .from(werkstattbeitrag)
    .innerJoin(nutzer, eq(werkstattbeitrag.nutzerId, nutzer.id))
    .where(eq(werkstattbeitrag.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) {
    return Response.json({ fehler: 'nicht_gefunden' }, { status: 404 });
  }

  const erlaubt = await istKuratorVon(sess.nutzerId, row.owner.stadtId);
  if (!erlaubt) {
    return Response.json(
      {
        error: {
          code: 'kein_zugriff',
          message:
            'Nur City-Leads der jeweiligen Stadt koennen Werkstattbeitraege verifizieren.',
        },
      },
      { status: 403 },
    );
  }

  if (row.beitrag.status !== 'erfasst') {
    return Response.json(
      {
        error: {
          code: 'falscher_status',
          message: 'Nur erfasste Werkstattbeitraege koennen verifiziert werden.',
        },
      },
      { status: 422 },
    );
  }

  // Geldbeitrag laeuft ueber Stripe-Webhook, nicht hier.
  if (row.beitrag.art === 'geldbeitrag') {
    return Response.json(
      {
        error: {
          code: 'falsche_art',
          message:
            'Geldbeitraege werden ueber den Stripe-Webhook verifiziert, nicht manuell.',
        },
      },
      { status: 422 },
    );
  }

  const jetzt = new Date();
  const gueltigBis = new Date(
    jetzt.getTime() + GUELTIGKEIT_MONATE * 30 * 24 * 60 * 60 * 1000,
  );

  const updated = await db
    .update(werkstattbeitrag)
    .set({
      status: 'verifiziert',
      verifiziertDurch: sess.nutzerId,
      verifiziertAm: jetzt,
      gueltigBis,
    })
    .where(eq(werkstattbeitrag.id, row.beitrag.id))
    .returning();
  const updatedRow = updated[0]!;

  try {
    await sendMail({
      to: row.owner.email,
      nutzerId: row.owner.id,
      template: 'T-602',
      props: {
        anzeigename: row.owner.anzeigename,
        gueltigBis: gueltigBis.toISOString().slice(0, 10),
        uebersichtUrl: `${APP_URL}/uebersicht/werkstattbeitrag`,
      },
    });
  } catch (err) {
    console.error('[werkstattbeitrag-verifizieren] sendMail T-602 failed:', err);
  }

  try {
    await db.insert(auditLog).values({
      nutzerId: sess.nutzerId,
      aktion: 'werkstattbeitrag.verifiziert',
      referenzTyp: 'werkstattbeitrag',
      referenzId: row.beitrag.id,
      metadaten: { owner_id: row.owner.id, art: row.beitrag.art },
    });
  } catch {
    // Audit-Failure schluckt der Erfolg.
  }

  return Response.json({ werkstattbeitrag: serializeWerkstattbeitrag(updatedRow) });
}
