/**
 * GET + PATCH /api/v1/foerderprofile/:id
 *
 * - GET: 'verifiziert'-Profile sind fuer eingeloggte Personen lesbar.
 *   Andere Status sind nur fuer Owner und Kurator:in der Stadt sichtbar.
 *   Bei `gegenleistung_typ='equity_offline'` wird ein expliziter
 *   `equity_hinweistext` ausgeliefert (PRD §11A Kulturverlust 5).
 * - PATCH: Owner-only. Status muss IN ('entwurf', 'verifiziert') sein.
 *   Bei `verifiziert`-PATCH bleibt der Status — keine erneute Verifikation
 *   noetig fuer rein redaktionelle Aenderungen.
 *
 * PRD-Referenz: §F-702, §F-703, §F-705.
 */

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { auditLog, foerderprofil, nutzer } from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';
import { rejectIfBadOrigin } from '@/lib/auth/csrf';
import { istKuratorVon } from '@/lib/auth/permissions';
import { foerderprofilPatchSchema } from '@/lib/validators/foerderprofil';
import { serializeFoerderprofil } from '@/lib/foerderprofil/serialize';

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function ladeFoerderprofil(id: string) {
  const rows = await db
    .select()
    .from(foerderprofil)
    .where(eq(foerderprofil.id, id))
    .limit(1);
  return rows[0] ?? null;
}

async function ownerStadtId(nutzerId: string): Promise<string | null> {
  const rows = await db
    .select({ stadtId: nutzer.stadtId })
    .from(nutzer)
    .where(eq(nutzer.id, nutzerId))
    .limit(1);
  return rows[0]?.stadtId ?? null;
}

export async function GET(req: Request, ctx: RouteContext): Promise<Response> {
  const { id } = await ctx.params;
  const row = await ladeFoerderprofil(id);
  if (!row) {
    return Response.json({ fehler: 'nicht_gefunden' }, { status: 404 });
  }

  if (row.verifikationStatus === 'verifiziert') {
    const sess = await getSessionFromRequest(req);
    if (!sess) {
      return Response.json({ fehler: 'unauthenticated' }, { status: 401 });
    }
    return Response.json({ foerderprofil: serializeFoerderprofil(row) });
  }

  // Nicht-verifizierte Profile nur fuer Owner und Kurator:in der Stadt.
  const sess = await getSessionFromRequest(req);
  if (!sess) {
    return Response.json({ fehler: 'nicht_gefunden' }, { status: 404 });
  }
  if (sess.nutzerId === row.nutzerId) {
    return Response.json({ foerderprofil: serializeFoerderprofil(row) });
  }

  // Kurator:in der Stadt der Owner-Person?
  const stadtId = await ownerStadtId(row.nutzerId);
  if (stadtId && (await istKuratorVon(sess.nutzerId, stadtId))) {
    return Response.json({ foerderprofil: serializeFoerderprofil(row) });
  }

  return Response.json({ fehler: 'nicht_gefunden' }, { status: 404 });
}

export async function PATCH(req: Request, ctx: RouteContext): Promise<Response> {
  const originResp = rejectIfBadOrigin(req);
  if (originResp) return originResp;

  const sess = await getSessionFromRequest(req);
  if (!sess) {
    return Response.json({ fehler: 'unauthenticated' }, { status: 401 });
  }

  const { id } = await ctx.params;
  const row = await ladeFoerderprofil(id);
  if (!row) {
    return Response.json({ fehler: 'nicht_gefunden' }, { status: 404 });
  }

  if (row.nutzerId !== sess.nutzerId) {
    return Response.json(
      { error: { code: 'kein_zugriff', message: 'Nur die Inhaber:in darf das Profil bearbeiten.' } },
      { status: 403 },
    );
  }

  if (
    row.verifikationStatus !== 'entwurf' &&
    row.verifikationStatus !== 'verifiziert'
  ) {
    return Response.json(
      {
        error: {
          code: 'nicht_editierbar',
          message:
            'Das Profil ist gerade in Verifikation oder pausiert und kann nicht bearbeitet werden.',
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

  const parsed = foerderprofilPatchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { fehler: 'validierung', details: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }
  const patch = parsed.data;

  const update: Partial<typeof foerderprofil.$inferInsert> = {};
  if (patch.organisation !== undefined) update.organisation = patch.organisation;
  if (patch.foerderart !== undefined) update.foerderart = patch.foerderart;
  if (patch.foerderrahmen_jahr_min_euro_cent !== undefined)
    update.foerderrahmenJahrMinEuroCent = patch.foerderrahmen_jahr_min_euro_cent;
  if (patch.foerderrahmen_jahr_max_euro_cent !== undefined)
    update.foerderrahmenJahrMaxEuroCent = patch.foerderrahmen_jahr_max_euro_cent;
  if (patch.foerderrahmen_einzel_max_euro_cent !== undefined)
    update.foerderrahmenEinzelMaxEuroCent =
      patch.foerderrahmen_einzel_max_euro_cent;
  if (patch.bevorzugte_werke !== undefined)
    update.bevorzugteWerke = patch.bevorzugte_werke;
  if (patch.gegenleistung_typ !== undefined)
    update.gegenleistungTyp = patch.gegenleistung_typ;
  if (patch.gegenleistung_text !== undefined)
    update.gegenleistungText = patch.gegenleistung_text;

  if (Object.keys(update).length === 0) {
    return Response.json({ foerderprofil: serializeFoerderprofil(row) });
  }

  update.aktualisiertAm = new Date();

  const updated = await db
    .update(foerderprofil)
    .set(update)
    .where(eq(foerderprofil.id, row.id))
    .returning();
  const updatedRow = updated[0];
  if (!updatedRow) {
    return Response.json({ fehler: 'unbekannt' }, { status: 500 });
  }

  try {
    await db.insert(auditLog).values({
      nutzerId: sess.nutzerId,
      aktion: 'foerderprofil.aktualisiert',
      referenzTyp: 'foerderprofil',
      referenzId: updatedRow.id,
    });
  } catch {
    // Audit-Failure darf den Erfolg nicht blockieren.
  }

  return Response.json({ foerderprofil: serializeFoerderprofil(updatedRow) });
}
