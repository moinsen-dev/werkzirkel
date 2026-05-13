import { text, timestamp } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';

/**
 * Wiederverwendbare Spaltendefinitionen für alle Tabellen.
 * - id: cuid2 (URL-sicher, sortierbar, 24 Zeichen)
 * - timestamps: timestamptz mit Default now()
 */

export const idCol = () =>
  text('id').primaryKey().$defaultFn(() => createId());

export const erstelltAm = () =>
  timestamp('erstellt_am', { withTimezone: true }).notNull().defaultNow();

export const aktualisiertAm = () =>
  timestamp('aktualisiert_am', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());
