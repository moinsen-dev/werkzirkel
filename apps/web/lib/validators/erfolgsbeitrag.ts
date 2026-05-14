/**
 * Zod-Validator fuer den Erfolgsbeitrag-Endpoint.
 *
 * Erfolgsbeitrag ist eine FREIWILLIGE Spende an die Werkstatt-Kasse bei
 * der Bedarf-Erfuellung — KEINE Provision. Bedarfstraeger:in waehlt
 * einen Prozent-Wert (Slider 0–10 %) und einen daraus berechneten Cent-
 * Betrag; die UI rechnet `hoehe_euro_cent` aus dem Slider-Wert, der
 * Validator bestaetigt nur, dass der Cent-Betrag plausibel ist
 * (1 € bis 100.000 €).
 *
 * PRD-Referenz: §10.10 (Erfolgsbeitrag freiwillig), §21
 * (Erfolgsbeitrag-Flow).
 */

import { z } from 'zod';

export const erfolgsbeitragSchema = z
  .object({
    hoehe_euro_cent: z
      .number()
      .int()
      .min(100, { message: 'Mindestbetrag ist 1 € (100 Cent).' })
      .max(10_000_000, { message: 'Hoechstbetrag ist 100.000 € (10.000.000 Cent).' }),
    prozent_satz: z
      .number()
      .min(0, { message: 'Prozent-Satz darf nicht negativ sein.' })
      .max(10, { message: 'Prozent-Satz ist auf 10 % gedeckelt.' })
      .optional(),
  })
  .strict();

export type ErfolgsbeitragInput = z.infer<typeof erfolgsbeitragSchema>;
