/**
 * GET /api/v1/kurator/bedarfe-in-pruefung
 *
 * Kurator-View aller Bedarfe in Status 'in_pruefung' fuer die Stadt der
 * Kurator:in. Liefert pro Bedarf den letzten Sprach-Check-Treffer aus dem
 * audit_log (sofern vorhanden), damit die Kurator:in problematische
 * Begriffe direkt sieht.
 *
 * Permission: User muss Kurator:in fuer die jeweilige Bedarf-Stadt sein.
 * Wir liefern nur Bedarfe der Staedte, die der User curiert.
 *
 * PRD-Referenz: §F-603, §11A Schutz S4.
 */

import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { auditLog, bedarf, nutzer } from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';
import { istKuratorVon } from '@/lib/auth/permissions';
import { serializeBedarf } from '@/lib/bedarf/serialize';
import type { Bedarf } from '@/lib/db/schema';

export async function GET(req: Request): Promise<Response> {
  const sess = await getSessionFromRequest(req);
  if (!sess) {
    return Response.json({ fehler: 'unauthenticated' }, { status: 401 });
  }

  // Alle Bedarfe in_pruefung laden, dann nach Kurator-Berechtigung pro Stadt
  // filtern. Bei sehr grossen Datenmengen waere ein JOIN mit stadt+kurator
  // billiger; fuer Hamburg-only-Phase ist das hier OK.
  const inPruefung = await db
    .select({
      bedarf,
      owner_anzeigename: nutzer.anzeigename,
      owner_klarname: nutzer.klarname,
      owner_email: nutzer.email,
    })
    .from(bedarf)
    .innerJoin(nutzer, eq(bedarf.nutzerId, nutzer.id))
    .where(eq(bedarf.status, 'in_pruefung'))
    .orderBy(desc(bedarf.aktualisiertAm));

  const result: Array<{
    bedarf: Record<string, unknown>;
    owner: { anzeigename: string; klarname: string | null; email: string };
    sprach_check_treffer: string[];
  }> = [];

  for (const row of inPruefung) {
    const erlaubt = await istKuratorVon(sess.nutzerId, row.bedarf.stadtId);
    if (!erlaubt) continue;

    // Letzten Sprach-Check-Treffer aus audit_log holen
    const auditRows = await db
      .select({ metadaten: auditLog.metadaten })
      .from(auditLog)
      .where(
        and(
          eq(auditLog.aktion, 'bedarf.eingereicht'),
          eq(auditLog.referenzTyp, 'bedarf'),
          eq(auditLog.referenzId, row.bedarf.id),
        ),
      )
      .orderBy(desc(auditLog.erstelltAm))
      .limit(1);
    const meta = auditRows[0]?.metadaten as
      | { sprach_check_treffer?: string[] }
      | undefined;
    const treffer = Array.isArray(meta?.sprach_check_treffer)
      ? meta!.sprach_check_treffer
      : [];

    result.push({
      bedarf: serializeBedarf(row.bedarf as Bedarf),
      owner: {
        anzeigename: row.owner_anzeigename,
        klarname: row.owner_klarname,
        email: row.owner_email,
      },
      sprach_check_treffer: treffer,
    });
  }

  return Response.json({ bedarfe: result });
}
