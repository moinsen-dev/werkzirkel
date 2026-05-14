/**
 * POST /api/v1/hilfegesuche/:id/antwort
 *
 * Eingeloggte Person hinterlaesst eine Antwort als Kommentar an einem
 * Hilfegesuch. Antworten sind das einzige Kommentar-Feature in v1.0
 * (PRD §8.15).
 *
 * Beim ersten Antwort-Eintrag wird der Hilfegesuch-Status von 'offen' auf
 * 'beantwortet' gesetzt — das ist UX-Bonus, kein harter Gate. Abgelaufene
 * Hilfegesuche koennen keine neuen Antworten mehr aufnehmen (422).
 */

import { eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import {
  auditLog,
  hilfegesuch,
  hilfegesuchAntwort,
} from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';
import { rejectIfBadOrigin } from '@/lib/auth/csrf';
import { hilfegesuchAntwortSchema } from '@/lib/validators/hilfegesuch';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(
  req: Request,
  ctx: RouteContext,
): Promise<Response> {
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

  const parsed = hilfegesuchAntwortSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { fehler: 'validierung', details: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }
  const input = parsed.data;

  const rows = await db
    .select({
      id: hilfegesuch.id,
      status: hilfegesuch.status,
      gueltigBis: hilfegesuch.gueltigBis,
    })
    .from(hilfegesuch)
    .where(eq(hilfegesuch.id, id))
    .limit(1);
  const current = rows[0];
  if (!current) {
    return Response.json({ fehler: 'nicht_gefunden' }, { status: 404 });
  }
  if (current.status === 'abgelaufen' || current.gueltigBis.getTime() < Date.now()) {
    return Response.json(
      {
        error: {
          code: 'hilfegesuch_abgelaufen',
          message: 'Dieses Hilfegesuch ist abgelaufen. Antworten sind nicht mehr moeglich.',
        },
      },
      { status: 422 },
    );
  }

  const inserted = await db
    .insert(hilfegesuchAntwort)
    .values({
      hilfegesuchId: id,
      nutzerId: sess.nutzerId,
      text: input.text,
    })
    .returning();
  const row = inserted[0];
  if (!row) {
    return Response.json({ fehler: 'unbekannt' }, { status: 500 });
  }

  // Bei erster Antwort: Status von 'offen' auf 'beantwortet' verschieben.
  if (current.status === 'offen') {
    await db
      .update(hilfegesuch)
      .set({ status: 'beantwortet' })
      .where(eq(hilfegesuch.id, id));
  }

  try {
    await db.insert(auditLog).values({
      nutzerId: sess.nutzerId,
      aktion: 'hilfegesuch_antwort.angelegt',
      referenzTyp: 'hilfegesuch_antwort',
      referenzId: row.id,
      metadaten: { hilfegesuch_id: id },
    });
  } catch {
    // Audit-Failure tolerabel.
  }

  return Response.json({ antwort: row }, { status: 201 });
}
