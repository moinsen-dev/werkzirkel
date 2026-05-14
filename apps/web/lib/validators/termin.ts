/**
 * Zod-Validatoren fuer Termin-CRUD-Endpunkte unter `/api/v1/termine/*`.
 *
 * Quelle: PRD §F-401..§F-405, §15.8, §8.8, §14.6.
 *
 * - WERDEN VON CLIENT UND SERVER GEMEINSAM VERWENDET.
 * - Alle Fehlermeldungen deutsch.
 * - `datum_uhrzeit` muss mindestens 1 Stunde in der Zukunft liegen.
 * - Termin braucht entweder `ort_text` ODER `online_link` (oder beides).
 */

import { z } from 'zod';
import { terminStatus, terminTyp } from '@/lib/db/schema/enums';

const MIN_DATUM_OFFSET_MS = 60 * 60 * 1000; // 1 Stunde

/**
 * Termin anlegen — alle Pflichtfelder aus PRD §8.8 / §F-401.
 */
export const terminAnlegenSchema = z
  .object({
    stadt_id: z
      .string()
      .min(1, { message: 'Stadt-ID ist erforderlich.' })
      .max(20, { message: 'Stadt-ID ist zu lang.' }),
    typ: z.enum(terminTyp, {
      errorMap: () => ({ message: 'Termin-Typ ist ungueltig.' }),
    }),
    titel: z
      .string()
      .min(1, { message: 'Titel ist erforderlich.' })
      .max(200, { message: 'Titel ist zu lang (max. 200 Zeichen).' }),
    beschreibung: z
      .string()
      .min(1, { message: 'Beschreibung ist erforderlich.' })
      .max(5000, { message: 'Beschreibung ist zu lang (max. 5000 Zeichen).' }),
    ort_text: z
      .string()
      .max(500, { message: 'Ort-Text ist zu lang (max. 500 Zeichen).' })
      .optional()
      .nullable(),
    online_link: z
      .string()
      .url({ message: 'Online-Link muss eine gueltige URL sein.' })
      .max(500, { message: 'Online-Link ist zu lang (max. 500 Zeichen).' })
      .optional()
      .nullable(),
    datum_uhrzeit: z.coerce
      .date({ errorMap: () => ({ message: 'Datum/Uhrzeit ist ungueltig.' }) })
      .refine((d) => d.getTime() > Date.now() + MIN_DATUM_OFFSET_MS, {
        message: 'Termin muss mindestens 1 Stunde in der Zukunft liegen.',
      }),
    max_teilnehmer: z
      .number({ errorMap: () => ({ message: 'Max-Teilnehmer muss eine Zahl sein.' }) })
      .int({ message: 'Max-Teilnehmer muss eine ganze Zahl sein.' })
      .min(2, { message: 'Max-Teilnehmer muss mindestens 2 sein.' })
      .max(100, { message: 'Max-Teilnehmer darf hoechstens 100 sein.' }),
  })
  .strict()
  .refine((d) => Boolean(d.ort_text?.trim()) || Boolean(d.online_link?.trim()), {
    message: 'Termin braucht entweder einen Ort oder einen Online-Link.',
    path: ['ort_text'],
  });

export type TerminAnlegenInput = z.infer<typeof terminAnlegenSchema>;

/**
 * Termin bearbeiten — alle Felder optional, `stadt_id` ist nicht aenderbar.
 *
 * Ort/Online-Link werden hier nicht erzwungen — die Route prueft beim Patch
 * gegen den finalen Zustand (existierender Wert + Patch) ab.
 */
export const terminPatchSchema = z
  .object({
    typ: z
      .enum(terminTyp, { errorMap: () => ({ message: 'Termin-Typ ist ungueltig.' }) })
      .optional(),
    titel: z
      .string()
      .min(1, { message: 'Titel darf nicht leer sein.' })
      .max(200, { message: 'Titel ist zu lang (max. 200 Zeichen).' })
      .optional(),
    beschreibung: z
      .string()
      .min(1, { message: 'Beschreibung darf nicht leer sein.' })
      .max(5000, { message: 'Beschreibung ist zu lang (max. 5000 Zeichen).' })
      .optional(),
    ort_text: z
      .string()
      .max(500, { message: 'Ort-Text ist zu lang (max. 500 Zeichen).' })
      .nullable()
      .optional(),
    online_link: z
      .union([
        z
          .string()
          .url({ message: 'Online-Link muss eine gueltige URL sein.' })
          .max(500, { message: 'Online-Link ist zu lang (max. 500 Zeichen).' }),
        z.null(),
      ])
      .optional(),
    datum_uhrzeit: z.coerce
      .date({ errorMap: () => ({ message: 'Datum/Uhrzeit ist ungueltig.' }) })
      .refine((d) => d.getTime() > Date.now() + MIN_DATUM_OFFSET_MS, {
        message: 'Termin muss mindestens 1 Stunde in der Zukunft liegen.',
      })
      .optional(),
    max_teilnehmer: z
      .number({ errorMap: () => ({ message: 'Max-Teilnehmer muss eine Zahl sein.' }) })
      .int({ message: 'Max-Teilnehmer muss eine ganze Zahl sein.' })
      .min(2, { message: 'Max-Teilnehmer muss mindestens 2 sein.' })
      .max(100, { message: 'Max-Teilnehmer darf hoechstens 100 sein.' })
      .optional(),
  })
  .strict();

export type TerminPatchInput = z.infer<typeof terminPatchSchema>;

/**
 * Absage-Body — optionaler Grund-Text.
 */
export const terminAbsagenSchema = z
  .object({
    absage_grund: z
      .string()
      .max(2000, { message: 'Absage-Grund ist zu lang (max. 2000 Zeichen).' })
      .optional(),
  })
  .strict();

export type TerminAbsagenInput = z.infer<typeof terminAbsagenSchema>;

/**
 * Query-Filter fuer GET /api/v1/termine.
 *
 * `typ` und `status` als Mehrfach-Werte moeglich. Public-User sehen per Default
 * nur `veroeffentlicht` + `durchgefuehrt` — der Route-Handler erzwingt das.
 */
export const termineListQuerySchema = z
  .object({
    stadt_id: z.string().min(1).max(20).optional(),
    typ: z
      .array(
        z.enum(terminTyp, {
          errorMap: () => ({ message: 'Termin-Typ-Filter ist ungueltig.' }),
        }),
      )
      .optional(),
    ab_datum: z.coerce
      .date({ errorMap: () => ({ message: 'ab_datum ist ungueltig.' }) })
      .optional(),
    bis_datum: z.coerce
      .date({ errorMap: () => ({ message: 'bis_datum ist ungueltig.' }) })
      .optional(),
    status: z
      .array(
        z.enum(terminStatus, {
          errorMap: () => ({ message: 'Status-Filter ist ungueltig.' }),
        }),
      )
      .optional(),
    cursor: z.string().min(1).max(40).optional(),
    limit: z.coerce
      .number()
      .int()
      .min(1, { message: 'limit muss mindestens 1 sein.' })
      .max(50, { message: 'limit darf hoechstens 50 sein.' })
      .default(20),
  })
  .strict();

export type TermineListQuery = z.infer<typeof termineListQuerySchema>;
