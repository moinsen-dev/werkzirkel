/**
 * Postgres-backed Sliding-Window-Rate-Limit.
 *
 * Speichert pro Treffer eine Zeile in `rate_limit_bucket`. Beim Check werden
 * Zeilen im Fenster gezaehlt; wenn der Counter unter dem Limit liegt, wird
 * eine neue Zeile gesetzt und `{ ok: true }` zurueckgegeben. Sonst 429.
 *
 * Genutzt in `app/api/v1/auth/magic-link/route.ts`:
 * - 5 Magic-Links pro E-Mail pro Stunde
 * - 30 Magic-Links pro IP pro Stunde
 *
 * PRD-Referenz: §16 (Auth & Rate-Limits).
 */

import { and, eq, gt } from 'drizzle-orm';
import { db } from '@/lib/db';
import { rateLimitBucket } from '@/lib/db/schema/rate-limit';

export interface CheckLimitOpts {
  /** Schluessel — typisch `email:<addr>` oder `ip:<addr>`. */
  key: string;
  /** Endpoint-Bezeichner (z.B. `magic-link-email`, `magic-link-ip`). */
  endpoint: string;
  /** Maximalzahl von Treffern im Fenster (inklusive). Ueberschreitung → 429. */
  max: number;
  /** Fenstergroesse in Minuten. */
  windowMinutes: number;
}

export interface CheckLimitResult {
  ok: boolean;
  remaining: number;
  count: number;
}

/**
 * Prueft + erhoeht atomar das Sliding-Window. Wenn unter dem Limit, wird ein
 * neuer Eintrag erzeugt und `ok: true` zurueckgegeben. Sonst `ok: false`.
 */
export async function checkLimit(
  opts: CheckLimitOpts,
): Promise<CheckLimitResult> {
  const since = new Date(Date.now() - opts.windowMinutes * 60 * 1000);
  const rows = await db
    .select({ id: rateLimitBucket.id })
    .from(rateLimitBucket)
    .where(
      and(
        eq(rateLimitBucket.key, opts.key),
        eq(rateLimitBucket.endpoint, opts.endpoint),
        gt(rateLimitBucket.erstelltAm, since),
      ),
    );

  const count = rows.length;

  if (count >= opts.max) {
    return { ok: false, remaining: 0, count };
  }

  // Unter dem Limit → Treffer registrieren.
  await db.insert(rateLimitBucket).values({
    key: opts.key,
    endpoint: opts.endpoint,
  });

  return { ok: true, remaining: opts.max - count - 1, count: count + 1 };
}

/**
 * Magic-Link: 5 Versende-Anforderungen pro E-Mail-Adresse pro Stunde (PRD §16).
 */
export function checkMagicLinkEmailLimit(email: string): Promise<CheckLimitResult> {
  return checkLimit({
    key: `email:${email.toLowerCase()}`,
    endpoint: 'magic-link-email',
    max: 5,
    windowMinutes: 60,
  });
}

/**
 * Magic-Link: 30 Versende-Anforderungen pro IP-Adresse pro Stunde (PRD §16).
 */
export function checkMagicLinkIpLimit(ip: string): Promise<CheckLimitResult> {
  return checkLimit({
    key: `ip:${ip}`,
    endpoint: 'magic-link-ip',
    max: 30,
    windowMinutes: 60,
  });
}
