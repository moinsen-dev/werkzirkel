/**
 * POST /api/v1/bedarfe/:id/erfuellt
 *
 * Bedarfstraeger:in markiert einen Bedarf als erfuellt. Status muss
 * 'oeffentlich' oder 'in_gespraechen' sein. Optional: `werk_id` (das Werk,
 * das den Bedarf erfuellt hat) und Selbstauskunft zur Groesse des
 * Auftrags (PRD §F-605).
 *
 * PRD-Referenz: §F-605, §14.3.
 */

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { auditLog, bedarf } from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';
import { rejectIfBadOrigin } from '@/lib/auth/csrf';
import { bedarfErfuelltSchema } from '@/lib/validators/bedarf';
import { serializeBedarf } from '@/lib/bedarf/serialize';

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
  const rows = await db.select().from(bedarf).where(eq(bedarf.id, id)).limit(1);
  const row = rows[0];
  if (!row) {
    return Response.json({ fehler: 'nicht_gefunden' }, { status: 404 });
  }

  if (row.nutzerId !== sess.nutzerId) {
    return Response.json(
      { error: { code: 'kein_zugriff', message: 'Nur die Inhaber:in darf den Bedarf erfuellt markieren.' } },
      { status: 403 },
    );
  }

  if (row.status !== 'oeffentlich' && row.status !== 'in_gespraechen') {
    return Response.json(
      {
        error: {
          code: 'falscher_status',
          message:
            'Nur oeffentliche oder in Gespraechen befindliche Bedarfe koennen erfuellt markiert werden.',
        },
      },
      { status: 422 },
    );
  }

  // Body ist optional (komplett leer ist erlaubt).
  let body: unknown = {};
  try {
    const raw = await req.text();
    if (raw && raw.trim().length > 0) {
      body = JSON.parse(raw);
    }
  } catch {
    return Response.json({ fehler: 'ungueltiger_body' }, { status: 400 });
  }

  const parsed = bedarfErfuelltSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { fehler: 'validierung', details: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }
  const input = parsed.data;

  const jetzt = new Date();
  const update: Partial<typeof bedarf.$inferInsert> = {
    status: 'erfuellt',
    erfuelltAm: jetzt,
    aktualisiertAm: jetzt,
  };
  if (input.werk_id !== undefined) update.erfuelltVonWerkId = input.werk_id;
  if (input.selbstauskunft_min_euro_cent !== undefined)
    update.selbstauskunftGroesseEuroCentMin = input.selbstauskunft_min_euro_cent;
  if (input.selbstauskunft_max_euro_cent !== undefined)
    update.selbstauskunftGroesseEuroCentMax = input.selbstauskunft_max_euro_cent;

  const updated = await db
    .update(bedarf)
    .set(update)
    .where(eq(bedarf.id, row.id))
    .returning();
  const updatedRow = updated[0]!;

  try {
    await db.insert(auditLog).values({
      nutzerId: sess.nutzerId,
      aktion: 'bedarf.erfuellt',
      referenzTyp: 'bedarf',
      referenzId: row.id,
      metadaten: {
        werk_id: input.werk_id ?? null,
        selbstauskunft_min: input.selbstauskunft_min_euro_cent ?? null,
        selbstauskunft_max: input.selbstauskunft_max_euro_cent ?? null,
      },
    });
  } catch {
    // Audit-Failure darf den Erfolg nicht blockieren.
  }

  return Response.json({ bedarf: serializeBedarf(updatedRow) });
}
