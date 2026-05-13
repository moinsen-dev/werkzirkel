/**
 * GET /api/v1/pruefrunden/:id/anmeldungen
 *
 * Liste angemeldeter Tester:innen einer Pruefrunde — nur fuer Werk-Inhaber:in.
 * PRD §F-203, §15.4.
 *
 * - Auth + Werk-Inhaber:innen-Check.
 * - Liefert Public-Profil-Daten (anzeigename, avatar_url, stadt_id) + Anmeldungs-Status.
 */

import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { nutzer, pruefrunde, pruefrundenAnmeldung, werk } from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(req: Request, ctx: RouteContext): Promise<Response> {
  const sess = await getSessionFromRequest(req);
  if (!sess) {
    return Response.json({ fehler: 'unauthenticated' }, { status: 401 });
  }

  const { id } = await ctx.params;

  // Pruefrunde + Werk laden — wir brauchen nur die werk.nutzer_id fuer den
  // Permission-Check.
  const prRows = await db
    .select({
      pruefrundeId: pruefrunde.id,
      werkNutzerId: werk.nutzerId,
    })
    .from(pruefrunde)
    .innerJoin(werk, eq(werk.id, pruefrunde.werkId))
    .where(eq(pruefrunde.id, id))
    .limit(1);
  const prRow = prRows[0];
  if (!prRow) {
    return Response.json({ fehler: 'nicht_gefunden' }, { status: 404 });
  }
  if (prRow.werkNutzerId !== sess.nutzerId) {
    return Response.json(
      {
        error: {
          code: 'kein_zugriff',
          message:
            'Nur die Werk-Inhaber:in kann die Tester:innen-Liste einsehen.',
        },
      },
      { status: 403 },
    );
  }

  const rows = await db
    .select({
      id: pruefrundenAnmeldung.id,
      status: pruefrundenAnmeldung.status,
      erstelltAm: pruefrundenAnmeldung.erstelltAm,
      testerId: nutzer.id,
      anzeigename: nutzer.anzeigename,
      avatarUrl: nutzer.avatarUrl,
      stadtId: nutzer.stadtId,
    })
    .from(pruefrundenAnmeldung)
    .innerJoin(nutzer, eq(nutzer.id, pruefrundenAnmeldung.testerId))
    .where(and(eq(pruefrundenAnmeldung.pruefrundeId, id)))
    .orderBy(asc(pruefrundenAnmeldung.erstelltAm));

  return Response.json({
    anmeldungen: rows.map((r) => ({
      id: r.id,
      status: r.status,
      erstellt_am: r.erstelltAm,
      tester: {
        id: r.testerId,
        anzeigename: r.anzeigename,
        avatar_url: r.avatarUrl,
        stadt_id: r.stadtId,
      },
    })),
  });
}
