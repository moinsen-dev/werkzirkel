/**
 * POST /api/v1/termine/:id/durchgefuehrt
 *
 * Statusuebergang `veroeffentlicht` → `durchgefuehrt` (PRD §14.6).
 *
 * - Auth + Permission (City-Lead der Stadt oder Admin).
 * - Status muss 'veroeffentlicht' sein.
 * - `datum_uhrzeit` muss in der Vergangenheit liegen.
 * - Audit-Log.
 *
 * Anwesenheits-Dokumentation kommt im separaten Task — hier nur der
 * Statusuebergang.
 */

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { auditLog, termin } from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';
import { rejectIfBadOrigin } from '@/lib/auth/csrf';
import { istKuratorVon } from '@/lib/auth/permissions';
import { serializeTermin } from '@/lib/termin/serialize';

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
  const rows = await db.select().from(termin).where(eq(termin.id, id)).limit(1);
  const row = rows[0];
  if (!row) {
    return Response.json({ fehler: 'nicht_gefunden' }, { status: 404 });
  }

  const erlaubt = await istKuratorVon(sess.nutzerId, row.stadtId);
  if (!erlaubt) {
    return Response.json(
      {
        error: {
          code: 'kein_zugriff',
          message:
            'Nur City-Leads der jeweiligen Stadt koennen Termine als durchgefuehrt markieren.',
        },
      },
      { status: 403 },
    );
  }

  if (row.status !== 'veroeffentlicht') {
    return Response.json(
      {
        error: {
          code: 'falscher_status',
          message:
            'Nur veroeffentlichte Termine koennen als durchgefuehrt markiert werden.',
        },
      },
      { status: 422 },
    );
  }

  if (row.datumUhrzeit.getTime() >= Date.now()) {
    return Response.json(
      {
        error: {
          code: 'termin_in_zukunft',
          message:
            'Ein Termin kann erst nach seinem Datum als durchgefuehrt markiert werden.',
        },
      },
      { status: 422 },
    );
  }

  const updated = await db
    .update(termin)
    .set({ status: 'durchgefuehrt', aktualisiertAm: new Date() })
    .where(eq(termin.id, row.id))
    .returning();
  const updatedRow = updated[0];
  if (!updatedRow) {
    return Response.json({ fehler: 'unbekannt' }, { status: 500 });
  }

  try {
    await db.insert(auditLog).values({
      nutzerId: sess.nutzerId,
      aktion: 'termin.durchgefuehrt',
      referenzTyp: 'termin',
      referenzId: updatedRow.id,
    });
  } catch {
    // Audit-Failure darf den Erfolg nicht blockieren.
  }

  return Response.json({ termin: serializeTermin(updatedRow) });
}
