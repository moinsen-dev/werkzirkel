/**
 * PATCH /api/v1/feedback/:id/hilfreich
 *
 * Werk-Inhaber:in markiert ein Feedback als hilfreich (oder nimmt die
 * Markierung zurueck). Damit wird es in der oeffentlichen
 * `/api/v1/werke/:id/feedbacks-hilfreich`-Liste sichtbar (PRD §F-206, §8.4).
 *
 * - Auth.
 * - Permission via JOIN feedback → pruefrunde → werk → werk.nutzer_id == sess.
 * - Body: `{ hilfreich: boolean }`.
 * - UPDATE setzt `hilfreich_markiert` + `hilfreich_markiert_am` (NULL bei false).
 * - Audit-Log.
 * - Returns 200 mit aktualisiertem Feedback.
 */

import { eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import {
  auditLog,
  feedback,
  pruefrunde,
  werk,
} from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';
import { rejectIfBadOrigin } from '@/lib/auth/csrf';
import { feedbackHilfreichSchema } from '@/lib/validators/feedback';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: Request, ctx: RouteContext): Promise<Response> {
  const originResp = rejectIfBadOrigin(req);
  if (originResp) return originResp;

  const sess = await getSessionFromRequest(req);
  if (!sess) {
    return Response.json({ fehler: 'unauthenticated' }, { status: 401 });
  }

  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ fehler: 'ungueltiger_body' }, { status: 400 });
  }

  const parsed = feedbackHilfreichSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { fehler: 'validierung', details: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }
  const { hilfreich } = parsed.data;

  // Permission-Check: feedback → pruefrunde → werk.nutzer_id.
  const rows = await db
    .select({
      feedbackId: feedback.id,
      werkNutzerId: werk.nutzerId,
    })
    .from(feedback)
    .innerJoin(pruefrunde, eq(pruefrunde.id, feedback.pruefrundeId))
    .innerJoin(werk, eq(werk.id, pruefrunde.werkId))
    .where(eq(feedback.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) {
    return Response.json({ fehler: 'nicht_gefunden' }, { status: 404 });
  }
  if (row.werkNutzerId !== sess.nutzerId) {
    return Response.json(
      {
        error: {
          code: 'kein_zugriff',
          message:
            'Nur die Werk-Inhaber:in kann Feedback als hilfreich markieren.',
        },
      },
      { status: 403 },
    );
  }

  const now = new Date();
  const updated = await db
    .update(feedback)
    .set({
      hilfreichMarkiert: hilfreich,
      hilfreichMarkiertAm: hilfreich ? now : null,
    })
    .where(eq(feedback.id, id))
    .returning();
  const updatedRow = updated[0];
  if (!updatedRow) {
    return Response.json({ fehler: 'unbekannt' }, { status: 500 });
  }

  try {
    await db.insert(auditLog).values({
      nutzerId: sess.nutzerId,
      aktion: hilfreich
        ? 'feedback.hilfreich_markiert'
        : 'feedback.hilfreich_demarkiert',
      referenzTyp: 'feedback',
      referenzId: id,
      metadaten: {},
    });
  } catch {
    // Audit-Failure darf den Erfolg nicht blockieren.
  }

  return Response.json({
    feedback: {
      id: updatedRow.id,
      hilfreich_markiert: updatedRow.hilfreichMarkiert,
      hilfreich_markiert_am: updatedRow.hilfreichMarkiertAm,
    },
  });
}
