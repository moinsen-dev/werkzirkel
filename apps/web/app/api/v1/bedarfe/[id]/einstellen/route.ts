/**
 * POST /api/v1/bedarfe/:id/einstellen
 *
 * Bedarfstraeger:in stellt den Bedarf ein (Cancel). Erlaubt aus jedem Status
 * AUSSER 'erfuellt' und 'eingestellt'. Setzt Status auf 'eingestellt'.
 *
 * PRD-Referenz: §F-606, §14.3.
 */

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { auditLog, bedarf } from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';
import { rejectIfBadOrigin } from '@/lib/auth/csrf';
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
  const rows = await db.select().from(bedarf).where(eq(bedarf.id, id)).limit(1);
  const row = rows[0];
  if (!row) {
    return Response.json({ fehler: 'nicht_gefunden' }, { status: 404 });
  }

  if (row.nutzerId !== sess.nutzerId) {
    return Response.json(
      { error: { code: 'kein_zugriff', message: 'Nur die Inhaber:in darf den Bedarf einstellen.' } },
      { status: 403 },
    );
  }

  if (row.status === 'erfuellt' || row.status === 'eingestellt') {
    return Response.json(
      {
        error: {
          code: 'falscher_status',
          message:
            'Erfuellte oder bereits eingestellte Bedarfe koennen nicht mehr eingestellt werden.',
        },
      },
      { status: 422 },
    );
  }

  const updated = await db
    .update(bedarf)
    .set({ status: 'eingestellt', aktualisiertAm: new Date() })
    .where(eq(bedarf.id, row.id))
    .returning();
  const updatedRow = updated[0]!;

  try {
    await db.insert(auditLog).values({
      nutzerId: sess.nutzerId,
      aktion: 'bedarf.eingestellt',
      referenzTyp: 'bedarf',
      referenzId: row.id,
    });
  } catch {
    // Audit-Failure darf den Erfolg nicht blockieren.
  }

  return Response.json({ bedarf: serializeBedarf(updatedRow) });
}
