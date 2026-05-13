/**
 * GET /api/v1/pruefrunden/:id/feedbacks
 *
 * Liste aller Feedbacks zu einer Pruefrunde — nur fuer Werk-Inhaber:in.
 * PRD §F-205 (Sichtbarkeit), §15.4.
 *
 * - Auth + Werk-Inhaber:innen-Check (sess.nutzerId === werk.nutzer_id).
 * - Liefert alle Feedback-Felder + Tester-Public-Daten (anzeigename, avatar_url, stadt_id).
 * - Tester:innen sehen ihr eigenes Feedback NICHT (403).
 * - Anonyme Aufrufer: 401.
 */

import { asc, eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import {
  feedback,
  nutzer,
  pruefrunde,
  werk,
} from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(req: Request, ctx: RouteContext): Promise<Response> {
  const sess = await getSessionFromRequest(req);
  if (!sess) {
    return Response.json({ fehler: 'unauthenticated' }, { status: 401 });
  }

  const { id } = await ctx.params;

  // Pruefrunde + Werk laden — nur werk.nutzer_id fuer Permission-Check.
  const prRows = await db
    .select({
      pruefrundeId: pruefrunde.id,
      werkNutzerId: werk.nutzerId,
    })
    .from(pruefrunde)
    .innerJoin(werk, eq(werk.id, pruefrunde.werkId))
    .where(eq(pruefrunde.id, id))
    .limit(1);
  const prRow = prRows[0];
  if (!prRow) {
    return Response.json({ fehler: 'nicht_gefunden' }, { status: 404 });
  }
  if (prRow.werkNutzerId !== sess.nutzerId) {
    return Response.json(
      {
        error: {
          code: 'kein_zugriff',
          message:
            'Nur die Werk-Inhaber:in kann das Feedback zu dieser Pruefrunde einsehen.',
        },
      },
      { status: 403 },
    );
  }

  const rows = await db
    .select({
      id: feedback.id,
      pruefrundeId: feedback.pruefrundeId,
      ersterEindruck: feedback.ersterEindruck,
      verstaendlichkeit: feedback.verstaendlichkeit,
      nutzen: feedback.nutzen,
      bedienbarkeit: feedback.bedienbarkeit,
      fehler: feedback.fehler,
      positionierung: feedback.positionierung,
      zahlungsbereitschaft: feedback.zahlungsbereitschaft,
      verbesserungen: feedback.verbesserungen,
      gesamteindruck: feedback.gesamteindruck,
      hilfreichMarkiert: feedback.hilfreichMarkiert,
      hilfreichMarkiertAm: feedback.hilfreichMarkiertAm,
      erstelltAm: feedback.erstelltAm,
      testerId: nutzer.id,
      testerAnzeigename: nutzer.anzeigename,
      testerAvatarUrl: nutzer.avatarUrl,
      testerStadtId: nutzer.stadtId,
    })
    .from(feedback)
    .leftJoin(nutzer, eq(nutzer.id, feedback.testerId))
    .where(eq(feedback.pruefrundeId, id))
    .orderBy(asc(feedback.erstelltAm));

  return Response.json({
    feedbacks: rows.map((r) => ({
      id: r.id,
      pruefrunde_id: r.pruefrundeId,
      erster_eindruck: r.ersterEindruck,
      verstaendlichkeit: r.verstaendlichkeit,
      nutzen: r.nutzen,
      bedienbarkeit: r.bedienbarkeit,
      fehler: r.fehler,
      positionierung: r.positionierung,
      zahlungsbereitschaft: r.zahlungsbereitschaft,
      verbesserungen: r.verbesserungen,
      gesamteindruck: r.gesamteindruck,
      hilfreich_markiert: r.hilfreichMarkiert,
      hilfreich_markiert_am: r.hilfreichMarkiertAm,
      erstellt_am: r.erstelltAm,
      tester: r.testerId
        ? {
            id: r.testerId,
            anzeigename: r.testerAnzeigename,
            avatar_url: r.testerAvatarUrl,
            stadt_id: r.testerStadtId,
          }
        : null,
    })),
  });
}
