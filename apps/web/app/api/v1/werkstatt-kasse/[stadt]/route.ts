/**
 * GET /api/v1/werkstatt-kasse/:stadt
 *
 * Öffentliche Quartalsübersicht für eine Stadt. Zeigt NUR freigegebene
 * Einträge (freigegebenAm IS NOT NULL). Optional ?quartal=YYYY-Qn filtert
 * auf das angegebene Quartal; ohne Filter werden alle freigegebenen Einträge
 * der Stadt geliefert.
 *
 * Slug-Mapping wie /zirkel/[stadt]: hh/hamburg → 'hh', b/berlin → 'b',
 * m/muenchen/münchen → 'm'. Unbekannte Slugs → 404.
 *
 * PRD-Referenz: §8.11 (Community-Pool, öffentliche Quartalsübersicht).
 */

import { and, desc, eq, isNotNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import { stadt as stadtTable, werkstattKasseEintrag } from '@/lib/db/schema';
import { serializeKasseEintrag } from '@/lib/kasse/serialize';

interface RouteContext {
  params: Promise<{ stadt: string }>;
}

const SLUG_MAP: Record<string, 'hh' | 'b' | 'm'> = {
  hh: 'hh',
  hamburg: 'hh',
  b: 'b',
  berlin: 'b',
  m: 'm',
  muenchen: 'm',
  'münchen': 'm',
};

function resolveStadtId(raw: string): 'hh' | 'b' | 'm' | null {
  const slug = decodeURIComponent(raw).trim().toLowerCase();
  return SLUG_MAP[slug] ?? null;
}

export async function GET(req: Request, ctx: RouteContext): Promise<Response> {
  const { stadt: rawSlug } = await ctx.params;
  const stadtId = resolveStadtId(rawSlug);
  if (!stadtId) {
    return Response.json({ fehler: 'nicht_gefunden' }, { status: 404 });
  }

  // Stadt-Existenz prüfen (Robustheit gegen Test-Seeds ohne diese Stadt).
  const stadtRows = await db
    .select({ id: stadtTable.id, name: stadtTable.name })
    .from(stadtTable)
    .where(eq(stadtTable.id, stadtId))
    .limit(1);
  const stadtRow = stadtRows[0];
  if (!stadtRow) {
    return Response.json({ fehler: 'nicht_gefunden' }, { status: 404 });
  }

  const url = new URL(req.url);
  const quartal = url.searchParams.get('quartal');

  const conditions = [
    eq(werkstattKasseEintrag.stadtId, stadtId),
    isNotNull(werkstattKasseEintrag.freigegebenAm),
  ];
  if (quartal) {
    conditions.push(eq(werkstattKasseEintrag.quartal, quartal));
  }

  const rows = await db
    .select()
    .from(werkstattKasseEintrag)
    .where(and(...conditions))
    .orderBy(desc(werkstattKasseEintrag.datum), desc(werkstattKasseEintrag.id));

  let summeEingangCent = 0;
  let summeAusgangCent = 0;
  for (const r of rows) {
    if (r.typ === 'eingang') summeEingangCent += r.hoeheEuroCent;
    else summeAusgangCent += r.hoeheEuroCent;
  }

  return Response.json({
    stadt: { id: stadtRow.id, name: stadtRow.name },
    quartal: quartal ?? null,
    eintraege: rows.map(serializeKasseEintrag),
    summen: {
      eingang_cent: summeEingangCent,
      ausgang_cent: summeAusgangCent,
      saldo_cent: summeEingangCent - summeAusgangCent,
    },
  });
}
