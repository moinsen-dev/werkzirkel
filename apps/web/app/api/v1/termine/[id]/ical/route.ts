/**
 * GET /api/v1/termine/:id/ical
 *
 * Liefert einen RFC-5545-konformen .ics-Body fuer einen Termin.
 *
 * Sichtbarkeit:
 *  - 'geplant' → 404 (Termin ist nicht oeffentlich, keine Kalender-Eintraege).
 *  - 'veroeffentlicht' / 'durchgefuehrt' / 'abgesagt' → 200, .ics herunterladbar.
 *    'abgesagt' liefert STATUS:CANCELLED, damit ein bereits importierter Termin
 *    in fremden Kalendern automatisch als abgesagt markiert wird (RFC-5545 §3.8.1.11).
 *
 * Antwort-Header:
 *  - Content-Type: text/calendar; charset=utf-8
 *  - Content-Disposition: attachment; filename="werkzirkel-<typ>-<id>.ics"
 *
 * Verlinkt aus T-401 Bestaetigungs-Mail und Termin-Detail-Seite (PRD §8.8 + §15.8).
 */

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { termin } from '@/lib/db/schema';
import { env } from '@/lib/env';
import { buildIcsForTermin } from '@/lib/termin/ical';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, ctx: RouteContext): Promise<Response> {
  const { id } = await ctx.params;

  const rows = await db.select().from(termin).where(eq(termin.id, id)).limit(1);
  const row = rows[0];
  if (!row) {
    return new Response(null, { status: 404 });
  }

  // 'geplant'-Termine sind nicht oeffentlich — kein Kalender-Eintrag.
  if (row.status === 'geplant') {
    return new Response(null, { status: 404 });
  }

  const ics = buildIcsForTermin(
    {
      id: row.id,
      titel: row.titel,
      beschreibung: row.beschreibung,
      ort_text: row.ortText,
      online_link: row.onlineLink,
      datum_uhrzeit: row.datumUhrzeit,
      status: row.status,
      typ: row.typ,
    },
    env.APP_URL,
  );

  return new Response(ics, {
    status: 200,
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      'content-disposition': `attachment; filename="werkzirkel-${row.typ}-${row.id}.ics"`,
      'cache-control': 'no-store',
    },
  });
}
