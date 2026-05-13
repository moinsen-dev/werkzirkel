'use server';

/**
 * Server-Actions fuer `/anmelden`.
 *
 * `magicLinkAnfordern` wird vom Formular auf der Anmelden-Seite per
 * `<form action={magicLinkAnfordern}>` aufgerufen. Sie validiert E-Mail
 * und Zweck via Zod, ermittelt die Client-IP fuer den Rate-Limit-Bucket
 * und ruft die Kern-Funktion `requestMagicLink()` aus
 * `lib/auth/magic-link.ts` direkt auf — kein HTTP-Hop, damit der
 * Origin-CSRF-Check des HTTP-Endpoints nicht im Weg steht.
 *
 * Nach dem Aufruf wird auf die Anmelden-Seite zurueck-redirected:
 * - Erfolg            → `?gesendet=1`
 * - Rate-Limit-Treffer → `?fehler=rate-limit`
 * - Validierungs-Fehler → `?fehler=ungueltige-email`
 *
 * `?next` wird durch die ganze Kette geschleift (in der Server-Action,
 * im Token-Insert, im Verify-Redirect) — alle Stationen pruefen auf
 * same-origin.
 */

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { requestMagicLink } from '@/lib/auth/magic-link';

const schema = z.object({
  email: z.string().email().max(320),
  zweck: z.enum(['login', 'registrierung']),
});

export async function magicLinkAnfordern(formData: FormData): Promise<void> {
  const email = String(formData.get('email') ?? '').trim();
  const zweckRaw = String(formData.get('zweck') ?? 'login');
  const nextRaw = String(formData.get('next') ?? '');

  const next =
    nextRaw && nextRaw.startsWith('/') && !nextRaw.startsWith('//')
      ? nextRaw
      : '';
  const nextQuery = next ? `&next=${encodeURIComponent(next)}` : '';

  const parsed = schema.safeParse({ email, zweck: zweckRaw });
  if (!parsed.success) {
    redirect(`/anmelden?fehler=ungueltige-email${nextQuery}`);
  }

  const hdrs = await headers();
  const ip =
    hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    hdrs.get('x-real-ip') ??
    '0.0.0.0';

  const result = await requestMagicLink({
    email: parsed.data.email,
    zweck: parsed.data.zweck,
    ip,
    nextPath: next || null,
  });

  if (!result.ok) {
    redirect(`/anmelden?fehler=rate-limit${nextQuery}`);
  }

  redirect(`/anmelden?gesendet=1${nextQuery}`);
}
