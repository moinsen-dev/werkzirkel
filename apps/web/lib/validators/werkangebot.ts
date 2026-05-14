/**
 * Zod-Validatoren fuer Werkangebot-Endpunkte unter
 * `/api/v1/bedarfe/:id/werkangebote` und `/api/v1/werkangebote/:id`.
 *
 * Quelle: PRD §F-621..§F-625 (Werkangebote, Privacy-Layer S2/S3).
 * Alle Fehlermeldungen deutsch, du-Form.
 */

import { z } from 'zod';

/**
 * Anlegen eines Werkangebots durch eine Macher:in.
 *
 * Pflichtfelder (PRD §F-621):
 *  - `werk_id`: das eigene Werk, mit dem die Macher:in antwortet.
 *  - `konkretes_vorgehen`: was wuerde konkret gebaut/getan werden (50-3000).
 *  - `ausdruecklicher_ausschluss`: was *nicht* enthalten ist — Schutz vor
 *    Scope-Drift (20-2000).
 *  - `erster_liefer_meilenstein`: erster pruefbarer Schritt (20-1000).
 *
 * Keine Preise/Pitch-Felder — Werkzirkel ist kein Marktplatz (§11A S3).
 */
export const werkangebotAnlegenSchema = z
  .object({
    werk_id: z
      .string()
      .min(1, { message: 'Werk-ID ist erforderlich.' })
      .max(40),
    konkretes_vorgehen: z
      .string()
      .min(50, {
        message: 'Bitte beschreibe dein konkretes Vorgehen (mindestens 50 Zeichen).',
      })
      .max(3000, {
        message: 'Konkretes Vorgehen ist zu lang (max. 3000 Zeichen).',
      }),
    ausdruecklicher_ausschluss: z
      .string()
      .min(20, {
        message:
          'Bitte mache mindestens 20 Zeichen lang deutlich, was nicht enthalten ist.',
      })
      .max(2000, {
        message: 'Ausdruecklicher Ausschluss ist zu lang (max. 2000 Zeichen).',
      }),
    erster_liefer_meilenstein: z
      .string()
      .min(20, {
        message:
          'Bitte beschreibe den ersten Liefer-Meilenstein (mindestens 20 Zeichen).',
      })
      .max(1000, {
        message: 'Erster Liefer-Meilenstein ist zu lang (max. 1000 Zeichen).',
      }),
  })
  .strict();

export type WerkangebotAnlegenInput = z.infer<typeof werkangebotAnlegenSchema>;

/**
 * Status-Wechsel-Body fuer PATCH /api/v1/werkangebote/:id.
 *
 * Wer was darf, wird im Endpoint geprueft:
 *  - Bedarfstraeger:in (Bedarf-Inhaber:in): in_gespraechen | beauftragt | nicht_gewaehlt
 *  - Macher:in (Werkangebot-Inhaber:in):   zurueckgezogen
 */
export const werkangebotStatusPatchSchema = z
  .object({
    status: z.enum([
      'in_gespraechen',
      'beauftragt',
      'nicht_gewaehlt',
      'zurueckgezogen',
    ]),
  })
  .strict();

export type WerkangebotStatusPatchInput = z.infer<
  typeof werkangebotStatusPatchSchema
>;
