import { pgTable, text, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { idCol, erstelltAm, aktualisiertAm } from './_helpers';
import { nutzer } from './nutzer';
import type { Werkstand, WerkSichtbarkeit, WerkStatus, Hilfebedarf } from './enums';

export const werk = pgTable(
  'werk',
  {
    id: idCol(),
    nutzerId: text('nutzer_id')
      .notNull()
      .references(() => nutzer.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    kurzbeschreibung: text('kurzbeschreibung').notNull(),
    problem: text('problem').notNull(),
    zielgruppe: text('zielgruppe').notNull(),
    werkstand: text('werkstand').$type<Werkstand>().notNull(),
    hilfebedarf: text('hilfebedarf')
      .array()
      .$type<Hilfebedarf[]>()
      .notNull()
      .default(sql`'{}'::text[]`),
    link: text('link'),
    screenshots: text('screenshots')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    sichtbarkeit: text('sichtbarkeit').$type<WerkSichtbarkeit>().notNull().default('oeffentlich'),
    status: text('status').$type<WerkStatus>().notNull().default('aktiv'),
    erstelltAm: erstelltAm(),
    aktualisiertAm: aktualisiertAm(),
  },
  (table) => ({
    nutzerIdx: index('werk_nutzer_id_idx').on(table.nutzerId),
    werkstandIdx: index('werk_werkstand_idx').on(table.werkstand),
    sichtbarkeitStatusIdx: index('werk_sichtbarkeit_status_idx').on(
      table.sichtbarkeit,
      table.status,
    ),
    // FTS-Spalte und GIN-Index kommen in einer separaten Migration (Sprint 12 / Suche).
  }),
);

export type Werk = typeof werk.$inferSelect;
export type NeuesWerk = typeof werk.$inferInsert;

/**
 * Historie von Werkstand-Wechseln pro Werk (für Werkstand-Verlauf in der Werkseite).
 */
export const werkHistorie = pgTable('werk_historie', {
  id: idCol(),
  werkId: text('werk_id')
    .notNull()
    .references(() => werk.id, { onDelete: 'cascade' }),
  werkstandAlt: text('werkstand_alt').$type<Werkstand>(),
  werkstandNeu: text('werkstand_neu').$type<Werkstand>(),
  geaendertVon: text('geaendert_von').references(() => nutzer.id, { onDelete: 'set null' }),
  geaendertAm: erstelltAm(),
});

export type WerkHistorie = typeof werkHistorie.$inferSelect;
