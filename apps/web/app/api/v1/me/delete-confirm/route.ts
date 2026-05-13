/**
 * GET /api/v1/me/delete-confirm?token=<clear>
 *
 * Konto-Loeschung Schritt 2 (PRD §10, §34): bestaetigt die Loeschungs-Anfrage
 * per Klick auf den per Mail zugesandten Magic-Link.
 *
 * - Public-Endpunkt: keine Session erforderlich, die E-Mail-Adresse ist die
 *   Authentifizierung (wer Zugang zum Postfach hat, kann bestaetigen).
 * - STRIKTE Zweck-Pruefung: der Token-Treffer muss
 *   `zweck='konto_loeschen_bestaetigung'` haben. Ein Login-Magic-Link kann
 *   damit niemals versehentlich eine Loeschung ausloesen (PRD §16,
 *   token-misuse-prevention; siehe Unit-Test).
 * - Setzt `nutzer.status='loeschung_anstehend'` und startet die 7-Tage-Karenz
 *   via `loeschung_anstehend_bis = now() + 7 Tage`. Der tatsaechliche
 *   Hard-Delete uebernimmt der Cron-Job (task-cron-jobs-auth).
 */

import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { auditLog, magicLinkToken, nutzer } from '@/lib/db/schema';
import { hashMagicLinkToken } from '@/lib/auth/magic-link';
import { env } from '@/lib/env';

const KARENZ_TAGE = 7;

function redirectInvalid(): Response {
  return new Response(null, {
    status: 302,
    headers: {
      location: `${env.APP_URL}/anmelden?fehler=loeschung-token-ungueltig`,
    },
  });
}

function clientIp(req: Request): string | null {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    null
  );
}

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const clear = url.searchParams.get('token');
  if (!clear || clear.length < 16) return redirectInvalid();

  const tokenHash = hashMagicLinkToken(clear);

  // Strikte Zweck-Pruefung: nur Tokens mit konto_loeschen_bestaetigung
  // werden hier akzeptiert (Login-Tokens duerfen NIE die Loeschung anstossen).
  const tokenRows = await db
    .select()
    .from(magicLinkToken)
    .where(
      and(
        eq(magicLinkToken.tokenHash, tokenHash),
        eq(magicLinkToken.zweck, 'konto_loeschen_bestaetigung'),
      ),
    )
    .limit(1);
  const tok = tokenRows[0];
  if (!tok) return redirectInvalid();

  if (tok.expiresAt.getTime() < Date.now()) return redirectInvalid();
  if (tok.verwendetAm) return redirectInvalid();

  // ── Token verwerten ──────────────────────────────────────────────────────
  await db
    .update(magicLinkToken)
    .set({ verwendetAm: new Date() })
    .where(eq(magicLinkToken.id, tok.id));

  // ── Nutzer:in finden ─────────────────────────────────────────────────────
  const foundUser = await db
    .select({ id: nutzer.id })
    .from(nutzer)
    .where(eq(nutzer.email, tok.email))
    .limit(1);
  const user = foundUser[0];
  if (!user) return redirectInvalid();

  const karenzBis = new Date(
    Date.now() + KARENZ_TAGE * 24 * 60 * 60 * 1000,
  );

  await db
    .update(nutzer)
    .set({
      status: 'loeschung_anstehend',
      loeschungAnstehendBis: karenzBis,
      aktualisiertAm: new Date(),
    })
    .where(eq(nutzer.id, user.id));

  // ── Audit-Log (best-effort) ──────────────────────────────────────────────
  try {
    await db.insert(auditLog).values({
      nutzerId: user.id,
      aktion: 'me.deletion-confirmed',
      referenzTyp: 'nutzer',
      referenzId: user.id,
      ipAdresse: clientIp(req),
      userAgent: req.headers.get('user-agent'),
    });
  } catch {
    // Audit-Failure darf den Status-Wechsel nicht zurueckziehen.
  }

  return new Response(null, {
    status: 302,
    headers: {
      location: `${env.APP_URL}/einstellungen?tab=datenschutz&loeschung=bestaetigt`,
    },
  });
}
