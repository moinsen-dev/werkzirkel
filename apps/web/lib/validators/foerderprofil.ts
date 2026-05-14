/**
 * Zod-Validatoren fuer Foerderprofil-CRUD-Endpunkte unter
 * `/api/v1/foerderprofile/*` und `/api/v1/kurator/foerderprofile/*`.
 *
 * Quelle: PRD §F-701..§F-706, §19 (Verifikations-Workflow), §11A
 * Schutzmechanik 5 (Kulturverlust — kein Vermitteln von Beteiligungen).
 *
 * Alle Fehlermeldungen deutsch, du-Form.
 */

import { z } from 'zod';
import { foerderart, gegenleistungTyp } from '@/lib/db/schema/enums';

/**
 * Anlegen — alle Pflichtfelder eines Foerderprofils.
 */
export const foerderprofilAnlegenSchema = z
  .object({
    organisation: z
      .string()
      .min(1, { message: 'Organisation ist erforderlich.' })
      .max(200, { message: 'Organisation ist zu lang (max. 200 Zeichen).' }),
    foerderart: z.enum(foerderart, {
      errorMap: () => ({ message: 'Foerderart ist ungueltig.' }),
    }),
    foerderrahmen_jahr_min_euro_cent: z
      .number()
      .int()
      .min(0, { message: 'Foerderrahmen darf nicht negativ sein.' })
      .optional(),
    foerderrahmen_jahr_max_euro_cent: z
      .number()
      .int()
      .min(0, { message: 'Foerderrahmen darf nicht negativ sein.' })
      .optional(),
    foerderrahmen_einzel_max_euro_cent: z
      .number()
      .int()
      .min(0, { message: 'Foerderrahmen darf nicht negativ sein.' })
      .optional(),
    bevorzugte_werke: z
      .string()
      .max(2000, { message: 'Bevorzugte Werke ist zu lang (max. 2000 Zeichen).' })
      .optional(),
    gegenleistung_typ: z.enum(gegenleistungTyp, {
      errorMap: () => ({ message: 'Gegenleistung-Typ ist ungueltig.' }),
    }),
    gegenleistung_text: z
      .string()
      .max(2000, { message: 'Gegenleistung-Text ist zu lang (max. 2000 Zeichen).' })
      .optional(),
  })
  .strict()
  .refine(
    (d) =>
      !d.foerderrahmen_jahr_min_euro_cent ||
      !d.foerderrahmen_jahr_max_euro_cent ||
      d.foerderrahmen_jahr_min_euro_cent <= d.foerderrahmen_jahr_max_euro_cent,
    {
      message: 'Foerderrahmen Min darf nicht groesser als Max sein.',
      path: ['foerderrahmen_jahr_min_euro_cent'],
    },
  );

export type FoerderprofilAnlegenInput = z.infer<
  typeof foerderprofilAnlegenSchema
>;

/**
 * Patch — alle Felder optional.
 */
export const foerderprofilPatchSchema = z
  .object({
    organisation: z
      .string()
      .min(1)
      .max(200, { message: 'Organisation ist zu lang (max. 200 Zeichen).' })
      .optional(),
    foerderart: z
      .enum(foerderart, {
        errorMap: () => ({ message: 'Foerderart ist ungueltig.' }),
      })
      .optional(),
    foerderrahmen_jahr_min_euro_cent: z.number().int().min(0).nullable().optional(),
    foerderrahmen_jahr_max_euro_cent: z.number().int().min(0).nullable().optional(),
    foerderrahmen_einzel_max_euro_cent: z.number().int().min(0).nullable().optional(),
    bevorzugte_werke: z.string().max(2000).nullable().optional(),
    gegenleistung_typ: z
      .enum(gegenleistungTyp, {
        errorMap: () => ({ message: 'Gegenleistung-Typ ist ungueltig.' }),
      })
      .optional(),
    gegenleistung_text: z.string().max(2000).nullable().optional(),
  })
  .strict();

export type FoerderprofilPatchInput = z.infer<typeof foerderprofilPatchSchema>;

/**
 * Kurator-Ablehnungs-Body.
 */
export const foerderprofilAblehnenSchema = z
  .object({
    grund: z
      .string()
      .min(1, { message: 'Grund ist erforderlich.' })
      .max(2000, { message: 'Grund ist zu lang (max. 2000 Zeichen).' }),
  })
  .strict();

export type FoerderprofilAblehnenInput = z.infer<
  typeof foerderprofilAblehnenSchema
>;

/**
 * Query-Filter fuer GET /api/v1/foerderprofile.
 */
export const foerderprofileListQuerySchema = z
  .object({
    stadt_id: z.string().min(1).max(20).optional(),
    foerderart: z.array(z.enum(foerderart)).optional(),
    gegenleistung_typ: z.array(z.enum(gegenleistungTyp)).optional(),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(50)
      .default(20),
  })
  .strict();

export type FoerderprofileListQuery = z.infer<
  typeof foerderprofileListQuerySchema
>;
