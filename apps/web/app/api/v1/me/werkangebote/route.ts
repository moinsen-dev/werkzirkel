/**
 * GET /api/v1/me/werkangebote
 *
 * Liste aller eigenen Werkangebote der eingeloggten Macher:in.
 * Sortiert: neueste zuerst.
 *
 * PRD-Referenz: §F-623 (Macher:innen-Sicht eigener Werkangebote).
 */

import { desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { werkangebot } from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';
import { serializeWerkangebot } from '@/lib/werkangebot/serialize';

export async function GET(req: Request): Promise<Response> {
  const sess = await getSessionFromRequest(req);
  if (!sess) {
    return Response.json({ fehler: 'unauthenticated' }, { status: 401 });
  }

  const rows = await db
    .select()
    .from(werkangebot)
    .where(eq(werkangebot.macherId, sess.nutzerId))
    .orderBy(desc(werkangebot.erstelltAm));

  return Response.json({
    werkangebote: rows.map(serializeWerkangebot),
  });
}
