/**
 * GET /api/v1/kurator/meldungen
 *
 * Kurator-Postfach: Liste aller Meldungen mit Status-Filter.
 * Default-Filter: alle Status. `?status=offen` schraenkt ein.
 *
 * Permission: User muss Rolle 'kurator' oder 'admin' haben.
 *   (Stadt-Scope wird hier bewusst nicht erzwungen — Meldungen sind global
 *   relevant; jede Kurator:in sieht alle, gemaess PRD §27.)
 *
 * PRD-Referenz: §27 (Moderations-Workflow), §F-503.
 */

import { and, desc, eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { meldung, nutzer } from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';
import { hasRolle } from '@/lib/auth/permissions';
import { meldungenListQuerySchema } from '@/lib/validators/meldung';

export async function GET(req: Request): Promise<Response> {
  const sess = await getSessionFromRequest(req);
  if (!sess) {
    return Response.json({ fehler: 'unauthenticated' }, { status: 401 });
  }

  if (!hasRolle(sess.nutzer, 'kurator') && !hasRolle(sess.nutzer, 'admin')) {
    return Response.json(
      {
        error: {
          code: 'kein_zugriff',
          message:
            'Nur Kurator:innen und Admins koennen das Melde-Postfach lesen.',
        },
      },
      { status: 403 },
    );
  }

  const url = new URL(req.url);
  const params = url.searchParams;
  const queryInput: Record<string, unknown> = {};
  const status = params.get('status');
  if (status !== null && status !== '') queryInput.status = status;
  const limit = params.get('limit');
  if (limit !== null && limit !== '') queryInput.limit = limit;

  const parsed = meldungenListQuerySchema.safeParse(queryInput);
  if (!parsed.success) {
    return Response.json(
      { fehler: 'validierung', details: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }
  const q = parsed.data;

  const filters = [];
  if (q.status) filters.push(eq(meldung.status, q.status));

  const rows = await db
    .select({
      meldung,
      melderAnzeigename: nutzer.anzeigename,
    })
    .from(meldung)
    .leftJoin(nutzer, eq(nutzer.id, meldung.gemeldetVon))
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(desc(meldung.erstelltAm), desc(meldung.id))
    .limit(q.limit);

  return Response.json({
    meldungen: rows.map((r) => ({
      ...r.meldung,
      melder_anzeigename: r.melderAnzeigename, // null wenn anonyme Meldung
    })),
  });
}
