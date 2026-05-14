/**
 * GET /api/v1/admin/nutzer
 *
 * Admin-Liste aller Nutzer:innen mit Such- und Filter-Funktion.
 *
 * Query-Parameter (alle optional):
 *   - q        Volltext-Pattern (case-insensitive) gegen email, klarname,
 *              anzeigename. ILIKE %q% — keine Wildcards/Regex.
 *   - stadt    Stadt-Kuerzel (exakt).
 *   - rolle    Rolle (exakt). ANY-Match auf das rollen-Array.
 *   - status   Nutzer-Status (exakt).
 *   - limit    Default 50, max 200.
 *   - offset   Pagination.
 *
 * Permission: Rolle 'admin'.
 *
 * PRD-Referenz: §15.14, §26 (Admin-Backoffice).
 */

import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';

import { db } from '@/lib/db';
import { nutzer } from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';
import { istAdmin } from '@/lib/auth/permissions';
import { adminNutzerListQuerySchema } from '@/lib/validators/admin';

export async function GET(req: Request): Promise<Response> {
  const sess = await getSessionFromRequest(req);
  if (!sess) {
    return Response.json({ fehler: 'unauthenticated' }, { status: 401 });
  }
  if (!istAdmin(sess.nutzer)) {
    return Response.json(
      {
        error: {
          code: 'kein_zugriff',
          message: 'Nur Admins koennen die Nutzer-Liste sehen.',
        },
      },
      { status: 403 },
    );
  }

  const url = new URL(req.url);
  const queryInput: Record<string, unknown> = {};
  for (const [key, value] of url.searchParams.entries()) {
    if (value !== '') queryInput[key] = value;
  }
  const parsed = adminNutzerListQuerySchema.safeParse(queryInput);
  if (!parsed.success) {
    return Response.json(
      { fehler: 'validierung', details: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }
  const q = parsed.data;

  const filters = [];
  if (q.q) {
    const pat = `%${q.q}%`;
    filters.push(
      or(
        ilike(nutzer.email, pat),
        ilike(nutzer.klarname, pat),
        ilike(nutzer.anzeigename, pat),
      )!,
    );
  }
  if (q.stadt) filters.push(eq(nutzer.stadtId, q.stadt));
  if (q.status) filters.push(eq(nutzer.status, q.status));
  if (q.rolle) {
    // rollen ist text[] — `= ANY(rollen)` Pattern
    filters.push(sql`${q.rolle} = ANY(${nutzer.rollen})`);
  }

  const rows = await db
    .select({
      id: nutzer.id,
      email: nutzer.email,
      klarname: nutzer.klarname,
      anzeigename: nutzer.anzeigename,
      stadtId: nutzer.stadtId,
      rollen: nutzer.rollen,
      status: nutzer.status,
      erstelltAm: nutzer.erstelltAm,
    })
    .from(nutzer)
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(desc(nutzer.erstelltAm), desc(nutzer.id))
    .limit(q.limit)
    .offset(q.offset);

  return Response.json({ nutzer: rows, limit: q.limit, offset: q.offset });
}
