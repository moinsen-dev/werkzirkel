/**
 * GET + PATCH + DELETE /api/v1/termine/:id
 *
 * - GET: Detail. Public fuer 'veroeffentlicht'/'durchgefuehrt'/'abgesagt'.
 *   'geplant' nur fuer City-Lead der Stadt (oder Admin). Liefert Termin +
 *   Counter der aktiven Anmeldungen (PRD §15.8).
 * - PATCH: City-Lead-only, nur in Status 'geplant' oder 'veroeffentlicht'
 *   (PRD §14.6).
 * - DELETE: City-Lead-only, nur in Status 'geplant' loeschbar. CASCADE
 *   raeumt termin_anmeldung + Bezuege mit weg.
 */

import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  auditLog,
  termin,
  terminAnmeldung,
} from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';
import { rejectIfBadOrigin } from '@/lib/auth/csrf';
import { istKuratorVon } from '@/lib/auth/permissions';
import { terminPatchSchema } from '@/lib/validators/termin';
import { serializeTermin } from '@/lib/termin/serialize';
import {
  ladeBedarfBezuege,
  ladeFoerderprofilBezuege,
} from '@/lib/termin/bezuege';

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function ladeTermin(id: string) {
  const rows = await db
    .select()
    .from(termin)
    .where(eq(termin.id, id))
    .limit(1);
  return rows[0] ?? null;
}

async function zaehleAnmeldungen(terminId: string): Promise<number> {
  const rows = await db
    .select({ anzahl: sql<number>`count(*)::int` })
    .from(terminAnmeldung)
    .where(
      and(
        eq(terminAnmeldung.terminId, terminId),
        inArray(terminAnmeldung.status, ['angemeldet', 'anwesend']),
      ),
    );
  return rows[0]?.anzahl ?? 0;
}

async function zaehleWarteliste(terminId: string): Promise<number> {
  const rows = await db
    .select({ anzahl: sql<number>`count(*)::int` })
    .from(terminAnmeldung)
    .where(
      and(
        eq(terminAnmeldung.terminId, terminId),
        eq(terminAnmeldung.status, 'warteliste'),
      ),
    );
  return rows[0]?.anzahl ?? 0;
}

export async function GET(req: Request, ctx: RouteContext): Promise<Response> {
  const { id } = await ctx.params;
  const row = await ladeTermin(id);
  if (!row) {
    return Response.json({ fehler: 'nicht_gefunden' }, { status: 404 });
  }

  if (row.status === 'geplant') {
    const sess = await getSessionFromRequest(req);
    if (!sess) {
      return Response.json({ fehler: 'nicht_gefunden' }, { status: 404 });
    }
    const erlaubt = await istKuratorVon(sess.nutzerId, row.stadtId);
    if (!erlaubt) {
      return Response.json({ fehler: 'nicht_gefunden' }, { status: 404 });
    }
  }

  const [angemeldet, warteliste] = await Promise.all([
    zaehleAnmeldungen(row.id),
    zaehleWarteliste(row.id),
  ]);

  // Bei Briefing Night-Terminen liefern wir die verknuepften Bedarfe und
  // Foerderprofile mit, damit Frontends in einem Roundtrip rendern koennen
  // (PRD §8.8, §13.19, §13.20).
  let bedarfe:
    | Array<Awaited<ReturnType<typeof ladeBedarfBezuege>>[number]>
    | undefined;
  let foerderprofile:
    | Array<Awaited<ReturnType<typeof ladeFoerderprofilBezuege>>[number]>
    | undefined;
  if (row.typ === 'bedarfsschau') {
    [bedarfe, foerderprofile] = await Promise.all([
      ladeBedarfBezuege(row.id),
      ladeFoerderprofilBezuege(row.id),
    ]);
  }

  return Response.json({
    termin: serializeTermin(row),
    counts: {
      angemeldet,
      warteliste,
    },
    ...(bedarfe !== undefined ? { bedarfe } : {}),
    ...(foerderprofile !== undefined ? { foerderprofile } : {}),
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
  const row = await ladeTermin(id);
  if (!row) {
    return Response.json({ fehler: 'nicht_gefunden' }, { status: 404 });
  }

  const erlaubt = await istKuratorVon(sess.nutzerId, row.stadtId);
  if (!erlaubt) {
    return Response.json(
      {
        error: {
          code: 'kein_zugriff',
          message:
            'Nur City-Leads der jeweiligen Stadt koennen Termine bearbeiten.',
        },
      },
      { status: 403 },
    );
  }

  if (row.status !== 'geplant' && row.status !== 'veroeffentlicht') {
    return Response.json(
      {
        error: {
          code: 'nicht_editierbar',
          message:
            'Termine koennen nur in Status "geplant" oder "veroeffentlicht" bearbeitet werden.',
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

  const parsed = terminPatchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { fehler: 'validierung', details: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }
  const patch = parsed.data;

  // Ort/Online-Link konsistent zum gemergten Endzustand pruefen.
  const finalOrt =
    patch.ort_text !== undefined ? patch.ort_text : row.ortText;
  const finalLink =
    patch.online_link !== undefined ? patch.online_link : row.onlineLink;
  if (!(finalOrt && finalOrt.trim()) && !(finalLink && finalLink.trim())) {
    return Response.json(
      {
        fehler: 'validierung',
        details: {
          ort_text: ['Termin braucht entweder einen Ort oder einen Online-Link.'],
        },
      },
      { status: 422 },
    );
  }

  const update: Partial<typeof termin.$inferInsert> = {};
  if (patch.typ !== undefined) update.typ = patch.typ;
  if (patch.titel !== undefined) update.titel = patch.titel;
  if (patch.beschreibung !== undefined) update.beschreibung = patch.beschreibung;
  if (patch.ort_text !== undefined) update.ortText = patch.ort_text;
  if (patch.online_link !== undefined) update.onlineLink = patch.online_link;
  if (patch.datum_uhrzeit !== undefined) update.datumUhrzeit = patch.datum_uhrzeit;
  if (patch.max_teilnehmer !== undefined) update.maxTeilnehmer = patch.max_teilnehmer;

  if (Object.keys(update).length === 0) {
    return Response.json({ termin: serializeTermin(row) });
  }

  update.aktualisiertAm = new Date();

  const updated = await db
    .update(termin)
    .set(update)
    .where(eq(termin.id, row.id))
    .returning();
  const updatedRow = updated[0];
  if (!updatedRow) {
    return Response.json({ fehler: 'unbekannt' }, { status: 500 });
  }

  try {
    await db.insert(auditLog).values({
      nutzerId: sess.nutzerId,
      aktion: 'termin.aktualisiert',
      referenzTyp: 'termin',
      referenzId: updatedRow.id,
    });
  } catch {
    // Audit-Failure darf den Erfolg nicht blockieren.
  }

  return Response.json({ termin: serializeTermin(updatedRow) });
}

export async function DELETE(req: Request, ctx: RouteContext): Promise<Response> {
  const originResp = rejectIfBadOrigin(req);
  if (originResp) return originResp;

  const sess = await getSessionFromRequest(req);
  if (!sess) {
    return Response.json({ fehler: 'unauthenticated' }, { status: 401 });
  }

  const { id } = await ctx.params;
  const row = await ladeTermin(id);
  if (!row) {
    return Response.json({ fehler: 'nicht_gefunden' }, { status: 404 });
  }

  const erlaubt = await istKuratorVon(sess.nutzerId, row.stadtId);
  if (!erlaubt) {
    return Response.json(
      {
        error: {
          code: 'kein_zugriff',
          message:
            'Nur City-Leads der jeweiligen Stadt koennen Termine loeschen.',
        },
      },
      { status: 403 },
    );
  }

  if (row.status !== 'geplant') {
    return Response.json(
      {
        error: {
          code: 'nicht_loeschbar',
          message:
            'Nur Termine im Status "geplant" sind loeschbar. Veroeffentlichte Termine bitte absagen.',
        },
      },
      { status: 422 },
    );
  }

  await db.delete(termin).where(eq(termin.id, row.id));

  try {
    await db.insert(auditLog).values({
      nutzerId: sess.nutzerId,
      aktion: 'termin.geloescht',
      referenzTyp: 'termin',
      referenzId: row.id,
    });
  } catch {
    // Audit-Failure darf den Erfolg nicht blockieren.
  }

  return new Response(null, { status: 204 });
}
