/**
 * GET /api/v1/me/foerdermitgliedschaft
 *
 * Liefert die eigene Foerdermitgliedschaft-Row (falls vorhanden) zusammen
 * mit den abgeleiteten `nutzer.foerdermitglied_seit/bis`-Feldern. Wenn keine
 * Mitgliedschaft existiert, wird `null` zurueckgegeben.
 *
 * PRD-Referenz: §8.13 (Foerdermitgliedschaft-Stufen) + §20.
 */

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { foerdermitgliedschaft } from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';

export async function GET(req: Request): Promise<Response> {
  const sess = await getSessionFromRequest(req);
  if (!sess) {
    return Response.json({ fehler: 'unauthenticated' }, { status: 401 });
  }

  const rows = await db
    .select()
    .from(foerdermitgliedschaft)
    .where(eq(foerdermitgliedschaft.nutzerId, sess.nutzerId))
    .limit(1);
  const row = rows[0];

  return Response.json({
    foerdermitgliedschaft: row
      ? {
          id: row.id,
          nutzer_id: row.nutzerId,
          stufe: row.stufe,
          status: row.status,
          beginn: row.beginn,
          ende: row.ende,
          stripe_customer_id: row.stripeCustomerId,
          stripe_subscription_id: row.stripeSubscriptionId,
          erstellt_am: row.erstelltAm,
        }
      : null,
    foerdermitglied_seit: sess.nutzer.foerdermitgliedSeit,
    foerdermitglied_bis: sess.nutzer.foerdermitgliedBis,
  });
}
