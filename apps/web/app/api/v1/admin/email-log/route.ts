/**
 * GET /api/v1/admin/email-log
 *
 * Paginierte Email-Log-Liste mit Filtern.
 *
 * Query-Parameter (alle optional):
 *   - template   exakt (z.B. 'T-101 pruefrunde-neue-anmeldung')
 *   - status     'gesendet' | 'fehlgeschlagen' | 'bounced'
 *   - nutzer_id  exakt
 *   - von / bis  ISO-Datum
 *   - limit, offset
 *
 * Permission: Rolle 'admin'.
 *
 * PRD-Referenz: §15.14 (E-Mail-Log-Browser).
 */

import { and, desc, eq, gte, lt } from 'drizzle-orm';

import { db } from '@/lib/db';
import { emailBenachrichtigungLog } from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';
import { istAdmin } from '@/lib/auth/permissions';
import { adminEmailLogQuerySchema } from '@/lib/validators/admin';

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
          message: 'Nur Admins koennen das E-Mail-Log einsehen.',
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
  const parsed = adminEmailLogQuerySchema.safeParse(queryInput);
  if (!parsed.success) {
    return Response.json(
      { fehler: 'validierung', details: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }
  const q = parsed.data;

  const filters = [];
  if (q.template) filters.push(eq(emailBenachrichtigungLog.template, q.template));
  if (q.status) filters.push(eq(emailBenachrichtigungLog.status, q.status));
  if (q.nutzer_id)
    filters.push(eq(emailBenachrichtigungLog.nutzerId, q.nutzer_id));
  if (q.von) {
    const start = new Date(`${q.von}T00:00:00.000Z`);
    filters.push(gte(emailBenachrichtigungLog.erstelltAm, start));
  }
  if (q.bis) {
    const bisDate = new Date(`${q.bis}T00:00:00.000Z`);
    bisDate.setUTCDate(bisDate.getUTCDate() + 1);
    filters.push(lt(emailBenachrichtigungLog.erstelltAm, bisDate));
  }

  const rows = await db
    .select()
    .from(emailBenachrichtigungLog)
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(
      desc(emailBenachrichtigungLog.erstelltAm),
      desc(emailBenachrichtigungLog.id),
    )
    .limit(q.limit)
    .offset(q.offset);

  return Response.json({
    eintraege: rows,
    limit: q.limit,
    offset: q.offset,
  });
}
