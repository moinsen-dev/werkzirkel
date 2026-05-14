/**
 * Zod-Validatoren fuer Hilfegesuche und Antworten unter `/api/v1/hilfegesuche/*`.
 *
 * Quelle: PRD §8.15 (Hilfegesuche, max 14 Tage Gueltigkeit, Antworten als
 * Kommentare), §F-15.x.
 *
 * - Werden von Client und Server gemeinsam verwendet.
 * - Alle Fehlermeldungen sind deutsch.
 * - `gueltigBis` darf maximal 14 Tage in der Zukunft liegen — gemessen ab
 *   `Date.now()` zur Validierungszeit. Server-Logik verlaesst sich darauf
 *   ZUSAETZLICH zur Validator-Schicht (defense in depth).
 */

import { z } from 'zod';
import { hilfegesuchStatus } from '@/lib/db/schema/enums';

const MAX_GUELTIGKEIT_TAGE = 14;

function maxGueltigBis(): Date {
  return new Date(Date.now() + MAX_GUELTIGKEIT_TAGE * 24 * 60 * 60 * 1000);
}

/**
 * Akzeptiert Date-Objekte oder ISO-Strings und normalisiert zu Date.
 */
const datumIso = z.preprocess(
  (v) => {
    if (v instanceof Date) return v;
    if (typeof v === 'string' && v.length > 0) {
      const d = new Date(v);
      if (!isNaN(d.getTime())) return d;
    }
    return v;
  },
  z.date({
    errorMap: () => ({ message: 'Bitte gib ein gueltiges Datum an.' }),
  }),
);

export const hilfegesuchAnlegenSchema = z
  .object({
    titel: z
      .string()
      .min(3, { message: 'Titel muss mindestens 3 Zeichen lang sein.' })
      .max(200, { message: 'Titel ist zu lang (max. 200 Zeichen).' }),
    beschreibung: z
      .string()
      .min(10, {
        message: 'Beschreibung muss mindestens 10 Zeichen lang sein.',
      })
      .max(4000, {
        message: 'Beschreibung ist zu lang (max. 4000 Zeichen).',
      }),
    tags: z
      .array(
        z
          .string()
          .min(1, { message: 'Tag darf nicht leer sein.' })
          .max(40, { message: 'Tag ist zu lang (max. 40 Zeichen).' }),
      )
      .max(10, { message: 'Hoechstens 10 Tags erlaubt.' })
      .default([]),
    werk_id: z
      .string()
      .min(1)
      .max(40)
      .optional()
      .nullable(),
    gueltig_bis: datumIso.refine((d) => d.getTime() > Date.now(), {
      message: 'gueltig_bis muss in der Zukunft liegen.',
    }).refine(
      (d) => d.getTime() <= maxGueltigBis().getTime() + 60 * 1000,
      // 60s Slack, damit Client-Server-Clock-Drift nicht beisst.
      {
        message:
          'Hilfegesuche koennen maximal 14 Tage gueltig sein. Bitte kuerzeres Datum waehlen.',
      },
    ),
  })
  .strict();

export type HilfegesuchAnlegenInput = z.infer<typeof hilfegesuchAnlegenSchema>;

export const hilfegesuchAntwortSchema = z
  .object({
    text: z
      .string()
      .min(10, {
        message: 'Antwort muss mindestens 10 Zeichen lang sein.',
      })
      .max(4000, {
        message: 'Antwort ist zu lang (max. 4000 Zeichen).',
      }),
  })
  .strict();

export type HilfegesuchAntwortInput = z.infer<typeof hilfegesuchAntwortSchema>;

/**
 * Query-Filter fuer GET /api/v1/hilfegesuche.
 */
export const hilfegesucheListQuerySchema = z
  .object({
    stadt_id: z.string().min(1).max(20).optional(),
    tag: z.string().min(1).max(40).optional(),
    status: z.enum(hilfegesuchStatus).optional(),
    limit: z.coerce
      .number()
      .int()
      .min(1, { message: 'limit muss mindestens 1 sein.' })
      .max(50, { message: 'limit darf hoechstens 50 sein.' })
      .default(20),
  })
  .strict();

export type HilfegesucheListQuery = z.infer<typeof hilfegesucheListQuerySchema>;

export const MAX_HILFEGESUCH_GUELTIGKEIT_TAGE = MAX_GUELTIGKEIT_TAGE;
