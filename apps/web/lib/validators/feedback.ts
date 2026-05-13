/**
 * Zod-Validatoren fuer Feedback-Endpunkte unter `/api/v1/pruefrunden/:id/feedback`,
 * `/api/v1/feedback/:id/hilfreich` und `/api/v1/werke/:id/feedbacks-hilfreich`.
 *
 * Quelle: PRD §F-204 (strukturiertes Feedback), §F-205 (Sichtbarkeit),
 * §F-206 (hilfreich-Markierung), §13.9 (Feedback-Schema), §8.4.
 *
 * - Alle Felder ausser `gesamteindruck` sind optional; jede Kategorie hat
 *   max. 2000 Zeichen.
 * - WERDEN VON CLIENT UND SERVER GEMEINSAM VERWENDET.
 * - Alle Fehlermeldungen deutsch.
 */

import { z } from 'zod';

const KATEGORIE_MAX = 2000;

const optionalKategorie = (label: string) =>
  z
    .string()
    .max(KATEGORIE_MAX, {
      message: `${label} darf hoechstens ${KATEGORIE_MAX} Zeichen lang sein.`,
    })
    .optional();

/**
 * Feedback abgeben — 8 optionale Kategorien + Pflicht-Gesamteindruck (PRD §13.9).
 */
export const feedbackAbgebenSchema = z
  .object({
    erster_eindruck: optionalKategorie('Erster Eindruck'),
    verstaendlichkeit: optionalKategorie('Verstaendlichkeit'),
    nutzen: optionalKategorie('Nutzen'),
    bedienbarkeit: optionalKategorie('Bedienbarkeit'),
    fehler: optionalKategorie('Fehler'),
    positionierung: optionalKategorie('Positionierung'),
    zahlungsbereitschaft: optionalKategorie('Zahlungsbereitschaft'),
    verbesserungen: optionalKategorie('Verbesserungen'),
    gesamteindruck: z
      .string()
      .min(1, { message: 'Gesamteindruck ist erforderlich.' })
      .max(KATEGORIE_MAX, {
        message: `Gesamteindruck darf hoechstens ${KATEGORIE_MAX} Zeichen lang sein.`,
      }),
  })
  .strict();

export type FeedbackAbgebenInput = z.infer<typeof feedbackAbgebenSchema>;

/**
 * Hilfreich-Markierung — boolean toggle (PRD §F-206).
 */
export const feedbackHilfreichSchema = z
  .object({
    hilfreich: z.boolean({
      errorMap: () => ({
        message: 'hilfreich muss true oder false sein.',
      }),
    }),
  })
  .strict();

export type FeedbackHilfreichInput = z.infer<typeof feedbackHilfreichSchema>;
