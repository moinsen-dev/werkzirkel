/**
 * GET + PATCH /api/v1/bedarfe/:id
 *
 * - GET: eingeloggte Person sieht Bedarf, wenn status oeffentlich/in_gespraechen/
 *   erfuellt/eingestellt ODER current.id == bedarf.nutzer_id ODER Kurator
 *   der Stadt. Bei entwurf/in_pruefung nur Owner und Kurator.
 *   Owner-Response enthaelt zusaetzlich `werkangebote_count` und Liste der
 *   werkangebote-IDs (PRD §F-604 Inhaberin-View).
 * - PATCH: Owner-only. Status muss 'entwurf' sein (PRD §F-602 — nach dem
 *   Einreichen ist Bearbeiten gesperrt, wir verlangen den Weg über Kurator).
 *
 * PRD-Referenz: §F-602, §F-604, §15.5.
 */

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { auditLog, bedarf, werkangebot } from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';
import { rejectIfBadOrigin } from '@/lib/auth/csrf';
import { istKuratorVon } from '@/lib/auth/permissions';
import { bedarfPatchSchema } from '@/lib/validators/bedarf';
import { serializeBedarf } from '@/lib/bedarf/serialize';

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function ladeBedarf(id: string) {
  const rows = await db.select().from(bedarf).where(eq(bedarf.id, id)).limit(1);
  return rows[0] ?? null;
}

const PUBLIC_STATUS = ['oeffentlich', 'in_gespraechen', 'erfuellt', 'eingestellt'] as const;

export async function GET(req: Request, ctx: RouteContext): Promise<Response> {
  const sess = await getSessionFromRequest(req);
  if (!sess) {
    return Response.json({ fehler: 'unauthenticated' }, { status: 401 });
  }

  const { id } = await ctx.params;
  const row = await ladeBedarf(id);
  if (!row) {
    return Response.json({ fehler: 'nicht_gefunden' }, { status: 404 });
  }

  const isOwner = row.nutzerId === sess.nutzerId;
  const isPublicStatus = (PUBLIC_STATUS as readonly string[]).includes(row.status);

  if (!isOwner && !isPublicStatus) {
    const isKurator = await istKuratorVon(sess.nutzerId, row.stadtId);
    if (!isKurator) {
      return Response.json({ fehler: 'nicht_gefunden' }, { status: 404 });
    }
  }

  const response: Record<string, unknown> = { bedarf: serializeBedarf(row) };

  // Owner-Sicht: Werkangebote-Liste mitschicken.
  if (isOwner) {
    const angebote = await db
      .select({
        id: werkangebot.id,
        werk_id: werkangebot.werkId,
        macher_id: werkangebot.macherId,
        status: werkangebot.status,
        erstellt_am: werkangebot.erstelltAm,
      })
      .from(werkangebot)
      .where(eq(werkangebot.bedarfId, row.id));
    response.werkangebote_count = angebote.length;
    response.werkangebote = angebote;
  }

  return Response.json(response);
}

export async function PATCH(req: Request, ctx: RouteContext): Promise<Response> {
  const originResp = rejectIfBadOrigin(req);
  if (originResp) return originResp;

  const sess = await getSessionFromRequest(req);
  if (!sess) {
    return Response.json({ fehler: 'unauthenticated' }, { status: 401 });
  }

  const { id } = await ctx.params;
  const row = await ladeBedarf(id);
  if (!row) {
    return Response.json({ fehler: 'nicht_gefunden' }, { status: 404 });
  }

  if (row.nutzerId !== sess.nutzerId) {
    return Response.json(
      {
        error: {
          code: 'kein_zugriff',
          message: 'Nur die Inhaber:in darf den Bedarf bearbeiten.',
        },
      },
      { status: 403 },
    );
  }

  if (row.status !== 'entwurf') {
    return Response.json(
      {
        error: {
          code: 'nicht_editierbar',
          message:
            'Der Bedarf ist bereits eingereicht und kann nicht mehr bearbeitet werden.',
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

  const parsed = bedarfPatchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { fehler: 'validierung', details: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }
  const patch = parsed.data;

  const update: Partial<typeof bedarf.$inferInsert> = {};
  if (patch.organisation !== undefined) update.organisation = patch.organisation;
  if (patch.titel !== undefined) update.titel = patch.titel;
  if (patch.problem !== undefined) update.problem = patch.problem;
  if (patch.nutzen !== undefined) update.nutzen = patch.nutzen;
  if (patch.stadt_id !== undefined) update.stadtId = patch.stadt_id;
  if (patch.groessenordnung_zeit_wochen !== undefined)
    update.groessenordnungZeitWochen = patch.groessenordnung_zeit_wochen;
  if (patch.groessenordnung_aufwand_tage !== undefined)
    update.groessenordnungAufwandTage = patch.groessenordnung_aufwand_tage;
  if (patch.geldrahmen_min_euro_cent !== undefined)
    update.geldrahmenMinEuroCent = patch.geldrahmen_min_euro_cent;
  if (patch.geldrahmen_max_euro_cent !== undefined)
    update.geldrahmenMaxEuroCent = patch.geldrahmen_max_euro_cent;
  if (patch.frist !== undefined) update.frist = patch.frist;
  if (patch.branche !== undefined) update.branche = patch.branche;
  if (patch.bevorzugter_werkstand !== undefined)
    update.bevorzugterWerkstand = patch.bevorzugter_werkstand;

  if (Object.keys(update).length === 0) {
    return Response.json({ bedarf: serializeBedarf(row) });
  }

  update.aktualisiertAm = new Date();

  const updated = await db
    .update(bedarf)
    .set(update)
    .where(eq(bedarf.id, row.id))
    .returning();
  const updatedRow = updated[0];
  if (!updatedRow) {
    return Response.json({ fehler: 'unbekannt' }, { status: 500 });
  }

  try {
    await db.insert(auditLog).values({
      nutzerId: sess.nutzerId,
      aktion: 'bedarf.aktualisiert',
      referenzTyp: 'bedarf',
      referenzId: updatedRow.id,
    });
  } catch {
    // Audit-Failure darf den Erfolg nicht blockieren.
  }

  return Response.json({ bedarf: serializeBedarf(updatedRow) });
}
