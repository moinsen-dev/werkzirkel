/**
 * POST /api/v1/foerderprofile/:id/einreichen
 *
 * Foerderprofil von 'entwurf' → 'in_verifikation' transferieren. Versendet
 * T-501 an die Foerder:in als Bestaetigung; City-Leads-Notification
 * laeuft per separater Notifications-Pipeline (hier nicht im Scope).
 *
 * PRD-Referenz: §F-702 (Verifikations-Workflow §19).
 */

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { auditLog, foerderprofil } from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';
import { rejectIfBadOrigin } from '@/lib/auth/csrf';
import { sendMail } from '@/lib/email/send';
import { env } from '@/lib/env';
import { serializeFoerderprofil } from '@/lib/foerderprofil/serialize';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const APP_URL = env.APP_URL.replace(/\/+$/, '');

export async function POST(req: Request, ctx: RouteContext): Promise<Response> {
  const originResp = rejectIfBadOrigin(req);
  if (originResp) return originResp;

  const sess = await getSessionFromRequest(req);
  if (!sess) {
    return Response.json({ fehler: 'unauthenticated' }, { status: 401 });
  }

  const { id } = await ctx.params;

  const rows = await db
    .select()
    .from(foerderprofil)
    .where(eq(foerderprofil.id, id))
    .limit(1);
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

  if (row.verifikationStatus !== 'entwurf') {
    return Response.json(
      {
        error: {
          code: 'falscher_status',
          message: 'Nur Profile im Status "entwurf" koennen eingereicht werden.',
        },
      },
      { status: 422 },
    );
  }

  const updated = await db
    .update(foerderprofil)
    .set({ verifikationStatus: 'in_verifikation', aktualisiertAm: new Date() })
    .where(eq(foerderprofil.id, row.id))
    .returning();
  const updatedRow = updated[0]!;

  // T-501 an die Foerder:in.
  try {
    await sendMail({
      to: sess.nutzer.email,
      nutzerId: sess.nutzerId,
      template: 'T-501',
      props: {
        organisation: row.organisation,
        profilUrl: `${APP_URL}/uebersicht/foerderprofil`,
      },
    });
  } catch (err) {
    console.error('[foerderprofil-einreichen] sendMail T-501 failed:', err);
  }

  try {
    await db.insert(auditLog).values({
      nutzerId: sess.nutzerId,
      aktion: 'foerderprofil.eingereicht',
      referenzTyp: 'foerderprofil',
      referenzId: row.id,
    });
  } catch {
    // Audit-Failure darf den Erfolg nicht blockieren.
  }

  return Response.json({ foerderprofil: serializeFoerderprofil(updatedRow) });
}
