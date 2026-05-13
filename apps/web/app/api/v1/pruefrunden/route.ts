/**
 * POST + GET /api/v1/pruefrunden
 *
 * - POST: legt eine neue Pruefrunde in Status 'entwurf' an. Auth + Rolle
 *   'macher' + Werk-Ownership Pflicht. Reziprozitaets-Check erst beim
 *   Veroeffentlichen (separater Endpoint).
 * - GET: oeffentliche Liste mit Filter/Cursor-Pagination gemaess PRD §15.4.
 *   Default-Status-Filter sind 'oeffentlich', 'geschlossen', 'abgeschlossen' —
 *   Entwuerfe sind privat. Mit `?nur_eigene=1` und gueltiger Session sieht
 *   die Inhaber:in auch eigene Entwuerfe.
 */

import { and, asc, eq, gt, inArray, or } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  auditLog,
  nutzer,
  pruefrunde,
  werk,
} from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';
import { rejectIfBadOrigin } from '@/lib/auth/csrf';
import {
  pruefrundeAnlegenSchema,
  pruefrundenListQuerySchema,
} from '@/lib/validators/pruefrunde';
import { serializePruefrunde } from '@/lib/pruefrunde/serialize';
import {
  pruefrundeStatus,
  type PruefrundeStatus,
} from '@/lib/db/schema/enums';

const PUBLIC_STATUS: ReadonlyArray<PruefrundeStatus> = [
  'oeffentlich',
  'geschlossen',
  'abgeschlossen',
];

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
            'Nur Macher:innen koennen Pruefrunden anlegen. Aktiviere die Macher:in-Rolle in deinem Werkpass.',
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

  const parsed = pruefrundeAnlegenSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { fehler: 'validierung', details: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }
  const input = parsed.data;

  // Werk-Ownership-Check.
  const werkRows = await db
    .select({ id: werk.id, nutzerId: werk.nutzerId })
    .from(werk)
    .where(eq(werk.id, input.werk_id))
    .limit(1);
  const werkRow = werkRows[0];
  if (!werkRow) {
    return Response.json(
      {
        error: {
          code: 'werk_nicht_gefunden',
          message: 'Das angegebene Werk existiert nicht.',
        },
      },
      { status: 422 },
    );
  }
  if (werkRow.nutzerId !== sess.nutzerId) {
    return Response.json(
      {
        error: {
          code: 'kein_zugriff',
          message: 'Du kannst nur fuer eigene Werke Pruefrunden anlegen.',
        },
      },
      { status: 403 },
    );
  }

  const inserted = await db
    .insert(pruefrunde)
    .values({
      werkId: input.werk_id,
      titel: input.titel,
      testziel: input.testziel,
      testaufgabe: input.testaufgabe,
      zielgruppe: input.zielgruppe,
      zeitbedarfMinuten: input.zeitbedarf_minuten,
      gesuchteTester: input.gesuchte_tester,
      feedbackKategorien: input.feedback_kategorien,
      frist: input.frist,
      status: 'entwurf',
    })
    .returning();

  const row = inserted[0];
  if (!row) {
    return Response.json({ fehler: 'unbekannt' }, { status: 500 });
  }

  try {
    await db.insert(auditLog).values({
      nutzerId: sess.nutzerId,
      aktion: 'pruefrunde.angelegt',
      referenzTyp: 'pruefrunde',
      referenzId: row.id,
    });
  } catch {
    // Audit-Failure darf den Erfolg nicht blockieren.
  }

  return Response.json({ pruefrunde: serializePruefrunde(row) }, { status: 201 });
}

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const params = url.searchParams;

  const queryInput: Record<string, unknown> = {};
  const stadtId = params.get('stadt_id');
  if (stadtId !== null && stadtId !== '') queryInput.stadt_id = stadtId;
  const statusVals = params.getAll('status');
  if (statusVals.length > 0) queryInput.status = statusVals;
  const werkId = params.get('werk_id');
  if (werkId !== null && werkId !== '') queryInput.werk_id = werkId;
  const nurEigene = params.get('nur_eigene');
  if (nurEigene !== null && nurEigene !== '') queryInput.nur_eigene = nurEigene;
  const cursor = params.get('cursor');
  if (cursor !== null && cursor !== '') queryInput.cursor = cursor;
  const limit = params.get('limit');
  if (limit !== null && limit !== '') queryInput.limit = limit;

  const parsed = pruefrundenListQuerySchema.safeParse(queryInput);
  if (!parsed.success) {
    return Response.json(
      { fehler: 'validierung', details: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }
  const q = parsed.data;

  // Optionaler Session-Lookup (nur fuer nur_eigene=1 noetig).
  const eigeneFilter = q.nur_eigene === '1';
  let sessionNutzerId: string | null = null;
  if (eigeneFilter) {
    const sess = await getSessionFromRequest(req);
    if (!sess) {
      return Response.json({ fehler: 'unauthenticated' }, { status: 401 });
    }
    sessionNutzerId = sess.nutzerId;
  }

  // Cursor-Wert nachladen (frist + id fuer stabile Sortierung).
  let cursorRow: { frist: Date; id: string } | null = null;
  if (q.cursor) {
    const rows = await db
      .select({ frist: pruefrunde.frist, id: pruefrunde.id })
      .from(pruefrunde)
      .where(eq(pruefrunde.id, q.cursor))
      .limit(1);
    cursorRow = rows[0] ?? null;
  }

  // Status-Filter: ohne `nur_eigene` werden Entwuerfe ausgeblendet.
  // Mit `nur_eigene=1` darf der Inhaber-Filter unten alle 4 Status sehen.
  const requestedStatus = q.status && q.status.length > 0 ? q.status : null;
  let effectiveStatus: PruefrundeStatus[];
  if (eigeneFilter) {
    // alle 4, optional auf q.status eingeschraenkt
    effectiveStatus = requestedStatus
      ? (requestedStatus as PruefrundeStatus[])
      : (pruefrundeStatus as unknown as PruefrundeStatus[]);
  } else {
    // public only — schneide explizit gewuenschte Status auf den public-Set.
    const baseSet = requestedStatus
      ? (requestedStatus as PruefrundeStatus[]).filter((s) =>
          PUBLIC_STATUS.includes(s),
        )
      : [...PUBLIC_STATUS];
    effectiveStatus = baseSet;
  }
  if (effectiveStatus.length === 0) {
    return Response.json({ pruefrunden: [], nextCursor: null });
  }

  const filters = [inArray(pruefrunde.status, effectiveStatus)];

  if (q.werk_id) {
    filters.push(eq(pruefrunde.werkId, q.werk_id));
  }
  if (q.stadt_id) {
    filters.push(eq(nutzer.stadtId, q.stadt_id));
  }
  if (eigeneFilter && sessionNutzerId) {
    filters.push(eq(werk.nutzerId, sessionNutzerId));
  }
  if (cursorRow) {
    // Sortierung (frist ASC, id ASC). Cursor: alles nach (frist, id).
    filters.push(
      or(
        gt(pruefrunde.frist, cursorRow.frist),
        and(
          eq(pruefrunde.frist, cursorRow.frist),
          gt(pruefrunde.id, cursorRow.id),
        ),
      )!,
    );
  }

  // Wir fragen `limit + 1` ab, um zu wissen ob es eine naechste Seite gibt.
  const rows = await db
    .select({
      pruefrunde,
      werkName: werk.name,
      werkKurzbeschreibung: werk.kurzbeschreibung,
      werkstand: werk.werkstand,
      inhaberId: nutzer.id,
      inhaberAnzeigename: nutzer.anzeigename,
      inhaberAvatarUrl: nutzer.avatarUrl,
      inhaberStadtId: nutzer.stadtId,
    })
    .from(pruefrunde)
    .innerJoin(werk, eq(werk.id, pruefrunde.werkId))
    .innerJoin(nutzer, eq(nutzer.id, werk.nutzerId))
    .where(and(...filters))
    .orderBy(asc(pruefrunde.frist), asc(pruefrunde.id))
    .limit(q.limit + 1);

  const hasMore = rows.length > q.limit;
  const sliced = hasMore ? rows.slice(0, q.limit) : rows;
  const last = sliced.at(-1);
  const nextCursor = hasMore && last ? last.pruefrunde.id : null;

  return Response.json({
    pruefrunden: sliced.map((r) => ({
      ...serializePruefrunde(r.pruefrunde),
      werk: {
        id: r.pruefrunde.werkId,
        name: r.werkName,
        kurzbeschreibung: r.werkKurzbeschreibung,
        werkstand: r.werkstand,
      },
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
