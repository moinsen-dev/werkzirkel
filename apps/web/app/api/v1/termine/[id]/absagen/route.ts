/**
 * POST /api/v1/termine/:id/absagen
 *
 * Statusuebergang `veroeffentlicht` → `abgesagt` (PRD §14.6).
 *
 * - Auth + Permission (Kurator:in der Stadt oder Admin).
 * - Status muss 'veroeffentlicht' sein.
 * - Sendet T-404 an alle Angemeldeten + Wartelisten-Personen.
 *   Auch wenn die Anmeldungs-Liste leer ist, ist das ein valider Pfad
 *   (kein Crash).
 * - Audit-Log inkl. optionalem `absage_grund` aus Body.
 */

import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  auditLog,
  nutzer,
  termin,
  terminAnmeldung,
} from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';
import { rejectIfBadOrigin } from '@/lib/auth/csrf';
import { istKuratorVon } from '@/lib/auth/permissions';
import { terminAbsagenSchema } from '@/lib/validators/termin';
import { serializeTermin } from '@/lib/termin/serialize';
import { sendMail } from '@/lib/email/send';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const TERMIN_TYP_LABEL: Record<string, string> = {
  pruefabend: 'Pruefabend',
  schauabend: 'Schauabend',
  bedarfsschau: 'Bedarfsschau',
  baurunde: 'Baurunde',
  werkgespraech: 'Werkgespraech',
  kennenlernrunde: 'Kennenlernrunde',
};

function formatDeutsch(d: Date): string {
  // Deterministische deutsche Darstellung — `Intl.DateTimeFormat` mit
  // `de-DE` & `Europe/Berlin`. Beispiel: "16. Mai 2026".
  return new Intl.DateTimeFormat('de-DE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Berlin',
  }).format(d);
}

export async function POST(req: Request, ctx: RouteContext): Promise<Response> {
  const originResp = rejectIfBadOrigin(req);
  if (originResp) return originResp;

  const sess = await getSessionFromRequest(req);
  if (!sess) {
    return Response.json({ fehler: 'unauthenticated' }, { status: 401 });
  }

  const { id } = await ctx.params;
  const rows = await db.select().from(termin).where(eq(termin.id, id)).limit(1);
  const row = rows[0];
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
            'Nur Kurator:innen der jeweiligen Stadt koennen Termine absagen.',
        },
      },
      { status: 403 },
    );
  }

  if (row.status !== 'veroeffentlicht') {
    return Response.json(
      {
        error: {
          code: 'falscher_status',
          message:
            'Nur veroeffentlichte Termine koennen abgesagt werden.',
        },
      },
      { status: 422 },
    );
  }

  // Body ist optional — leerer Body sollte nicht crashen.
  let body: unknown = {};
  if (req.headers.get('content-length') && req.headers.get('content-length') !== '0') {
    try {
      body = await req.json();
    } catch {
      body = {};
    }
  } else {
    try {
      const text = await req.text();
      if (text) body = JSON.parse(text);
    } catch {
      body = {};
    }
  }

  const parsed = terminAbsagenSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return Response.json(
      { fehler: 'validierung', details: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }
  const { absage_grund } = parsed.data;

  // Empfaenger:innen-Liste fuer T-404: alle aktiven Anmeldungen (angemeldet
  // + warteliste). Anwesend-Marker existieren beim 'veroeffentlicht'-Zustand
  // nicht; storniert/anwesend/nicht_anwesend filtern wir defensiv aus.
  const empfaenger = await db
    .select({
      anmeldungId: terminAnmeldung.id,
      nutzerId: nutzer.id,
      email: nutzer.email,
    })
    .from(terminAnmeldung)
    .innerJoin(nutzer, eq(nutzer.id, terminAnmeldung.nutzerId))
    .where(
      and(
        eq(terminAnmeldung.terminId, row.id),
        inArray(terminAnmeldung.status, ['angemeldet', 'warteliste']),
      ),
    );

  // Status hochsetzen.
  const updated = await db
    .update(termin)
    .set({ status: 'abgesagt', aktualisiertAm: new Date() })
    .where(eq(termin.id, row.id))
    .returning();
  const updatedRow = updated[0];
  if (!updatedRow) {
    return Response.json({ fehler: 'unbekannt' }, { status: 500 });
  }

  // T-404 an alle Empfaenger:innen versenden — ausserhalb der DB-Schreibe,
  // damit Mail-Failures die Absage nicht blockieren.
  const terminTypLabel = TERMIN_TYP_LABEL[row.typ] ?? row.typ;
  const terminDatum = formatDeutsch(row.datumUhrzeit);
  for (const e of empfaenger) {
    try {
      await sendMail({
        to: e.email,
        nutzerId: e.nutzerId,
        template: 'T-404',
        props: {
          terminTitel: row.titel,
          terminTyp: terminTypLabel,
          terminDatum,
          ...(absage_grund ? { absageGrund: absage_grund } : {}),
        },
      });
    } catch (err) {
      // Mail-Failures duerfen den Endpoint nicht zum Absturz bringen.
      console.error('[termin-absagen] sendMail T-404 failed:', err);
    }
  }

  try {
    await db.insert(auditLog).values({
      nutzerId: sess.nutzerId,
      aktion: 'termin.abgesagt',
      referenzTyp: 'termin',
      referenzId: updatedRow.id,
      metadaten: {
        ...(absage_grund ? { absage_grund } : {}),
        benachrichtigt: empfaenger.length,
      },
    });
  } catch {
    // Audit-Failure darf den Erfolg nicht blockieren.
  }

  return Response.json({
    termin: serializeTermin(updatedRow),
    benachrichtigt: empfaenger.length,
  });
}

