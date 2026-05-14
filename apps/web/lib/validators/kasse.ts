/**
 * Zod-Validatoren fuer die Werkstatt-Kasse-Endpoints.
 *
 * Eintrag-Schema: Kurator:innen legen Einträge an (typ + kategorie + Höhe +
 * Beschreibung + Datum). Quartal wird serverseitig aus Datum berechnet (siehe
 * `lib/kasse/quartal.ts`); der Validator akzeptiert ihn optional, falls die
 * UI ihn explizit setzen will.
 *
 * Beleg-URL und Referenz-Felder sind optional und werden vor allem von
 * automatischen Webhook-Einträgen befüllt — Kurator:innen können sie aber
 * für manuelle Belege ergänzen.
 *
 * Quartal-Format: '<YYYY>-Q<1-4>', z.B. '2026-Q1'. Datum-Format: 'YYYY-MM-DD'.
 *
 * PRD-Referenz: §8.11 (Werkstatt-Kasse pro Stadt + Quartalsbericht).
 */

import { z } from 'zod';
import {
  kasseTyp,
  kasseKategorieEingang,
  kasseKategorieAusgang,
} from '@/lib/db/schema/enums';

export const KASSE_TYP_VALUES = kasseTyp;
export const KASSE_KATEGORIE_EINGANG_VALUES = kasseKategorieEingang;
export const KASSE_KATEGORIE_AUSGANG_VALUES = kasseKategorieAusgang;

const datumRegex = /^\d{4}-\d{2}-\d{2}$/;
const quartalRegex = /^\d{4}-Q[1-4]$/;

export const kasseEintragSchema = z
  .object({
    typ: z.enum(kasseTyp, {
      errorMap: () => ({ message: 'Typ muss eingang oder ausgang sein.' }),
    }),
    kategorie: z
      .string()
      .min(1, { message: 'Kategorie ist erforderlich.' })
      .max(80, { message: 'Kategorie ist zu lang.' }),
    hoehe_euro_cent: z
      .number()
      .int()
      .min(1, { message: 'Höhe muss mindestens 1 Cent sein.' })
      .max(100_000_000, { message: 'Höchstbetrag ist 1.000.000 € (100.000.000 Cent).' }),
    beschreibung: z
      .string()
      .min(3, { message: 'Beschreibung ist zu kurz (mindestens 3 Zeichen).' })
      .max(500, { message: 'Beschreibung ist zu lang (max. 500 Zeichen).' }),
    datum: z
      .string()
      .regex(datumRegex, { message: 'Datum muss im Format YYYY-MM-DD vorliegen.' }),
    quartal: z
      .string()
      .regex(quartalRegex, { message: 'Quartal muss im Format YYYY-Q1..Q4 vorliegen.' })
      .optional(),
    beleg_url: z
      .string()
      .url({ message: 'Beleg-URL ist ungültig.' })
      .max(500)
      .optional(),
    referenz_typ: z.string().max(60).optional(),
    referenz_id: z.string().max(60).optional(),
  })
  .strict()
  .superRefine((val, ctx) => {
    const eingang = (KASSE_KATEGORIE_EINGANG_VALUES as readonly string[]).includes(
      val.kategorie,
    );
    const ausgang = (KASSE_KATEGORIE_AUSGANG_VALUES as readonly string[]).includes(
      val.kategorie,
    );
    if (val.typ === 'eingang' && !eingang) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['kategorie'],
        message: 'Eingangs-Kategorie unbekannt.',
      });
    }
    if (val.typ === 'ausgang' && !ausgang) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['kategorie'],
        message: 'Ausgangs-Kategorie unbekannt.',
      });
    }
  });

export type KasseEintragInput = z.infer<typeof kasseEintragSchema>;
