import { pgTable, text, integer, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { idCol, erstelltAm, aktualisiertAm } from './_helpers';
import { nutzer } from './nutzer';
import { stadt } from './stadt';
import { werk } from './werk';
import { werkstattbeitrag } from './werkstattbeitrag';
import type { BedarfStatus, WerkangebotStatus } from './enums';

export const bedarf = pgTable(
  'bedarf',
  {
    id: idCol(),
    nutzerId: text('nutzer_id')
      .notNull()
      .references(() => nutzer.id, { onDelete: 'cascade' }),
    organisation: text('organisation').notNull(),
    titel: text('titel').notNull(),
    problem: text('problem').notNull(),
    nutzen: text('nutzen').notNull(),
    stadtId: text('stadt_id')
      .notNull()
      .references(() => stadt.id),
    groessenordnungZeitWochen: integer('groessenordnung_zeit_wochen'),
    groessenordnungAufwandTage: integer('groessenordnung_aufwand_tage'),
    geldrahmenMinEuroCent: integer('geldrahmen_min_euro_cent'),
    geldrahmenMaxEuroCent: integer('geldrahmen_max_euro_cent'),
    frist: timestamp('frist', { withTimezone: true }).notNull(),
    werkstattbeitragId: text('werkstattbeitrag_id').references(() => werkstattbeitrag.id),
    branche: text('branche'),
    bevorzugterWerkstand: text('bevorzugter_werkstand'),
    status: text('status').$type<BedarfStatus>().notNull().default('entwurf'),
    erfuelltVonWerkId: text('erfuellt_von_werk_id').references(() => werk.id, {
      onDelete: 'set null',
    }),
    selbstauskunftGroesseEuroCentMin: integer('selbstauskunft_groesse_euro_cent_min'),
    selbstauskunftGroesseEuroCentMax: integer('selbstauskunft_groesse_euro_cent_max'),
    erfuelltAm: timestamp('erfuellt_am', { withTimezone: true }),
    erstelltAm: erstelltAm(),
    aktualisiertAm: aktualisiertAm(),
  },
  (table) => ({
    nutzerIdx: index('bedarf_nutzer_id_idx').on(table.nutzerId),
    stadtStatusIdx: index('bedarf_stadt_status_idx').on(table.stadtId, table.status),
    fristIdx: index('bedarf_frist_idx').on(table.frist),
  }),
);

export type Bedarf = typeof bedarf.$inferSelect;
export type NeuerBedarf = typeof bedarf.$inferInsert;

/**
 * Werkangebot — strukturierte Antwort eines Werks auf einen Bedarf.
 *
 * Sichtbarkeit: nur Bedarfsträger:in und Macher:in dürfen lesen. Wird im API-Layer
 * erzwungen, nicht via Postgres-RLS. Pro Bedarf maximal ein Werkangebot je Werk
 * (UNIQUE-Constraint).
 */
export const werkangebot = pgTable(
  'werkangebot',
  {
    id: idCol(),
    bedarfId: text('bedarf_id')
      .notNull()
      .references(() => bedarf.id, { onDelete: 'cascade' }),
    werkId: text('werk_id')
      .notNull()
      .references(() => werk.id, { onDelete: 'cascade' }),
    macherId: text('macher_id')
      .notNull()
      .references(() => nutzer.id, { onDelete: 'cascade' }),
    konkretesVorgehen: text('konkretes_vorgehen').notNull(),
    ausdruecklicherAusschluss: text('ausdruecklicher_ausschluss').notNull(),
    ersterLieferMeilenstein: text('erster_liefer_meilenstein').notNull(),
    status: text('status').$type<WerkangebotStatus>().notNull().default('eingereicht'),
    erstelltAm: erstelltAm(),
    aktualisiertAm: aktualisiertAm(),
  },
  (table) => ({
    uniqueIdx: uniqueIndex('werkangebot_bedarf_werk_uniq').on(table.bedarfId, table.werkId),
    bedarfIdx: index('werkangebot_bedarf_id_idx').on(table.bedarfId),
    macherIdx: index('werkangebot_macher_id_idx').on(table.macherId),
  }),
);

export type Werkangebot = typeof werkangebot.$inferSelect;
export type NeuesWerkangebot = typeof werkangebot.$inferInsert;
