/**
 * POST /api/v1/foerderprofile/:id/pausieren
 *
 * Foerderprofil von 'verifiziert' → 'pausiert' (Owner-pausiert sich selbst).
 *
 * PRD-Referenz: §F-704.
 */

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { auditLog, foerderprofil } from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';
import { rejectIfBadOrigin } from '@/lib/auth/csrf';
import { serializeFoerderprofil } from '@/lib/foerderprofil/serialize';

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
    .select()
    .from(foerderprofil)
    .where(eq(foerderprofil.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) {
    return Response.json({ fehler: 'nicht_gefunden' }, { status: 404 });
  }

  if (row.nutzerId !== sess.nutzerId) {
    return Response.json(
      { error: { code: 'kein_zugriff', message: 'Nur die Inhaber:in darf pausieren.' } },
      { status: 403 },
    );
  }

  if (row.verifikationStatus !== 'verifiziert') {
    return Response.json(
      {
        error: {
          code: 'falscher_status',
          message: 'Nur verifizierte Profile koennen pausiert werden.',
        },
      },
      { status: 422 },
    );
  }

  const updated = await db
    .update(foerderprofil)
    .set({
      verifikationStatus: 'pausiert',
      pausiertSeit: new Date(),
      aktualisiertAm: new Date(),
    })
    .where(eq(foerderprofil.id, row.id))
    .returning();
  const updatedRow = updated[0]!;

  try {
    await db.insert(auditLog).values({
      nutzerId: sess.nutzerId,
      aktion: 'foerderprofil.pausiert_owner',
      referenzTyp: 'foerderprofil',
      referenzId: row.id,
    });
  } catch {
    // Audit-Failure darf den Erfolg nicht blockieren.
  }

  return Response.json({ foerderprofil: serializeFoerderprofil(updatedRow) });
}
