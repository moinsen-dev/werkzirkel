/**
 * /api/v1/kurator/werkstatt-kasse
 *
 *  POST — City-Lead legt einen neuen Kasse-Eintrag an (manueller Ausgang
 *  oder manueller Eingang neben den automatischen Stripe-Webhook-Eingängen).
 *  Eintrag startet UNFREIGEGEBEN (freigegebenAm = null); Admin muss freigeben.
 *
 *  GET — Kurator-Übersicht: alle Einträge der eigenen Stadt (auch
 *  unfreigegebene), nach Datum absteigend. Mit optionalem ?quartal=YYYY-Qn.
 *
 * PRD-Referenz: §8.11 (Community-Pool pro Stadt + Quartalsbericht).
 */

import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { auditLog, werkstattKasseEintrag } from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';
import { rejectIfBadOrigin } from '@/lib/auth/csrf';
import { istKuratorVon } from '@/lib/auth/permissions';
import { kasseEintragSchema } from '@/lib/validators/kasse';
import { quartalOf } from '@/lib/kasse/quartal';
import { serializeKasseEintrag } from '@/lib/kasse/serialize';

export async function POST(req: Request): Promise<Response> {
  const originResp = rejectIfBadOrigin(req);
  if (originResp) return originResp;

  const sess = await getSessionFromRequest(req);
  if (!sess) {
    return Response.json({ fehler: 'unauthenticated' }, { status: 401 });
  }

  const stadtId = sess.nutzer.stadtId;
  const erlaubt = await istKuratorVon(sess.nutzerId, stadtId);
  if (!erlaubt) {
    return Response.json(
      {
        error: {
          code: 'kein_zugriff',
          message:
            'Nur City-Leads können Community-Pool-Einträge anlegen.',
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

  const parsed = kasseEintragSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { fehler: 'validierung', details: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }
  const input = parsed.data;

  // Quartal aus Datum ableiten, falls nicht explizit gesetzt.
  const datumDate = new Date(`${input.datum}T00:00:00Z`);
  if (Number.isNaN(datumDate.getTime())) {
    return Response.json(
      { fehler: 'validierung', details: { datum: ['ungültig'] } },
      { status: 422 },
    );
  }
  const quartal = input.quartal ?? quartalOf(datumDate);

  const inserted = await db
    .insert(werkstattKasseEintrag)
    .values({
      stadtId,
      typ: input.typ,
      kategorie: input.kategorie,
      hoeheEuroCent: input.hoehe_euro_cent,
      beschreibung: input.beschreibung,
      belegUrl: input.beleg_url ?? null,
      referenzTyp: input.referenz_typ ?? null,
      referenzId: input.referenz_id ?? null,
      datum: input.datum,
      quartal,
      erfasstDurch: sess.nutzerId,
    })
    .returning();
  const row = inserted[0]!;

  try {
    await db.insert(auditLog).values({
      nutzerId: sess.nutzerId,
      aktion: 'werkstatt_kasse.angelegt',
      referenzTyp: 'werkstatt_kasse_eintrag',
      referenzId: row.id,
      metadaten: {
        stadt_id: stadtId,
        typ: input.typ,
        kategorie: input.kategorie,
        hoehe_euro_cent: input.hoehe_euro_cent,
        quartal,
      },
    });
  } catch {
    /* audit best-effort */
  }

  return Response.json(
    { eintrag: serializeKasseEintrag(row) },
    { status: 201 },
  );
}

export async function GET(req: Request): Promise<Response> {
  const sess = await getSessionFromRequest(req);
  if (!sess) {
    return Response.json({ fehler: 'unauthenticated' }, { status: 401 });
  }

  const stadtId = sess.nutzer.stadtId;
  const erlaubt = await istKuratorVon(sess.nutzerId, stadtId);
  if (!erlaubt) {
    return Response.json(
      {
        error: {
          code: 'kein_zugriff',
          message:
            'Nur City-Leads können die Kassen-Übersicht ihrer Stadt einsehen.',
        },
      },
      { status: 403 },
    );
  }

  const url = new URL(req.url);
  const quartal = url.searchParams.get('quartal');

  const where = quartal
    ? and(
        eq(werkstattKasseEintrag.stadtId, stadtId),
        eq(werkstattKasseEintrag.quartal, quartal),
      )
    : eq(werkstattKasseEintrag.stadtId, stadtId);

  const rows = await db
    .select()
    .from(werkstattKasseEintrag)
    .where(where)
    .orderBy(desc(werkstattKasseEintrag.datum), desc(werkstattKasseEintrag.id));

  return Response.json({
    stadt_id: stadtId,
    quartal: quartal ?? null,
    eintraege: rows.map(serializeKasseEintrag),
  });
}
