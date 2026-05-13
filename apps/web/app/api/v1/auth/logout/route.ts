/**
 * POST /api/v1/auth/logout
 *
 * Invalidiert die aktuelle Session (loescht Zeile aus `session`) und loescht
 * das `wz_session`-Cookie. Antwortet 204 (auch wenn keine Session existiert —
 * idempotent).
 *
 * CSRF: Origin-Check.
 */

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { session as sessionTable } from '@/lib/db/schema/nutzer';
import { rejectIfBadOrigin } from '@/lib/auth/csrf';
import {
  buildClearSessionCookie,
  getSessionIdFromRequest,
} from '@/lib/auth/session';

export async function POST(req: Request): Promise<Response> {
  const originResp = rejectIfBadOrigin(req);
  if (originResp) return originResp;

  const sid = getSessionIdFromRequest(req);
  if (sid) {
    await db.delete(sessionTable).where(eq(sessionTable.id, sid));
  }

  return new Response(null, {
    status: 204,
    headers: { 'set-cookie': buildClearSessionCookie() },
  });
}
