/**
 * GET /api/v1/werke/:id/feedbacks-hilfreich
 *
 * Oeffentliche Liste der als „hilfreich" markierten Feedbacks zu allen
 * Pruefrunden eines Werks (PRD §8.4, §F-206). Anonyme Anzeige —
 * KEINE tester_id, KEIN tester-Name, KEINE E-Mail. Stattdessen sequentielle
 * Labels „Tester:in 1", „Tester:in 2" usw. in Reihenfolge der Markierung.
 *
 * Public — keine Auth.
 */

import { and, asc, eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { feedback, pruefrunde, werk } from '@/lib/db/schema';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, ctx: RouteContext): Promise<Response> {
  const { id: werkId } = await ctx.params;

  // Werk-Existenz pruefen (404 bei nicht existent — sonst gibt es einen
  // leeren Array, was Caller verwirren wuerde).
  const werkRows = await db
    .select({ id: werk.id })
    .from(werk)
    .where(eq(werk.id, werkId))
    .limit(1);
  if (!werkRows[0]) {
    return Response.json({ fehler: 'nicht_gefunden' }, { status: 404 });
  }

  // Feedbacks ueber alle Pruefrunden dieses Werks, nur hilfreich=true.
  // Reihenfolge: hilfreich_markiert_am ASC (stabile sequentielle Labels).
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
      hilfreichMarkiertAm: feedback.hilfreichMarkiertAm,
      erstelltAm: feedback.erstelltAm,
    })
    .from(feedback)
    .innerJoin(pruefrunde, eq(pruefrunde.id, feedback.pruefrundeId))
    .where(
      and(eq(pruefrunde.werkId, werkId), eq(feedback.hilfreichMarkiert, true)),
    )
    .orderBy(asc(feedback.hilfreichMarkiertAm));

  // Anonymisierte Response. Tester:in-Identitaet komplett gestrippt — nur das
  // sequentielle Label und die Feedback-Inhalte.
  return Response.json({
    feedbacks: rows.map((r, index) => ({
      id: r.id,
      pruefrunde_id: r.pruefrundeId,
      tester_label: `Tester:in ${index + 1}`,
      erster_eindruck: r.ersterEindruck,
      verstaendlichkeit: r.verstaendlichkeit,
      nutzen: r.nutzen,
      bedienbarkeit: r.bedienbarkeit,
      fehler: r.fehler,
      positionierung: r.positionierung,
      zahlungsbereitschaft: r.zahlungsbereitschaft,
      verbesserungen: r.verbesserungen,
      gesamteindruck: r.gesamteindruck,
      hilfreich_markiert_am: r.hilfreichMarkiertAm,
      erstellt_am: r.erstelltAm,
    })),
  });
}
