/**
 * POST /api/v1/kurator/bedarfe/:id/ablehnen
 *
 * City-Lead lehnt einen eingereichten Bedarf ab. Setzt Status auf
 * 'eingestellt' und versendet T-303 mit Grund-Text.
 *
 * PRD-Referenz: §F-603, §14.3.
 */

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { auditLog, bedarf, nutzer } from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';
import { rejectIfBadOrigin } from '@/lib/auth/csrf';
import { istKuratorVon } from '@/lib/auth/permissions';
import { sendMail } from '@/lib/email/send';
import { bedarfAblehnenSchema } from '@/lib/validators/bedarf';
import { serializeBedarf } from '@/lib/bedarf/serialize';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: Request, ctx: RouteContext): Promise<Response> {
  const originResp = rejectIfBadOrigin(req);
  if (originResp) return originResp;

  const sess = await getSessionFromRequest(req);
  if (!sess) {
    return Response.json({ fehler: 'unauthenticated' }, { status: 401 });
  }

  const { id } = await ctx.params;
  const rows = await db
    .select({ bedarf, owner_email: nutzer.email, owner_id: nutzer.id })
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
            'Nur City-Leads der jeweiligen Stadt koennen Bedarfe ablehnen.',
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
          message: 'Nur Bedarfe in Pruefung koennen abgelehnt werden.',
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

  const parsed = bedarfAblehnenSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { fehler: 'validierung', details: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }
  const { grund } = parsed.data;

  const updated = await db
    .update(bedarf)
    .set({ status: 'eingestellt', aktualisiertAm: new Date() })
    .where(eq(bedarf.id, row.bedarf.id))
    .returning();
  const updatedRow = updated[0]!;

  // T-303 an Bedarfstraeger:in
  try {
    await sendMail({
      to: row.owner_email,
      nutzerId: row.owner_id,
      template: 'T-303',
      props: {
        titel: row.bedarf.titel,
        organisation: row.bedarf.organisation,
        grund,
      },
    });
  } catch (err) {
    console.error('[bedarf-ablehnen] sendMail T-303 failed:', err);
  }

  try {
    await db.insert(auditLog).values({
      nutzerId: sess.nutzerId,
      aktion: 'bedarf.abgelehnt',
      referenzTyp: 'bedarf',
      referenzId: row.bedarf.id,
      metadaten: { owner_id: row.owner_id, grund },
    });
  } catch {
    // Audit-Failure darf den Erfolg nicht blockieren.
  }

  return Response.json({ bedarf: serializeBedarf(updatedRow) });
}
