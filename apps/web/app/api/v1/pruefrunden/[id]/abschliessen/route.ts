/**
 * POST /api/v1/pruefrunden/:id/abschliessen
 *
 * Statusuebergang `geschlossen` → `abgeschlossen` (PRD §14.2).
 *
 * - Auth + Inhaber:innen-Check.
 * - Status muss 'geschlossen' sein.
 * - Mindestens ein Feedback muss als `hilfreich_markiert=true` sein (PRD §14.2).
 */

import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  auditLog,
  feedback,
  pruefrunde,
  werk,
} from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';
import { rejectIfBadOrigin } from '@/lib/auth/csrf';
import { serializePruefrunde } from '@/lib/pruefrunde/serialize';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: Request, ctx: RouteContext): Promise<Response> {
  const originResp = rejectIfBadOrigin(req);
  if (originResp) return originResp;

  const sess = await getSessionFromRequest(req);
  if (!sess) {
    return Response.json({ fehler: 'unauthenticated' }, { status: 401 });
  }

  const { id } = await ctx.params;

  const rows = await db
    .select({ pruefrunde, werkNutzerId: werk.nutzerId })
    .from(pruefrunde)
    .innerJoin(werk, eq(werk.id, pruefrunde.werkId))
    .where(eq(pruefrunde.id, id))
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
          message: 'Du kannst nur eigene Pruefrunden abschliessen.',
        },
      },
      { status: 403 },
    );
  }
  if (row.pruefrunde.status !== 'geschlossen') {
    return Response.json(
      {
        error: {
          code: 'falscher_status',
          message:
            'Nur geschlossene Pruefrunden koennen abgeschlossen werden. Bitte zuerst schliessen.',
        },
      },
      { status: 422 },
    );
  }

  // Mindestens ein hilfreich-markiertes Feedback muss existieren.
  const hilfreichCountRows = await db
    .select({ anzahl: sql<number>`count(*)::int` })
    .from(feedback)
    .where(
      and(
        eq(feedback.pruefrundeId, row.pruefrunde.id),
        eq(feedback.hilfreichMarkiert, true),
      ),
    );
  const hilfreichAnzahl = hilfreichCountRows[0]?.anzahl ?? 0;
  if (hilfreichAnzahl < 1) {
    return Response.json(
      {
        error: {
          code: 'kein_hilfreiches_feedback',
          message:
            'Markiere mindestens ein Feedback als hilfreich, bevor du die Pruefrunde abschliesst.',
        },
      },
      { status: 422 },
    );
  }

  const updated = await db
    .update(pruefrunde)
    .set({ status: 'abgeschlossen', aktualisiertAm: new Date() })
    .where(eq(pruefrunde.id, row.pruefrunde.id))
    .returning();
  const updatedRow = updated[0];
  if (!updatedRow) {
    return Response.json({ fehler: 'unbekannt' }, { status: 500 });
  }

  try {
    await db.insert(auditLog).values({
      nutzerId: sess.nutzerId,
      aktion: 'pruefrunde.abgeschlossen',
      referenzTyp: 'pruefrunde',
      referenzId: updatedRow.id,
    });
  } catch {
    // Audit-Failure darf den Erfolg nicht blockieren.
  }

  return Response.json({ pruefrunde: serializePruefrunde(updatedRow) });
}
