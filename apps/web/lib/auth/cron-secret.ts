/**
 * Cron-Secret-Middleware fuer alle Endpunkte unter `/api/v1/cron/*`.
 *
 * Jeder Cron-Endpunkt erwartet einen Header `X-Cron-Secret` mit dem Wert aus
 * `env.CRON_SECRET`. Andere Aufrufer (insb. Browser-Sessions) sollen die
 * Endpunkte NICHT triggern koennen — daher kein Origin-Check, sondern reine
 * Shared-Secret-Authentifizierung.
 *
 * PRD-Referenz: §15.15 (Cron-Endpoint-Pattern), §11 (Cron-Jobs-Liste).
 */

import { env } from '@/lib/env';

/**
 * Validiert den `X-Cron-Secret`-Header.
 *
 * Returns:
 *   - `null` wenn der Header korrekt ist → Aufrufer darf weitermachen
 *   - eine `Response` (401) wenn der Header fehlt oder falsch ist
 *
 * Hardening:
 *   - Wenn `CRON_SECRET` nicht in der Env gesetzt ist, wird JEDER Aufruf
 *     abgelehnt (failed-closed) — niemals "kein Secret = freier Zugang".
 *   - Vergleich ueber `timingSafeEqual` koennte erwogen werden; da das
 *     Secret aber lang und zufaellig ist und ueber TLS reist, reicht
 *     String-Equality. (Timing-Attacks erfordern Tausende Versuche an
 *     einem Endpunkt, der ein 429 ausloest.)
 */
export function requireCronSecret(req: Request): Response | null {
  const expected = env.CRON_SECRET?.trim();
  if (!expected) {
    return Response.json(
      { fehler: 'cron_secret_nicht_konfiguriert' },
      { status: 401 },
    );
  }
  const provided = req.headers.get('x-cron-secret')?.trim();
  if (!provided || provided !== expected) {
    return Response.json({ fehler: 'unauthorized' }, { status: 401 });
  }
  return null;
}
