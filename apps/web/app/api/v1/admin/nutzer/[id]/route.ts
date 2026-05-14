/**
 * GET /api/v1/admin/nutzer/:id
 *
 * Detail-View einer Nutzer:in fuer das Admin-Backoffice.
 * Enthaelt alle Profil-Felder + Anzahl aktiver Sessions.
 *
 * Permission: Rolle 'admin'.
 *
 * PRD-Referenz: §15.14, §26.
 */

import { eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { nutzer, session as sessionTable } from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';
import { istAdmin } from '@/lib/auth/permissions';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(req: Request, ctx: RouteContext): Promise<Response> {
  const sess = await getSessionFromRequest(req);
  if (!sess) {
    return Response.json({ fehler: 'unauthenticated' }, { status: 401 });
  }
  if (!istAdmin(sess.nutzer)) {
    return Response.json(
      {
        error: {
          code: 'kein_zugriff',
          message: 'Nur Admins koennen Nutzer-Details sehen.',
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

  const sessions = await db
    .select({ id: sessionTable.id, expiresAt: sessionTable.expiresAt })
    .from(sessionTable)
    .where(eq(sessionTable.nutzerId, id));

  return Response.json({
    nutzer: row,
    aktive_sessions: sessions.length,
  });
}
