/**
 * POST /api/v1/bedarfe/:id/erfolgsbeitrag/ueberspringen
 *
 * Der explizite No-Payment-Exit zum Erfolgsbeitrag-Panel (PRD §10.10 +
 * §21: "Schaltfläche `Ohne Beitrag fortfahren` ist deutlich sichtbar —
 * kein Dark Pattern"). Loggt die Entscheidung im audit_log und
 * redirected zurück auf die Bedarfs-Detailseite mit Erfolgs-Banner.
 *
 * Schreibt KEINE erfolgsbeitrag-Row — der Beitrag ist ausdrücklich
 * freiwillig, "nicht gegeben" ist kein Zahlungs-Vorgang, sondern der
 * Default-Zustand nach dem Erfüllt-Markieren.
 *
 * Vorbedingungen:
 *  - Auth + Owner des Bedarfs.
 *  - Bedarf hat Status `erfuellt` (PRD §F-605 — sonst hat das Panel
 *    erst gar nicht geblickt).
 */

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { auditLog, bedarf } from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';
import { rejectIfBadOrigin } from '@/lib/auth/csrf';
import { env } from '@/lib/env';

interface RouteContext {
  params: Promise<{ id: string }>;
}

function clientIp(req: Request): string | null {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    null
  );
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
      {
        error: {
          code: 'kein_zugriff',
          message: 'Nur die Inhaber:in darf den Erfolgsbeitrag überspringen.',
        },
      },
      { status: 403 },
    );
  }

  if (row.status !== 'erfuellt') {
    return Response.json(
      {
        error: {
          code: 'falscher_status',
          message:
            'Erfolgsbeitrag-Überspringen ist nur möglich, wenn der Bedarf bereits erfüllt markiert wurde.',
        },
      },
      { status: 422 },
    );
  }

  try {
    await db.insert(auditLog).values({
      nutzerId: sess.nutzerId,
      aktion: 'bedarf.erfolgsbeitrag-uebersprungen',
      referenzTyp: 'bedarf',
      referenzId: row.id,
      ipAdresse: clientIp(req),
      userAgent: req.headers.get('user-agent'),
    });
  } catch {
    // Audit-Failure darf den No-Payment-Exit nicht blockieren.
  }

  // 303 → Browser fuehrt einen GET auf das Redirect-Target aus.
  const target = `${env.APP_URL.replace(/\/+$/, '')}/bedarfe/${row.id}?erfolg=erfolgsbeitrag_uebersprungen`;
  return new Response(null, {
    status: 303,
    headers: { location: target },
  });
}
