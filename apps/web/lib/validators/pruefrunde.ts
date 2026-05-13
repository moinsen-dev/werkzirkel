/**
 * Zod-Validatoren fuer Pruefrunde-CRUD-Endpunkte unter `/api/v1/pruefrunden/*`.
 *
 * Quelle: PRD §F-201 / §F-202 (Pflichtfelder), §14.2 (Statusmaschine),
 * §15.4 (Endpunkte).
 *
 * - WERDEN VON CLIENT UND SERVER GEMEINSAM VERWENDET.
 * - Alle Fehlermeldungen deutsch.
 * - `testaufgabe` ist Markdown — Rendering/Sanitization passiert im UI.
 * - `frist` wird via `z.coerce.date()` aus ISO-Strings akzeptiert. Limit:
 *   mindestens 1 Tag und hoechstens 60 Tage in der Zukunft (PRD §F-202).
 */

import { z } from 'zod';
import { feedbackKategorie, pruefrundeStatus } from '@/lib/db/schema/enums';

const MIN_FRIST_OFFSET_MS = 24 * 60 * 60 * 1000; // 1 Tag
const MAX_FRIST_OFFSET_MS = 60 * 24 * 60 * 60 * 1000; // 60 Tage

/**
 * Pruefrunde anlegen — alle Pflichtfelder aus PRD §F-202.
 */
export const pruefrundeAnlegenSchema = z
  .object({
    werk_id: z
      .string()
      .min(1, { message: 'Werk-ID ist erforderlich.' })
      .max(40, { message: 'Werk-ID ist zu lang.' }),
    titel: z
      .string()
      .min(1, { message: 'Titel ist erforderlich.' })
      .max(200, { message: 'Titel ist zu lang (max. 200 Zeichen).' }),
    testziel: z
      .string()
      .min(1, { message: 'Testziel ist erforderlich.' })
      .max(2000, { message: 'Testziel ist zu lang (max. 2000 Zeichen).' }),
    testaufgabe: z
      .string()
      .min(1, { message: 'Testaufgabe ist erforderlich.' })
      .max(5000, { message: 'Testaufgabe ist zu lang (max. 5000 Zeichen).' }),
    zielgruppe: z
      .string()
      .min(1, { message: 'Zielgruppe ist erforderlich.' })
      .max(500, { message: 'Zielgruppe ist zu lang (max. 500 Zeichen).' }),
    zeitbedarf_minuten: z
      .number({
        errorMap: () => ({ message: 'Zeitbedarf muss eine Zahl sein.' }),
      })
      .int({ message: 'Zeitbedarf muss eine ganze Zahl sein.' })
      .min(5, { message: 'Zeitbedarf muss mindestens 5 Minuten betragen.' })
      .max(120, { message: 'Zeitbedarf darf hoechstens 120 Minuten sein.' }),
    gesuchte_tester: z
      .number({
        errorMap: () => ({ message: 'Tester-Anzahl muss eine Zahl sein.' }),
      })
      .int({ message: 'Tester-Anzahl muss eine ganze Zahl sein.' })
      .min(1, { message: 'Mindestens 1 Tester:in muss gesucht werden.' })
      .max(10, { message: 'Hoechstens 10 Tester:innen pro Pruefrunde.' }),
    feedback_kategorien: z
      .array(
        z.enum(feedbackKategorie, {
          errorMap: () => ({ message: 'Feedback-Kategorie ist ungueltig.' }),
        }),
      )
      .min(1, { message: 'Mindestens eine Feedback-Kategorie ist erforderlich.' })
      .max(feedbackKategorie.length, {
        message: 'Zu viele Feedback-Kategorien.',
      }),
    frist: z.coerce
      .date({
        errorMap: () => ({ message: 'Frist ist ungueltig.' }),
      })
      .refine((d) => d.getTime() > Date.now() + MIN_FRIST_OFFSET_MS, {
        message: 'Frist muss mindestens 1 Tag in der Zukunft liegen.',
      })
      .refine((d) => d.getTime() < Date.now() + MAX_FRIST_OFFSET_MS, {
        message: 'Frist darf hoechstens 60 Tage in der Zukunft liegen.',
      }),
  })
  .strict();

export type PruefrundeAnlegenInput = z.infer<typeof pruefrundeAnlegenSchema>;

/**
 * Pruefrunde bearbeiten — alle Felder optional, werk_id NICHT aenderbar
 * (eine Pruefrunde wird nicht an ein anderes Werk umgehaengt — bei Bedarf
 * neue anlegen).
 */
export const pruefrundePatchSchema = z
  .object({
    titel: z
      .string()
      .min(1, { message: 'Titel darf nicht leer sein.' })
      .max(200, { message: 'Titel ist zu lang (max. 200 Zeichen).' })
      .optional(),
    testziel: z
      .string()
      .min(1, { message: 'Testziel darf nicht leer sein.' })
      .max(2000, { message: 'Testziel ist zu lang (max. 2000 Zeichen).' })
      .optional(),
    testaufgabe: z
      .string()
      .min(1, { message: 'Testaufgabe darf nicht leer sein.' })
      .max(5000, { message: 'Testaufgabe ist zu lang (max. 5000 Zeichen).' })
      .optional(),
    zielgruppe: z
      .string()
      .min(1, { message: 'Zielgruppe darf nicht leer sein.' })
      .max(500, { message: 'Zielgruppe ist zu lang (max. 500 Zeichen).' })
      .optional(),
    zeitbedarf_minuten: z
      .number({
        errorMap: () => ({ message: 'Zeitbedarf muss eine Zahl sein.' }),
      })
      .int({ message: 'Zeitbedarf muss eine ganze Zahl sein.' })
      .min(5, { message: 'Zeitbedarf muss mindestens 5 Minuten betragen.' })
      .max(120, { message: 'Zeitbedarf darf hoechstens 120 Minuten sein.' })
      .optional(),
    gesuchte_tester: z
      .number({
        errorMap: () => ({ message: 'Tester-Anzahl muss eine Zahl sein.' }),
      })
      .int({ message: 'Tester-Anzahl muss eine ganze Zahl sein.' })
      .min(1, { message: 'Mindestens 1 Tester:in muss gesucht werden.' })
      .max(10, { message: 'Hoechstens 10 Tester:innen pro Pruefrunde.' })
      .optional(),
    feedback_kategorien: z
      .array(
        z.enum(feedbackKategorie, {
          errorMap: () => ({ message: 'Feedback-Kategorie ist ungueltig.' }),
        }),
      )
      .min(1, { message: 'Mindestens eine Feedback-Kategorie ist erforderlich.' })
      .max(feedbackKategorie.length, {
        message: 'Zu viele Feedback-Kategorien.',
      })
      .optional(),
    frist: z.coerce
      .date({
        errorMap: () => ({ message: 'Frist ist ungueltig.' }),
      })
      .refine((d) => d.getTime() > Date.now() + MIN_FRIST_OFFSET_MS, {
        message: 'Frist muss mindestens 1 Tag in der Zukunft liegen.',
      })
      .refine((d) => d.getTime() < Date.now() + MAX_FRIST_OFFSET_MS, {
        message: 'Frist darf hoechstens 60 Tage in der Zukunft liegen.',
      })
      .optional(),
  })
  .strict();

export type PruefrundePatchInput = z.infer<typeof pruefrundePatchSchema>;

/**
 * Query-Filter fuer GET /api/v1/pruefrunden.
 *
 * `status` als Mehrfach-Wert moeglich (`?status=oeffentlich&status=geschlossen`).
 * `nur_eigene=1` ist eine Bequemlichkeit fuer eingeloggte Macher:innen, um
 * Entwuerfe + alle eigenen Pruefrunden zu sehen — siehe Route-Handler.
 */
export const pruefrundenListQuerySchema = z
  .object({
    stadt_id: z.string().min(1).max(20).optional(),
    status: z
      .array(
        z.enum(pruefrundeStatus, {
          errorMap: () => ({ message: 'Status-Filter ist ungueltig.' }),
        }),
      )
      .optional(),
    werk_id: z.string().min(1).max(40).optional(),
    nur_eigene: z.enum(['0', '1']).optional(),
    cursor: z.string().min(1).max(40).optional(),
    limit: z.coerce
      .number()
      .int()
      .min(1, { message: 'limit muss mindestens 1 sein.' })
      .max(50, { message: 'limit darf hoechstens 50 sein.' })
      .default(20),
  })
  .strict();

export type PruefrundenListQuery = z.infer<typeof pruefrundenListQuerySchema>;
