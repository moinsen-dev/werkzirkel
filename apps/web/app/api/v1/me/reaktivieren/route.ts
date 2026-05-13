/**
 * POST /api/v1/me/reaktivieren
 *
 * Setzt `nutzer.status='aktiv'` zurueck. Quelle: PRD §F-005.
 *
 * Sicherheitshinweis: ein im Status `loeschung_anstehend` befindliches Konto
 * wird ueber den dedizierten `cancel-deletion`-Endpunkt reaktiviert
 * (separater Task: task-konto-loeschung). Dieser Endpunkt ist ausschliesslich
 * fuer den Wechsel `pausiert` → `aktiv`. Wenn der Status `gesperrt` oder
 * `loeschung_anstehend` ist, antwortet der Endpunkt 409.
 *
 * Idempotent fuer den Zustand `aktiv` (zweite Reaktivierung = Noop, 204).
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

  const current = sess.nutzer.status;
  if (current !== 'aktiv' && current !== 'pausiert') {
    return Response.json(
      {
        fehler: 'status_konflikt',
        details: { status: [`Reaktivierung nicht moeglich aus Status '${current}'.`] },
      },
      { status: 409 },
    );
  }

  await db
    .update(nutzer)
    .set({ status: 'aktiv', aktualisiertAm: new Date() })
    .where(eq(nutzer.id, sess.nutzerId));

  return new Response(null, { status: 204 });
}
