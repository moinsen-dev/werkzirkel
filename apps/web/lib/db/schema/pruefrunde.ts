import { pgTable, text, integer, timestamp, boolean, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { idCol, erstelltAm, aktualisiertAm } from './_helpers';
import { werk } from './werk';
import { nutzer } from './nutzer';
import type {
  PruefrundeStatus,
  PruefrundeAnmeldungStatus,
  FeedbackKategorie,
  VerpflichtungStatus,
} from './enums';

export const pruefrunde = pgTable(
  'pruefrunde',
  {
    id: idCol(),
    werkId: text('werk_id')
      .notNull()
      .references(() => werk.id, { onDelete: 'cascade' }),
    titel: text('titel').notNull(),
    testziel: text('testziel').notNull(),
    testaufgabe: text('testaufgabe').notNull(),
    zielgruppe: text('zielgruppe').notNull(),
    zeitbedarfMinuten: integer('zeitbedarf_minuten').notNull(),
    gesuchteTester: integer('gesuchte_tester').notNull(),
    feedbackKategorien: text('feedback_kategorien')
      .array()
      .$type<FeedbackKategorie[]>()
      .notNull(),
    frist: timestamp('frist', { withTimezone: true }).notNull(),
    status: text('status').$type<PruefrundeStatus>().notNull().default('entwurf'),
    erstelltAm: erstelltAm(),
    aktualisiertAm: aktualisiertAm(),
  },
  (table) => ({
    werkIdx: index('pruefrunde_werk_id_idx').on(table.werkId),
    statusFristIdx: index('pruefrunde_status_frist_idx').on(table.status, table.frist),
  }),
);

export type Pruefrunde = typeof pruefrunde.$inferSelect;
export type NeuePruefrunde = typeof pruefrunde.$inferInsert;

/**
 * Tester:innen-Anmeldung pro Prüfrunde (Slot-System).
 */
export const pruefrundenAnmeldung = pgTable(
  'pruefrunden_anmeldung',
  {
    id: idCol(),
    pruefrundeId: text('pruefrunde_id')
      .notNull()
      .references(() => pruefrunde.id, { onDelete: 'cascade' }),
    testerId: text('tester_id')
      .notNull()
      .references(() => nutzer.id, { onDelete: 'cascade' }),
    status: text('status').$type<PruefrundeAnmeldungStatus>().notNull().default('angemeldet'),
    erstelltAm: erstelltAm(),
  },
  (table) => ({
    uniqueIdx: uniqueIndex('pruefrunden_anmeldung_uniq').on(table.pruefrundeId, table.testerId),
  }),
);

export type PruefrundenAnmeldung = typeof pruefrundenAnmeldung.$inferSelect;

/**
 * Feedback eines Testers zu einer Prüfrunde. Initial nur für Werkinhaber:in sichtbar.
 */
export const feedback = pgTable(
  'feedback',
  {
    id: idCol(),
    pruefrundeId: text('pruefrunde_id')
      .notNull()
      .references(() => pruefrunde.id, { onDelete: 'cascade' }),
    testerId: text('tester_id').references(() => nutzer.id, { onDelete: 'set null' }),
    ersterEindruck: text('erster_eindruck'),
    verstaendlichkeit: text('verstaendlichkeit'),
    nutzen: text('nutzen'),
    bedienbarkeit: text('bedienbarkeit'),
    fehler: text('fehler'),
    positionierung: text('positionierung'),
    zahlungsbereitschaft: text('zahlungsbereitschaft'),
    verbesserungen: text('verbesserungen'),
    gesamteindruck: text('gesamteindruck').notNull(),
    hilfreichMarkiert: boolean('hilfreich_markiert').notNull().default(false),
    hilfreichMarkiertAm: timestamp('hilfreich_markiert_am', { withTimezone: true }),
    erstelltAm: erstelltAm(),
  },
  (table) => ({
    uniqueIdx: uniqueIndex('feedback_uniq').on(table.pruefrundeId, table.testerId),
    pruefrundeIdx: index('feedback_pruefrunde_id_idx').on(table.pruefrundeId),
    testerIdx: index('feedback_tester_id_idx').on(table.testerId),
  }),
);

export type Feedback = typeof feedback.$inferSelect;
export type NeuesFeedback = typeof feedback.$inferInsert;

/**
 * Materialisierte Test-Bilanz pro Nutzer:in. Wird von der Reziprozitäts-Engine
 * (lib/reziprozitaet/) gepflegt, nicht direkt durch CRUD.
 */
export const testSaldo = pgTable('test_saldo', {
  nutzerId: text('nutzer_id')
    .primaryKey()
    .references(() => nutzer.id, { onDelete: 'cascade' }),
  testsGegeben: integer('tests_gegeben').notNull().default(0),
  testsErhalten: integer('tests_erhalten').notNull().default(0),
  offeneVerpflichtungAnzahl: integer('offene_verpflichtung_anzahl').notNull().default(0),
  naechsteVerpflichtungFrist: timestamp('naechste_verpflichtung_frist', { withTimezone: true }),
  aktualisiertAm: aktualisiertAm(),
});

export type TestSaldo = typeof testSaldo.$inferSelect;

/**
 * Offene Reziprozitäts-Verpflichtungen pro Nutzer:in.
 * Wird erzeugt, wenn jemand eine Prüfrunde startet, ohne 2 Tests im Saldo zu haben.
 */
export const pruefrundenVerpflichtung = pgTable('pruefrunden_verpflichtung', {
  id: idCol(),
  nutzerId: text('nutzer_id')
    .notNull()
    .references(() => nutzer.id, { onDelete: 'cascade' }),
  ausPruefrundeId: text('aus_pruefrunde_id')
    .notNull()
    .references(() => pruefrunde.id, { onDelete: 'cascade' }),
  frist: timestamp('frist', { withTimezone: true }).notNull(),
  status: text('status').$type<VerpflichtungStatus>().notNull().default('offen'),
  erfuelltDurchFeedbackId: text('erfuellt_durch_feedback_id').references(() => feedback.id),
  erstelltAm: erstelltAm(),
});

export type PruefrundenVerpflichtung = typeof pruefrundenVerpflichtung.$inferSelect;
