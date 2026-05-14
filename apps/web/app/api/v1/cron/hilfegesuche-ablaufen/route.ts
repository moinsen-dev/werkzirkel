/**
 * POST/GET /api/v1/cron/hilfegesuche-ablaufen
 *
 * Taeglicher Cron. Setzt alle Hilfegesuche mit `gueltig_bis < now` UND
 * Status `offen` ODER `beantwortet` auf `status='abgelaufen'`.
 *
 * PRD-Referenz: §8.15 (max 14 Tage Gueltigkeit), §15.15 (Cron-Pattern).
 * Auth: `X-Cron-Secret`-Header.
 */

import { and, inArray, lt } from 'drizzle-orm';

import { db } from '@/lib/db';
import { auditLog, hilfegesuch } from '@/lib/db/schema';
import { requireCronSecret } from '@/lib/auth/cron-secret';

export const AUDIT_AKTION_CRON_LAUF = 'cron.hilfegesuche-ablaufen';

async function handler(req: Request): Promise<Response> {
  const denied = requireCronSecret(req);
  if (denied) return denied;

  const startMs = Date.now();
  const jetzt = new Date();

  const aktualisiert = await db
    .update(hilfegesuch)
    .set({ status: 'abgelaufen' })
    .where(
      and(
        lt(hilfegesuch.gueltigBis, jetzt),
        inArray(hilfegesuch.status, ['offen', 'beantwortet']),
      ),
    )
    .returning({ id: hilfegesuch.id });

  const result = {
    abgelaufen: aktualisiert.length,
  };

  const dauerMs = Date.now() - startMs;
  try {
    await db.insert(auditLog).values({
      nutzerId: null,
      aktion: AUDIT_AKTION_CRON_LAUF,
      metadaten: { ...result, dauer_ms: dauerMs },
    });
  } catch {
    // Audit-Failure tolerabel.
  }

  return Response.json(result);
}

export async function POST(req: Request): Promise<Response> {
  return handler(req);
}

export async function GET(req: Request): Promise<Response> {
  return handler(req);
}
