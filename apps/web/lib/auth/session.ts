/**
 * Werkzirkel-eigenes Session-Management fuer die `/api/v1/auth/*`-API.
 *
 * Wir verwenden NICHT Better-Auths interne Cookie-Signierung, sondern speichern
 * die Session-ID (cuid2) direkt im `wz_session`-Cookie. Server-seitige
 * Validierung schlaegt jede Nicht-DB-konforme ID ab; die ID an sich ist nicht
 * raterbar (24 Zeichen Base36). Damit halten wir Schemata, Cookie-Namen und
 * Lifecycle in unserer Hand.
 *
 * Cookie-Konfig gemaess PRD §16:
 * - Name: `wz_session`
 * - httpOnly + Secure + SameSite=Lax + Path=/
 * - Max-Age 30 Tage (Sliding-Window: bei Nutzung wird `expires_at` verlaengert)
 */

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { session as sessionTable, nutzer } from '@/lib/db/schema/nutzer';
import { env } from '@/lib/env';

export const SESSION_COOKIE_NAME = 'wz_session';
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 Tage

export interface SessionRow {
  id: string;
  nutzerId: string;
  expiresAt: Date;
  userAgent: string | null;
  ipAdresse: string | null;
}

/**
 * Erzeugt eine neue Session-Row und gibt die ID zurueck.
 * Cookie-Setzen ist Sache des Route-Handlers (er kennt die Response).
 */
export async function createSession(opts: {
  nutzerId: string;
  userAgent: string | null;
  ipAdresse: string | null;
}): Promise<SessionRow> {
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
  const inserted = await db
    .insert(sessionTable)
    .values({
      nutzerId: opts.nutzerId,
      expiresAt,
      userAgent: opts.userAgent,
      ipAdresse: opts.ipAdresse,
    })
    .returning();
  const row = inserted[0];
  if (!row) throw new Error('createSession: insert lieferte keinen Datensatz.');
  return {
    id: row.id,
    nutzerId: row.nutzerId,
    expiresAt: row.expiresAt,
    userAgent: row.userAgent,
    ipAdresse: row.ipAdresse,
  };
}

/**
 * Liest die Session-ID aus dem `wz_session`-Cookie der Request.
 */
export function getSessionIdFromRequest(req: Request): string | null {
  const cookie = req.headers.get('cookie');
  if (!cookie) return null;
  // simple cookie-parse — wir kennen den Namen exakt.
  for (const part of cookie.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === SESSION_COOKIE_NAME) {
      return decodeURIComponent(rest.join('='));
    }
  }
  return null;
}

/**
 * Holt die aktuelle Session inkl. Nutzer:in aus DB anhand des Cookies.
 * Liefert `null`, wenn Cookie fehlt, Session unbekannt oder abgelaufen.
 *
 * Sliding-Window: bei gueltiger Session wird `expires_at` verlaengert, wenn
 * die Naehe zur Expiry < 1 Tag ist (verhindert unnoetige Writes).
 */
export async function getSessionFromRequest(req: Request): Promise<
  | (SessionRow & {
      nutzer: typeof nutzer.$inferSelect;
    })
  | null
> {
  const id = getSessionIdFromRequest(req);
  if (!id) return null;

  const rows = await db
    .select()
    .from(sessionTable)
    .where(eq(sessionTable.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) return null;

  if (row.expiresAt.getTime() < Date.now()) {
    // abgelaufen — aufraeumen
    await db.delete(sessionTable).where(eq(sessionTable.id, id));
    return null;
  }

  // Sliding-Window: wenn weniger als 1 Tag bis Expiry, verlaengern.
  const remainingMs = row.expiresAt.getTime() - Date.now();
  if (remainingMs < 24 * 60 * 60 * 1000) {
    const newExpires = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
    await db
      .update(sessionTable)
      .set({ expiresAt: newExpires })
      .where(eq(sessionTable.id, id));
    row.expiresAt = newExpires;
  }

  const nutzerRows = await db
    .select()
    .from(nutzer)
    .where(eq(nutzer.id, row.nutzerId))
    .limit(1);
  const nutzerRow = nutzerRows[0];
  if (!nutzerRow) return null;

  return {
    id: row.id,
    nutzerId: row.nutzerId,
    expiresAt: row.expiresAt,
    userAgent: row.userAgent,
    ipAdresse: row.ipAdresse,
    nutzer: nutzerRow,
  };
}

/**
 * Baut den `Set-Cookie`-Headerwert fuer `wz_session`.
 * In Produktion `Secure`, in Dev (NODE_ENV !== production) ohne Secure damit
 * lokales HTTP-Testing funktioniert.
 */
export function buildSessionCookie(sessionId: string): string {
  const secure = env.NODE_ENV === 'production' ? '; Secure' : '';
  return [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionId)}`,
    `Path=/`,
    `HttpOnly`,
    `SameSite=Lax`,
    `Max-Age=${SESSION_MAX_AGE_SECONDS}`,
  ].join('; ') + secure;
}

/**
 * Baut einen `Set-Cookie`-Header, der das Session-Cookie loescht.
 */
export function buildClearSessionCookie(): string {
  const secure = env.NODE_ENV === 'production' ? '; Secure' : '';
  return [
    `${SESSION_COOKIE_NAME}=`,
    `Path=/`,
    `HttpOnly`,
    `SameSite=Lax`,
    `Max-Age=0`,
  ].join('; ') + secure;
}
