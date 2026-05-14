/**
 * POST + GET /api/v1/foerderprofile
 *
 * - POST: legt ein neues Foerderprofil in Status 'entwurf' an. Auth +
 *   Foerderer-Rolle Pflicht. UNIQUE(nutzer_id) — pro User max 1 Profil.
 * - GET: Liste eingeloggter Personen mit Filter stadt/foerderart/
 *   gegenleistung_typ. Nur Profile in Status 'verifiziert' (PRD §F-704).
 *
 * PRD-Referenz: §F-701..§F-706, §19 (Verifikations-Workflow).
 */

import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { auditLog, foerderprofil, nutzer } from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';
import { rejectIfBadOrigin } from '@/lib/auth/csrf';
import { istFoerderer } from '@/lib/auth/permissions';
import {
  foerderprofilAnlegenSchema,
  foerderprofileListQuerySchema,
} from '@/lib/validators/foerderprofil';
import { serializeFoerderprofil } from '@/lib/foerderprofil/serialize';
import {
  foerderart as foerderartEnum,
  gegenleistungTyp as gegenleistungTypEnum,
  type Foerderart,
  type GegenleistungTyp,
} from '@/lib/db/schema/enums';

export async function POST(req: Request): Promise<Response> {
  const originResp = rejectIfBadOrigin(req);
  if (originResp) return originResp;

  const sess = await getSessionFromRequest(req);
  if (!sess) {
    return Response.json({ fehler: 'unauthenticated' }, { status: 401 });
  }

  if (!istFoerderer(sess.nutzer)) {
    return Response.json(
      {
        error: {
          code: 'kein_foerderer',
          message:
            'Nur Foerder:innen koennen ein Foerderprofil anlegen. Bitte erst die Rolle in den Einstellungen hinzufuegen.',
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

  const parsed = foerderprofilAnlegenSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { fehler: 'validierung', details: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }
  const input = parsed.data;

  // UNIQUE(nutzer_id) — pruefen, ob bereits ein Profil existiert.
  const existing = await db
    .select({ id: foerderprofil.id })
    .from(foerderprofil)
    .where(eq(foerderprofil.nutzerId, sess.nutzerId))
    .limit(1);
  if (existing[0]) {
    return Response.json(
      {
        error: {
          code: 'bereits_vorhanden',
          message: 'Du hast bereits ein Foerderprofil. Bearbeite es ueber den PATCH-Endpoint.',
          foerderprofil_id: existing[0].id,
        },
      },
      { status: 422 },
    );
  }

  const inserted = await db
    .insert(foerderprofil)
    .values({
      nutzerId: sess.nutzerId,
      organisation: input.organisation,
      foerderart: input.foerderart,
      foerderrahmenJahrMinEuroCent: input.foerderrahmen_jahr_min_euro_cent ?? null,
      foerderrahmenJahrMaxEuroCent: input.foerderrahmen_jahr_max_euro_cent ?? null,
      foerderrahmenEinzelMaxEuroCent: input.foerderrahmen_einzel_max_euro_cent ?? null,
      bevorzugteWerke: input.bevorzugte_werke ?? null,
      gegenleistungTyp: input.gegenleistung_typ,
      gegenleistungText: input.gegenleistung_text ?? null,
      verifikationStatus: 'entwurf',
    })
    .returning();
  const row = inserted[0];
  if (!row) {
    return Response.json({ fehler: 'unbekannt' }, { status: 500 });
  }

  try {
    await db.insert(auditLog).values({
      nutzerId: sess.nutzerId,
      aktion: 'foerderprofil.angelegt',
      referenzTyp: 'foerderprofil',
      referenzId: row.id,
    });
  } catch {
    // Audit-Failure darf den Erfolg nicht blockieren.
  }

  return Response.json(
    { foerderprofil: serializeFoerderprofil(row) },
    { status: 201 },
  );
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
  const foerderartVals = params.getAll('foerderart');
  if (foerderartVals.length > 0) queryInput.foerderart = foerderartVals;
  const gegenleistungVals = params.getAll('gegenleistung_typ');
  if (gegenleistungVals.length > 0)
    queryInput.gegenleistung_typ = gegenleistungVals;
  const limit = params.get('limit');
  if (limit !== null && limit !== '') queryInput.limit = limit;

  const parsed = foerderprofileListQuerySchema.safeParse(queryInput);
  if (!parsed.success) {
    return Response.json(
      { fehler: 'validierung', details: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }
  const q = parsed.data;

  const filters = [eq(foerderprofil.verifikationStatus, 'verifiziert')];

  if (q.foerderart && q.foerderart.length > 0) {
    filters.push(
      inArray(foerderprofil.foerderart, q.foerderart as Foerderart[]),
    );
  }
  if (q.gegenleistung_typ && q.gegenleistung_typ.length > 0) {
    filters.push(
      inArray(
        foerderprofil.gegenleistungTyp,
        q.gegenleistung_typ as GegenleistungTyp[],
      ),
    );
  }

  let rows;
  if (q.stadt_id) {
    rows = await db
      .select()
      .from(foerderprofil)
      .innerJoin(nutzer, eq(foerderprofil.nutzerId, nutzer.id))
      .where(and(eq(nutzer.stadtId, q.stadt_id), ...filters))
      .limit(q.limit);
    return Response.json({
      foerderprofile: rows.map((r) =>
        serializeFoerderprofil(r.foerderprofil),
      ),
    });
  }

  rows = await db
    .select()
    .from(foerderprofil)
    .where(and(...filters))
    .limit(q.limit);

  return Response.json({
    foerderprofile: rows.map((r) => serializeFoerderprofil(r)),
  });
}

// silence unused enum imports (kept for explicit type narrowing if needed).
void foerderartEnum;
void gegenleistungTypEnum;
