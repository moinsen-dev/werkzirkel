/**
 * POST /api/v1/cron/magic-link-cleanup
 *
 * Stuendlicher Cron-Job: loescht alle `magic_link_token`-Eintraege, deren
 * `expires_at` mindestens 1 Tag in der Vergangenheit liegt. Die 1-Tag-
 * Karenz sorgt dafuer, dass abgelaufene Tokens noch kurzzeitig nachvollzogen
 * werden koennen (Telemetrie / Fehleranalyse), bevor sie verschwinden.
 *
 * Auth: `X-Cron-Secret`-Header.
 *
 * Idempotenz: alle abgelaufenen Tokens sind nach der ersten Ausfuehrung weg,
 * eine zweite Ausfuehrung loescht 0 Eintraege.
 *
 * PRD-Referenz: §11 (Cron-Jobs), §16 (Token-Lifecycle).
 */

import { lt } from 'drizzle-orm';

import { db } from '@/lib/db';
import { auditLog, magicLinkToken } from '@/lib/db/schema';
import { requireCronSecret } from '@/lib/auth/cron-secret';

const KARENZ_MS = 24 * 60 * 60 * 1000;

async function handler(req: Request): Promise<Response> {
  const denied = requireCronSecret(req);
  if (denied) return denied;

  const startMs = Date.now();
  const schwelle = new Date(Date.now() - KARENZ_MS);

  const deleted = await db
    .delete(magicLinkToken)
    .where(lt(magicLinkToken.expiresAt, schwelle))
    .returning({ id: magicLinkToken.id });

  const result = {
    geloescht: deleted.length,
    dauer_ms: Date.now() - startMs,
  };

  try {
    await db.insert(auditLog).values({
      nutzerId: null,
      aktion: 'cron.magic-link-cleanup',
      metadaten: result,
    });
  } catch {
    // ignore
  }

  return Response.json(result);
}

export async function POST(req: Request): Promise<Response> {
  return handler(req);
}

export async function GET(req: Request): Promise<Response> {
  return handler(req);
}
