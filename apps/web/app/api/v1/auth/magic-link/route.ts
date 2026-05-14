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

import { z } from 'zod';
import { rejectIfBadOrigin } from '@/lib/auth/csrf';
import { requestMagicLink } from '@/lib/auth/magic-link';

const bodySchema = z.object({
  email: z.string().email().max(320),
  zweck: z.enum([
    'login',
    'registrierung',
    'registrierung-bedarf',
    'registrierung-foerder',
  ]),
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
  const ip = clientIp(req);

  const result = await requestMagicLink({ email, zweck, ip });
  if (!result.ok) {
    return Response.json({ fehler: result.fehler }, { status: 429 });
  }
  return new Response(null, { status: 204 });
}
