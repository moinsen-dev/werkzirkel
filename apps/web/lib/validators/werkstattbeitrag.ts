/**
 * Zod-Validatoren fuer die Werkstattbeitrag-API.
 *
 * - Geldbeitrag (Pfad B): nur 50/100/150 EUR in Cent.
 * - Sachleistung (Pfad C): Nachweis-Text Pflicht, optional Doku-URL.
 * - Kurator-Ablehnen: Grund Pflicht.
 *
 * Pfad A (Schauabend-Teilnahme) wird automatisch ueber den
 * `maybeCreateSchauabendBeitrag`-Hook im Termin-Anwesenheits-Endpoint
 * erzeugt — kein eigener Validator noetig.
 *
 * PRD-Referenz: §10.5 (Werkstattbeitrag-Workflow), §18 (Drei Pfade).
 */

import { z } from 'zod';

/** Erlaubte Geldbeitrag-Hoehen in Euro-Cent (50/100/150 EUR). */
export const GELDBEITRAG_HOEHEN = [5000, 10000, 15000] as const;
export type GeldbeitragHoehe = (typeof GELDBEITRAG_HOEHEN)[number];

export const werkstattbeitragGeldbeitragSchema = z
  .object({
    hoehe_euro_cent: z
      .number()
      .int()
      .refine((v) => (GELDBEITRAG_HOEHEN as readonly number[]).includes(v), {
        message: 'Hoehe muss 5000, 10000 oder 15000 Cent (50/100/150 EUR) sein.',
      }),
  })
  .strict();

export type WerkstattbeitragGeldbeitragInput = z.infer<
  typeof werkstattbeitragGeldbeitragSchema
>;

export const werkstattbeitragSachleistungSchema = z
  .object({
    nachweis_text: z
      .string()
      .min(10, { message: 'Nachweis-Text ist zu kurz (mindestens 10 Zeichen).' })
      .max(2000, { message: 'Nachweis-Text ist zu lang (max. 2000 Zeichen).' }),
    nachweis_dokument_url: z
      .string()
      .url({ message: 'Dokument-URL ist ungueltig.' })
      .max(500)
      .optional(),
  })
  .strict();

export type WerkstattbeitragSachleistungInput = z.infer<
  typeof werkstattbeitragSachleistungSchema
>;

export const werkstattbeitragAblehnenSchema = z
  .object({
    grund: z
      .string()
      .min(1, { message: 'Grund ist erforderlich.' })
      .max(2000, { message: 'Grund ist zu lang (max. 2000 Zeichen).' }),
  })
  .strict();

export type WerkstattbeitragAblehnenInput = z.infer<
  typeof werkstattbeitragAblehnenSchema
>;
