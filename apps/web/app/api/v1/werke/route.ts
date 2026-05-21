/**
 * POST + GET /api/v1/werke
 *
 * - POST: legt ein neues Werk an. Auth + Rolle 'macher' Pflicht.
 *   Limit-Check (max 5 ohne Foerdermitgliedschaft) gemaess PRD §F-101.
 * - GET: liefert eine oeffentliche Liste mit Filter/Sortierung/Cursor-Pagination
 *   gemaess PRD §F-103 + §15.3. KEINE Suchfunktion (siehe PRD-Prinzip P4 +
 *   task-werke-overview-Akzeptanzkriterium).
 */

import { and, desc, eq, lt, or, arrayOverlaps, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  auditLog,
  nutzer,
  werk,
  werkHistorie,
} from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';
import { rejectIfBadOrigin } from '@/lib/auth/csrf';
import {
  werkAnlegenSchema,
  werkeListQuerySchema,
} from '@/lib/validators/werk';
import { pruefeWerkAnlegenLimit } from '@/lib/werk/limit';
import { serializeWerk } from '@/lib/werk/serialize';

export async function POST(req: Request): Promise<Response> {
  const originResp = rejectIfBadOrigin(req);
  if (originResp) return originResp;

  const sess = await getSessionFromRequest(req);
  if (!sess) {
    return Response.json({ fehler: 'unauthenticated' }, { status: 401 });
  }

  if (!sess.nutzer.rollen.includes('macher')) {
    return Response.json(
      {
        error: {
          code: 'rolle_fehlt',
          message:
            'Nur Builder:innen koennen Builds anlegen. Aktiviere die Builder:in-Rolle in deinem Builder-Profil.',
        },
      },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ fehler: 'ungueltiger_body' }, { status: 400 });
  }

  const parsed = werkAnlegenSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { fehler: 'validierung', details: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }
  const input = parsed.data;

  const limit = await pruefeWerkAnlegenLimit(sess.nutzerId);
  if (!limit.erlaubt) {
    return Response.json(
      {
        error: {
          code: 'limit_erreicht',
          message:
            'Du hast bereits 5 Werke. Eine Foerdermitgliedschaft hebt das Limit auf.',
        },
      },
      { status: 422 },
    );
  }

  const inserted = await db
    .insert(werk)
    .values({
      nutzerId: sess.nutzerId,
      name: input.name,
      kurzbeschreibung: input.kurzbeschreibung,
      problem: input.problem,
      zielgruppe: input.zielgruppe,
      werkstand: input.werkstand,
      hilfebedarf: input.hilfebedarf,
      link: input.link ?? null,
      sichtbarkeit: input.sichtbarkeit,
    })
    .returning();

  const row = inserted[0];
  if (!row) {
    return Response.json({ fehler: 'unbekannt' }, { status: 500 });
  }

  // Initialer Build-Stand-Historie-Eintrag: werkstand_alt=null markiert die
  // Anlage. Spätere Werkstand-Wechsel knüpfen daran an, sodass der Verlauf
  // auf der Build-Seite mindestens N+1 Einträge bei N Änderungen zeigt.
  try {
    await db.insert(werkHistorie).values({
      werkId: row.id,
      werkstandAlt: null,
      werkstandNeu: row.werkstand,
      geaendertVon: sess.nutzerId,
    });
  } catch {
    // Historie-Insert ist best-effort — Werk steht auch ohne Initial-Eintrag.
  }

  try {
    await db.insert(auditLog).values({
      nutzerId: sess.nutzerId,
      aktion: 'werk.angelegt',
      referenzTyp: 'werk',
      referenzId: row.id,
    });
  } catch {
    // Audit-Failure darf den Erfolg nicht blockieren.
  }

  return Response.json({ werk: serializeWerk(row) }, { status: 201 });
}

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const params = url.searchParams;

  // Mehrfach-Werte fuer werkstand/hilfebedarf einsammeln.
  const queryInput: Record<string, unknown> = {};
  const stadtId = params.get('stadt_id');
  if (stadtId !== null && stadtId !== '') queryInput.stadt_id = stadtId;
  const werkstandVals = params.getAll('werkstand');
  if (werkstandVals.length > 0) queryInput.werkstand = werkstandVals;
  const hilfebedarfVals = params.getAll('hilfebedarf');
  if (hilfebedarfVals.length > 0) queryInput.hilfebedarf = hilfebedarfVals;
  const cursor = params.get('cursor');
  if (cursor !== null && cursor !== '') queryInput.cursor = cursor;
  const limit = params.get('limit');
  if (limit !== null && limit !== '') queryInput.limit = limit;

  const parsed = werkeListQuerySchema.safeParse(queryInput);
  if (!parsed.success) {
    return Response.json(
      { fehler: 'validierung', details: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }
  const q = parsed.data;

  // Cursor-Wert nachladen (wir brauchen aktualisiert_am vom Cursor-Werk
  // fuer stabile Pagination).
  let cursorRow: { aktualisiertAm: Date; id: string } | null = null;
  if (q.cursor) {
    const rows = await db
      .select({ aktualisiertAm: werk.aktualisiertAm, id: werk.id })
      .from(werk)
      .where(eq(werk.id, q.cursor))
      .limit(1);
    cursorRow = rows[0] ?? null;
    if (!cursorRow) {
      // Cursor zeigt auf nicht-existentes Werk — wir behandeln das wie kein
      // Cursor (statt 422), damit Front-Ends robust paginieren koennen.
    }
  }

  const filters = [
    eq(werk.sichtbarkeit, 'oeffentlich'),
    eq(werk.status, 'aktiv'),
  ];
  if (q.werkstand && q.werkstand.length > 0) {
    filters.push(inArray(werk.werkstand, q.werkstand));
  }
  if (q.hilfebedarf && q.hilfebedarf.length > 0) {
    filters.push(arrayOverlaps(werk.hilfebedarf, q.hilfebedarf));
  }
  if (q.stadt_id) {
    filters.push(eq(nutzer.stadtId, q.stadt_id));
  }
  if (cursorRow) {
    // (aktualisiert_am, id) < (cursor_aktualisiert_am, cursor_id)
    filters.push(
      or(
        lt(werk.aktualisiertAm, cursorRow.aktualisiertAm),
        and(
          eq(werk.aktualisiertAm, cursorRow.aktualisiertAm),
          lt(werk.id, cursorRow.id),
        ),
      )!,
    );
  }

  // Wir fragen `limit + 1` ab, um zu wissen ob es eine naechste Seite gibt.
  const rows = await db
    .select({
      werk,
      inhaberId: nutzer.id,
      inhaberAnzeigename: nutzer.anzeigename,
      inhaberAvatarUrl: nutzer.avatarUrl,
      inhaberStadtId: nutzer.stadtId,
    })
    .from(werk)
    .innerJoin(nutzer, eq(nutzer.id, werk.nutzerId))
    .where(and(...filters))
    .orderBy(desc(werk.aktualisiertAm), desc(werk.id))
    .limit(q.limit + 1);

  const hasMore = rows.length > q.limit;
  const sliced = hasMore ? rows.slice(0, q.limit) : rows;
  const last = sliced.at(-1);
  const nextCursor = hasMore && last ? last.werk.id : null;

  return Response.json({
    werke: sliced.map((r) => ({
      ...serializeWerk(r.werk),
      inhaber: {
        id: r.inhaberId,
        anzeigename: r.inhaberAnzeigename,
        avatar_url: r.inhaberAvatarUrl,
        stadt_id: r.inhaberStadtId,
      },
    })),
    nextCursor,
  });
}
