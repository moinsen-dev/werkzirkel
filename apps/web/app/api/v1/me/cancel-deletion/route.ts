/**
 * POST /api/v1/me/cancel-deletion
 *
 * Konto-Loeschung Schritt 3 (PRD §10): widerruft eine laufende Loeschungs-
 * Karenz. Setzt `nutzer.status='aktiv'` und nullt `loeschung_anstehend_bis`.
 *
 * Idempotent: ein Aufruf bei Nutzer:in mit Status `aktiv` setzt nichts
 * Schaedliches, gibt ebenfalls 204.
 */

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { auditLog, nutzer } from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';
import { rejectIfBadOrigin } from '@/lib/auth/csrf';

function clientIp(req: Request): string | null {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    null
  );
}

export async function POST(req: Request): Promise<Response> {
  const originResp = rejectIfBadOrigin(req);
  if (originResp) return originResp;

  const sess = await getSessionFromRequest(req);
  if (!sess) {
    return Response.json({ fehler: 'unauthenticated' }, { status: 401 });
  }

  await db
    .update(nutzer)
    .set({
      status: 'aktiv',
      loeschungAnstehendBis: null,
      aktualisiertAm: new Date(),
    })
    .where(eq(nutzer.id, sess.nutzerId));

  // ── Audit-Log (best-effort) ──────────────────────────────────────────────
  try {
    await db.insert(auditLog).values({
      nutzerId: sess.nutzerId,
      aktion: 'me.deletion-cancelled',
      referenzTyp: 'nutzer',
      referenzId: sess.nutzerId,
      ipAdresse: clientIp(req),
      userAgent: req.headers.get('user-agent'),
    });
  } catch {
    // Audit-Failure darf den Widerruf nicht blockieren.
  }

  return new Response(null, { status: 204 });
}
