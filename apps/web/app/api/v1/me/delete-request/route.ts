/**
 * POST /api/v1/me/delete-request
 *
 * Konto-Loeschung Schritt 1 (PRD §10, §34): erzeugt einen
 * Bestaetigungs-Magic-Link-Token mit `zweck='konto_loeschen_bestaetigung'`
 * und versendet T-003. Der eigentliche Statuswechsel auf
 * `loeschung_anstehend` passiert erst beim Klick auf den Bestaetigungs-Link.
 *
 * Idempotenz: aeltere offene Tokens fuer dieselbe Email + diesen Zweck
 * werden vor dem Insert auf `verwendet_am = now()` gesetzt — so existiert
 * zu jedem Zeitpunkt maximal ein gueltiger Pending-Token.
 */

import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import { auditLog, magicLinkToken } from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';
import { rejectIfBadOrigin } from '@/lib/auth/csrf';
import { generateMagicLinkToken } from '@/lib/auth/magic-link';
import { sendMail } from '@/lib/email/send';
import { env } from '@/lib/env';

const CONFIRM_EXPIRY_MIN = 15;

function clientIp(req: Request): string | null {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    null
  );
}

export async function POST(req: Request): Promise<Response> {
  const originResp = rejectIfBadOrigin(req);
  if (originResp) return originResp;

  const sess = await getSessionFromRequest(req);
  if (!sess) {
    return Response.json({ fehler: 'unauthenticated' }, { status: 401 });
  }

  const email = sess.nutzer.email;

  // ── Aeltere Pending-Tokens fuer denselben Zweck invalidieren ─────────────
  await db
    .update(magicLinkToken)
    .set({ verwendetAm: new Date() })
    .where(
      and(
        eq(magicLinkToken.email, email),
        eq(magicLinkToken.zweck, 'konto_loeschen_bestaetigung'),
        isNull(magicLinkToken.verwendetAm),
      ),
    );

  // ── Neuen Bestaetigungs-Token anlegen ────────────────────────────────────
  const { clearToken, tokenHash } = generateMagicLinkToken();
  const expiresAt = new Date(Date.now() + CONFIRM_EXPIRY_MIN * 60 * 1000);
  await db.insert(magicLinkToken).values({
    email,
    tokenHash,
    zweck: 'konto_loeschen_bestaetigung',
    expiresAt,
  });

  // ── T-003 versenden ──────────────────────────────────────────────────────
  // Voraussichtliches Loeschdatum: heute + 7 Tage. Der User hat 15min zum
  // Confirmen; Karenz startet ab Confirm-Klick. Die Differenz ist <0,1 Tag,
  // also rundet "heute+7T" zuverlaessig auf das tatsaechliche Datum.
  const confirmUrl = `${env.APP_URL}/api/v1/me/delete-confirm?token=${encodeURIComponent(clearToken)}`;
  const voraussichtlichesLoeschdatum = new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000,
  ).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  await sendMail({
    to: email,
    template: 'T-003',
    props: {
      confirmUrl,
      voraussichtlichesLoeschdatum,
      appUrl: env.APP_URL,
    },
    nutzerId: sess.nutzerId,
  });

  // ── Audit-Log (best-effort) ──────────────────────────────────────────────
  try {
    await db.insert(auditLog).values({
      nutzerId: sess.nutzerId,
      aktion: 'me.delete-requested',
      referenzTyp: 'nutzer',
      referenzId: sess.nutzerId,
      ipAdresse: clientIp(req),
      userAgent: req.headers.get('user-agent'),
    });
  } catch {
    // Audit-Failure darf den Versand-Pfad nicht blockieren.
  }

  return new Response(null, { status: 204 });
}
