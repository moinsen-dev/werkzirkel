/**
 * POST + GET /api/v1/termine
 *
 * - POST: legt einen neuen Termin in Status 'geplant' an. Auth + Kurator:in-
 *   Rolle fuer die jeweilige Stadt (oder Admin) Pflicht (PRD §F-401, §15.8).
 * - GET: Liste mit Filtern + Cursor-Pagination gemaess PRD §15.8.
 *   Default-Status-Filter sind 'veroeffentlicht' + 'durchgefuehrt' — 'geplant'
 *   und 'abgesagt' sind nicht-public; Kurator:innen einer Stadt sehen aber
 *   auch 'geplant'/'abgesagt' ihrer eigenen Stadt (Admin alle).
 *
 *   Sortierung: `datum_uhrzeit ASC`. Cursor ist die `termin.id` der letzten
 *   Zeile; bei gleicher Datum/Uhrzeit dient die ID als Tiebreaker.
 */

import { and, asc, eq, gt, gte, inArray, lte, or } from 'drizzle-orm';
import { db } from '@/lib/db';
import { auditLog, termin, terminWerkBezug, werk } from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';
import { rejectIfBadOrigin } from '@/lib/auth/csrf';
import { istKuratorVon } from '@/lib/auth/permissions';
import {
  terminAnlegenSchema,
  termineListQuerySchema,
} from '@/lib/validators/termin';
import { serializeTermin } from '@/lib/termin/serialize';
import {
  terminStatus,
  type TerminStatus,
} from '@/lib/db/schema/enums';

const PUBLIC_STATUS: ReadonlyArray<TerminStatus> = [
  'veroeffentlicht',
  'durchgefuehrt',
];

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

  const parsed = terminAnlegenSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { fehler: 'validierung', details: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }
  const input = parsed.data;

  // Permission-Check: Kurator:in der Stadt oder Admin.
  const erlaubt = await istKuratorVon(sess.nutzerId, input.stadt_id);
  if (!erlaubt) {
    return Response.json(
      {
        error: {
          code: 'kein_zugriff',
          message:
            'Nur Kurator:innen der jeweiligen Stadt koennen Termine anlegen.',
        },
      },
      { status: 403 },
    );
  }

  const inserted = await db
    .insert(termin)
    .values({
      stadtId: input.stadt_id,
      typ: input.typ,
      titel: input.titel,
      beschreibung: input.beschreibung,
      ortText: input.ort_text ?? null,
      onlineLink: input.online_link ?? null,
      datumUhrzeit: input.datum_uhrzeit,
      maxTeilnehmer: input.max_teilnehmer,
      erstelltVon: sess.nutzerId,
      status: 'geplant',
    })
    .returning();

  const row = inserted[0];
  if (!row) {
    return Response.json({ fehler: 'unbekannt' }, { status: 500 });
  }

  // Werk-Bezuege fuer Schauabend-Termine. Nur Werke akzeptieren, die in der
  // gleichen Stadt sind UND public sichtbar — sonst kann ein Kurator ein
  // pausiertes/fremdes Werk im Schauabend bewerben.
  const werkIds = input.werk_ids ?? [];
  if (werkIds.length > 0) {
    const validRows = await db
      .select({ id: werk.id })
      .from(werk)
      .where(
        and(
          inArray(werk.id, werkIds),
          eq(werk.stadtId, input.stadt_id),
          eq(werk.status, 'aktiv'),
          inArray(werk.sichtbarkeit, ['oeffentlich', 'nur_zirkel']),
        ),
      );
    const validIds = new Set(validRows.map((r) => r.id));
    const akzeptierteIds = werkIds.filter((id) => validIds.has(id));
    if (akzeptierteIds.length > 0) {
      await db.insert(terminWerkBezug).values(
        akzeptierteIds.map((werkId, idx) => ({
          terminId: row.id,
          werkId,
          reihenfolge: 100 + idx,
        })),
      );
    }
  }

  try {
    await db.insert(auditLog).values({
      nutzerId: sess.nutzerId,
      aktion: 'termin.angelegt',
      referenzTyp: 'termin',
      referenzId: row.id,
      metadaten: {
        stadt_id: input.stadt_id,
        typ: input.typ,
        werk_anzahl: werkIds.length,
      },
    });
  } catch {
    // Audit-Failure darf den Erfolg nicht blockieren.
  }

  return Response.json({ termin: serializeTermin(row) }, { status: 201 });
}

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const params = url.searchParams;

  const queryInput: Record<string, unknown> = {};
  const stadtId = params.get('stadt_id');
  if (stadtId !== null && stadtId !== '') queryInput.stadt_id = stadtId;
  const typVals = params.getAll('typ');
  if (typVals.length > 0) queryInput.typ = typVals;
  const abDatum = params.get('ab_datum');
  if (abDatum !== null && abDatum !== '') queryInput.ab_datum = abDatum;
  const bisDatum = params.get('bis_datum');
  if (bisDatum !== null && bisDatum !== '') queryInput.bis_datum = bisDatum;
  const statusVals = params.getAll('status');
  if (statusVals.length > 0) queryInput.status = statusVals;
  const cursor = params.get('cursor');
  if (cursor !== null && cursor !== '') queryInput.cursor = cursor;
  const limit = params.get('limit');
  if (limit !== null && limit !== '') queryInput.limit = limit;

  const parsed = termineListQuerySchema.safeParse(queryInput);
  if (!parsed.success) {
    return Response.json(
      { fehler: 'validierung', details: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }
  const q = parsed.data;

  // Optionaler Session-Lookup — Kurator:in der Stadt sieht zusaetzlich
  // 'geplant'/'abgesagt' der eigenen Stadt, Admin alles.
  const sess = await getSessionFromRequest(req);

  const requestedStatus = q.status && q.status.length > 0 ? q.status : null;
  let effectiveStatus: TerminStatus[];

  const isAdmin = sess?.nutzer.rollen.includes('admin') ?? false;
  const istKuratorEigenerStadt =
    !!sess &&
    !isAdmin &&
    sess.nutzer.rollen.includes('kurator') &&
    !!q.stadt_id &&
    sess.nutzer.stadtId === q.stadt_id;

  if (isAdmin) {
    effectiveStatus = requestedStatus
      ? (requestedStatus as TerminStatus[])
      : (terminStatus as unknown as TerminStatus[]);
  } else if (istKuratorEigenerStadt) {
    // Kurator:innen sehen alle Status der eigenen Stadt.
    effectiveStatus = requestedStatus
      ? (requestedStatus as TerminStatus[])
      : (terminStatus as unknown as TerminStatus[]);
  } else {
    // Public-Pfad — explizit gewuenschte Status werden auf den Public-Set
    // eingeschraenkt.
    const baseSet = requestedStatus
      ? (requestedStatus as TerminStatus[]).filter((s) =>
          PUBLIC_STATUS.includes(s),
        )
      : [...PUBLIC_STATUS];
    effectiveStatus = baseSet;
  }
  if (effectiveStatus.length === 0) {
    return Response.json({ termine: [], nextCursor: null });
  }

  // Cursor-Wert nachladen (datum_uhrzeit + id fuer stabile Sortierung).
  let cursorRow: { datumUhrzeit: Date; id: string } | null = null;
  if (q.cursor) {
    const rows = await db
      .select({ datumUhrzeit: termin.datumUhrzeit, id: termin.id })
      .from(termin)
      .where(eq(termin.id, q.cursor))
      .limit(1);
    cursorRow = rows[0] ?? null;
  }

  const filters = [inArray(termin.status, effectiveStatus)];

  if (q.stadt_id) {
    filters.push(eq(termin.stadtId, q.stadt_id));
  }
  if (q.typ && q.typ.length > 0) {
    filters.push(inArray(termin.typ, q.typ));
  }
  if (q.ab_datum) {
    filters.push(gte(termin.datumUhrzeit, q.ab_datum));
  }
  if (q.bis_datum) {
    filters.push(lte(termin.datumUhrzeit, q.bis_datum));
  }
  if (cursorRow) {
    filters.push(
      or(
        gt(termin.datumUhrzeit, cursorRow.datumUhrzeit),
        and(
          eq(termin.datumUhrzeit, cursorRow.datumUhrzeit),
          gt(termin.id, cursorRow.id),
        ),
      )!,
    );
  }

  const rows = await db
    .select()
    .from(termin)
    .where(and(...filters))
    .orderBy(asc(termin.datumUhrzeit), asc(termin.id))
    .limit(q.limit + 1);

  const hasMore = rows.length > q.limit;
  const sliced = hasMore ? rows.slice(0, q.limit) : rows;
  const last = sliced.at(-1);
  const nextCursor = hasMore && last ? last.id : null;

  return Response.json({
    termine: sliced.map((t) => serializeTermin(t)),
    nextCursor,
  });
}
