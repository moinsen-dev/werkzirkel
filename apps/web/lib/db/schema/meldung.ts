import { pgTable, text, timestamp, index } from 'drizzle-orm/pg-core';
import { idCol, erstelltAm } from './_helpers';
import { nutzer } from './nutzer';
import type { MeldungReferenzTyp, MeldungKategorie, MeldungStatus } from './enums';

export const meldung = pgTable(
  'meldung',
  {
    id: idCol(),
    gemeldetVon: text('gemeldet_von').references(() => nutzer.id, { onDelete: 'set null' }),
    referenzTyp: text('referenz_typ').$type<MeldungReferenzTyp>().notNull(),
    referenzId: text('referenz_id').notNull(),
    kategorie: text('kategorie').$type<MeldungKategorie>().notNull(),
    beschreibung: text('beschreibung'),
    status: text('status').$type<MeldungStatus>().notNull().default('offen'),
    bearbeiterId: text('bearbeiter_id').references(() => nutzer.id, { onDelete: 'set null' }),
    ergebnisNotiz: text('ergebnis_notiz'),
    erstelltAm: erstelltAm(),
    geschlossenAm: timestamp('geschlossen_am', { withTimezone: true }),
  },
  (table) => ({
    statusIdx: index('meldung_status_idx').on(table.status),
    referenzIdx: index('meldung_referenz_idx').on(table.referenzTyp, table.referenzId),
  }),
);

export type Meldung = typeof meldung.$inferSelect;
export type NeueMeldung = typeof meldung.$inferInsert;
