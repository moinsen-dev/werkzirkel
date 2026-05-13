/**
 * POST /api/v1/me/pausieren
 *
 * Setzt `nutzer.status='pausiert'`. Quelle: PRD §F-005 (Konto-Deaktivierung).
 *
 * Eine Pause bezieht sich auf NEUE Aktivitaet (Anmeldungen, Bedarfe,
 * Werkangebote), nicht auf bisherige Inhalte (PRD §10.1) — die werden weiter
 * angezeigt.
 *
 * Idempotent: zweimal pausieren ist OK, jeder Aufruf 204.
 */

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { nutzer } from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';
import { rejectIfBadOrigin } from '@/lib/auth/csrf';

export async function POST(req: Request): Promise<Response> {
  const originResp = rejectIfBadOrigin(req);
  if (originResp) return originResp;

  const sess = await getSessionFromRequest(req);
  if (!sess) {
    return Response.json({ fehler: 'unauthenticated' }, { status: 401 });
  }

  await db
    .update(nutzer)
    .set({ status: 'pausiert', aktualisiertAm: new Date() })
    .where(eq(nutzer.id, sess.nutzerId));

  return new Response(null, { status: 204 });
}
