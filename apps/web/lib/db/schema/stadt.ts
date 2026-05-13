import { pgTable, text, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { erstelltAm, aktualisiertAm } from './_helpers';
import type { StadtStatus } from './enums';

/**
 * Regionale Zirkel.
 * id ist kein cuid2, sondern ein menschenlesbares Kürzel ('hh', 'b', 'm', ...).
 */
export const stadt = pgTable(
  'stadt',
  {
    id: text('id').primaryKey(), // 'hh', 'b', 'm'
    name: text('name').notNull().unique(),
    status: text('status').$type<StadtStatus>().notNull(),
    kuratorId: text('kurator_id'), // FK → nutzer.id, gesetzt nach Kurator-Ernennung
    beschreibung: text('beschreibung'),
    sortierung: integer('sortierung').notNull().default(100),
    erstelltAm: erstelltAm(),
    aktualisiertAm: aktualisiertAm(),
  },
  (table) => ({
    statusIdx: index('stadt_status_idx').on(table.status),
  }),
);

export type Stadt = typeof stadt.$inferSelect;
export type NeueStadt = typeof stadt.$inferInsert;
