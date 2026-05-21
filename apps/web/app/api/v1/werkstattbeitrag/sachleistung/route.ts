/**
 * POST /api/v1/werkstattbeitrag/sachleistung
 *
 * Membership-Beitrag-Pfad C: Bedarfstraeger:in meldet eine Sachleistung
 * (Raum, Getraenke, Doku, ...). Beitrag wird mit Status 'erfasst' angelegt
 * und muss von einer City-Lead via /api/v1/kurator/werkstattbeitraege/:id/
 * verifizieren auf 'verifiziert' gehoben werden.
 *
 * - Auth + Bedarfstraeger:innen-Rolle.
 * - Body: { nachweis_text, nachweis_dokument_url? }.
 *
 * PRD-Referenz: §10.5, §18 (Pfad C).
 */

import { db } from '@/lib/db';
import { auditLog, werkstattbeitrag } from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';
import { rejectIfBadOrigin } from '@/lib/auth/csrf';
import { istBedarfstraeger } from '@/lib/auth/permissions';
import { werkstattbeitragSachleistungSchema } from '@/lib/validators/werkstattbeitrag';
import { serializeWerkstattbeitrag } from '@/lib/werkstattbeitrag/serialize';

export async function POST(req: Request): Promise<Response> {
  const originResp = rejectIfBadOrigin(req);
  if (originResp) return originResp;

  const sess = await getSessionFromRequest(req);
  if (!sess) {
    return Response.json({ fehler: 'unauthenticated' }, { status: 401 });
  }

  if (!istBedarfstraeger(sess.nutzer)) {
    return Response.json(
      {
        error: {
          code: 'keine_bedarfstraeger_rolle',
          message:
            'Nur Bedarfstraeger:innen koennen einen Membership-Beitrag melden. Bitte erst die Rolle in den Einstellungen hinzufuegen.',
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

  const parsed = werkstattbeitragSachleistungSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { fehler: 'validierung', details: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }
  const { nachweis_text, nachweis_dokument_url } = parsed.data;

  const inserted = await db
    .insert(werkstattbeitrag)
    .values({
      nutzerId: sess.nutzerId,
      art: 'sachleistung',
      nachweisText: nachweis_text,
      nachweisDokumentUrl: nachweis_dokument_url ?? null,
      status: 'erfasst',
    })
    .returning();
  const row = inserted[0];
  if (!row) {
    return Response.json({ fehler: 'unbekannt' }, { status: 500 });
  }

  try {
    await db.insert(auditLog).values({
      nutzerId: sess.nutzerId,
      aktion: 'werkstattbeitrag.sachleistung.gemeldet',
      referenzTyp: 'werkstattbeitrag',
      referenzId: row.id,
    });
  } catch {
    // Audit-Failure darf den Erfolg nicht blockieren.
  }

  return Response.json(
    { werkstattbeitrag: serializeWerkstattbeitrag(row) },
    { status: 201 },
  );
}
