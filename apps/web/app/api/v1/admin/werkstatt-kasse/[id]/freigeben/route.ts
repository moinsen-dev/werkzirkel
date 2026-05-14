/**
 * POST /api/v1/admin/werkstatt-kasse/:id/freigeben
 *
 * Admin gibt einen Kasse-Eintrag frei. Setzt `freigegeben_durch` +
 * `freigegeben_am`. Erst nach Freigabe taucht der Eintrag im öffentlichen
 * `/api/v1/werkstatt-kasse/:stadt`-Listing auf.
 *
 * Permission: nur Admins. Idempotent — wenn schon freigegeben, gibt der
 * Endpoint die Row zurück, ohne sie zu überschreiben.
 *
 * PRD-Referenz: §8.11 (Quartalsbericht: Kurator erfasst, Admin gibt frei).
 */

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { auditLog, werkstattKasseEintrag } from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';
import { rejectIfBadOrigin } from '@/lib/auth/csrf';
import { hasRolle } from '@/lib/auth/permissions';
import { serializeKasseEintrag } from '@/lib/kasse/serialize';

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

  if (!hasRolle(sess.nutzer, 'admin')) {
    return Response.json(
      {
        error: {
          code: 'kein_zugriff',
          message: 'Nur Admins können Kasse-Einträge freigeben.',
        },
      },
      { status: 403 },
    );
  }

  const { id } = await ctx.params;

  const rows = await db
    .select()
    .from(werkstattKasseEintrag)
    .where(eq(werkstattKasseEintrag.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) {
    return Response.json({ fehler: 'nicht_gefunden' }, { status: 404 });
  }

  // Idempotent: schon freigegeben → unverändert zurückliefern.
  if (row.freigegebenAm) {
    return Response.json({ eintrag: serializeKasseEintrag(row) });
  }

  const jetzt = new Date();
  const updated = await db
    .update(werkstattKasseEintrag)
    .set({
      freigegebenDurch: sess.nutzerId,
      freigegebenAm: jetzt,
    })
    .where(eq(werkstattKasseEintrag.id, id))
    .returning();
  const updatedRow = updated[0]!;

  try {
    await db.insert(auditLog).values({
      nutzerId: sess.nutzerId,
      aktion: 'werkstatt_kasse.freigegeben',
      referenzTyp: 'werkstatt_kasse_eintrag',
      referenzId: id,
      metadaten: {
        stadt_id: updatedRow.stadtId,
        typ: updatedRow.typ,
        kategorie: updatedRow.kategorie,
        hoehe_euro_cent: updatedRow.hoeheEuroCent,
      },
    });
  } catch {
    /* audit best-effort */
  }

  return Response.json({ eintrag: serializeKasseEintrag(updatedRow) });
}
