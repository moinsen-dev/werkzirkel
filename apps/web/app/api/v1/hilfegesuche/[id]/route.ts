/**
 * GET + DELETE /api/v1/hilfegesuche/:id
 *
 * - GET: Detail inklusive Antworten (sortiert nach erstellt_am ASC) und
 *   Autor:innen-Metadaten. Auth Pflicht — Hilfegesuche sind nur fuer
 *   eingeloggte Mitglieder sichtbar.
 * - DELETE: nur Owner. CASCADE raeumt Antworten ueber FK
 *   `hilfegesuch_antwort.hilfegesuch_id -> hilfegesuch.id ON DELETE CASCADE`.
 */

import { asc, eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import {
  auditLog,
  hilfegesuch,
  hilfegesuchAntwort,
  nutzer,
} from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';
import { rejectIfBadOrigin } from '@/lib/auth/csrf';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(req: Request, ctx: RouteContext): Promise<Response> {
  const sess = await getSessionFromRequest(req);
  if (!sess) {
    return Response.json({ fehler: 'unauthenticated' }, { status: 401 });
  }

  const { id } = await ctx.params;

  const rows = await db
    .select({
      hilfegesuch,
      autorId: nutzer.id,
      autorAnzeigename: nutzer.anzeigename,
      autorAvatarUrl: nutzer.avatarUrl,
      autorStadtId: nutzer.stadtId,
    })
    .from(hilfegesuch)
    .innerJoin(nutzer, eq(nutzer.id, hilfegesuch.nutzerId))
    .where(eq(hilfegesuch.id, id))
    .limit(1);

  const row = rows[0];
  if (!row) {
    return Response.json({ fehler: 'nicht_gefunden' }, { status: 404 });
  }

  const antworten = await db
    .select({
      antwort: hilfegesuchAntwort,
      autorId: nutzer.id,
      autorAnzeigename: nutzer.anzeigename,
      autorAvatarUrl: nutzer.avatarUrl,
    })
    .from(hilfegesuchAntwort)
    .innerJoin(nutzer, eq(nutzer.id, hilfegesuchAntwort.nutzerId))
    .where(eq(hilfegesuchAntwort.hilfegesuchId, id))
    .orderBy(asc(hilfegesuchAntwort.erstelltAm), asc(hilfegesuchAntwort.id));

  return Response.json({
    hilfegesuch: row.hilfegesuch,
    autor: {
      id: row.autorId,
      anzeigename: row.autorAnzeigename,
      avatar_url: row.autorAvatarUrl,
      stadt_id: row.autorStadtId,
    },
    antworten: antworten.map((a) => ({
      ...a.antwort,
      autor: {
        id: a.autorId,
        anzeigename: a.autorAnzeigename,
        avatar_url: a.autorAvatarUrl,
      },
    })),
  });
}

export async function DELETE(
  req: Request,
  ctx: RouteContext,
): Promise<Response> {
  const originResp = rejectIfBadOrigin(req);
  if (originResp) return originResp;

  const sess = await getSessionFromRequest(req);
  if (!sess) {
    return Response.json({ fehler: 'unauthenticated' }, { status: 401 });
  }

  const { id } = await ctx.params;

  const existing = await db
    .select({ id: hilfegesuch.id, nutzerId: hilfegesuch.nutzerId })
    .from(hilfegesuch)
    .where(eq(hilfegesuch.id, id))
    .limit(1);
  const current = existing[0];
  if (!current) {
    return Response.json({ fehler: 'nicht_gefunden' }, { status: 404 });
  }
  if (current.nutzerId !== sess.nutzerId) {
    return Response.json(
      {
        error: {
          code: 'kein_zugriff',
          message: 'Du kannst nur eigene Hilfegesuche loeschen.',
        },
      },
      { status: 403 },
    );
  }

  await db.delete(hilfegesuch).where(eq(hilfegesuch.id, id));

  try {
    await db.insert(auditLog).values({
      nutzerId: sess.nutzerId,
      aktion: 'hilfegesuch.geloescht',
      referenzTyp: 'hilfegesuch',
      referenzId: id,
    });
  } catch {
    // Audit-Failure tolerabel.
  }

  return new Response(null, { status: 204 });
}
