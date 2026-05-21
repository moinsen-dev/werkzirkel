/**
 * POST /api/v1/kurator/foerderprofile/:id/ablehnen
 *
 * City-Lead lehnt das Foerderprofil ab. Erwartet `{ grund: string }`,
 * setzt Status 'abgelehnt' und versendet T-503 an die Inhaber:in.
 *
 * PRD-Referenz: §F-702, §19.
 */

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { auditLog, foerderprofil, nutzer } from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';
import { rejectIfBadOrigin } from '@/lib/auth/csrf';
import { istKuratorVon } from '@/lib/auth/permissions';
import { sendMail } from '@/lib/email/send';
import { foerderprofilAblehnenSchema } from '@/lib/validators/foerderprofil';
import { serializeFoerderprofil } from '@/lib/foerderprofil/serialize';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: Request, ctx: RouteContext): Promise<Response> {
  const originResp = rejectIfBadOrigin(req);
  if (originResp) return originResp;

  const sess = await getSessionFromRequest(req);
  if (!sess) {
    return Response.json({ fehler: 'unauthenticated' }, { status: 401 });
  }

  const { id } = await ctx.params;

  const rows = await db
    .select({
      profil: foerderprofil,
      owner: { id: nutzer.id, email: nutzer.email, stadtId: nutzer.stadtId },
    })
    .from(foerderprofil)
    .innerJoin(nutzer, eq(foerderprofil.nutzerId, nutzer.id))
    .where(eq(foerderprofil.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) {
    return Response.json({ fehler: 'nicht_gefunden' }, { status: 404 });
  }

  const erlaubt = await istKuratorVon(sess.nutzerId, row.owner.stadtId);
  if (!erlaubt) {
    return Response.json(
      {
        error: {
          code: 'kein_zugriff',
          message:
            'Nur City-Leads der jeweiligen Stadt koennen Foerderprofile ablehnen.',
        },
      },
      { status: 403 },
    );
  }

  if (row.profil.verifikationStatus !== 'in_verifikation') {
    return Response.json(
      {
        error: {
          code: 'falscher_status',
          message: 'Nur Profile in Verifikation koennen abgelehnt werden.',
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

  const parsed = foerderprofilAblehnenSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { fehler: 'validierung', details: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }
  const { grund } = parsed.data;

  const updated = await db
    .update(foerderprofil)
    .set({
      verifikationStatus: 'abgelehnt',
      aktualisiertAm: new Date(),
    })
    .where(eq(foerderprofil.id, row.profil.id))
    .returning();
  const updatedRow = updated[0]!;

  try {
    await sendMail({
      to: row.owner.email,
      nutzerId: row.owner.id,
      template: 'T-503',
      props: {
        organisation: row.profil.organisation,
        grund,
      },
    });
  } catch (err) {
    console.error('[foerderprofil-ablehnen] sendMail T-503 failed:', err);
  }

  try {
    await db.insert(auditLog).values({
      nutzerId: sess.nutzerId,
      aktion: 'foerderprofil.abgelehnt',
      referenzTyp: 'foerderprofil',
      referenzId: row.profil.id,
      metadaten: { owner_id: row.owner.id, grund },
    });
  } catch {
    // Audit-Failure darf den Erfolg nicht blockieren.
  }

  return Response.json({ foerderprofil: serializeFoerderprofil(updatedRow) });
}
