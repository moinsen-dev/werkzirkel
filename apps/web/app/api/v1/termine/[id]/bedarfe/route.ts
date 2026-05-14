/**
 * POST /api/v1/termine/:id/bedarfe
 *
 * Kurator setzt die Liste der Bedarfe, die auf einer Bedarfsschau vorgestellt
 * werden (PRD §8.8 Bedarfsschau-Format, §13.19 `termin_bedarf_bezug`).
 *
 * - Auth + `istKuratorVon(termin.stadt_id)`.
 * - `termin.typ` muss 'bedarfsschau' sein — andere Typen haben keine
 *   Bedarf-Bezuege.
 * - Body Zod-validiert: `{ bedarf_ids: string[], reihenfolge?: Record<id,n> }`.
 * - Idempotente Wunsch-Liste: DELETE existing, INSERT new in einer Transaktion.
 * - Audit-Log.
 * - Returns 200 mit `{ anzahl: N }`.
 */

import { eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  auditLog,
  bedarf,
  termin,
  terminBedarfBezug,
} from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';
import { rejectIfBadOrigin } from '@/lib/auth/csrf';
import { istKuratorVon } from '@/lib/auth/permissions';
import { terminBedarfeSetzenSchema } from '@/lib/validators/termin';

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
            'Nur Kurator:innen der jeweiligen Stadt koennen die Bedarfe einer Bedarfsschau setzen.',
        },
      },
      { status: 403 },
    );
  }

  if (row.typ !== 'bedarfsschau') {
    return Response.json(
      {
        error: {
          code: 'falscher_typ',
          message:
            'Bedarf-Bezuege koennen nur fuer Termine mit Typ "bedarfsschau" gesetzt werden.',
        },
      },
      { status: 422 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ fehler: 'ungueltiger_body' }, { status: 400 });
  }

  const parsed = terminBedarfeSetzenSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { fehler: 'validierung', details: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }
  const { bedarf_ids, reihenfolge } = parsed.data;

  // Duplikate aus dem Input entfernen.
  const uniqueIds = Array.from(new Set(bedarf_ids));

  // Pruefen, dass alle bedarf_ids existieren und zur Stadt gehoeren.
  let gueltigeIds: string[] = [];
  if (uniqueIds.length > 0) {
    const found = await db
      .select({ id: bedarf.id, stadtId: bedarf.stadtId })
      .from(bedarf)
      .where(inArray(bedarf.id, uniqueIds));
    const stadtMissmatch = found.filter((f) => f.stadtId !== row.stadtId);
    if (stadtMissmatch.length > 0) {
      return Response.json(
        {
          error: {
            code: 'fremde_stadt',
            message:
              'Mindestens ein Bedarf gehoert nicht zur Stadt dieses Termins.',
          },
        },
        { status: 422 },
      );
    }
    gueltigeIds = found.map((f) => f.id);
    const fehlend = uniqueIds.filter((bid) => !gueltigeIds.includes(bid));
    if (fehlend.length > 0) {
      return Response.json(
        {
          error: {
            code: 'unbekannte_ids',
            message: 'Mindestens ein Bedarf existiert nicht.',
            details: { ids: fehlend },
          },
        },
        { status: 422 },
      );
    }
  }

  await db.transaction(async (tx) => {
    await tx
      .delete(terminBedarfBezug)
      .where(eq(terminBedarfBezug.terminId, id));
    if (gueltigeIds.length > 0) {
      await tx.insert(terminBedarfBezug).values(
        gueltigeIds.map((bid, idx) => ({
          terminId: id,
          bedarfId: bid,
          reihenfolge:
            reihenfolge?.[bid] !== undefined ? reihenfolge[bid]! : idx,
        })),
      );
    }
  });

  try {
    await db.insert(auditLog).values({
      nutzerId: sess.nutzerId,
      aktion: 'termin.bedarfe_gesetzt',
      referenzTyp: 'termin',
      referenzId: id,
      metadaten: { anzahl: gueltigeIds.length, bedarf_ids: gueltigeIds },
    });
  } catch {
    // Audit-Failure darf den Erfolg nicht blockieren.
  }

  return Response.json({ anzahl: gueltigeIds.length });
}
