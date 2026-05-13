import { pgTable, text, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { idCol, erstelltAm, aktualisiertAm } from './_helpers';
import { nutzer } from './nutzer';
import type { Foerderart, GegenleistungTyp, FoerderprofilStatus } from './enums';

export const foerderprofil = pgTable(
  'foerderprofil',
  {
    id: idCol(),
    nutzerId: text('nutzer_id')
      .notNull()
      .unique()
      .references(() => nutzer.id, { onDelete: 'cascade' }),
    organisation: text('organisation').notNull(),
    foerderart: text('foerderart').$type<Foerderart>().notNull(),
    foerderrahmenJahrMinEuroCent: integer('foerderrahmen_jahr_min_euro_cent'),
    foerderrahmenJahrMaxEuroCent: integer('foerderrahmen_jahr_max_euro_cent'),
    foerderrahmenEinzelMaxEuroCent: integer('foerderrahmen_einzel_max_euro_cent'),
    bevorzugteWerke: text('bevorzugte_werke'),
    gegenleistungTyp: text('gegenleistung_typ').$type<GegenleistungTyp>().notNull(),
    gegenleistungText: text('gegenleistung_text'),
    verifikationStatus: text('verifikation_status')
      .$type<FoerderprofilStatus>()
      .notNull()
      .default('entwurf'),
    verifiziererId: text('verifizierer_id').references(() => nutzer.id, { onDelete: 'set null' }),
    verifiziertAm: timestamp('verifiziert_am', { withTimezone: true }),
    pausiertSeit: timestamp('pausiert_seit', { withTimezone: true }),
    letzteBedarfsschauId: text('letzte_bedarfsschau_id'), // FK termin in Migration
    letzteBedarfsschauAm: timestamp('letzte_bedarfsschau_am', { withTimezone: true }),
    erstelltAm: erstelltAm(),
    aktualisiertAm: aktualisiertAm(),
  },
  (table) => ({
    statusIdx: index('foerderprofil_status_idx').on(table.verifikationStatus),
    letzteBedarfsschauIdx: index('foerderprofil_letzte_bedarfsschau_idx').on(
      table.letzteBedarfsschauAm,
    ),
  }),
);

export type Foerderprofil = typeof foerderprofil.$inferSelect;
export type NeuesFoerderprofil = typeof foerderprofil.$inferInsert;
