/**
 * GET /api/v1/admin/audit-log
 *
 * Paginierte Audit-Log-Liste mit Filtern.
 *
 * Query-Parameter (alle optional):
 *   - aktion     exakt (z.B. 'meldung.resolviert')
 *   - nutzer_id  exakt
 *   - von        ISO-Datum (yyyy-mm-dd) — inklusiv, ab Tagesbeginn
 *   - bis        ISO-Datum (yyyy-mm-dd) — inklusiv, bis Tagesende
 *   - limit, offset
 *
 * Permission: Rolle 'admin'.
 *
 * PRD-Referenz: §15.14 (Audit-Log-Browser).
 */

import { and, desc, eq, gte, lt } from 'drizzle-orm';

import { db } from '@/lib/db';
import { auditLog } from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';
import { istAdmin } from '@/lib/auth/permissions';
import { adminAuditLogQuerySchema } from '@/lib/validators/admin';

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
          message: 'Nur Admins koennen das Audit-Log einsehen.',
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
  const parsed = adminAuditLogQuerySchema.safeParse(queryInput);
  if (!parsed.success) {
    return Response.json(
      { fehler: 'validierung', details: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }
  const q = parsed.data;

  const filters = [];
  if (q.aktion) filters.push(eq(auditLog.aktion, q.aktion));
  if (q.nutzer_id) filters.push(eq(auditLog.nutzerId, q.nutzer_id));
  if (q.von) {
    const start = new Date(`${q.von}T00:00:00.000Z`);
    filters.push(gte(auditLog.erstelltAm, start));
  }
  if (q.bis) {
    // bis ist inklusiv (Tagesende) — wir nutzen `< (bis + 1 Tag)`.
    const bisDate = new Date(`${q.bis}T00:00:00.000Z`);
    bisDate.setUTCDate(bisDate.getUTCDate() + 1);
    filters.push(lt(auditLog.erstelltAm, bisDate));
  }

  const rows = await db
    .select()
    .from(auditLog)
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(desc(auditLog.erstelltAm), desc(auditLog.id))
    .limit(q.limit)
    .offset(q.offset);

  return Response.json({
    eintraege: rows,
    limit: q.limit,
    offset: q.offset,
  });
}
