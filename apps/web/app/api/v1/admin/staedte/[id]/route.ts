/**
 * PATCH /api/v1/admin/staedte/:id
 *
 * Aktualisiert Stadt-Felder. Insbesondere `status` (aktivieren/deaktivieren).
 *
 * Permission: Rolle 'admin'.
 *
 * PRD-Referenz: §15.14, §10.
 */

import { eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { auditLog, stadt } from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';
import { rejectIfBadOrigin } from '@/lib/auth/csrf';
import { istAdmin } from '@/lib/auth/permissions';
import { adminStadtUpdateSchema } from '@/lib/validators/admin';

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
  if (!istAdmin(sess.nutzer)) {
    return Response.json(
      {
        error: {
          code: 'kein_zugriff',
          message: 'Nur Admins koennen Staedte aendern.',
        },
      },
      { status: 403 },
    );
  }

  const { id } = await ctx.params;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return Response.json({ fehler: 'ungueltiger_body' }, { status: 400 });
  }

  const parsed = adminStadtUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json(
      { fehler: 'validierung', details: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }
  const input = parsed.data;

  const rows = await db.select().from(stadt).where(eq(stadt.id, id)).limit(1);
  const row = rows[0];
  if (!row) {
    return Response.json({ fehler: 'nicht_gefunden' }, { status: 404 });
  }

  const updates: Partial<typeof stadt.$inferInsert> = {
    aktualisiertAm: new Date(),
  };
  if (input.status !== undefined) updates.status = input.status;
  if (input.name !== undefined) updates.name = input.name;
  if (input.beschreibung !== undefined) updates.beschreibung = input.beschreibung;
  if (input.sortierung !== undefined) updates.sortierung = input.sortierung;

  const updated = await db
    .update(stadt)
    .set(updates)
    .where(eq(stadt.id, id))
    .returning();
  const updatedRow = updated[0]!;

  try {
    await db.insert(auditLog).values({
      nutzerId: sess.nutzerId,
      aktion: 'stadt.aktualisiert',
      referenzTyp: 'stadt',
      referenzId: id,
      metadaten: {
        vorher: { status: row.status, name: row.name },
        nachher: { status: updatedRow.status, name: updatedRow.name },
      },
    });
  } catch {
    /* audit best-effort */
  }

  return Response.json({ stadt: updatedRow });
}
