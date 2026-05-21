/**
 * POST /api/v1/kurator/foerderprofile/:id/verifizieren
 *
 * City-Lead der Stadt der Foerder:in setzt das Profil von 'in_verifikation'
 * auf 'verifiziert'. Versendet T-502 an die Inhaber:in.
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
            'Nur City-Leads der jeweiligen Stadt koennen Foerderprofile verifizieren.',
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
          message: 'Nur Profile in Verifikation koennen verifiziert werden.',
        },
      },
      { status: 422 },
    );
  }

  const jetzt = new Date();
  const updated = await db
    .update(foerderprofil)
    .set({
      verifikationStatus: 'verifiziert',
      verifiziererId: sess.nutzerId,
      verifiziertAm: jetzt,
      pausiertSeit: null,
      aktualisiertAm: jetzt,
    })
    .where(eq(foerderprofil.id, row.profil.id))
    .returning();
  const updatedRow = updated[0]!;

  try {
    await sendMail({
      to: row.owner.email,
      nutzerId: row.owner.id,
      template: 'T-502',
      props: {
        organisation: row.profil.organisation,
        profilUrl: `${APP_URL}/uebersicht/foerderprofil`,
      },
    });
  } catch (err) {
    console.error('[foerderprofil-verifizieren] sendMail T-502 failed:', err);
  }

  try {
    await db.insert(auditLog).values({
      nutzerId: sess.nutzerId,
      aktion: 'foerderprofil.verifiziert',
      referenzTyp: 'foerderprofil',
      referenzId: row.profil.id,
      metadaten: { owner_id: row.owner.id },
    });
  } catch {
    // Audit-Failure darf den Erfolg nicht blockieren.
  }

  return Response.json({ foerderprofil: serializeFoerderprofil(updatedRow) });
}
