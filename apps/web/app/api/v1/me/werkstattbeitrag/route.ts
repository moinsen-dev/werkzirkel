/**
 * GET /api/v1/me/werkstattbeitrag
 *
 * Liste aller eigenen Membership-Beitrag-Rows der eingeloggten Person.
 * Sortiert: neu zuerst.
 *
 * PRD-Referenz: §10.5 (Bedarfstraeger:innen-Uebersicht).
 */

import { desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { werkstattbeitrag } from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';
import { serializeWerkstattbeitrag } from '@/lib/werkstattbeitrag/serialize';

export async function GET(req: Request): Promise<Response> {
  const sess = await getSessionFromRequest(req);
  if (!sess) {
    return Response.json({ fehler: 'unauthenticated' }, { status: 401 });
  }

  const rows = await db
    .select()
    .from(werkstattbeitrag)
    .where(eq(werkstattbeitrag.nutzerId, sess.nutzerId))
    .orderBy(desc(werkstattbeitrag.erstelltAm));

  return Response.json({
    werkstattbeitraege: rows.map(serializeWerkstattbeitrag),
  });
}
