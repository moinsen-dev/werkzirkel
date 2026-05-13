/**
 * GET /api/v1/auth/me
 *
 * Liefert das eigene Konto + alle aktiven Sessions. 401 wenn keine gueltige
 * Session.
 *
 * Response-Shape (Auszug):
 *   {
 *     nutzer: { id, email, anzeigename, klarname, stadtId, rollen,
 *               kurzbeschreibung, faehigkeiten, interessen, avatarUrl,
 *               teilnahmeart, status, erstelltAm },
 *     sessions: [{ id, userAgent, ipAdresse, expiresAt, erstelltAm, current }]
 *   }
 *
 * Hidden: `email_verifiziert_am`, alle Token-Hashes, alle Plaintext-Secrets.
 */

import { and, eq, gt } from 'drizzle-orm';
import { db } from '@/lib/db';
import { session as sessionTable } from '@/lib/db/schema/nutzer';
import { getSessionFromRequest } from '@/lib/auth/session';

export async function GET(req: Request): Promise<Response> {
  const sess = await getSessionFromRequest(req);
  if (!sess) {
    return Response.json({ fehler: 'unauthenticated' }, { status: 401 });
  }

  const sessions = await db
    .select({
      id: sessionTable.id,
      userAgent: sessionTable.userAgent,
      ipAdresse: sessionTable.ipAdresse,
      expiresAt: sessionTable.expiresAt,
      erstelltAm: sessionTable.erstelltAm,
    })
    .from(sessionTable)
    .where(
      and(
        eq(sessionTable.nutzerId, sess.nutzerId),
        gt(sessionTable.expiresAt, new Date()),
      ),
    );

  return Response.json({
    nutzer: {
      id: sess.nutzer.id,
      email: sess.nutzer.email,
      anzeigename: sess.nutzer.anzeigename,
      klarname: sess.nutzer.klarname,
      stadtId: sess.nutzer.stadtId,
      rollen: sess.nutzer.rollen,
      kurzbeschreibung: sess.nutzer.kurzbeschreibung,
      faehigkeiten: sess.nutzer.faehigkeiten,
      interessen: sess.nutzer.interessen,
      avatarUrl: sess.nutzer.avatarUrl,
      teilnahmeart: sess.nutzer.teilnahmeart,
      status: sess.nutzer.status,
      erstelltAm: sess.nutzer.erstelltAm,
    },
    sessions: sessions.map((s) => ({
      ...s,
      current: s.id === sess.id,
    })),
  });
}
