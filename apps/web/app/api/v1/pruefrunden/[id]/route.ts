/**
 * GET + PATCH + DELETE /api/v1/pruefrunden/:id
 *
 * - GET: oeffentliches Detail. 404 bei Status='entwurf', ausser fuer Inhaber:in.
 *   Liefert Pruefrunde + Werk-Public-Daten + Inhaber-Anzeigename + Counts
 *   (angemeldete Tester:innen, abgegebenes Feedback).
 * - PATCH: Inhaber:innen-only, NUR im Status 'entwurf'. PRD §14.2: nach
 *   Veroeffentlichung sind Pruefrunden unwiderruflich.
 * - DELETE: Inhaber:innen-only, NUR im Status 'entwurf'. CASCADE raeumt
 *   etwaige (Test-)Anmeldungen + Feedback weg.
 */

import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  auditLog,
  feedback,
  nutzer,
  pruefrunde,
  pruefrundenAnmeldung,
  werk,
} from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';
import { rejectIfBadOrigin } from '@/lib/auth/csrf';
import { pruefrundePatchSchema } from '@/lib/validators/pruefrunde';
import { serializePruefrunde } from '@/lib/pruefrunde/serialize';

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function ladePruefrundeMitWerk(id: string) {
  const rows = await db
    .select({
      pruefrunde,
      werk,
      inhaberId: nutzer.id,
      inhaberAnzeigename: nutzer.anzeigename,
      inhaberAvatarUrl: nutzer.avatarUrl,
      inhaberStadtId: nutzer.stadtId,
    })
    .from(pruefrunde)
    .innerJoin(werk, eq(werk.id, pruefrunde.werkId))
    .innerJoin(nutzer, eq(nutzer.id, werk.nutzerId))
    .where(eq(pruefrunde.id, id))
    .limit(1);
  return rows[0] ?? null;
}

async function zaehleAnmeldungen(pruefrundeId: string): Promise<number> {
  const rows = await db
    .select({ anzahl: sql<number>`count(*)::int` })
    .from(pruefrundenAnmeldung)
    .where(
      and(
        eq(pruefrundenAnmeldung.pruefrundeId, pruefrundeId),
        inArray(pruefrundenAnmeldung.status, ['angemeldet', 'feedback_gegeben']),
      ),
    );
  return rows[0]?.anzahl ?? 0;
}

async function zaehleFeedbacks(pruefrundeId: string): Promise<number> {
  const rows = await db
    .select({ anzahl: sql<number>`count(*)::int` })
    .from(feedback)
    .where(eq(feedback.pruefrundeId, pruefrundeId));
  return rows[0]?.anzahl ?? 0;
}

export async function GET(req: Request, ctx: RouteContext): Promise<Response> {
  const { id } = await ctx.params;
  const row = await ladePruefrundeMitWerk(id);
  if (!row) {
    return Response.json({ fehler: 'nicht_gefunden' }, { status: 404 });
  }

  if (row.pruefrunde.status === 'entwurf') {
    const sess = await getSessionFromRequest(req);
    if (!sess || sess.nutzerId !== row.werk.nutzerId) {
      return Response.json({ fehler: 'nicht_gefunden' }, { status: 404 });
    }
  }

  const [angemeldet, feedbackGegeben] = await Promise.all([
    zaehleAnmeldungen(row.pruefrunde.id),
    zaehleFeedbacks(row.pruefrunde.id),
  ]);

  return Response.json({
    pruefrunde: serializePruefrunde(row.pruefrunde),
    werk: {
      id: row.werk.id,
      name: row.werk.name,
      kurzbeschreibung: row.werk.kurzbeschreibung,
      werkstand: row.werk.werkstand,
      sichtbarkeit: row.werk.sichtbarkeit,
    },
    inhaber: {
      id: row.inhaberId,
      anzeigename: row.inhaberAnzeigename,
      avatar_url: row.inhaberAvatarUrl,
      stadt_id: row.inhaberStadtId,
    },
    counts: {
      angemeldet,
      feedback_gegeben: feedbackGegeben,
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
  const row = await ladePruefrundeMitWerk(id);
  if (!row) {
    return Response.json({ fehler: 'nicht_gefunden' }, { status: 404 });
  }
  if (row.werk.nutzerId !== sess.nutzerId) {
    return Response.json(
      {
        error: {
          code: 'kein_zugriff',
          message: 'Du kannst nur eigene Pruefrunden bearbeiten.',
        },
      },
      { status: 403 },
    );
  }
  if (row.pruefrunde.status !== 'entwurf') {
    return Response.json(
      {
        error: {
          code: 'nicht_editierbar',
          message:
            'Veroeffentlichte Pruefrunden koennen nicht mehr bearbeitet werden. Lege bei Bedarf eine neue an.',
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

  const parsed = pruefrundePatchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { fehler: 'validierung', details: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }
  const patch = parsed.data;

  const update: Partial<typeof pruefrunde.$inferInsert> = {};
  if (patch.titel !== undefined) update.titel = patch.titel;
  if (patch.testziel !== undefined) update.testziel = patch.testziel;
  if (patch.testaufgabe !== undefined) update.testaufgabe = patch.testaufgabe;
  if (patch.zielgruppe !== undefined) update.zielgruppe = patch.zielgruppe;
  if (patch.zeitbedarf_minuten !== undefined)
    update.zeitbedarfMinuten = patch.zeitbedarf_minuten;
  if (patch.gesuchte_tester !== undefined)
    update.gesuchteTester = patch.gesuchte_tester;
  if (patch.feedback_kategorien !== undefined)
    update.feedbackKategorien = patch.feedback_kategorien;
  if (patch.frist !== undefined) update.frist = patch.frist;

  if (Object.keys(update).length === 0) {
    return Response.json({ pruefrunde: serializePruefrunde(row.pruefrunde) });
  }

  update.aktualisiertAm = new Date();

  const updated = await db
    .update(pruefrunde)
    .set(update)
    .where(eq(pruefrunde.id, row.pruefrunde.id))
    .returning();
  const updatedRow = updated[0];
  if (!updatedRow) {
    return Response.json({ fehler: 'unbekannt' }, { status: 500 });
  }

  try {
    await db.insert(auditLog).values({
      nutzerId: sess.nutzerId,
      aktion: 'pruefrunde.aktualisiert',
      referenzTyp: 'pruefrunde',
      referenzId: updatedRow.id,
    });
  } catch {
    // Audit-Failure darf den Erfolg nicht blockieren.
  }

  return Response.json({ pruefrunde: serializePruefrunde(updatedRow) });
}

export async function DELETE(req: Request, ctx: RouteContext): Promise<Response> {
  const originResp = rejectIfBadOrigin(req);
  if (originResp) return originResp;

  const sess = await getSessionFromRequest(req);
  if (!sess) {
    return Response.json({ fehler: 'unauthenticated' }, { status: 401 });
  }

  const { id } = await ctx.params;
  const row = await ladePruefrundeMitWerk(id);
  if (!row) {
    return Response.json({ fehler: 'nicht_gefunden' }, { status: 404 });
  }
  if (row.werk.nutzerId !== sess.nutzerId) {
    return Response.json(
      {
        error: {
          code: 'kein_zugriff',
          message: 'Du kannst nur eigene Pruefrunden loeschen.',
        },
      },
      { status: 403 },
    );
  }
  if (row.pruefrunde.status !== 'entwurf') {
    return Response.json(
      {
        error: {
          code: 'nicht_loeschbar',
          message:
            'Veroeffentlichte Pruefrunden sind unwiderruflich. Du kannst nur Entwuerfe loeschen.',
        },
      },
      { status: 422 },
    );
  }

  await db.delete(pruefrunde).where(eq(pruefrunde.id, row.pruefrunde.id));

  try {
    await db.insert(auditLog).values({
      nutzerId: sess.nutzerId,
      aktion: 'pruefrunde.geloescht',
      referenzTyp: 'pruefrunde',
      referenzId: row.pruefrunde.id,
    });
  } catch {
    // Audit-Failure darf den Erfolg nicht blockieren.
  }

  return new Response(null, { status: 204 });
}
