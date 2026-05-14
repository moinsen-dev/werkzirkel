/**
 * GET /api/v1/auth/magic-link/verify?token=<clear>
 *
 * Verifiziert einen Magic-Link-Token (PRD §15.1, §16):
 * - Hasht den eingehenden Klartext-Token mit SHA-256.
 * - Sucht ihn in `magic_link_token` (per `token_hash`).
 * - Lehnt ab, wenn unbekannt / abgelaufen / bereits verwendet:
 *   302 → `${APP_URL}/anmelden?fehler=token-ungueltig`.
 * - Sonst:
 *   - Markiert Token als verwendet (`verwendet_am = now()`).
 *   - Bei `zweck='registrierung'` und unbekannter E-Mail: legt einen neuen
 *     Nutzer mit Mindest-Defaults an (klarname leer, anzeigename = local-part).
 *   - Setzt `email_verifiziert_am`, falls noch nicht gesetzt.
 *   - Erstellt eine neue Session-Row und setzt `wz_session`-Cookie.
 *   - 302 → `${APP_URL}/uebersicht` (oder `tokenRow.next_path`, wenn gesetzt
 *     UND same-origin — Off-Site-Redirects werden defensiv geblockt).
 */

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { magicLinkToken, nutzer } from '@/lib/db/schema/nutzer';
import { env } from '@/lib/env';
import { hashMagicLinkToken } from '@/lib/auth/magic-link';
import { buildSessionCookie, createSession } from '@/lib/auth/session';

function redirectInvalid(): Response {
  return new Response(null, {
    status: 302,
    headers: { location: `${env.APP_URL}/anmelden?fehler=token-ungueltig` },
  });
}

function clientIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  );
}

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const clear = url.searchParams.get('token');
  if (!clear || clear.length < 16) return redirectInvalid();

  const tokenHash = hashMagicLinkToken(clear);

  const tokenRows = await db
    .select()
    .from(magicLinkToken)
    .where(eq(magicLinkToken.tokenHash, tokenHash))
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

  // ── Nutzer:in suchen / anlegen ───────────────────────────────────────────
  const found = await db
    .select()
    .from(nutzer)
    .where(eq(nutzer.email, tok.email))
    .limit(1);

  let nutzerId: string;

  const existing = found[0];
  if (existing) {
    nutzerId = existing.id;
    // E-Mail-Verifikation nachziehen, falls noch nicht passiert.
    if (!existing.emailVerifiziertAm) {
      await db
        .update(nutzer)
        .set({ emailVerifiziertAm: new Date() })
        .where(eq(nutzer.id, nutzerId));
    }
  } else if (
    tok.zweck === 'registrierung' ||
    tok.zweck === 'registrierung-bedarf' ||
    tok.zweck === 'registrierung-foerder'
  ) {
    const localPart = tok.email.split('@')[0] ?? 'macher';
    const initialRollen =
      tok.zweck === 'registrierung-bedarf'
        ? (['bedarfstraeger'] as const)
        : tok.zweck === 'registrierung-foerder'
          ? (['foerderer'] as const)
          : (['macher'] as const);
    const insertedNutzer = await db
      .insert(nutzer)
      .values({
        email: tok.email,
        emailVerifiziertAm: new Date(),
        klarname: '',
        anzeigename: localPart,
        stadtId: 'hh',
        rollen: [...initialRollen],
      })
      .returning({ id: nutzer.id });
    const created = insertedNutzer[0];
    if (!created) return redirectInvalid();
    nutzerId = created.id;
  } else {
    // login-Zweck, aber kein Nutzer da → unerwartet (POST blockt das),
    // aber defensiv abfangen.
    return redirectInvalid();
  }

  // ── Session erzeugen + Cookie setzen ─────────────────────────────────────
  const sess = await createSession({
    nutzerId,
    userAgent: req.headers.get('user-agent'),
    ipAdresse: clientIp(req),
  });

  // Redirect-Ziel bestimmen:
  // - registrierung-bedarf/-foerder: zwingt nach /registrieren?rolle=...
  //   (Klarname-Pflicht muss noch erfuellt werden, bevor /uebersicht zugaenglich ist).
  // - Sonst: `next_path` aus dem Token bevorzugen, wenn gesetzt UND eindeutig
  //   same-origin. Fallback Default `/uebersicht`.
  let safeNext: string;
  if (tok.zweck === 'registrierung-bedarf') {
    safeNext = '/registrieren?rolle=bedarf';
  } else if (tok.zweck === 'registrierung-foerder') {
    safeNext = '/registrieren?rolle=foerder';
  } else {
    safeNext = isSafeNextPath(tok.nextPath) ? tok.nextPath! : '/uebersicht';
  }

  const headers = new Headers({
    location: `${env.APP_URL}${safeNext}`,
    'set-cookie': buildSessionCookie(sess.id),
  });
  return new Response(null, { status: 302, headers });
}

/**
 * Sicherheits-Filter fuer Redirect-Targets: nur same-origin Pfade erlauben.
 *
 * Erlaubt: `/uebersicht`, `/werke/abc`, `/anmelden?foo=bar`.
 * Verworfen: `https://evil.com/`, `//evil.com/phish`, `javascript:...`.
 */
function isSafeNextPath(p: string | null): boolean {
  if (!p) return false;
  if (!p.startsWith('/')) return false;
  if (p.startsWith('//')) return false;
  return true;
}
