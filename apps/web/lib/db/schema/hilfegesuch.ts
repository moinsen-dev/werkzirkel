import { pgTable, text, timestamp, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { idCol, erstelltAm } from './_helpers';
import { nutzer } from './nutzer';
import { stadt } from './stadt';
import { werk } from './werk';
import type { HilfegesuchStatus } from './enums';

export const hilfegesuch = pgTable('hilfegesuch', {
  id: idCol(),
  nutzerId: text('nutzer_id')
    .notNull()
    .references(() => nutzer.id, { onDelete: 'cascade' }),
  werkId: text('werk_id').references(() => werk.id, { onDelete: 'set null' }),
  stadtId: text('stadt_id')
    .notNull()
    .references(() => stadt.id),
  titel: text('titel').notNull(),
  beschreibung: text('beschreibung').notNull(),
  tags: text('tags')
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  gueltigBis: timestamp('gueltig_bis', { withTimezone: true }).notNull(),
  status: text('status').$type<HilfegesuchStatus>().notNull().default('offen'),
  erstelltAm: erstelltAm(),
});

export type Hilfegesuch = typeof hilfegesuch.$inferSelect;
export type NeuesHilfegesuch = typeof hilfegesuch.$inferInsert;

export const hilfegesuchAntwort = pgTable(
  'hilfegesuch_antwort',
  {
    id: idCol(),
    hilfegesuchId: text('hilfegesuch_id')
      .notNull()
      .references(() => hilfegesuch.id, { onDelete: 'cascade' }),
    nutzerId: text('nutzer_id')
      .notNull()
      .references(() => nutzer.id, { onDelete: 'cascade' }),
    text: text('text').notNull(),
    erstelltAm: erstelltAm(),
  },
  (table) => ({
    hilfegesuchIdx: index('hilfegesuch_antwort_hilfegesuch_id_idx').on(table.hilfegesuchId),
  }),
);

export type HilfegesuchAntwort = typeof hilfegesuchAntwort.$inferSelect;
