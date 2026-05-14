/**
 * DELETE /api/v1/hilfegesuch-antworten/:id
 *
 * Loescht eine eigene Antwort an einem Hilfegesuch. Nur Autor:in darf
 * loeschen; sonst 403. 404 wenn unbekannt.
 */

import { eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { auditLog, hilfegesuchAntwort } from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';
import { rejectIfBadOrigin } from '@/lib/auth/csrf';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function DELETE(
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

  const existing = await db
    .select({
      id: hilfegesuchAntwort.id,
      nutzerId: hilfegesuchAntwort.nutzerId,
      hilfegesuchId: hilfegesuchAntwort.hilfegesuchId,
    })
    .from(hilfegesuchAntwort)
    .where(eq(hilfegesuchAntwort.id, id))
    .limit(1);
  const current = existing[0];
  if (!current) {
    return Response.json({ fehler: 'nicht_gefunden' }, { status: 404 });
  }
  if (current.nutzerId !== sess.nutzerId) {
    return Response.json(
      {
        error: {
          code: 'kein_zugriff',
          message: 'Du kannst nur eigene Antworten loeschen.',
        },
      },
      { status: 403 },
    );
  }

  await db.delete(hilfegesuchAntwort).where(eq(hilfegesuchAntwort.id, id));

  try {
    await db.insert(auditLog).values({
      nutzerId: sess.nutzerId,
      aktion: 'hilfegesuch_antwort.geloescht',
      referenzTyp: 'hilfegesuch_antwort',
      referenzId: id,
      metadaten: { hilfegesuch_id: current.hilfegesuchId },
    });
  } catch {
    // Audit-Failure tolerabel.
  }

  return new Response(null, { status: 204 });
}
