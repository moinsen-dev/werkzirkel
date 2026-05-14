/**
 * Zod-Validatoren fuer Bedarf-CRUD-Endpunkte unter `/api/v1/bedarfe/*`
 * und `/api/v1/kurator/bedarfe/*`.
 *
 * Quelle: PRD §F-601..§F-607 (Bedarf-CRUD + Werkstattbeitrag-Nachweis),
 * §14.3 (Statusmaschine entwurf → in_pruefung → oeffentlich →
 * in_gespraechen → erfuellt | eingestellt).
 *
 * Alle Fehlermeldungen deutsch, du-Form.
 */

import { z } from 'zod';

/** Frist muss mindestens 24 h in der Zukunft liegen. */
const FRIST_MIN_OFFSET_MS = 24 * 60 * 60 * 1000;

/**
 * Anlegen — Pflichtfelder eines Bedarfs. status='entwurf' wird serverseitig
 * gesetzt; das Schema lehnt einen mitgelieferten status ab (strict mode).
 */
export const bedarfAnlegenSchema = z
  .object({
    organisation: z
      .string()
      .min(1, { message: 'Organisation ist erforderlich.' })
      .max(200, { message: 'Organisation ist zu lang (max. 200 Zeichen).' }),
    titel: z
      .string()
      .min(1, { message: 'Titel ist erforderlich.' })
      .max(200, { message: 'Titel ist zu lang (max. 200 Zeichen).' }),
    problem: z
      .string()
      .min(1, { message: 'Problem-Beschreibung ist erforderlich.' })
      .max(5000, { message: 'Problem-Beschreibung ist zu lang (max. 5000 Zeichen).' }),
    nutzen: z
      .string()
      .min(1, { message: 'Nutzen-Beschreibung ist erforderlich.' })
      .max(2000, { message: 'Nutzen-Beschreibung ist zu lang (max. 2000 Zeichen).' }),
    stadt_id: z
      .string()
      .min(1, { message: 'Stadt ist erforderlich.' })
      .max(20),
    groessenordnung_zeit_wochen: z
      .number()
      .int()
      .min(1, { message: 'Groessenordnung Zeit muss mindestens 1 Woche sein.' })
      .max(52, { message: 'Groessenordnung Zeit darf hoechstens 52 Wochen sein.' })
      .optional(),
    groessenordnung_aufwand_tage: z
      .number()
      .int()
      .min(1, { message: 'Groessenordnung Aufwand muss mindestens 1 Tag sein.' })
      .max(200, { message: 'Groessenordnung Aufwand darf hoechstens 200 Tage sein.' })
      .optional(),
    geldrahmen_min_euro_cent: z
      .number()
      .int()
      .min(0, { message: 'Geldrahmen darf nicht negativ sein.' })
      .optional(),
    geldrahmen_max_euro_cent: z
      .number()
      .int()
      .min(0, { message: 'Geldrahmen darf nicht negativ sein.' })
      .optional(),
    frist: z.coerce
      .date()
      .refine((d) => d.getTime() > Date.now() + FRIST_MIN_OFFSET_MS, {
        message: 'Frist muss mindestens 24 Stunden in der Zukunft liegen.',
      }),
    branche: z
      .string()
      .max(100, { message: 'Branche ist zu lang (max. 100 Zeichen).' })
      .optional(),
    bevorzugter_werkstand: z
      .string()
      .max(100, { message: 'Bevorzugter Werkstand ist zu lang (max. 100 Zeichen).' })
      .optional(),
  })
  .strict()
  .refine(
    (d) =>
      d.geldrahmen_min_euro_cent === undefined ||
      d.geldrahmen_max_euro_cent === undefined ||
      d.geldrahmen_min_euro_cent <= d.geldrahmen_max_euro_cent,
    {
      message: 'Geldrahmen Min darf nicht groesser als Max sein.',
      path: ['geldrahmen_min_euro_cent'],
    },
  );

export type BedarfAnlegenInput = z.infer<typeof bedarfAnlegenSchema>;

/**
 * Patch — alle Felder optional. status-Uebergaenge laufen ueber die
 * dedizierten Action-Endpoints (einreichen / erfuellt / einstellen).
 */
export const bedarfPatchSchema = z
  .object({
    organisation: z.string().min(1).max(200).optional(),
    titel: z.string().min(1).max(200).optional(),
    problem: z.string().min(1).max(5000).optional(),
    nutzen: z.string().min(1).max(2000).optional(),
    stadt_id: z.string().min(1).max(20).optional(),
    groessenordnung_zeit_wochen: z.number().int().min(1).max(52).nullable().optional(),
    groessenordnung_aufwand_tage: z.number().int().min(1).max(200).nullable().optional(),
    geldrahmen_min_euro_cent: z.number().int().min(0).nullable().optional(),
    geldrahmen_max_euro_cent: z.number().int().min(0).nullable().optional(),
    frist: z.coerce
      .date()
      .refine((d) => d.getTime() > Date.now() + FRIST_MIN_OFFSET_MS, {
        message: 'Frist muss mindestens 24 Stunden in der Zukunft liegen.',
      })
      .optional(),
    branche: z.string().max(100).nullable().optional(),
    bevorzugter_werkstand: z.string().max(100).nullable().optional(),
  })
  .strict();

export type BedarfPatchInput = z.infer<typeof bedarfPatchSchema>;

/**
 * "Erfuellt"-Markierung. Optional ein werk_id (das den Bedarf erfuellt hat)
 * und eine freiwillige Selbstauskunft zur Groesse des Auftrags (PRD §F-605).
 */
export const bedarfErfuelltSchema = z
  .object({
    werk_id: z.string().min(1).max(40).optional(),
    selbstauskunft_min_euro_cent: z.number().int().min(0).optional(),
    selbstauskunft_max_euro_cent: z.number().int().min(0).optional(),
  })
  .strict()
  .refine(
    (d) =>
      d.selbstauskunft_min_euro_cent === undefined ||
      d.selbstauskunft_max_euro_cent === undefined ||
      d.selbstauskunft_min_euro_cent <= d.selbstauskunft_max_euro_cent,
    {
      message: 'Selbstauskunft Min darf nicht groesser als Max sein.',
      path: ['selbstauskunft_min_euro_cent'],
    },
  );

export type BedarfErfuelltInput = z.infer<typeof bedarfErfuelltSchema>;

/**
 * Kurator-Ablehnen-Body.
 */
export const bedarfAblehnenSchema = z
  .object({
    grund: z
      .string()
      .min(1, { message: 'Grund ist erforderlich.' })
      .max(2000, { message: 'Grund ist zu lang (max. 2000 Zeichen).' }),
  })
  .strict();

export type BedarfAblehnenInput = z.infer<typeof bedarfAblehnenSchema>;

/**
 * Query-Filter fuer GET /api/v1/bedarfe.
 *
 * Default-Status-Filter: 'oeffentlich' und 'in_gespraechen' (PRD §F-603,
 * eingeloggte Nutzer:innen sehen genau die fuer den Zirkel relevanten
 * Bedarfe). Andere Status-Filter sind moeglich (z.B. fuer Kurator-Views).
 */
export const bedarfeListQuerySchema = z
  .object({
    stadt_id: z.string().min(1).max(20).optional(),
    status: z
      .array(
        z.enum([
          'entwurf',
          'in_pruefung',
          'oeffentlich',
          'in_gespraechen',
          'erfuellt',
          'eingestellt',
        ]),
      )
      .optional(),
    geldrahmen_min_euro_cent: z.coerce.number().int().min(0).optional(),
    geldrahmen_max_euro_cent: z.coerce.number().int().min(0).optional(),
    cursor: z.string().min(1).max(40).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();

export type BedarfeListQuery = z.infer<typeof bedarfeListQuerySchema>;
