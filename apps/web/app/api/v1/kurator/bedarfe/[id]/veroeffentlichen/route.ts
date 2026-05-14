/**
 * POST /api/v1/kurator/bedarfe/:id/veroeffentlichen
 *
 * Kurator:in der Bedarf-Stadt setzt einen Bedarf von 'in_pruefung' auf
 * 'oeffentlich'. Inkrementiert dabei `werkstattbeitrag.verwendet_fuer_bedarfe`
 * um 1 (PRD §F-603 — der Beitrag wird durch die Veroeffentlichung verbraucht;
 * Max-Limit von 4 wird so durchgesetzt). Versendet T-302 an Bedarfstraeger:in.
 *
 * PRD-Referenz: §F-603, §11A, §14.3.
 */

import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { auditLog, bedarf, nutzer, werkstattbeitrag } from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';
import { rejectIfBadOrigin } from '@/lib/auth/csrf';
import { istKuratorVon } from '@/lib/auth/permissions';
import { sendMail } from '@/lib/email/send';
import { env } from '@/lib/env';
import { serializeBedarf } from '@/lib/bedarf/serialize';

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
  const rows = await db
    .select({
      bedarf,
      owner_email: nutzer.email,
      owner_id: nutzer.id,
    })
    .from(bedarf)
    .innerJoin(nutzer, eq(bedarf.nutzerId, nutzer.id))
    .where(eq(bedarf.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) {
    return Response.json({ fehler: 'nicht_gefunden' }, { status: 404 });
  }

  const erlaubt = await istKuratorVon(sess.nutzerId, row.bedarf.stadtId);
  if (!erlaubt) {
    return Response.json(
      {
        error: {
          code: 'kein_zugriff',
          message:
            'Nur Kurator:innen der jeweiligen Stadt koennen Bedarfe veroeffentlichen.',
        },
      },
      { status: 403 },
    );
  }

  if (row.bedarf.status !== 'in_pruefung') {
    return Response.json(
      {
        error: {
          code: 'falscher_status',
          message: 'Nur Bedarfe in Pruefung koennen veroeffentlicht werden.',
        },
      },
      { status: 422 },
    );
  }

  const jetzt = new Date();
  const updated = await db
    .update(bedarf)
    .set({ status: 'oeffentlich', aktualisiertAm: jetzt })
    .where(eq(bedarf.id, row.bedarf.id))
    .returning();
  const updatedRow = updated[0]!;

  // verwendet_fuer_bedarfe inkrementieren (PRD §F-603 — Beitrag verbraucht).
  if (row.bedarf.werkstattbeitragId) {
    try {
      await db
        .update(werkstattbeitrag)
        .set({
          verwendetFuerBedarfe: sql`${werkstattbeitrag.verwendetFuerBedarfe} + 1`,
        })
        .where(eq(werkstattbeitrag.id, row.bedarf.werkstattbeitragId));
    } catch (err) {
      console.error('[bedarf-veroeffentlichen] werkstattbeitrag-counter update failed:', err);
    }
  }

  // T-302 an Bedarfstraeger:in
  try {
    await sendMail({
      to: row.owner_email,
      nutzerId: row.owner_id,
      template: 'T-302',
      props: {
        titel: row.bedarf.titel,
        organisation: row.bedarf.organisation,
        bedarfUrl: `${APP_URL}/bedarfe/${row.bedarf.id}`,
      },
    });
  } catch (err) {
    console.error('[bedarf-veroeffentlichen] sendMail T-302 failed:', err);
  }

  try {
    await db.insert(auditLog).values({
      nutzerId: sess.nutzerId,
      aktion: 'bedarf.veroeffentlicht',
      referenzTyp: 'bedarf',
      referenzId: row.bedarf.id,
      metadaten: {
        owner_id: row.owner_id,
        werkstattbeitrag_id: row.bedarf.werkstattbeitragId,
      },
    });
  } catch {
    // Audit-Failure darf den Erfolg nicht blockieren.
  }

  return Response.json({ bedarf: serializeBedarf(updatedRow) });
}
