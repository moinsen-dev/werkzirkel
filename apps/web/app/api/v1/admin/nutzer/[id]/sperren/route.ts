/**
 * POST /api/v1/admin/nutzer/:id/sperren
 *
 * Sperrt eine Nutzer:in:
 *   1. nutzer.status = 'gesperrt'
 *   2. ALLE aktiven Sessions des Users werden geloescht — der User wird
 *      damit auf der Stelle ausgeloggt (Akzeptanz-Kriterium PRD-Task).
 *   3. Audit-Log-Eintrag 'nutzer.gesperrt' mit Grund.
 *
 * Idempotent: ist die Person bereits gesperrt, wird der Status nicht erneut
 * geaendert; Sessions werden trotzdem aufgeraeumt (defensiv).
 *
 * Permission: Rolle 'admin'.
 *
 * PRD-Referenz: §15.14, §F-504.
 */

import { eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { auditLog, nutzer, session as sessionTable } from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';
import { rejectIfBadOrigin } from '@/lib/auth/csrf';
import { istAdmin } from '@/lib/auth/permissions';
import { adminNutzerSperrenSchema } from '@/lib/validators/admin';

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
  if (!istAdmin(sess.nutzer)) {
    return Response.json(
      {
        error: {
          code: 'kein_zugriff',
          message: 'Nur Admins koennen Nutzer:innen sperren.',
        },
      },
      { status: 403 },
    );
  }

  const { id } = await ctx.params;

  // Body ist optional — wenn leer, Default-Grund=null.
  let grund: string | null = null;
  if (req.headers.get('content-length') !== '0') {
    try {
      const raw: unknown = await req.json();
      if (raw && typeof raw === 'object') {
        const parsed = adminNutzerSperrenSchema.safeParse(raw);
        if (!parsed.success) {
          return Response.json(
            { fehler: 'validierung', details: parsed.error.flatten().fieldErrors },
            { status: 422 },
          );
        }
        grund = parsed.data.grund ?? null;
      }
    } catch {
      /* leerer/ungueltiger body → grund bleibt null */
    }
  }

  const rows = await db
    .select()
    .from(nutzer)
    .where(eq(nutzer.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) {
    return Response.json({ fehler: 'nicht_gefunden' }, { status: 404 });
  }

  // Self-sperre verhindern — sonst koennte ein Admin sich aus Versehen aussperren.
  if (row.id === sess.nutzerId) {
    return Response.json(
      {
        error: {
          code: 'self_sperre',
          message: 'Du kannst dich nicht selbst sperren.',
        },
      },
      { status: 422 },
    );
  }

  if (row.status !== 'gesperrt') {
    await db
      .update(nutzer)
      .set({ status: 'gesperrt', aktualisiertAm: new Date() })
      .where(eq(nutzer.id, id));
  }

  // Alle Sessions des gesperrten Users invalidieren — Akzeptanz-Kriterium.
  const deletedSessions = await db
    .delete(sessionTable)
    .where(eq(sessionTable.nutzerId, id))
    .returning({ id: sessionTable.id });

  try {
    await db.insert(auditLog).values({
      nutzerId: sess.nutzerId,
      aktion: 'nutzer.gesperrt',
      referenzTyp: 'nutzer',
      referenzId: id,
      metadaten: {
        grund,
        sessions_invalidiert: deletedSessions.length,
      },
    });
  } catch {
    /* audit best-effort */
  }

  const updated = (
    await db.select().from(nutzer).where(eq(nutzer.id, id)).limit(1)
  )[0]!;

  return Response.json({
    nutzer: updated,
    sessions_invalidiert: deletedSessions.length,
  });
}
