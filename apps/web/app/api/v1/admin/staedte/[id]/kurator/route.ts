/**
 * POST /api/v1/admin/staedte/:id/kurator
 *
 * Ernennt eine Nutzer:in zur Kurator:in einer Stadt.
 *
 * Atomar in EINER Transaktion:
 *   1. stadt.kuratorId = nutzer_id
 *   2. nutzer.rollen += 'kurator' (idempotent — falls schon enthalten,
 *      bleibt das Array unveraendert)
 *
 * Akzeptanz-Kriterium des Tasks: beide Updates in EINER Transaktion.
 *
 * Permission: Rolle 'admin'.
 *
 * PRD-Referenz: §15.14, §26.
 */

import { eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { auditLog, nutzer, stadt } from '@/lib/db/schema';
import type { Rolle } from '@/lib/db/schema/enums';
import { getSessionFromRequest } from '@/lib/auth/session';
import { rejectIfBadOrigin } from '@/lib/auth/csrf';
import { istAdmin } from '@/lib/auth/permissions';
import { adminKuratorErnennenSchema } from '@/lib/validators/admin';

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
  if (!istAdmin(sess.nutzer)) {
    return Response.json(
      {
        error: {
          code: 'kein_zugriff',
          message: 'Nur Admins koennen Kurator:innen ernennen.',
        },
      },
      { status: 403 },
    );
  }

  const { id: stadtId } = await ctx.params;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return Response.json({ fehler: 'ungueltiger_body' }, { status: 400 });
  }
  const parsed = adminKuratorErnennenSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json(
      { fehler: 'validierung', details: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }
  const { nutzer_id: nutzerId } = parsed.data;

  // Validierung: Stadt und Nutzer:in existieren?
  const stadtRows = await db
    .select()
    .from(stadt)
    .where(eq(stadt.id, stadtId))
    .limit(1);
  const stadtRow = stadtRows[0];
  if (!stadtRow) {
    return Response.json(
      { fehler: 'stadt_nicht_gefunden' },
      { status: 404 },
    );
  }

  const nutzerRows = await db
    .select()
    .from(nutzer)
    .where(eq(nutzer.id, nutzerId))
    .limit(1);
  const nutzerRow = nutzerRows[0];
  if (!nutzerRow) {
    return Response.json(
      { fehler: 'nutzer_nicht_gefunden' },
      { status: 404 },
    );
  }

  // Atomar in einer Transaktion
  const result = await db.transaction(async (tx) => {
    await tx
      .update(stadt)
      .set({ kuratorId: nutzerId, aktualisiertAm: new Date() })
      .where(eq(stadt.id, stadtId));

    // Idempotent: rollen-Array nur ergaenzen, wenn 'kurator' fehlt.
    const neueRollen: Rolle[] = nutzerRow.rollen.includes('kurator')
      ? nutzerRow.rollen
      : ([...nutzerRow.rollen, 'kurator'] as Rolle[]);
    await tx
      .update(nutzer)
      .set({ rollen: neueRollen, aktualisiertAm: new Date() })
      .where(eq(nutzer.id, nutzerId));

    const stadtAfter = (
      await tx.select().from(stadt).where(eq(stadt.id, stadtId)).limit(1)
    )[0]!;
    const nutzerAfter = (
      await tx.select().from(nutzer).where(eq(nutzer.id, nutzerId)).limit(1)
    )[0]!;

    return { stadt: stadtAfter, nutzer: nutzerAfter };
  });

  try {
    await db.insert(auditLog).values({
      nutzerId: sess.nutzerId,
      aktion: 'kurator.ernannt',
      referenzTyp: 'stadt',
      referenzId: stadtId,
      metadaten: {
        nutzer_id: nutzerId,
        anzeigename: result.nutzer.anzeigename,
      },
    });
  } catch {
    /* audit best-effort */
  }

  return Response.json({
    stadt: result.stadt,
    nutzer: result.nutzer,
  });
}
