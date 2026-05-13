/**
 * POST /api/v1/cron/ip-kuerzung
 *
 * Taeglicher Cron-Job, der die DSGVO-Datenminimierung gemaess PRD §34
 * durchsetzt:
 *
 *  - Sessions und Audit-Log-Eintraege aelter als 30 Tage:
 *      letztes IPv4-Oktett auf `0` setzen (z.B. `192.168.1.42` → `192.168.1.0`).
 *      Idempotent: schon gekuerzte Eintraege werden nicht erneut beruehrt.
 *  - Sessions und Audit-Log-Eintraege aelter als 90 Tage:
 *      `user_agent` auf `NULL` setzen. Idempotent.
 *
 * Auth: `X-Cron-Secret`-Header.
 *
 * Idempotenz: WHERE-Clauses schliessen bereits behandelte Eintraege aus,
 * sodass ein Doppelaufruf 0 weitere Updates erzeugt.
 *
 * Implementierungs-Hinweis (IPv4): wir kuerzen mit einem regex-Replace via
 * SQL — `regexp_replace(ip_adresse, '\.[0-9]+$', '.0')`. IPv6-Adressen
 * (enthalten `:`) werden ueber `WHERE ip_adresse NOT LIKE '%:%'` ausgeschlossen
 * und bleiben unveraendert (Datenminimierung fuer IPv6 erfolgt anders,
 * derzeit out-of-scope laut PRD §34).
 */

import { and, eq, lt, sql, isNotNull, not, like } from 'drizzle-orm';

import { db } from '@/lib/db';
import { auditLog, session } from '@/lib/db/schema';
import { requireCronSecret } from '@/lib/auth/cron-secret';

const IP_KUERZUNG_TAGE = 30;
const UA_LOESCHUNG_TAGE = 90;

async function handler(req: Request): Promise<Response> {
  const denied = requireCronSecret(req);
  if (denied) return denied;

  const startMs = Date.now();
  const jetzt = Date.now();
  const ipSchwelle = new Date(jetzt - IP_KUERZUNG_TAGE * 24 * 60 * 60 * 1000);
  const uaSchwelle = new Date(jetzt - UA_LOESCHUNG_TAGE * 24 * 60 * 60 * 1000);

  // ── Session-IP-Kuerzung ─────────────────────────────────────────────────
  // Nur Eintraege > 30 Tage, IPv4 (kein ':' enthalten), nicht schon auf '.0'.
  const sessionIpUpdate = await db
    .update(session)
    .set({
      ipAdresse: sql`regexp_replace(${session.ipAdresse}, '\\.[0-9]+$', '.0')`,
    })
    .where(
      and(
        lt(session.erstelltAm, ipSchwelle),
        isNotNull(session.ipAdresse),
        not(like(session.ipAdresse, '%:%')),
        not(like(session.ipAdresse, '%.0')),
      ),
    )
    .returning({ id: session.id });

  // ── Session-User-Agent-Loeschung ────────────────────────────────────────
  const sessionUaUpdate = await db
    .update(session)
    .set({ userAgent: null })
    .where(
      and(lt(session.erstelltAm, uaSchwelle), isNotNull(session.userAgent)),
    )
    .returning({ id: session.id });

  // ── Audit-Log-IP-Kuerzung ───────────────────────────────────────────────
  const auditIpUpdate = await db
    .update(auditLog)
    .set({
      ipAdresse: sql`regexp_replace(${auditLog.ipAdresse}, '\\.[0-9]+$', '.0')`,
    })
    .where(
      and(
        lt(auditLog.erstelltAm, ipSchwelle),
        isNotNull(auditLog.ipAdresse),
        not(like(auditLog.ipAdresse, '%:%')),
        not(like(auditLog.ipAdresse, '%.0')),
      ),
    )
    .returning({ id: auditLog.id });

  // ── Audit-Log-User-Agent-Loeschung ──────────────────────────────────────
  const auditUaUpdate = await db
    .update(auditLog)
    .set({ userAgent: null })
    .where(
      and(lt(auditLog.erstelltAm, uaSchwelle), isNotNull(auditLog.userAgent)),
    )
    .returning({ id: auditLog.id });

  const result = {
    session_ip_kuerzungen: sessionIpUpdate.length,
    session_ua_geloescht: sessionUaUpdate.length,
    audit_ip_kuerzungen: auditIpUpdate.length,
    audit_ua_geloescht: auditUaUpdate.length,
    dauer_ms: Date.now() - startMs,
  };

  // Audit-Log fuer den Cron-Lauf selbst.
  try {
    await db.insert(auditLog).values({
      nutzerId: null,
      aktion: 'cron.ip-kuerzung',
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

// Unused-Import-Schutz fuer den `eq`-Re-Export aus drizzle-orm (wird hier
// nicht direkt benutzt, koennte aber bei zukuenftiger Erweiterung helfen).
void eq;
