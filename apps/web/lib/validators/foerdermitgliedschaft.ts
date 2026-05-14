/**
 * Zod-Validator fuer die Foerdermitgliedschaft-Endpoints.
 *
 * Vier Stufen (PRD §8.13):
 *   - monatlich              ( 9 €/Monat,  Subscription monatlich)
 *   - jaehrlich              (90 €/Jahr,   Subscription jaehrlich)
 *   - foerderer_privat       (240 €/Jahr,  Subscription jaehrlich)
 *   - foerderer_organisation (1.200 €/Jahr, Subscription jaehrlich)
 *
 * Die Stripe-Preis-IDs werden zur Laufzeit aus `env.STRIPE_PRICE_*` gelesen
 * (siehe `lib/env.ts`); dieser Validator bestaetigt nur die Eingabe.
 */

import { z } from 'zod';
import { foermitglStufe } from '@/lib/db/schema/enums';

export const foerdermitgliedschaftStartSchema = z
  .object({
    stufe: z.enum(foermitglStufe),
  })
  .strict();

export type FoerdermitgliedschaftStartInput = z.infer<
  typeof foerdermitgliedschaftStartSchema
>;
