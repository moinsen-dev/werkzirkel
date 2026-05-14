/**
 * Zod-Validatoren fuer das Melde-System unter `/api/v1/meldungen/*` und
 * `/api/v1/kurator/meldungen/*`.
 *
 * Quelle: PRD §27 (Moderations-Workflow), §F-501..§F-504 (Moderation + Melden +
 * Inhalt ausblenden + Nutzer sperren).
 *
 * - Werden von Client und Server gemeinsam verwendet.
 * - Alle Fehlermeldungen sind deutsch.
 * - Anonyme Meldungen sind erlaubt — `gemeldet_von` wird Server-seitig aus der
 *   Session uebernommen oder `null`, wenn nicht eingeloggt. Daher kein Auth-Feld
 *   im Schema.
 * - Kurator-Resolution: `aktion` steuert, ob zusaetzlich zur Status-Aenderung
 *   eine Folge-Aktion ausgefuehrt wird (Inhalt ausblenden oder Nutzer sperren).
 */

import { z } from 'zod';
import {
  meldungReferenzTyp,
  meldungKategorie,
  meldungStatus,
} from '@/lib/db/schema/enums';

/**
 * Eine Meldung anlegen — Eingabe aus dem Melden-Modal.
 *
 * `beschreibung` ist optional, da die Kategorien bereits viel Kontext liefern.
 * Bei `kategorie='sonstiges'` ist eine Beschreibung gefuehlt sinnvoll, das
 * erzwingen wir aber nicht (Server akzeptiert leer).
 */
export const meldungAnlegenSchema = z
  .object({
    referenz_typ: z.enum(meldungReferenzTyp, {
      errorMap: () => ({ message: 'Referenz-Typ ist ungueltig.' }),
    }),
    referenz_id: z
      .string()
      .min(1, { message: 'Referenz-Id fehlt.' })
      .max(40, { message: 'Referenz-Id ist zu lang.' }),
    kategorie: z.enum(meldungKategorie, {
      errorMap: () => ({ message: 'Kategorie ist ungueltig.' }),
    }),
    beschreibung: z
      .string()
      .max(2000, { message: 'Beschreibung ist zu lang (max. 2000 Zeichen).' })
      .optional()
      .nullable(),
  })
  .strict();

export type MeldungAnlegenInput = z.infer<typeof meldungAnlegenSchema>;

/**
 * Aktionen, die eine Kurator:in bei Resolution einer Meldung auslesen kann.
 *
 * - `keine` — Status setzen, aber keine Folge-Aktion. Z.B. bei 'verworfen'.
 * - `inhalt_ausgeblendet` — Inhalt wird unsichtbar gemacht. Pro `referenz_typ`
 *   unterschiedlich umgesetzt (werk.status='ausgeblendet', bedarf.status='eingestellt',
 *   foerderprofil.verifikationStatus='pausiert').
 * - `nutzer_gesperrt` — Inhaber:in des Inhalts wird gesperrt
 *   (nutzer.status='gesperrt'). Bei `referenz_typ='nutzer'` direkt
 *   die referenzierte Person.
 */
export const meldungAktion = [
  'keine',
  'inhalt_ausgeblendet',
  'nutzer_gesperrt',
] as const;
export type MeldungAktion = (typeof meldungAktion)[number];

export const meldungResolutionSchema = z
  .object({
    status: z.enum(meldungStatus, {
      errorMap: () => ({ message: 'Status ist ungueltig.' }),
    }),
    aktion: z
      .enum(meldungAktion, {
        errorMap: () => ({ message: 'Aktion ist ungueltig.' }),
      })
      .default('keine'),
    ergebnis_notiz: z
      .string()
      .max(2000, { message: 'Notiz ist zu lang (max. 2000 Zeichen).' })
      .optional()
      .nullable(),
  })
  .strict();

export type MeldungResolutionInput = z.infer<typeof meldungResolutionSchema>;

/**
 * Query-Filter fuer GET /api/v1/kurator/meldungen.
 */
export const meldungenListQuerySchema = z
  .object({
    status: z.enum(meldungStatus).optional(),
    limit: z.coerce
      .number()
      .int()
      .min(1, { message: 'limit muss mindestens 1 sein.' })
      .max(100, { message: 'limit darf hoechstens 100 sein.' })
      .default(50),
  })
  .strict();

export type MeldungenListQuery = z.infer<typeof meldungenListQuerySchema>;
