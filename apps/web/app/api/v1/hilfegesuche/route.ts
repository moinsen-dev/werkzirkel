/**
 * POST + GET /api/v1/hilfegesuche
 *
 * - POST: Eingeloggte Person legt ein Quick-Help an. Stadt wird automatisch
 *   aus `nutzer.stadtId` uebernommen. Gueltigkeit max 14 Tage ab Anlage.
 *   Mini-Forum-Feature (PRD §8.15) — daher KEINE Membership-Beitrag-Gate,
 *   keine Kurator-Pruefung, keine Sprach-Pruefung. Nur Auth + Validator.
 * - GET: Liste mit Filter stadt_id/tag/status. Default-Status `offen`.
 *   Sortiert nach `erstellt_am DESC`. Keine Cursor-Pagination — Hilfegesuche
 *   sind kurzlebig (14 Tage), `limit` allein reicht.
 */

import { and, arrayContains, desc, eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import {
  auditLog,
  hilfegesuch,
  nutzer,
} from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';
import { rejectIfBadOrigin } from '@/lib/auth/csrf';
import {
  hilfegesuchAnlegenSchema,
  hilfegesucheListQuerySchema,
} from '@/lib/validators/hilfegesuch';

export async function POST(req: Request): Promise<Response> {
  const originResp = rejectIfBadOrigin(req);
  if (originResp) return originResp;

  const sess = await getSessionFromRequest(req);
  if (!sess) {
    return Response.json({ fehler: 'unauthenticated' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ fehler: 'ungueltiger_body' }, { status: 400 });
  }

  const parsed = hilfegesuchAnlegenSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { fehler: 'validierung', details: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }
  const input = parsed.data;

  const inserted = await db
    .insert(hilfegesuch)
    .values({
      nutzerId: sess.nutzerId,
      werkId: input.werk_id ?? null,
      stadtId: sess.nutzer.stadtId,
      titel: input.titel,
      beschreibung: input.beschreibung,
      tags: input.tags,
      gueltigBis: input.gueltig_bis,
      status: 'offen',
    })
    .returning();

  const row = inserted[0];
  if (!row) {
    return Response.json({ fehler: 'unbekannt' }, { status: 500 });
  }

  try {
    await db.insert(auditLog).values({
      nutzerId: sess.nutzerId,
      aktion: 'hilfegesuch.angelegt',
      referenzTyp: 'hilfegesuch',
      referenzId: row.id,
    });
  } catch {
    // Audit-Failure darf den Erfolg nicht blockieren.
  }

  return Response.json({ hilfegesuch: row }, { status: 201 });
}

export async function GET(req: Request): Promise<Response> {
  const sess = await getSessionFromRequest(req);
  if (!sess) {
    return Response.json({ fehler: 'unauthenticated' }, { status: 401 });
  }

  const url = new URL(req.url);
  const params = url.searchParams;
  const queryInput: Record<string, unknown> = {};
  const stadtId = params.get('stadt_id');
  if (stadtId !== null && stadtId !== '') queryInput.stadt_id = stadtId;
  const tag = params.get('tag');
  if (tag !== null && tag !== '') queryInput.tag = tag;
  const status = params.get('status');
  if (status !== null && status !== '') queryInput.status = status;
  const limit = params.get('limit');
  if (limit !== null && limit !== '') queryInput.limit = limit;

  const parsed = hilfegesucheListQuerySchema.safeParse(queryInput);
  if (!parsed.success) {
    return Response.json(
      { fehler: 'validierung', details: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }
  const q = parsed.data;

  const filters = [eq(hilfegesuch.status, q.status ?? 'offen')];
  if (q.stadt_id) filters.push(eq(hilfegesuch.stadtId, q.stadt_id));
  if (q.tag) filters.push(arrayContains(hilfegesuch.tags, [q.tag]));

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
    .where(and(...filters))
    .orderBy(desc(hilfegesuch.erstelltAm), desc(hilfegesuch.id))
    .limit(q.limit);

  return Response.json({
    hilfegesuche: rows.map((r) => ({
      ...r.hilfegesuch,
      autor: {
        id: r.autorId,
        anzeigename: r.autorAnzeigename,
        avatar_url: r.autorAvatarUrl,
        stadt_id: r.autorStadtId,
      },
    })),
  });
}
