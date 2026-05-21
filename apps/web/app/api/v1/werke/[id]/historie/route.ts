/**
 * GET /api/v1/werke/:id/historie
 *
 * Oeffentliche Build-Stand-Historie eines Werks. Liefert alle werk_historie-
 * Eintraege absteigend chronologisch sortiert, plus minimale Inhaber-Daten
 * der jeweils Aendernden (anzeigename, avatar — KEIN klarname/email).
 *
 * Quelle: PRD §15.3, §13.6 (werk_historie).
 */

import { desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { nutzer, werk, werkHistorie } from '@/lib/db/schema';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, ctx: RouteContext): Promise<Response> {
  const { id } = await ctx.params;

  // Werk existiert ueberhaupt?
  const werkRows = await db
    .select({ id: werk.id })
    .from(werk)
    .where(eq(werk.id, id))
    .limit(1);
  if (!werkRows[0]) {
    return Response.json({ fehler: 'nicht_gefunden' }, { status: 404 });
  }

  const rows = await db
    .select({
      werkstandAlt: werkHistorie.werkstandAlt,
      werkstandNeu: werkHistorie.werkstandNeu,
      geaendertAm: werkHistorie.geaendertAm,
      geaendertVonId: nutzer.id,
      geaendertVonAnzeigename: nutzer.anzeigename,
      geaendertVonAvatarUrl: nutzer.avatarUrl,
    })
    .from(werkHistorie)
    .leftJoin(nutzer, eq(nutzer.id, werkHistorie.geaendertVon))
    .where(eq(werkHistorie.werkId, id))
    .orderBy(desc(werkHistorie.geaendertAm));

  return Response.json({
    historie: rows.map((r) => ({
      werkstand_alt: r.werkstandAlt,
      werkstand_neu: r.werkstandNeu,
      geaendert_am: r.geaendertAm,
      geaendert_von: r.geaendertVonId
        ? {
            id: r.geaendertVonId,
            anzeigename: r.geaendertVonAnzeigename,
            avatar_url: r.geaendertVonAvatarUrl,
          }
        : null,
    })),
  });
}
