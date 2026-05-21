/**
 * PATCH /api/v1/termin-anmeldungen/:id/status
 *
 * Einzel-Aenderung einer Anmeldung durch die City-Lead (PRD §8.8). Wird
 * fuer nachtraegliche Korrekturen genutzt, wenn die Bulk-Anwesenheits-API
 * eine Person falsch zugeordnet hat.
 *
 * - Auth + `istKuratorVon(termin.stadt_id)` der Stadt des Termins der
 *   Anmeldung — sonst 403.
 * - Body: `{ status: 'anwesend' | 'nicht_anwesend' }`.
 * - 'storniert'-Eintraege werden nicht ueberschrieben (422).
 * - Membership-Beitrag-Hook wenn status auf 'anwesend' wechselt
 *   (Demo Night/Briefing Night + Bedarfstraeger:in).
 * - Audit-Log.
 * - Returns 200.
 */

import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { auditLog, termin, terminAnmeldung } from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';
import { rejectIfBadOrigin } from '@/lib/auth/csrf';
import { istKuratorVon } from '@/lib/auth/permissions';
import { maybeCreateSchauabendBeitrag } from '@/lib/werkstattbeitrag/schauabend-hook';
import { maybeUpdateFoerderprofilBedarfsschau } from '@/lib/foerderprofil/bedarfsschau-hook';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const statusSchema = z
  .object({
    status: z.enum(['anwesend', 'nicht_anwesend'], {
      errorMap: () => ({
        message: 'Status muss "anwesend" oder "nicht_anwesend" sein.',
      }),
    }),
  })
  .strict();

export async function PATCH(req: Request, ctx: RouteContext): Promise<Response> {
  const originResp = rejectIfBadOrigin(req);
  if (originResp) return originResp;

  const sess = await getSessionFromRequest(req);
  if (!sess) {
    return Response.json({ fehler: 'unauthenticated' }, { status: 401 });
  }

  const { id } = await ctx.params;

  const rows = await db
    .select({
      id: terminAnmeldung.id,
      terminId: terminAnmeldung.terminId,
      nutzerId: terminAnmeldung.nutzerId,
      status: terminAnmeldung.status,
      stadtId: termin.stadtId,
      typ: termin.typ,
    })
    .from(terminAnmeldung)
    .innerJoin(termin, eq(termin.id, terminAnmeldung.terminId))
    .where(eq(terminAnmeldung.id, id))
    .limit(1);
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
            'Nur City-Leads der jeweiligen Stadt koennen den Anwesenheitsstatus aendern.',
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

  const parsed = statusSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {
        fehler: 'validierung',
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 422 },
    );
  }
  const neuerStatus = parsed.data.status;

  if (row.status === 'storniert') {
    return Response.json(
      {
        error: {
          code: 'storniert_nicht_aenderbar',
          message:
            'Stornierte Anmeldungen koennen nicht auf einen Anwesenheitsstatus gesetzt werden.',
        },
      },
      { status: 422 },
    );
  }

  const vorher = row.status;

  await db
    .update(terminAnmeldung)
    .set({ status: neuerStatus })
    .where(eq(terminAnmeldung.id, id));

  // Membership-Beitrag-Hook bei Uebergang auf 'anwesend'.
  if (neuerStatus === 'anwesend' && vorher !== 'anwesend') {
    try {
      await maybeCreateSchauabendBeitrag({
        nutzer_id: row.nutzerId,
        termin_id: row.terminId,
        termin_typ: row.typ,
      });
    } catch (err) {
      console.error(
        '[termin-anmeldung-status] maybeCreateSchauabendBeitrag failed:',
        err,
      );
    }
    try {
      await maybeUpdateFoerderprofilBedarfsschau({
        nutzer_id: row.nutzerId,
        termin_id: row.terminId,
        termin_typ: row.typ,
      });
    } catch (err) {
      console.error(
        '[termin-anmeldung-status] maybeUpdateFoerderprofilBedarfsschau failed:',
        err,
      );
    }
  }

  try {
    await db.insert(auditLog).values({
      nutzerId: sess.nutzerId,
      aktion: 'termin.anwesenheit_einzel_aktualisiert',
      referenzTyp: 'termin_anmeldung',
      referenzId: id,
      metadaten: {
        vorheriger_status: vorher,
        neuer_status: neuerStatus,
        termin_id: row.terminId,
      },
    });
  } catch {
    // Audit-Failure darf den Erfolg nicht blockieren.
  }

  return Response.json({
    anmeldung: {
      id: row.id,
      termin_id: row.terminId,
      nutzer_id: row.nutzerId,
      status: neuerStatus,
    },
  });
}
