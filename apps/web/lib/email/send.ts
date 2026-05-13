/**
 * sendMail — zentraler Versand-Helper fuer alle Werkzirkel-Transaktionsmails.
 *
 * Kapselt:
 * - Template-Lookup (Name → React-Komponente)
 * - HTML- + Plain-Text-Rendering via `@react-email/render`
 * - Resend-Versand (oder Mock-Log wenn `RESEND_API_KEY` leer ist — Dev-Pfad)
 * - Persistente Protokollierung in `email_benachrichtigung_log`
 *
 * Aufrufer-Beispiel:
 *
 *     await sendMail({
 *       to: 'jana@example.com',
 *       template: 'T-001',
 *       props: { magicLinkUrl, expiresInMinutes: 15 },
 *       nutzerId,
 *     });
 *
 * Die konkrete Verdrahtung in Auth-/Cron-Routen passiert in den
 * Geschwister-Tasks (task-magic-link-endpoints, task-konto-loeschung,
 * task-cron-jobs-auth) — hier nur die Infrastruktur.
 *
 * PRD-Referenz: §11 (Resend-Tech-Stack), §23 (Template-Liste).
 */

import { render } from '@react-email/render';
import { Resend } from 'resend';
import * as React from 'react';

import { db } from '@/lib/db';
import { emailBenachrichtigungLog } from '@/lib/db/schema/audit';
import { env } from '@/lib/env';

import {
  MagicLinkLogin,
  T001_BETREFF,
  type MagicLinkLoginProps,
} from './templates/t-001-magic-link-login';
import {
  MagicLinkRegistrierung,
  T002_BETREFF,
  type MagicLinkRegistrierungProps,
} from './templates/t-002-magic-link-registrierung';
import {
  KontoLoeschungBestaetigung,
  T003_BETREFF,
  type KontoLoeschungBestaetigungProps,
} from './templates/t-003-konto-loeschung-bestaetigung';
import {
  KontoLoeschungErinnerung,
  T004_BETREFF,
  type KontoLoeschungErinnerungProps,
} from './templates/t-004-konto-loeschung-erinnerung';
import {
  KontoGeloescht,
  T005_BETREFF,
  type KontoGeloeschtProps,
} from './templates/t-005-konto-geloescht';
import {
  PruefrundeNeueAnmeldung,
  T101_BETREFF,
  type PruefrundeNeueAnmeldungProps,
} from './templates/t-101-pruefrunde-neue-anmeldung';
import {
  PruefrundeNeuesFeedback,
  T102_BETREFF,
  type PruefrundeNeuesFeedbackProps,
} from './templates/t-102-pruefrunde-neues-feedback';
import {
  ReziprozitaetFrist3d,
  T103_BETREFF,
  type ReziprozitaetFrist3dProps,
} from './templates/t-103-reziprozitaet-frist-3d';
import {
  ReziprozitaetFrist1d,
  T104_BETREFF,
  type ReziprozitaetFrist1dProps,
} from './templates/t-104-reziprozitaet-frist-1d';

/**
 * Diskriminierte Union aller bekannten Templates.
 * Jeder Eintrag bindet Template-Name an seinen Props-Typ — der Aufrufer
 * bekommt von TypeScript erzwungen die richtigen Felder.
 */
export type MailTemplate =
  | { template: 'T-001'; props: MagicLinkLoginProps }
  | { template: 'T-002'; props: MagicLinkRegistrierungProps }
  | { template: 'T-003'; props: KontoLoeschungBestaetigungProps }
  | { template: 'T-004'; props: KontoLoeschungErinnerungProps }
  | { template: 'T-005'; props: KontoGeloeschtProps }
  | { template: 'T-101'; props: PruefrundeNeueAnmeldungProps }
  | { template: 'T-102'; props: PruefrundeNeuesFeedbackProps }
  | { template: 'T-103'; props: ReziprozitaetFrist3dProps }
  | { template: 'T-104'; props: ReziprozitaetFrist1dProps };

/**
 * Datei-Anhang. Folgt dem Resend-Format, ist hier aber lokal getypt damit
 * der Helper unabhaengig von Resend-Typen bleibt (z.B. fuer Tests).
 */
export interface MailAttachment {
  filename: string;
  /** Buffer oder Base64-String. */
  content: Buffer | string;
  contentType?: string;
}

export interface SendMailBaseOpts {
  /** Empfaenger-Adresse. */
  to: string;
  /** Optional: Nutzer-ID fuer Versand-Log (FK auf nutzer.id). */
  nutzerId?: string | null;
  /** Optional: Datei-Anhaenge (z.B. DSGVO-Export beim Konto-Loesch-Mail). */
  attachments?: MailAttachment[];
}

export type SendMailOpts = SendMailBaseOpts & MailTemplate;

export interface SendMailResult {
  ok: boolean;
  /** True, wenn nur in der Konsole gemockt wurde (kein Resend-API-Key). */
  mocked?: boolean;
  /** Resend-ID aus der API-Antwort (sofern echt versendet). */
  resendId?: string | null;
  /** Fehler-Nachricht falls Versand fehlschlug. */
  fehler?: string;
}

/**
 * Mappt einen Template-Namen auf das passende Element (Komponente + Props)
 * und den deutschen Betreff. Zentrale Registry — neue Templates hier
 * eintragen.
 */
function buildEmail(
  opts: MailTemplate,
): { element: React.ReactElement; betreff: string } {
  switch (opts.template) {
    case 'T-001':
      return {
        element: React.createElement(MagicLinkLogin, opts.props),
        betreff: T001_BETREFF,
      };
    case 'T-002':
      return {
        element: React.createElement(MagicLinkRegistrierung, opts.props),
        betreff: T002_BETREFF,
      };
    case 'T-003':
      return {
        element: React.createElement(KontoLoeschungBestaetigung, opts.props),
        betreff: T003_BETREFF,
      };
    case 'T-004':
      return {
        element: React.createElement(KontoLoeschungErinnerung, opts.props),
        betreff: T004_BETREFF,
      };
    case 'T-005':
      return {
        element: React.createElement(KontoGeloescht, opts.props),
        betreff: T005_BETREFF,
      };
    case 'T-101':
      return {
        element: React.createElement(PruefrundeNeueAnmeldung, opts.props),
        betreff: T101_BETREFF,
      };
    case 'T-102':
      return {
        element: React.createElement(PruefrundeNeuesFeedback, opts.props),
        betreff: T102_BETREFF,
      };
    case 'T-103':
      return {
        element: React.createElement(ReziprozitaetFrist3d, opts.props),
        betreff: T103_BETREFF,
      };
    case 'T-104':
      return {
        element: React.createElement(ReziprozitaetFrist1d, opts.props),
        betreff: T104_BETREFF,
      };
  }
}

/**
 * Rendert ein Template einmal vollstaendig zu HTML + Plain-Text.
 * Wird in Tests direkt benutzt — daher exportiert.
 */
export async function renderMail(
  opts: MailTemplate,
): Promise<{ html: string; text: string; betreff: string }> {
  const { element, betreff } = buildEmail(opts);
  const html = await render(element);
  const text = await render(element, { plainText: true });
  return { html, text, betreff };
}

/**
 * Versendet eine Werkzirkel-Mail.
 *
 * Verhalten:
 * 1. Rendert das Template via React-Email zu HTML + Plain-Text.
 * 2. Wenn `RESEND_API_KEY` leer ist → strukturiertes `MAIL-MOCK`-Log in die
 *    Konsole und Frueh-Return mit `{ ok: true, mocked: true }`. Trotzdem
 *    wird ein Eintrag in `email_benachrichtigung_log` geschrieben, damit
 *    Dev-Telemetrie der echten gleicht.
 * 3. Sonst: Versand via Resend (`from` aus `EMAIL_FROM`).
 * 4. Versand-Outcome wird in `email_benachrichtigung_log` mit Status
 *    `gesendet` oder `fehlgeschlagen` (plus Resend-ID / Fehlermeldung)
 *    festgehalten — die Tabelle ist Source-of-Truth fuer Bounce-Handling.
 */
/**
 * RFC-2606-reservierte Test-Domains, an die NIEMALS echt versendet werden darf.
 * Plus interne Konvention `test.local`.
 */
const TEST_DOMAINS = [
  'example.com',
  'example.de',
  'example.org',
  'example.net',
  'test.local',
  'localhost',
];

function isTestRecipient(to: string): boolean {
  const lower = to.toLowerCase();
  return TEST_DOMAINS.some((d) => lower.endsWith('@' + d) || lower.endsWith('.' + d));
}

/**
 * Entscheidet, ob Resend tatsaechlich angesprochen werden darf — oder ob wir
 * in den Mock-Pfad gehen. Trifft auf:
 *  - kein API-Key gesetzt (Dev ohne Konto)
 *  - Vitest/Jest-Runtime
 *  - NODE_ENV=test
 *  - explizit per EMAIL_FORCE_MOCK=1 erzwungen
 *  - Empfaenger ist eine RFC-2606-Test-Domain
 *
 * Ohne diesen Riegel laufen Integration-Tests mit gesetztem RESEND_API_KEY in
 * die Tages-Quota des echten Resend-Kontos — bei autobuild-Laeufen mit
 * vielen sub-agent-Iterationen ist das innerhalb von Minuten ein Problem.
 */
function shouldMock(apiKey: string | undefined, to: string): boolean {
  if (!apiKey) return true;
  if (process.env.VITEST === 'true') return true;
  if (process.env.NODE_ENV === 'test') return true;
  if (process.env.EMAIL_FORCE_MOCK === '1') return true;
  if (isTestRecipient(to)) return true;
  return false;
}

export async function sendMail(opts: SendMailOpts): Promise<SendMailResult> {
  const { to, nutzerId = null, attachments } = opts;
  const { html, text, betreff } = await renderMail(opts);

  const apiKey = env.RESEND_API_KEY?.trim();
  const from = env.EMAIL_FROM?.trim() || 'Werkzirkel <noreply@werkzirkel.de>';

  // ── Dev-/Test-Pfad ──────────────────────────────────────────────────────
  if (shouldMock(apiKey, to)) {
    // strukturiertes Mock-Log, damit Dev-Pipelines greifen koennen.
    console.log(
      JSON.stringify({
        kanal: 'MAIL-MOCK',
        to,
        template: opts.template,
        betreff,
        nutzerId,
        anhaenge: attachments?.map((a) => a.filename) ?? [],
      }),
    );
    await persistLog({
      nutzerId,
      to,
      template: opts.template,
      betreff,
      status: 'gesendet',
      resendId: null,
      fehlerMeldung: null,
    });
    return { ok: true, mocked: true };
  }

  // ── Produktions-Pfad ────────────────────────────────────────────────────
  try {
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject: betreff,
      html,
      text,
      ...(attachments && attachments.length > 0
        ? { attachments: attachments.map((a) => ({
            filename: a.filename,
            content: a.content,
            contentType: a.contentType,
          })) }
        : {}),
    });

    if (error) {
      await persistLog({
        nutzerId,
        to,
        template: opts.template,
        betreff,
        status: 'fehlgeschlagen',
        resendId: null,
        fehlerMeldung: error.message ?? String(error),
      });
      return { ok: false, fehler: error.message ?? String(error) };
    }

    await persistLog({
      nutzerId,
      to,
      template: opts.template,
      betreff,
      status: 'gesendet',
      resendId: data?.id ?? null,
      fehlerMeldung: null,
    });
    return { ok: true, resendId: data?.id ?? null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await persistLog({
      nutzerId,
      to,
      template: opts.template,
      betreff,
      status: 'fehlgeschlagen',
      resendId: null,
      fehlerMeldung: message,
    });
    return { ok: false, fehler: message };
  }
}

/**
 * Schreibt einen Eintrag in `email_benachrichtigung_log`.
 * Schluckt eigene Fehler (Logging-Probleme duerfen den Versand-Return-Wert
 * nicht ueberschreiben) — wirft daher nie.
 */
async function persistLog(row: {
  nutzerId: string | null;
  to: string;
  template: string;
  betreff: string;
  status: 'gesendet' | 'fehlgeschlagen';
  resendId: string | null;
  fehlerMeldung: string | null;
}): Promise<void> {
  try {
    await db.insert(emailBenachrichtigungLog).values({
      nutzerId: row.nutzerId,
      email: row.to,
      template: row.template,
      betreff: row.betreff,
      status: row.status,
      resendId: row.resendId,
      fehlerMeldung: row.fehlerMeldung,
    });
  } catch (err) {
    // Logging-Fehler nicht weiterwerfen — der Versand-Pfad ist wichtiger.
    console.error('[email] persistLog failed:', err);
  }
}
