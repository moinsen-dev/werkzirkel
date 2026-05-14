/**
 * POST /api/v1/bedarfe/:id/einreichen
 *
 * Bedarf von 'entwurf' → 'in_pruefung' transferieren. Zwei kritische
 * Schutzmechaniken (PRD §11A + §F-602):
 *
 * 1. **Werkstattbeitrag-Gate**: Es muss ein verifizierter Werkstattbeitrag
 *    der Bedarfstraeger:in existieren, der noch gueltig ist (gueltig_bis
 *    > now oder NULL) und noch nicht 4-fach verwendet wurde
 *    (verwendet_fuer_bedarfe < 4). Ohne 422 mit code='werkstattbeitrag_fehlt'.
 *
 * 2. **Sprach-Check**: Pruefung gegen `lib/moderation/verbotene-woerter.ts`.
 *    Treffer fuehren nicht zur Ablehnung — sie werden im audit_log
 *    dokumentiert, damit die Kurator:in sie bei der Pruefung sieht.
 *    Der Status ist in beiden Faellen 'in_pruefung' (Kurator pruet immer).
 *
 * Versendet T-301 (Bestaetigung) an die Bedarfstraeger:in.
 *
 * PRD-Referenz: §F-602, §F-603, §14.3, §11A.
 */

import { and, eq, gt, isNull, lt, or } from 'drizzle-orm';
import { db } from '@/lib/db';
import { auditLog, bedarf, werkstattbeitrag } from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';
import { rejectIfBadOrigin } from '@/lib/auth/csrf';
import { sendMail } from '@/lib/email/send';
import { env } from '@/lib/env';
import { serializeBedarf } from '@/lib/bedarf/serialize';
import { checkSprache } from '@/lib/moderation/verbotene-woerter';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const APP_URL = env.APP_URL.replace(/\/+$/, '');
const VERWENDET_LIMIT = 4;

export async function POST(req: Request, ctx: RouteContext): Promise<Response> {
  const originResp = rejectIfBadOrigin(req);
  if (originResp) return originResp;

  const sess = await getSessionFromRequest(req);
  if (!sess) {
    return Response.json({ fehler: 'unauthenticated' }, { status: 401 });
  }

  const { id } = await ctx.params;
  const rows = await db.select().from(bedarf).where(eq(bedarf.id, id)).limit(1);
  const row = rows[0];
  if (!row) {
    return Response.json({ fehler: 'nicht_gefunden' }, { status: 404 });
  }

  if (row.nutzerId !== sess.nutzerId) {
    return Response.json(
      { error: { code: 'kein_zugriff', message: 'Nur die Inhaber:in darf einreichen.' } },
      { status: 403 },
    );
  }

  if (row.status !== 'entwurf') {
    return Response.json(
      {
        error: {
          code: 'falscher_status',
          message: 'Nur Bedarfe im Status "entwurf" koennen eingereicht werden.',
        },
      },
      { status: 422 },
    );
  }

  // ── Werkstattbeitrag-Gate ──────────────────────────────────────────────
  const jetzt = new Date();
  const beitragRows = await db
    .select()
    .from(werkstattbeitrag)
    .where(
      and(
        eq(werkstattbeitrag.nutzerId, sess.nutzerId),
        eq(werkstattbeitrag.status, 'verifiziert'),
        or(
          isNull(werkstattbeitrag.gueltigBis),
          gt(werkstattbeitrag.gueltigBis, jetzt),
        ),
        lt(werkstattbeitrag.verwendetFuerBedarfe, VERWENDET_LIMIT),
      ),
    )
    .limit(1);

  const beitrag = beitragRows[0];
  if (!beitrag) {
    return Response.json(
      {
        error: {
          code: 'werkstattbeitrag_fehlt',
          message:
            'Bitte hinterlege zuerst einen gueltigen Werkstattbeitrag (Schauabend, Geldbeitrag oder Sachleistung).',
        },
      },
      { status: 422 },
    );
  }

  // ── Sprach-Check ───────────────────────────────────────────────────────
  const checkText = [row.titel, row.problem, row.nutzen, row.organisation].join(
    '\n',
  );
  const sprache = checkSprache(checkText);

  const updated = await db
    .update(bedarf)
    .set({
      status: 'in_pruefung',
      werkstattbeitragId: beitrag.id,
      aktualisiertAm: jetzt,
    })
    .where(eq(bedarf.id, row.id))
    .returning();
  const updatedRow = updated[0]!;

  // T-301 Bestaetigung
  try {
    await sendMail({
      to: sess.nutzer.email,
      nutzerId: sess.nutzerId,
      template: 'T-301',
      props: {
        titel: row.titel,
        organisation: row.organisation,
        bedarfUrl: `${APP_URL}/uebersicht/bedarfe`,
      },
    });
  } catch (err) {
    console.error('[bedarf-einreichen] sendMail T-301 failed:', err);
  }

  try {
    await db.insert(auditLog).values({
      nutzerId: sess.nutzerId,
      aktion: 'bedarf.eingereicht',
      referenzTyp: 'bedarf',
      referenzId: row.id,
      metadaten: {
        werkstattbeitrag_id: beitrag.id,
        sprach_check_ok: sprache.ok,
        sprach_check_treffer: sprache.treffer,
      },
    });
  } catch {
    // Audit-Failure darf den Erfolg nicht blockieren.
  }

  return Response.json({
    bedarf: serializeBedarf(updatedRow),
    sprach_check: { ok: sprache.ok, treffer: sprache.treffer },
  });
}
