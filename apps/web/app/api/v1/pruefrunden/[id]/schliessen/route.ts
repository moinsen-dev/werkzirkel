/**
 * POST /api/v1/pruefrunden/:id/schliessen
 *
 * Statusuebergang `oeffentlich` → `geschlossen` (PRD §14.2).
 *
 * - Auth + Inhaber:innen-Check.
 * - Status muss 'oeffentlich' sein.
 * - Schliesst die Pruefrunde manuell — keine neuen Anmeldungen mehr,
 *   aber Tester:innen koennen noch Feedback abgeben (Anmeldungs-API).
 */

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { auditLog, pruefrunde, werk } from '@/lib/db/schema';
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
          message: 'Du kannst nur eigene Pruefrunden schliessen.',
        },
      },
      { status: 403 },
    );
  }
  if (row.pruefrunde.status !== 'oeffentlich') {
    return Response.json(
      {
        error: {
          code: 'falscher_status',
          message:
            'Nur veroeffentlichte Pruefrunden koennen geschlossen werden.',
        },
      },
      { status: 422 },
    );
  }

  const updated = await db
    .update(pruefrunde)
    .set({ status: 'geschlossen', aktualisiertAm: new Date() })
    .where(eq(pruefrunde.id, row.pruefrunde.id))
    .returning();
  const updatedRow = updated[0];
  if (!updatedRow) {
    return Response.json({ fehler: 'unbekannt' }, { status: 500 });
  }

  try {
    await db.insert(auditLog).values({
      nutzerId: sess.nutzerId,
      aktion: 'pruefrunde.geschlossen',
      referenzTyp: 'pruefrunde',
      referenzId: updatedRow.id,
    });
  } catch {
    // Audit-Failure darf den Erfolg nicht blockieren.
  }

  return Response.json({ pruefrunde: serializePruefrunde(updatedRow) });
}
