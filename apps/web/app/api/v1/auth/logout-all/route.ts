/**
 * POST /api/v1/auth/logout-all
 *
 * Beendet ALLE Sessions der eingeloggten Person (loescht alle Zeilen mit
 * `nutzer_id = current_user_id`). Auch die aktuelle. Loescht das Cookie.
 *
 * 401 wenn keine gueltige Session vorhanden ist.
 */

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { session as sessionTable } from '@/lib/db/schema/nutzer';
import { rejectIfBadOrigin } from '@/lib/auth/csrf';
import {
  buildClearSessionCookie,
  getSessionFromRequest,
} from '@/lib/auth/session';

export async function POST(req: Request): Promise<Response> {
  const originResp = rejectIfBadOrigin(req);
  if (originResp) return originResp;

  const sess = await getSessionFromRequest(req);
  if (!sess) {
    return Response.json({ fehler: 'unauthenticated' }, { status: 401 });
  }

  await db.delete(sessionTable).where(eq(sessionTable.nutzerId, sess.nutzerId));

  return new Response(null, {
    status: 204,
    headers: { 'set-cookie': buildClearSessionCookie() },
  });
}
