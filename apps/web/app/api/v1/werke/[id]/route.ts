/**
 * GET + PATCH + DELETE /api/v1/werke/:id
 *
 * - GET: oeffentliches Detail. 404 wenn versteckt (sichtbarkeit=pausiert ODER
 *   status=ausgeblendet) — ausser der Aufrufer ist die Inhaber:in.
 * - PATCH: Inhaber:innen-only. Werkstand-Wechsel erzeugt atomar einen
 *   `werk_historie`-Eintrag.
 * - DELETE: Inhaber:innen-only. CASCADE raeumt `werk_historie`.
 */

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  auditLog,
  nutzer,
  werk,
  werkHistorie,
} from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';
import { rejectIfBadOrigin } from '@/lib/auth/csrf';
import { werkPatchSchema } from '@/lib/validators/werk';
import { serializeWerk } from '@/lib/werk/serialize';

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function ladeWerkMitInhaber(id: string) {
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
    .where(eq(werk.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function GET(req: Request, ctx: RouteContext): Promise<Response> {
  const { id } = await ctx.params;
  const row = await ladeWerkMitInhaber(id);
  if (!row) {
    return Response.json({ fehler: 'nicht_gefunden' }, { status: 404 });
  }

  const istVersteckt =
    row.werk.status === 'ausgeblendet' || row.werk.sichtbarkeit === 'pausiert';

  if (istVersteckt) {
    // Eigene Werke sind fuer eigene Session immer sichtbar.
    const sess = await getSessionFromRequest(req);
    if (!sess || sess.nutzerId !== row.werk.nutzerId) {
      return Response.json({ fehler: 'nicht_gefunden' }, { status: 404 });
    }
  }

  return Response.json({
    werk: serializeWerk(row.werk),
    inhaber: {
      id: row.inhaberId,
      anzeigename: row.inhaberAnzeigename,
      avatar_url: row.inhaberAvatarUrl,
      stadt_id: row.inhaberStadtId,
    },
  });
}

export async function PATCH(req: Request, ctx: RouteContext): Promise<Response> {
  const originResp = rejectIfBadOrigin(req);
  if (originResp) return originResp;

  const sess = await getSessionFromRequest(req);
  if (!sess) {
    return Response.json({ fehler: 'unauthenticated' }, { status: 401 });
  }

  const { id } = await ctx.params;
  const existing = await db
    .select()
    .from(werk)
    .where(eq(werk.id, id))
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
          message: 'Du kannst nur deine eigenen Werke bearbeiten.',
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

  const parsed = werkPatchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { fehler: 'validierung', details: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }
  const patch = parsed.data;

  const werkstandWechselt =
    patch.werkstand !== undefined && patch.werkstand !== current.werkstand;

  const update: Partial<typeof werk.$inferInsert> = {};
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.kurzbeschreibung !== undefined)
    update.kurzbeschreibung = patch.kurzbeschreibung;
  if (patch.problem !== undefined) update.problem = patch.problem;
  if (patch.zielgruppe !== undefined) update.zielgruppe = patch.zielgruppe;
  if (patch.werkstand !== undefined) update.werkstand = patch.werkstand;
  if (patch.hilfebedarf !== undefined) update.hilfebedarf = patch.hilfebedarf;
  if (patch.link !== undefined) update.link = patch.link ?? null;
  if (patch.sichtbarkeit !== undefined) update.sichtbarkeit = patch.sichtbarkeit;

  if (Object.keys(update).length === 0) {
    return Response.json({ werk: serializeWerk(current) });
  }

  update.aktualisiertAm = new Date();

  const updated = await db.transaction(async (tx) => {
    if (werkstandWechselt && patch.werkstand) {
      await tx.insert(werkHistorie).values({
        werkId: current.id,
        werkstandAlt: current.werkstand,
        werkstandNeu: patch.werkstand,
        geaendertVon: sess.nutzerId,
      });
    }
    const rows = await tx
      .update(werk)
      .set(update)
      .where(eq(werk.id, current.id))
      .returning();
    return rows[0] ?? null;
  });

  if (!updated) {
    return Response.json({ fehler: 'unbekannt' }, { status: 500 });
  }

  try {
    await db.insert(auditLog).values({
      nutzerId: sess.nutzerId,
      aktion: 'werk.aktualisiert',
      referenzTyp: 'werk',
      referenzId: updated.id,
    });
  } catch {
    // Audit-Failure darf den Erfolg nicht blockieren.
  }

  return Response.json({ werk: serializeWerk(updated) });
}

export async function DELETE(req: Request, ctx: RouteContext): Promise<Response> {
  const originResp = rejectIfBadOrigin(req);
  if (originResp) return originResp;

  const sess = await getSessionFromRequest(req);
  if (!sess) {
    return Response.json({ fehler: 'unauthenticated' }, { status: 401 });
  }

  const { id } = await ctx.params;
  const existing = await db
    .select({ id: werk.id, nutzerId: werk.nutzerId })
    .from(werk)
    .where(eq(werk.id, id))
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
          message: 'Du kannst nur deine eigenen Werke loeschen.',
        },
      },
      { status: 403 },
    );
  }

  await db.delete(werk).where(eq(werk.id, current.id));

  try {
    await db.insert(auditLog).values({
      nutzerId: sess.nutzerId,
      aktion: 'werk.geloescht',
      referenzTyp: 'werk',
      referenzId: current.id,
    });
  } catch {
    // Audit-Failure darf den Erfolg nicht blockieren.
  }

  return new Response(null, { status: 204 });
}
