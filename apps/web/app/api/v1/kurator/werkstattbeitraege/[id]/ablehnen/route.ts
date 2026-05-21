/**
 * POST /api/v1/kurator/werkstattbeitraege/:id/ablehnen
 *
 * City-Lead lehnt einen Membership-Beitrag ab (vor allem Sachleistungen).
 * Erwartet `{ grund: string }`, setzt Status 'abgelehnt'.
 *
 * PRD-Referenz: §10.5, §18.
 */

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { auditLog, nutzer, werkstattbeitrag } from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';
import { rejectIfBadOrigin } from '@/lib/auth/csrf';
import { istKuratorVon } from '@/lib/auth/permissions';
import { werkstattbeitragAblehnenSchema } from '@/lib/validators/werkstattbeitrag';
import { serializeWerkstattbeitrag } from '@/lib/werkstattbeitrag/serialize';

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
    .select({
      beitrag: werkstattbeitrag,
      owner: {
        id: nutzer.id,
        email: nutzer.email,
        stadtId: nutzer.stadtId,
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
            'Nur City-Leads der jeweiligen Stadt koennen Werkstattbeitraege ablehnen.',
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
          message: 'Nur erfasste Werkstattbeitraege koennen abgelehnt werden.',
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

  const parsed = werkstattbeitragAblehnenSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { fehler: 'validierung', details: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }
  const { grund } = parsed.data;

  const updated = await db
    .update(werkstattbeitrag)
    .set({
      status: 'abgelehnt',
    })
    .where(eq(werkstattbeitrag.id, row.beitrag.id))
    .returning();
  const updatedRow = updated[0]!;

  try {
    await db.insert(auditLog).values({
      nutzerId: sess.nutzerId,
      aktion: 'werkstattbeitrag.abgelehnt',
      referenzTyp: 'werkstattbeitrag',
      referenzId: row.beitrag.id,
      metadaten: { owner_id: row.owner.id, art: row.beitrag.art, grund },
    });
  } catch {
    // Audit-Failure schluckt der Erfolg.
  }

  return Response.json({ werkstattbeitrag: serializeWerkstattbeitrag(updatedRow) });
}
