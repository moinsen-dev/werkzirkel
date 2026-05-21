/**
 * POST /api/v1/kurator/werkstatt-kasse/quartal/:q/abschliessen
 *
 * City-Lead schließt ein Quartal ab. Erzeugt einen Snapshot-Audit-Eintrag
 * mit allen Eingang-/Ausgang-Summen für die eigene Stadt + Quartal. Die
 * eigentlichen Kasse-Einträge werden NICHT verändert — der Abschluss ist
 * ein Buchhaltungs-Marker, keine Mutation. Wiederholtes Aufrufen schreibt
 * neue Snapshot-Versionen ins audit_log (Trail).
 *
 * Quartal-Param: 'YYYY-Qn' (URL-encoded; Next.js decoded das).
 *
 * PRD-Referenz: §8.11 (Quartalsabschluss-Workflow).
 */

import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { auditLog, werkstattKasseEintrag } from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';
import { rejectIfBadOrigin } from '@/lib/auth/csrf';
import { istKuratorVon } from '@/lib/auth/permissions';
import { parseQuartal } from '@/lib/kasse/quartal';

interface RouteContext {
  params: Promise<{ q: string }>;
}

export async function POST(req: Request, ctx: RouteContext): Promise<Response> {
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
            'Nur City-Leads ihrer Stadt können Quartale abschließen.',
        },
      },
      { status: 403 },
    );
  }

  const { q } = await ctx.params;
  const quartalLabel = decodeURIComponent(q);
  if (!parseQuartal(quartalLabel)) {
    return Response.json(
      {
        error: {
          code: 'ungueltiges_quartal',
          message: 'Quartal muss im Format YYYY-Q1..Q4 vorliegen.',
        },
      },
      { status: 422 },
    );
  }

  const rows = await db
    .select()
    .from(werkstattKasseEintrag)
    .where(
      and(
        eq(werkstattKasseEintrag.stadtId, stadtId),
        eq(werkstattKasseEintrag.quartal, quartalLabel),
      ),
    );

  let summeEingangCent = 0;
  let summeAusgangCent = 0;
  let anzahlFreigegeben = 0;
  let anzahlOffen = 0;
  for (const r of rows) {
    if (r.typ === 'eingang') summeEingangCent += r.hoeheEuroCent;
    else summeAusgangCent += r.hoeheEuroCent;
    if (r.freigegebenAm) anzahlFreigegeben++;
    else anzahlOffen++;
  }
  const saldoCent = summeEingangCent - summeAusgangCent;

  const snapshot = {
    stadt_id: stadtId,
    quartal: quartalLabel,
    anzahl_eintraege: rows.length,
    anzahl_freigegeben: anzahlFreigegeben,
    anzahl_offen: anzahlOffen,
    summe_eingang_cent: summeEingangCent,
    summe_ausgang_cent: summeAusgangCent,
    saldo_cent: saldoCent,
    abgeschlossen_am: new Date().toISOString(),
  };

  try {
    await db.insert(auditLog).values({
      nutzerId: sess.nutzerId,
      aktion: 'werkstatt_kasse.quartal_abgeschlossen',
      referenzTyp: 'werkstatt_kasse_quartal',
      referenzId: `${stadtId}:${quartalLabel}`,
      metadaten: snapshot,
    });
  } catch (err) {
    console.error('[kasse-abschluss] audit_log fehlgeschlagen:', err);
  }

  return Response.json({ abschluss: snapshot });
}
