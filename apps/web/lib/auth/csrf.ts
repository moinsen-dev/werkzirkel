/**
 * Origin-Header-Check fuer alle POST-Endpunkte unter `/api/v1/auth/*`.
 *
 * Schuetzt vor Cross-Site-Request-Forgery: Browser senden den `Origin`-Header
 * automatisch bei POST-Requests. Wenn er fehlt oder nicht der konfigurierten
 * App-URL entspricht, lehnen wir den Request ab.
 *
 * PRD-Referenz: §16 (Auth-Security).
 */

import { env } from '@/lib/env';

const APP_ORIGIN = new URL(env.APP_URL).origin;

export function isAllowedOrigin(req: Request): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return false;
  try {
    return new URL(origin).origin === APP_ORIGIN;
  } catch {
    return false;
  }
}

/**
 * Hilfsfunktion fuer Route-Handler: gibt `null` bei erlaubtem Origin,
 * sonst eine 403-Response.
 */
export function rejectIfBadOrigin(req: Request): Response | null {
  if (isAllowedOrigin(req)) return null;
  return new Response(
    JSON.stringify({ fehler: 'origin_unzulaessig' }),
    {
      status: 403,
      headers: { 'content-type': 'application/json' },
    },
  );
}
