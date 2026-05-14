/**
 * GET /api/v1/termine/:id/anmeldungen
 *
 * Liste aller Anmeldungen zu einem Termin. Sichtbar fuer Kurator:innen der
 * jeweiligen Stadt (oder Admin). Liefert die nutzer-public-Daten + Status.
 *
 * PRD §F-402, §15.8.
 */

import { asc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { nutzer, termin, terminAnmeldung } from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';
import { istKuratorVon } from '@/lib/auth/permissions';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(req: Request, ctx: RouteContext): Promise<Response> {
  const sess = await getSessionFromRequest(req);
  if (!sess) {
    return Response.json({ fehler: 'unauthenticated' }, { status: 401 });
  }

  const { id } = await ctx.params;

  const terminRows = await db
    .select({ id: termin.id, stadtId: termin.stadtId })
    .from(termin)
    .where(eq(termin.id, id))
    .limit(1);
  const terminRow = terminRows[0];
  if (!terminRow) {
    return Response.json({ fehler: 'nicht_gefunden' }, { status: 404 });
  }

  const erlaubt = await istKuratorVon(sess.nutzerId, terminRow.stadtId);
  if (!erlaubt) {
    return Response.json(
      {
        error: {
          code: 'kein_zugriff',
          message:
            'Nur Kurator:innen der jeweiligen Stadt koennen die Anmeldungs-Liste sehen.',
        },
      },
      { status: 403 },
    );
  }

  const rows = await db
    .select({
      id: terminAnmeldung.id,
      status: terminAnmeldung.status,
      notiz: terminAnmeldung.notiz,
      erstellt_am: terminAnmeldung.erstelltAm,
      nutzer_id: nutzer.id,
      nutzer_anzeigename: nutzer.anzeigename,
      nutzer_stadt_id: nutzer.stadtId,
    })
    .from(terminAnmeldung)
    .innerJoin(nutzer, eq(nutzer.id, terminAnmeldung.nutzerId))
    .where(eq(terminAnmeldung.terminId, id))
    .orderBy(asc(terminAnmeldung.erstelltAm), asc(terminAnmeldung.id));

  return Response.json({
    anmeldungen: rows.map((r) => ({
      id: r.id,
      status: r.status,
      notiz: r.notiz,
      erstellt_am: r.erstellt_am,
      nutzer: {
        id: r.nutzer_id,
        anzeigename: r.nutzer_anzeigename,
        stadt_id: r.nutzer_stadt_id,
      },
    })),
  });
}
