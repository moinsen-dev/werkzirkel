/**
 * Defaults fuer `nutzer.benachrichtigungs_einstellungen`.
 *
 * Quelle: PRD §8.14 — Benachrichtigungs-Strategie.
 *
 * - Alle relevanten Lifecycle-Mails sind standardmaessig EINGESCHALTET
 *   (Pruefrunde-Anmeldungen, Feedback, Frist, Werkangebote, Bedarfe,
 *   Termin-Erinnerungen).
 * - `stadt_digest` ist OPT-OUT (also default `true`): einmal pro Woche, kann
 *   abbestellt werden.
 * - `kurator_mitteilungen` ist OPT-IN (default `false`): erst auf explizite
 *   Zustimmung. Kurator:innen versenden gezielt — nicht jedem.
 *
 * Aenderungen hier wirken auf NEUE Konten (Auth-Lifecycle setzt sie beim
 * ersten Login) und auf die Default-Anzeige in `/einstellungen`.
 */

import type { BenachrichtigungsEinstellungen } from '@/lib/db/schema/nutzer';

export const defaultBenachrichtigungsEinstellungen: Required<BenachrichtigungsEinstellungen> = {
  pruefrunde_anmeldungen: true,
  pruefrunde_feedback: true,
  pruefrunde_frist: true,
  werkangebote: true,
  bedarf_passend: true,
  termin_erinnerungen: true,
  stadt_digest: true,
  kurator_mitteilungen: false,
};

/**
 * Liefert die effektiven Einstellungen einer Nutzer:in:
 * gespeicherte Werte gewinnen, fehlende Keys werden aus den Defaults gefuellt.
 */
export function mergeBenachrichtigungsEinstellungen(
  stored: BenachrichtigungsEinstellungen | null | undefined,
): Required<BenachrichtigungsEinstellungen> {
  return {
    ...defaultBenachrichtigungsEinstellungen,
    ...(stored ?? {}),
  };
}
