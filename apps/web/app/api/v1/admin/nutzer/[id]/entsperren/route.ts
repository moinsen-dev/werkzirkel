/**
 * POST /api/v1/admin/nutzer/:id/entsperren
 *
 * Entsperrt eine Nutzer:in: setzt nutzer.status = 'aktiv'.
 * Idempotent — wenn der User bereits aktiv ist, bleibt der Status.
 * Es werden KEINE Sessions wiederhergestellt; der User muss sich neu einloggen.
 *
 * Permission: Rolle 'admin'.
 *
 * PRD-Referenz: §15.14.
 */

import { eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { auditLog, nutzer } from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';
import { rejectIfBadOrigin } from '@/lib/auth/csrf';
import { istAdmin } from '@/lib/auth/permissions';

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
  if (!istAdmin(sess.nutzer)) {
    return Response.json(
      {
        error: {
          code: 'kein_zugriff',
          message: 'Nur Admins koennen Nutzer:innen entsperren.',
        },
      },
      { status: 403 },
    );
  }

  const { id } = await ctx.params;

  const rows = await db
    .select()
    .from(nutzer)
    .where(eq(nutzer.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) {
    return Response.json({ fehler: 'nicht_gefunden' }, { status: 404 });
  }

  if (row.status !== 'aktiv') {
    await db
      .update(nutzer)
      .set({ status: 'aktiv', aktualisiertAm: new Date() })
      .where(eq(nutzer.id, id));
  }

  try {
    await db.insert(auditLog).values({
      nutzerId: sess.nutzerId,
      aktion: 'nutzer.entsperrt',
      referenzTyp: 'nutzer',
      referenzId: id,
      metadaten: { vorheriger_status: row.status },
    });
  } catch {
    /* audit best-effort */
  }

  const updated = (
    await db.select().from(nutzer).where(eq(nutzer.id, id)).limit(1)
  )[0]!;

  return Response.json({ nutzer: updated });
}
