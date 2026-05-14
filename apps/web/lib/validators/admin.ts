/**
 * Zod-Validatoren fuer das Admin-Backoffice (PRD §15.14 + §26).
 *
 * - Nutzer-Suche / Sperren / Entsperren
 * - Stadt-Anlegen / Stadt-Aktivieren / Kurator ernennen
 * - Audit-Log + E-Mail-Log Filter
 *
 * Deutsch durchgehend. Schemata strict — unbekannte Felder werden abgelehnt,
 * damit Form-Posts mit Tippfehlern nicht stillschweigend ignoriert werden.
 */

import { z } from 'zod';
import {
  rolle,
  nutzerStatus,
  stadtStatus,
  emailStatus,
} from '@/lib/db/schema/enums';

/**
 * Filter fuer GET /api/v1/admin/nutzer.
 *
 * `q` ist ein Such-Pattern; es matcht case-insensitive gegen email, klarname,
 * anzeigename via SQL ILIKE. `stadt`, `rolle`, `status` sind exakte Filter.
 */
export const adminNutzerListQuerySchema = z
  .object({
    q: z
      .string()
      .max(120, { message: 'Suche darf hoechstens 120 Zeichen lang sein.' })
      .optional(),
    stadt: z.string().min(1).max(20).optional(),
    rolle: z.enum(rolle).optional(),
    status: z.enum(nutzerStatus).optional(),
    limit: z.coerce
      .number()
      .int()
      .min(1, { message: 'limit muss mindestens 1 sein.' })
      .max(200, { message: 'limit darf hoechstens 200 sein.' })
      .default(50),
    offset: z.coerce
      .number()
      .int()
      .min(0, { message: 'offset darf nicht negativ sein.' })
      .default(0),
  })
  .strict();

export type AdminNutzerListQuery = z.infer<typeof adminNutzerListQuerySchema>;

/**
 * Body fuer POST /api/v1/admin/nutzer/:id/sperren.
 * `grund` ist freitext, taucht im Audit-Log auf.
 */
export const adminNutzerSperrenSchema = z
  .object({
    grund: z
      .string()
      .max(500, { message: 'Grund darf hoechstens 500 Zeichen lang sein.' })
      .optional()
      .nullable(),
  })
  .strict();

export type AdminNutzerSperrenInput = z.infer<typeof adminNutzerSperrenSchema>;

/**
 * Body fuer POST /api/v1/admin/staedte — neue Stadt anlegen.
 * `id` ist ein menschenlesbares Kuerzel (z.B. 'hh'). Nicht via cuid2.
 */
export const adminStadtAnlegenSchema = z
  .object({
    id: z
      .string()
      .min(1, { message: 'Stadt-Kuerzel fehlt.' })
      .max(20, { message: 'Stadt-Kuerzel ist zu lang (max. 20 Zeichen).' })
      .regex(/^[a-z0-9_-]+$/i, {
        message:
          'Stadt-Kuerzel darf nur Buchstaben, Ziffern, Bindestrich oder Unterstrich enthalten.',
      }),
    name: z
      .string()
      .min(1, { message: 'Name fehlt.' })
      .max(120, { message: 'Name ist zu lang (max. 120 Zeichen).' }),
    status: z.enum(stadtStatus).default('vorbereitung'),
    beschreibung: z
      .string()
      .max(500, { message: 'Beschreibung ist zu lang.' })
      .optional()
      .nullable(),
    sortierung: z.coerce.number().int().min(0).max(10_000).default(100),
  })
  .strict();

export type AdminStadtAnlegenInput = z.infer<typeof adminStadtAnlegenSchema>;

/**
 * Body fuer PATCH /api/v1/admin/staedte/:id — aktivieren/deaktivieren.
 * Aktuell aenderbar: `status`, `name`, `beschreibung`, `sortierung`.
 */
export const adminStadtUpdateSchema = z
  .object({
    status: z.enum(stadtStatus).optional(),
    name: z.string().min(1).max(120).optional(),
    beschreibung: z.string().max(500).optional().nullable(),
    sortierung: z.coerce.number().int().min(0).max(10_000).optional(),
  })
  .strict();

export type AdminStadtUpdateInput = z.infer<typeof adminStadtUpdateSchema>;

/**
 * Body fuer POST /api/v1/admin/staedte/:id/kurator — Kurator:in ernennen.
 *
 * Setzt atomar in einer Transaktion:
 *   - stadt.kuratorId = nutzer_id
 *   - nutzer.rollen wird um 'kurator' ergaenzt (idempotent)
 *
 * Falls die Person bereits Kurator:in einer anderen Stadt ist, wird sie
 * trotzdem zugewiesen — eine Person kann nur fuer EINE Stadt zugeordnet
 * werden (PRD §10), aber die Rolle bleibt einmal vergeben.
 */
export const adminKuratorErnennenSchema = z
  .object({
    nutzer_id: z
      .string()
      .min(1, { message: 'nutzer_id fehlt.' })
      .max(40, { message: 'nutzer_id ist zu lang.' }),
  })
  .strict();

export type AdminKuratorErnennenInput = z.infer<typeof adminKuratorErnennenSchema>;

/**
 * Filter fuer GET /api/v1/admin/audit-log.
 *
 * - `aktion` (exact match)
 * - `nutzer_id` (exact match)
 * - `von` / `bis` als ISO-Datum (yyyy-mm-dd). Werden Server-seitig in Date
 *   konvertiert (von=Start-of-Day, bis=Start-of-NextDay exklusiv).
 */
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Datum muss YYYY-MM-DD sein.' });

export const adminAuditLogQuerySchema = z
  .object({
    aktion: z.string().min(1).max(100).optional(),
    nutzer_id: z.string().min(1).max(40).optional(),
    von: isoDate.optional(),
    bis: isoDate.optional(),
    limit: z.coerce.number().int().min(1).max(200).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict();

export type AdminAuditLogQuery = z.infer<typeof adminAuditLogQuerySchema>;

/**
 * Filter fuer GET /api/v1/admin/email-log.
 */
export const adminEmailLogQuerySchema = z
  .object({
    template: z.string().min(1).max(100).optional(),
    status: z.enum(emailStatus).optional(),
    nutzer_id: z.string().min(1).max(40).optional(),
    von: isoDate.optional(),
    bis: isoDate.optional(),
    limit: z.coerce.number().int().min(1).max(200).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict();

export type AdminEmailLogQuery = z.infer<typeof adminEmailLogQuerySchema>;
