import { pgTable, text, integer, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { idCol, erstelltAm, aktualisiertAm } from './_helpers';
import { nutzer } from './nutzer';
import { stadt } from './stadt';
import { werk } from './werk';
import { bedarf } from './bedarf';
import { foerderprofil } from './foerderprofil';
import type { TerminTyp, TerminStatus, TerminAnmeldungStatus } from './enums';

export const termin = pgTable(
  'termin',
  {
    id: idCol(),
    stadtId: text('stadt_id')
      .notNull()
      .references(() => stadt.id),
    typ: text('typ').$type<TerminTyp>().notNull(),
    titel: text('titel').notNull(),
    beschreibung: text('beschreibung').notNull(),
    ortText: text('ort_text'),
    onlineLink: text('online_link'),
    datumUhrzeit: timestamp('datum_uhrzeit', { withTimezone: true }).notNull(),
    maxTeilnehmer: integer('max_teilnehmer').notNull(),
    erstelltVon: text('erstellt_von')
      .notNull()
      .references(() => nutzer.id),
    status: text('status').$type<TerminStatus>().notNull().default('geplant'),
    notizenNachTermin: text('notizen_nach_termin'),
    erstelltAm: erstelltAm(),
    aktualisiertAm: aktualisiertAm(),
  },
  (table) => ({
    stadtTypIdx: index('termin_stadt_typ_idx').on(table.stadtId, table.typ),
    datumIdx: index('termin_datum_idx').on(table.datumUhrzeit),
    statusIdx: index('termin_status_idx').on(table.status),
  }),
);

export type Termin = typeof termin.$inferSelect;
export type NeuerTermin = typeof termin.$inferInsert;

export const terminAnmeldung = pgTable(
  'termin_anmeldung',
  {
    id: idCol(),
    terminId: text('termin_id')
      .notNull()
      .references(() => termin.id, { onDelete: 'cascade' }),
    nutzerId: text('nutzer_id')
      .notNull()
      .references(() => nutzer.id, { onDelete: 'cascade' }),
    status: text('status').$type<TerminAnmeldungStatus>().notNull().default('angemeldet'),
    notiz: text('notiz'),
    erstelltAm: erstelltAm(),
  },
  (table) => ({
    uniqueIdx: uniqueIndex('termin_anmeldung_uniq').on(table.terminId, table.nutzerId),
  }),
);

export type TerminAnmeldung = typeof terminAnmeldung.$inferSelect;

/**
 * Welche Werke werden bei einem Schauabend gezeigt.
 */
export const terminWerkBezug = pgTable(
  'termin_werk_bezug',
  {
    id: idCol(),
    terminId: text('termin_id')
      .notNull()
      .references(() => termin.id, { onDelete: 'cascade' }),
    werkId: text('werk_id')
      .notNull()
      .references(() => werk.id, { onDelete: 'cascade' }),
    reihenfolge: integer('reihenfolge').notNull().default(100),
    notizen: text('notizen'),
  },
  (table) => ({
    uniqueIdx: uniqueIndex('termin_werk_bezug_uniq').on(table.terminId, table.werkId),
  }),
);

/**
 * Welche Bedarfe werden bei einer Bedarfsschau vorgestellt.
 */
export const terminBedarfBezug = pgTable(
  'termin_bedarf_bezug',
  {
    id: idCol(),
    terminId: text('termin_id')
      .notNull()
      .references(() => termin.id, { onDelete: 'cascade' }),
    bedarfId: text('bedarf_id')
      .notNull()
      .references(() => bedarf.id, { onDelete: 'cascade' }),
    reihenfolge: integer('reihenfolge').notNull().default(100),
    notizen: text('notizen'),
  },
  (table) => ({
    uniqueIdx: uniqueIndex('termin_bedarf_bezug_uniq').on(table.terminId, table.bedarfId),
  }),
);

/**
 * Welche Förderprofile stellen sich bei einer Bedarfsschau persönlich vor.
 */
export const terminFoerderprofilBezug = pgTable(
  'termin_foerderprofil_bezug',
  {
    id: idCol(),
    terminId: text('termin_id')
      .notNull()
      .references(() => termin.id, { onDelete: 'cascade' }),
    foerderprofilId: text('foerderprofil_id')
      .notNull()
      .references(() => foerderprofil.id, { onDelete: 'cascade' }),
    reihenfolge: integer('reihenfolge').notNull().default(100),
    notizen: text('notizen'),
  },
  (table) => ({
    uniqueIdx: uniqueIndex('termin_foerderprofil_bezug_uniq').on(
      table.terminId,
      table.foerderprofilId,
    ),
  }),
);
