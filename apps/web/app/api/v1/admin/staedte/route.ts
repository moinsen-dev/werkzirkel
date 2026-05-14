/**
 * GET  /api/v1/admin/staedte — Liste aller Staedte (auch inaktive).
 * POST /api/v1/admin/staedte — Neue Stadt anlegen (DACH-Erweiterung).
 *
 * Stadt-Id ist ein menschenlesbares Kuerzel (z.B. 'hh') — KEIN cuid2.
 *
 * Permission: Rolle 'admin'.
 *
 * PRD-Referenz: §15.14 (Admin-Endpunkte), §10 (Staedte).
 */

import { eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { auditLog, stadt } from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';
import { rejectIfBadOrigin } from '@/lib/auth/csrf';
import { istAdmin } from '@/lib/auth/permissions';
import { adminStadtAnlegenSchema } from '@/lib/validators/admin';

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
          message: 'Nur Admins koennen die Staedte-Liste verwalten.',
        },
      },
      { status: 403 },
    );
  }

  const rows = await db.select().from(stadt).orderBy(stadt.sortierung, stadt.id);
  return Response.json({ staedte: rows });
}

export async function POST(req: Request): Promise<Response> {
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
          message: 'Nur Admins koennen Staedte anlegen.',
        },
      },
      { status: 403 },
    );
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return Response.json({ fehler: 'ungueltiger_body' }, { status: 400 });
  }

  const parsed = adminStadtAnlegenSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json(
      { fehler: 'validierung', details: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }
  const input = parsed.data;
  const idNormalized = input.id.toLowerCase();

  // Duplikat-Check (id ODER name).
  const existsById = await db
    .select({ id: stadt.id })
    .from(stadt)
    .where(eq(stadt.id, idNormalized))
    .limit(1);
  if (existsById.length > 0) {
    return Response.json(
      {
        error: {
          code: 'stadt_existiert',
          message: 'Eine Stadt mit diesem Kuerzel existiert bereits.',
        },
      },
      { status: 409 },
    );
  }

  try {
    const inserted = await db
      .insert(stadt)
      .values({
        id: idNormalized,
        name: input.name,
        status: input.status,
        beschreibung: input.beschreibung ?? null,
        sortierung: input.sortierung,
      })
      .returning();
    const row = inserted[0]!;

    try {
      await db.insert(auditLog).values({
        nutzerId: sess.nutzerId,
        aktion: 'stadt.angelegt',
        referenzTyp: 'stadt',
        referenzId: row.id,
        metadaten: { name: row.name, status: row.status },
      });
    } catch {
      /* audit best-effort */
    }

    return Response.json({ stadt: row }, { status: 201 });
  } catch (err) {
    // Wenn der unique-name-Constraint zuschlaegt
    if (err instanceof Error && /unique/i.test(err.message)) {
      return Response.json(
        {
          error: {
            code: 'name_existiert',
            message: 'Eine Stadt mit diesem Namen existiert bereits.',
          },
        },
        { status: 409 },
      );
    }
    throw err;
  }
}
