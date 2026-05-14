/**
 * POST + GET /api/v1/bedarfe
 *
 * - POST: legt einen neuen Bedarf in Status 'entwurf' an. Auth +
 *   Bedarfstraeger:innen-Rolle Pflicht. Klarname + Organisation muessen
 *   gesetzt sein (Klarname kommt aus dem nutzer-Record, Organisation aus
 *   dem Request-Body).
 * - GET: Liste eingeloggter Personen. Default-Status-Filter ['oeffentlich',
 *   'in_gespraechen']; explizit anders waehlbar via ?status=…. Anonyme
 *   Requests → 401 (PRD §F-603 — Bedarfe sind NICHT oeffentlich indexierbar).
 *
 * PRD-Referenz: §F-601..§F-603, §14.3, §15.5.
 */

import { and, asc, eq, gte, inArray, lte } from 'drizzle-orm';
import { db } from '@/lib/db';
import { auditLog, bedarf } from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';
import { rejectIfBadOrigin } from '@/lib/auth/csrf';
import { istBedarfstraeger } from '@/lib/auth/permissions';
import {
  bedarfAnlegenSchema,
  bedarfeListQuerySchema,
} from '@/lib/validators/bedarf';
import { serializeBedarf } from '@/lib/bedarf/serialize';
import type { BedarfStatus } from '@/lib/db/schema/enums';

const DEFAULT_LIST_STATUS: BedarfStatus[] = ['oeffentlich', 'in_gespraechen'];

export async function POST(req: Request): Promise<Response> {
  const originResp = rejectIfBadOrigin(req);
  if (originResp) return originResp;

  const sess = await getSessionFromRequest(req);
  if (!sess) {
    return Response.json({ fehler: 'unauthenticated' }, { status: 401 });
  }

  if (!istBedarfstraeger(sess.nutzer)) {
    return Response.json(
      {
        error: {
          code: 'kein_bedarfstraeger',
          message:
            'Nur Bedarfstraeger:innen koennen Bedarfe anlegen. Bitte erst die Rolle in den Einstellungen hinzufuegen.',
        },
      },
      { status: 403 },
    );
  }

  // Klarname-Pflicht fuer Bedarfstraeger:innen (PRD §13.2).
  const klarname = sess.nutzer.klarname?.trim();
  if (!klarname) {
    return Response.json(
      {
        error: {
          code: 'klarname_fehlt',
          message:
            'Bitte ergaenze deinen Klarnamen in den Einstellungen, bevor du einen Bedarf einbringst.',
        },
      },
      { status: 422 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ fehler: 'ungueltiger_body' }, { status: 400 });
  }

  const parsed = bedarfAnlegenSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { fehler: 'validierung', details: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }
  const input = parsed.data;

  const inserted = await db
    .insert(bedarf)
    .values({
      nutzerId: sess.nutzerId,
      organisation: input.organisation,
      titel: input.titel,
      problem: input.problem,
      nutzen: input.nutzen,
      stadtId: input.stadt_id,
      groessenordnungZeitWochen: input.groessenordnung_zeit_wochen ?? null,
      groessenordnungAufwandTage: input.groessenordnung_aufwand_tage ?? null,
      geldrahmenMinEuroCent: input.geldrahmen_min_euro_cent ?? null,
      geldrahmenMaxEuroCent: input.geldrahmen_max_euro_cent ?? null,
      frist: input.frist,
      branche: input.branche ?? null,
      bevorzugterWerkstand: input.bevorzugter_werkstand ?? null,
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
      aktion: 'bedarf.angelegt',
      referenzTyp: 'bedarf',
      referenzId: row.id,
    });
  } catch {
    // Audit-Failure darf den Erfolg nicht blockieren.
  }

  return Response.json({ bedarf: serializeBedarf(row) }, { status: 201 });
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
  const statusVals = params.getAll('status');
  if (statusVals.length > 0) queryInput.status = statusVals;
  const grMin = params.get('geldrahmen_min_euro_cent');
  if (grMin !== null && grMin !== '') queryInput.geldrahmen_min_euro_cent = grMin;
  const grMax = params.get('geldrahmen_max_euro_cent');
  if (grMax !== null && grMax !== '') queryInput.geldrahmen_max_euro_cent = grMax;
  const cursor = params.get('cursor');
  if (cursor !== null && cursor !== '') queryInput.cursor = cursor;
  const limit = params.get('limit');
  if (limit !== null && limit !== '') queryInput.limit = limit;

  const parsed = bedarfeListQuerySchema.safeParse(queryInput);
  if (!parsed.success) {
    return Response.json(
      { fehler: 'validierung', details: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }
  const q = parsed.data;

  const statusFilter =
    q.status && q.status.length > 0 ? q.status : DEFAULT_LIST_STATUS;

  const filters = [inArray(bedarf.status, statusFilter as BedarfStatus[])];
  if (q.stadt_id) filters.push(eq(bedarf.stadtId, q.stadt_id));
  if (q.geldrahmen_min_euro_cent !== undefined) {
    filters.push(gte(bedarf.geldrahmenMaxEuroCent, q.geldrahmen_min_euro_cent));
  }
  if (q.geldrahmen_max_euro_cent !== undefined) {
    filters.push(lte(bedarf.geldrahmenMinEuroCent, q.geldrahmen_max_euro_cent));
  }

  const rows = await db
    .select()
    .from(bedarf)
    .where(and(...filters))
    .orderBy(asc(bedarf.frist))
    .limit(q.limit);

  return Response.json({ bedarfe: rows.map(serializeBedarf) });
}
