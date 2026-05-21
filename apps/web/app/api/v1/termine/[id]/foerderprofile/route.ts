/**
 * POST /api/v1/termine/:id/foerderprofile
 *
 * Kurator setzt die Liste der Foerderprofile, die sich auf einer Briefing Night
 * persoenlich vorstellen (PRD §8.8 Briefing Night-Format, §13.20
 * `termin_foerderprofil_bezug`).
 *
 * - Auth + `istKuratorVon(termin.stadt_id)`.
 * - `termin.typ` muss 'bedarfsschau' sein.
 * - Body Zod-validiert: `{ foerderprofil_ids: string[], reihenfolge?: ... }`.
 * - Idempotente Wunsch-Liste: DELETE existing, INSERT new in einer Transaktion.
 * - Audit-Log.
 * - Returns 200 mit `{ anzahl: N }`.
 */

import { eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  auditLog,
  foerderprofil,
  nutzer,
  termin,
  terminFoerderprofilBezug,
} from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';
import { rejectIfBadOrigin } from '@/lib/auth/csrf';
import { istKuratorVon } from '@/lib/auth/permissions';
import { terminFoerderprofileSetzenSchema } from '@/lib/validators/termin';

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
            'Nur City-Leads der jeweiligen Stadt koennen die Foerderprofile einer Briefing Night setzen.',
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
            'Foerderprofil-Bezuege koennen nur fuer Termine mit Typ "bedarfsschau" gesetzt werden.',
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

  const parsed = terminFoerderprofileSetzenSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { fehler: 'validierung', details: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }
  const { foerderprofil_ids, reihenfolge } = parsed.data;

  const uniqueIds = Array.from(new Set(foerderprofil_ids));

  let gueltigeIds: string[] = [];
  if (uniqueIds.length > 0) {
    // Profile mit zugehoeriger nutzer.stadt_id holen, damit wir die Stadt
    // gegen die Termin-Stadt pruefen koennen.
    const found = await db
      .select({
        id: foerderprofil.id,
        nutzerStadtId: nutzer.stadtId,
      })
      .from(foerderprofil)
      .innerJoin(nutzer, eq(nutzer.id, foerderprofil.nutzerId))
      .where(inArray(foerderprofil.id, uniqueIds));

    const stadtMissmatch = found.filter(
      (f) => f.nutzerStadtId !== row.stadtId,
    );
    if (stadtMissmatch.length > 0) {
      return Response.json(
        {
          error: {
            code: 'fremde_stadt',
            message:
              'Mindestens ein Foerderprofil gehoert nicht zur Stadt dieses Termins.',
          },
        },
        { status: 422 },
      );
    }
    gueltigeIds = found.map((f) => f.id);
    const fehlend = uniqueIds.filter((fid) => !gueltigeIds.includes(fid));
    if (fehlend.length > 0) {
      return Response.json(
        {
          error: {
            code: 'unbekannte_ids',
            message: 'Mindestens ein Foerderprofil existiert nicht.',
            details: { ids: fehlend },
          },
        },
        { status: 422 },
      );
    }
  }

  await db.transaction(async (tx) => {
    await tx
      .delete(terminFoerderprofilBezug)
      .where(eq(terminFoerderprofilBezug.terminId, id));
    if (gueltigeIds.length > 0) {
      await tx.insert(terminFoerderprofilBezug).values(
        gueltigeIds.map((fid, idx) => ({
          terminId: id,
          foerderprofilId: fid,
          reihenfolge:
            reihenfolge?.[fid] !== undefined ? reihenfolge[fid]! : idx,
        })),
      );
    }
  });

  try {
    await db.insert(auditLog).values({
      nutzerId: sess.nutzerId,
      aktion: 'termin.foerderprofile_gesetzt',
      referenzTyp: 'termin',
      referenzId: id,
      metadaten: {
        anzahl: gueltigeIds.length,
        foerderprofil_ids: gueltigeIds,
      },
    });
  } catch {
    // Audit-Failure darf den Erfolg nicht blockieren.
  }

  return Response.json({ anzahl: gueltigeIds.length });
}
