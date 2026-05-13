import { pgTable, text, integer, date, timestamp } from 'drizzle-orm/pg-core';
import { idCol, erstelltAm } from './_helpers';
import { stadt } from './stadt';
import { nutzer } from './nutzer';
import type { KasseTyp } from './enums';

/**
 * Werkstatt-Kasse pro Stadt — transparent, quartalsweise abgeschlossen.
 *
 * Eingangs- und Ausgangs-Kategorien werden als text-Spalte geführt
 * (siehe enums.ts kasseKategorieEingang / kasseKategorieAusgang).
 */
export const werkstattKasseEintrag = pgTable('werkstatt_kasse_eintrag', {
  id: idCol(),
  stadtId: text('stadt_id')
    .notNull()
    .references(() => stadt.id),
  typ: text('typ').$type<KasseTyp>().notNull(),
  kategorie: text('kategorie').notNull(),
  hoeheEuroCent: integer('hoehe_euro_cent').notNull(),
  beschreibung: text('beschreibung').notNull(),
  belegUrl: text('beleg_url'),
  referenzTyp: text('referenz_typ'), // 'werkstattbeitrag' | 'erfolgsbeitrag' | 'foerdermitgliedschaft' | 'spende' | 'rechnung'
  referenzId: text('referenz_id'),
  datum: date('datum').notNull(),
  quartal: text('quartal').notNull(), // '2026-Q1'
  erfasstDurch: text('erfasst_durch')
    .notNull()
    .references(() => nutzer.id),
  freigegebenDurch: text('freigegeben_durch').references(() => nutzer.id, {
    onDelete: 'set null',
  }),
  freigegebenAm: timestamp('freigegeben_am', { withTimezone: true }),
  erstelltAm: erstelltAm(),
});

export type WerkstattKasseEintrag = typeof werkstattKasseEintrag.$inferSelect;
export type NeuerKasseEintrag = typeof werkstattKasseEintrag.$inferInsert;
