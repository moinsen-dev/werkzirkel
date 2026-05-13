/**
 * GET /api/v1/me/export
 *
 * DSGVO-Self-Service-Export (PRD §34, §15.2):
 * Liefert einen vollstaendigen JSON-Dump aller personenbezogenen Daten der
 * eingeloggten Nutzer:in. Headers liefern Content-Disposition: attachment, sodass
 * Browser den Download direkt anstossen.
 *
 * Aggregation liegt in `lib/dsgvo/export.ts` — derselbe Helper wird vom
 * Konto-Loeschungs-Cron als T-005-Anhang verwendet.
 *
 * - Auth: erforderlich (sonst 401)
 * - Rate-Limit: 1 Aufruf pro Nutzer:in pro Stunde (sonst 429)
 * - Audit-Log: jeder Export wird mit aktion='me.export' protokolliert
 */

import { db } from '@/lib/db';
import { auditLog } from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';
import { checkLimit } from '@/lib/auth/rate-limit';
import { buildExport } from '@/lib/dsgvo/export';

const EXPORT_RATE_LIMIT_MAX = 1;
const EXPORT_RATE_LIMIT_WINDOW_MIN = 60;

export async function GET(req: Request): Promise<Response> {
  const sess = await getSessionFromRequest(req);
  if (!sess) {
    return Response.json({ fehler: 'unauthenticated' }, { status: 401 });
  }

  const limit = await checkLimit({
    key: `nutzer:${sess.nutzerId}`,
    endpoint: 'me-export',
    max: EXPORT_RATE_LIMIT_MAX,
    windowMinutes: EXPORT_RATE_LIMIT_WINDOW_MIN,
  });
  if (!limit.ok) {
    return Response.json({ fehler: 'rate_limit' }, { status: 429 });
  }

  const exportObject = await buildExport(sess.nutzerId, sess.nutzer);

  // Audit-Log eintragen (best-effort — Export wird trotzdem ausgeliefert).
  try {
    await db.insert(auditLog).values({
      nutzerId: sess.nutzerId,
      aktion: 'me.export',
      referenzTyp: 'nutzer',
      referenzId: sess.nutzerId,
      ipAdresse:
        req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
        req.headers.get('x-real-ip') ??
        null,
      userAgent: req.headers.get('user-agent'),
    });
  } catch {
    // Audit-Failure darf den Export nicht blockieren.
  }

  const isoDate = new Date().toISOString().slice(0, 10);
  const filename = `werkzirkel-export-${isoDate}.json`;
  const body = JSON.stringify(exportObject, null, 2);

  return new Response(body, {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'no-store',
    },
  });
}
