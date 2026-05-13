/**
 * POST /api/v1/auth/magic-link
 *
 * Body (JSON): `{ email: string, zweck: "login" | "registrierung" }`.
 *
 * Verhalten (PRD §15.1, §16):
 * - Validiert per Zod.
 * - Pruest Rate-Limits:
 *   - 5 Treffer pro E-Mail pro Stunde → 429
 *   - 30 Treffer pro IP pro Stunde → 429
 * - Origin-Header muss zu APP_URL passen, sonst 403.
 * - Generiert 32-Byte-Random-Token + SHA-256-Hash.
 * - Speichert Hash in `magic_link_token` (Klartext bleibt nur im Server-RAM).
 * - Versendet T-001 (login) oder T-002 (registrierung) via `sendMail()`.
 * - Antwortet IMMER 204 (Aufklaerungsschutz gegen User-Enumeration) — auch
 *   wenn die E-Mail unbekannt ist. Bei Rate-Limit-Hit dagegen 429.
 */

import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { magicLinkToken, nutzer } from '@/lib/db/schema/nutzer';
import { env } from '@/lib/env';
import { rejectIfBadOrigin } from '@/lib/auth/csrf';
import { generateMagicLinkToken } from '@/lib/auth/magic-link';
import {
  checkMagicLinkEmailLimit,
  checkMagicLinkIpLimit,
} from '@/lib/auth/rate-limit';
import { sendMail } from '@/lib/email/send';

const MAGIC_LINK_EXPIRY_MIN = 15;

const bodySchema = z.object({
  email: z.string().email().max(320),
  zweck: z.enum(['login', 'registrierung']),
});

function clientIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  );
}

export async function POST(req: Request): Promise<Response> {
  const originResp = rejectIfBadOrigin(req);
  if (originResp) return originResp;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ fehler: 'ungueltiger_body' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { fehler: 'validierung', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const { email, zweck } = parsed.data;
  const normalizedEmail = email.toLowerCase();
  const ip = clientIp(req);

  // ── Rate-Limits PRD §16 ───────────────────────────────────────────────────
  const ipLimit = await checkMagicLinkIpLimit(ip);
  if (!ipLimit.ok) {
    return Response.json({ fehler: 'rate_limit_ip' }, { status: 429 });
  }
  const emailLimit = await checkMagicLinkEmailLimit(normalizedEmail);
  if (!emailLimit.ok) {
    return Response.json({ fehler: 'rate_limit_email' }, { status: 429 });
  }

  // ── User-Enumeration-Schutz: bei unbekannter Email immer noch 204 ────────
  // Bei login: wir versenden nur, wenn ein Nutzer existiert. Sonst NO-OP.
  // Bei registrierung: wir versenden immer (der Verify-Endpoint legt den
  // Nutzer erst beim Klick an).
  const knownNutzer = await db
    .select({ id: nutzer.id, anzeigename: nutzer.anzeigename })
    .from(nutzer)
    .where(eq(nutzer.email, normalizedEmail))
    .limit(1);

  if (zweck === 'login' && knownNutzer.length === 0) {
    // unbekannte Mail beim Login → still leise 204
    return new Response(null, { status: 204 });
  }

  // ── Token generieren + speichern ─────────────────────────────────────────
  const { clearToken, tokenHash } = generateMagicLinkToken();
  const expiresAt = new Date(Date.now() + MAGIC_LINK_EXPIRY_MIN * 60 * 1000);
  await db.insert(magicLinkToken).values({
    email: normalizedEmail,
    tokenHash,
    zweck,
    expiresAt,
  });

  // ── Mail versenden ───────────────────────────────────────────────────────
  const magicLinkUrl = `${env.APP_URL}/api/v1/auth/magic-link/verify?token=${encodeURIComponent(clearToken)}`;

  if (zweck === 'login') {
    await sendMail({
      to: normalizedEmail,
      template: 'T-001',
      props: {
        magicLinkUrl,
        expiresInMinutes: MAGIC_LINK_EXPIRY_MIN,
        appUrl: env.APP_URL,
      },
      nutzerId: knownNutzer[0]?.id ?? null,
    });
  } else {
    const anzeigename =
      knownNutzer[0]?.anzeigename ?? normalizedEmail.split('@')[0] ?? 'Werkzirkel';
    await sendMail({
      to: normalizedEmail,
      template: 'T-002',
      props: {
        magicLinkUrl,
        anzeigename,
        appUrl: env.APP_URL,
      },
      nutzerId: knownNutzer[0]?.id ?? null,
    });
  }

  return new Response(null, { status: 204 });
}
