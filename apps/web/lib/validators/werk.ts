/**
 * Zod-Validatoren fuer Werk-CRUD-Endpunkte unter `/api/v1/werke/*`.
 *
 * Quelle: PRD §8.3 (Werk-Pflichtfelder), §13.5 (werk-Schema), §15.3 (API).
 *
 * - WERDEN VON CLIENT UND SERVER GEMEINSAM VERWENDET.
 * - Alle Fehlermeldungen sind deutsch.
 * - `kurzbeschreibung` ist auf 280 Zeichen App-validiert (PRD §8.3, "Tweet-Laenge").
 *   Das ist absichtlich KEIN DB-Constraint, weil wir die Laenge ggf. anpassen
 *   wollen ohne Migration.
 * - `hilfebedarf` ist text[] mit Enum-Constraint pro Element.
 */

import { z } from 'zod';
import {
  werkstand,
  werkSichtbarkeit,
  hilfebedarf,
} from '@/lib/db/schema/enums';

/**
 * Optionales URL-Feld, das den Leerstring akzeptiert (User loescht den Link).
 * Leerstring wird zu `null` normalisiert.
 */
const optionalLink = z
  .string()
  .max(500, { message: 'Link ist zu lang (max. 500 Zeichen).' })
  .refine((v) => v === '' || /^https?:\/\//i.test(v), {
    message: 'Bitte eine vollstaendige URL eingeben (mit http:// oder https://).',
  })
  .transform((v) => (v === '' ? null : v))
  .optional()
  .nullable();

/**
 * Werk anlegen — alle Pflichtfelder aus PRD §8.3.
 */
export const werkAnlegenSchema = z
  .object({
    name: z
      .string()
      .min(1, { message: 'Werkname ist erforderlich.' })
      .max(200, { message: 'Werkname ist zu lang (max. 200 Zeichen).' }),
    kurzbeschreibung: z
      .string()
      .min(1, { message: 'Kurzbeschreibung ist erforderlich.' })
      .max(280, {
        message: 'Kurzbeschreibung darf maximal 280 Zeichen lang sein.',
      }),
    problem: z
      .string()
      .min(1, { message: 'Problem-Beschreibung ist erforderlich.' })
      .max(2000, { message: 'Problem-Beschreibung ist zu lang (max. 2000 Zeichen).' }),
    zielgruppe: z
      .string()
      .min(1, { message: 'Zielgruppe ist erforderlich.' })
      .max(500, { message: 'Zielgruppe ist zu lang (max. 500 Zeichen).' }),
    werkstand: z.enum(werkstand, {
      errorMap: () => ({ message: 'Werkstand ist ungueltig.' }),
    }),
    hilfebedarf: z
      .array(z.enum(hilfebedarf), {
        errorMap: () => ({ message: 'Hilfebedarf enthaelt ungueltige Werte.' }),
      })
      .max(hilfebedarf.length, { message: 'Zu viele Hilfebedarfs-Tags.' }),
    link: optionalLink,
    sichtbarkeit: z
      .enum(werkSichtbarkeit, {
        errorMap: () => ({ message: 'Sichtbarkeit ist ungueltig.' }),
      })
      .default('oeffentlich'),
  })
  .strict();

export type WerkAnlegenInput = z.infer<typeof werkAnlegenSchema>;

/**
 * Werk bearbeiten — alle Felder optional.
 */
export const werkPatchSchema = z
  .object({
    name: z
      .string()
      .min(1, { message: 'Werkname darf nicht leer sein.' })
      .max(200, { message: 'Werkname ist zu lang (max. 200 Zeichen).' })
      .optional(),
    kurzbeschreibung: z
      .string()
      .min(1, { message: 'Kurzbeschreibung darf nicht leer sein.' })
      .max(280, {
        message: 'Kurzbeschreibung darf maximal 280 Zeichen lang sein.',
      })
      .optional(),
    problem: z
      .string()
      .min(1, { message: 'Problem-Beschreibung darf nicht leer sein.' })
      .max(2000, { message: 'Problem-Beschreibung ist zu lang (max. 2000 Zeichen).' })
      .optional(),
    zielgruppe: z
      .string()
      .min(1, { message: 'Zielgruppe darf nicht leer sein.' })
      .max(500, { message: 'Zielgruppe ist zu lang (max. 500 Zeichen).' })
      .optional(),
    werkstand: z
      .enum(werkstand, {
        errorMap: () => ({ message: 'Werkstand ist ungueltig.' }),
      })
      .optional(),
    hilfebedarf: z
      .array(z.enum(hilfebedarf), {
        errorMap: () => ({ message: 'Hilfebedarf enthaelt ungueltige Werte.' }),
      })
      .max(hilfebedarf.length, { message: 'Zu viele Hilfebedarfs-Tags.' })
      .optional(),
    link: optionalLink,
    sichtbarkeit: z
      .enum(werkSichtbarkeit, {
        errorMap: () => ({ message: 'Sichtbarkeit ist ungueltig.' }),
      })
      .optional(),
  })
  .strict();

export type WerkPatchInput = z.infer<typeof werkPatchSchema>;

/**
 * Query-Filter fuer GET /api/v1/werke.
 *
 * Query-Strings koennen mehrfach denselben Key haben (`?werkstand=a&werkstand=b`)
 * — wir akzeptieren daher Arrays. Das Aufrufer-Wrapper-Code muss
 * `URLSearchParams.getAll(key)` benutzen, nicht `.get(key)`.
 */
export const werkeListQuerySchema = z
  .object({
    stadt_id: z.string().min(1).max(20).optional(),
    werkstand: z
      .array(
        z.enum(werkstand, {
          errorMap: () => ({ message: 'Werkstand-Filter ist ungueltig.' }),
        }),
      )
      .optional(),
    hilfebedarf: z
      .array(
        z.enum(hilfebedarf, {
          errorMap: () => ({ message: 'Hilfebedarf-Filter ist ungueltig.' }),
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

export type WerkeListQuery = z.infer<typeof werkeListQuerySchema>;
