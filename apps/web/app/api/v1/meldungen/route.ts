/**
 * POST /api/v1/meldungen
 *
 * Eine Meldung anlegen. Anonyme Meldungen sind ausdruecklich erlaubt
 * (PRD §27, §F-503) — `gemeldet_von` = null, wenn keine Session vorhanden.
 *
 * - CSRF-Schutz: rejectIfBadOrigin (Browser sendet Origin automatisch, auch
 *   ohne Auth).
 * - Rate-Limit: 10 Meldungen pro IP pro Stunde (Spam-Schutz).
 * - Audit-Log: meldung.angelegt.
 *
 * Antwort: 201 mit der angelegten Meldung; 422 bei Validierungsfehler;
 *          403 bei falschem Origin; 429 bei Rate-Limit.
 */

import { db } from '@/lib/db';
import { auditLog, meldung } from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';
import { rejectIfBadOrigin } from '@/lib/auth/csrf';
import { checkLimit } from '@/lib/auth/rate-limit';
import { meldungAnlegenSchema } from '@/lib/validators/meldung';

function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]!.trim();
  return req.headers.get('x-real-ip') ?? 'unbekannt';
}

export async function POST(req: Request): Promise<Response> {
  const originResp = rejectIfBadOrigin(req);
  if (originResp) return originResp;

  // Session ist OPTIONAL — anonyme Meldungen sind erlaubt.
  const sess = await getSessionFromRequest(req).catch(() => null);

  // Rate-Limit pro IP gegen Meldungs-Spam.
  const ip = clientIp(req);
  const limit = await checkLimit({
    key: `ip:${ip}`,
    endpoint: 'meldung-anlegen',
    max: 10,
    windowMinutes: 60,
  });
  if (!limit.ok) {
    return Response.json(
      {
        error: {
          code: 'rate_limited',
          message:
            'Zu viele Meldungen von dieser IP. Bitte warte eine Stunde und versuche es erneut.',
        },
      },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ fehler: 'ungueltiger_body' }, { status: 400 });
  }
  const parsed = meldungAnlegenSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { fehler: 'validierung', details: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }
  const input = parsed.data;

  const inserted = await db
    .insert(meldung)
    .values({
      gemeldetVon: sess?.nutzerId ?? null,
      referenzTyp: input.referenz_typ,
      referenzId: input.referenz_id,
      kategorie: input.kategorie,
      beschreibung: input.beschreibung ?? null,
      status: 'offen',
    })
    .returning();

  const row = inserted[0];
  if (!row) {
    return Response.json({ fehler: 'unbekannt' }, { status: 500 });
  }

  try {
    await db.insert(auditLog).values({
      nutzerId: sess?.nutzerId ?? null,
      aktion: 'meldung.angelegt',
      referenzTyp: 'meldung',
      referenzId: row.id,
      metadaten: {
        referenz_typ: input.referenz_typ,
        referenz_id: input.referenz_id,
        kategorie: input.kategorie,
        anonym: sess == null,
      },
      ipAdresse: ip,
    });
  } catch {
    // Audit-Failure darf den Erfolg nicht blockieren.
  }

  return Response.json({ meldung: row }, { status: 201 });
}
