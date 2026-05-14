/**
 * Zod-Validatoren fuer Nutzer-Profil-Updates und Benachrichtigungs-Einstellungen.
 *
 * Quelle: PRD §13.2 (nutzer-Schema) und §F-001 bis §F-005 (Konto + Werkpass).
 *
 * - WERDEN VON CLIENT UND SERVER GEMEINSAM VERWENDET.
 *   Auf dem Server (Route-Handler) wird das Schema gegen den Request-Body
 *   geparst; auf der Client-Seite kann es ueber `react-hook-form` zur
 *   Inline-Validierung verwendet werden.
 * - Alle Felder sind optional — `PATCH /api/v1/me` ist sparse. Nur uebermittelte
 *   Felder werden geaendert. Das macht den Konflikt mit Datenbank-NOT-NULL-Spalten
 *   handhabbar: die Nutzer:in muss `klarname` und `anzeigename` nicht jedes Mal
 *   mitschicken, nur wenn sie es aendern moechten.
 * - **App-Validierung Klarname-Pflicht** (PRD §13.2 letzter Block): wenn
 *   `rollen` `bedarfstraeger` oder `foerderer` enthaelt, muss `klarname`
 *   nicht-leer sein. Wird via Refinement gegen den GESAMTEN Patch geprueft —
 *   d.h. wenn nur `rollen` mitkommt, muss das Server-Handling ueberpruefen,
 *   ob der bisherige `klarname` reicht. Hier sichern wir nur das Patch-interne
 *   "wenn rollen + klarname=leer ⇒ Fehler" ab.
 *
 * Fehlermeldungen sind durchgehend deutsch (deutsche Plattform).
 */

import { z } from 'zod';
import { rolle, teilnahmeart } from '@/lib/db/schema/enums';
import type { Rolle } from '@/lib/db/schema/enums';
import { defaultBenachrichtigungsEinstellungen } from '@/lib/notifications/defaults';

/**
 * Hilfs-Schema: optionales URL-Feld, das auch den Leerstring akzeptiert (User
 * loescht das Feld). Leerstring wird zu `null` normalisiert.
 */
const optionalUrl = z
  .string()
  .max(500, { message: 'URL ist zu lang (max. 500 Zeichen).' })
  .refine((v) => v === '' || /^https?:\/\//i.test(v), {
    message: 'Bitte eine vollstaendige URL eingeben (mit http:// oder https://).',
  })
  .transform((v) => (v === '' ? null : v))
  .optional()
  .nullable();

const optionalText = (max: number, label: string) =>
  z
    .string()
    .max(max, { message: `${label} ist zu lang (max. ${max} Zeichen).` })
    .optional();

/**
 * Welche Rollen erfordern einen Klarnamen?
 * PRD §13.2: bedarfstraeger und foerderer.
 */
export const ROLLEN_KLARNAME_PFLICHT: ReadonlySet<Rolle> = new Set([
  'bedarfstraeger',
  'foerderer',
]);

export function rollenErforderlichKlarname(rollen: readonly Rolle[]): boolean {
  return rollen.some((r) => ROLLEN_KLARNAME_PFLICHT.has(r));
}

/**
 * Profil-Update-Schema fuer `PATCH /api/v1/me`.
 */
export const nutzerProfilUpdateSchema = z
  .object({
    klarname: z
      .string()
      .min(1, { message: 'Klarname darf nicht leer sein.' })
      .max(200, { message: 'Klarname ist zu lang (max. 200 Zeichen).' })
      .optional(),
    anzeigename: z
      .string()
      .min(1, { message: 'Anzeigename darf nicht leer sein.' })
      .max(80, { message: 'Anzeigename ist zu lang (max. 80 Zeichen).' })
      .optional(),
    stadtId: z
      .string()
      .min(1, { message: 'Stadt muss gewaehlt werden.' })
      .max(20)
      .optional(),
    kurzbeschreibung: optionalText(500, 'Kurzbeschreibung'),
    faehigkeiten: z
      .array(z.string().min(1).max(80))
      .max(20, { message: 'Maximal 20 Faehigkeiten.' })
      .optional(),
    interessen: z
      .array(z.string().min(1).max(80))
      .max(20, { message: 'Maximal 20 Interessen.' })
      .optional(),
    rollen: z
      .array(z.enum(rolle))
      .min(1, { message: 'Mindestens eine Rolle muss gewaehlt sein.' })
      .max(rolle.length, { message: 'Zu viele Rollen.' })
      .optional(),
    teilnahmeart: z.enum(teilnahmeart).optional().nullable(),
    website: optionalUrl,
    github: optionalUrl,
    linkedin: optionalUrl,
    mastodon: optionalUrl,
  })
  .strict()
  .superRefine((data, ctx) => {
    // App-Validierung Klarname-Pflicht: wenn rollen 'bedarfstraeger' oder
    // 'foerderer' enthaelt und klarname im selben Patch mitkommt, muss
    // klarname nicht-leer sein. Server-Handling muss zusaetzlich pruefen,
    // ob der bisherige Klarname reicht, wenn nur `rollen` im Patch ist.
    if (data.rollen && rollenErforderlichKlarname(data.rollen)) {
      const klarname = data.klarname;
      if (klarname !== undefined && klarname.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['klarname'],
          message:
            'Fuer Rollen Bedarfstraeger:in / Foerder:in ist ein Klarname Pflicht.',
        });
      }
    }
  });

export type NutzerProfilUpdate = z.infer<typeof nutzerProfilUpdateSchema>;

/**
 * Benachrichtigungs-Einstellungen-Schema. Identische Keys wie Defaults.
 */
export const benachrichtigungsEinstellungenSchema = z
  .object(
    Object.fromEntries(
      (Object.keys(defaultBenachrichtigungsEinstellungen) as Array<
        keyof typeof defaultBenachrichtigungsEinstellungen
      >).map((k) => [k, z.boolean()]),
    ) as Record<keyof typeof defaultBenachrichtigungsEinstellungen, z.ZodBoolean>,
  )
  .strict();

export type BenachrichtigungsEinstellungenInput = z.infer<
  typeof benachrichtigungsEinstellungenSchema
>;
