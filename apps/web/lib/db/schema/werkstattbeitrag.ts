import { pgTable, text, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { idCol, erstelltAm } from './_helpers';
import { nutzer } from './nutzer';
import type { WerkstattbeitragArt, WerkstattbeitragStatus } from './enums';

// Note: termin-FK wird durch lazy-import in der Migration aufgelöst (Circular zwischen
// termin und werkstattbeitrag wäre möglich, weil Bedarfsschau-Teilnahme als Werkstattbeitrag
// gilt). Wir referenzieren termin nur als text-Spalte mit FK in der Migration.

export const werkstattbeitrag = pgTable(
  'werkstattbeitrag',
  {
    id: idCol(),
    nutzerId: text('nutzer_id')
      .notNull()
      .references(() => nutzer.id, { onDelete: 'cascade' }),
    art: text('art').$type<WerkstattbeitragArt>().notNull(),
    hoeheEuroCent: integer('hoehe_euro_cent'),
    nachweisText: text('nachweis_text'),
    nachweisDokumentUrl: text('nachweis_dokument_url'),
    terminId: text('termin_id'), // FK auf termin(id), in Migration ergänzt
    stripeSessionId: text('stripe_session_id'),
    status: text('status').$type<WerkstattbeitragStatus>().notNull().default('erfasst'),
    verifiziertDurch: text('verifiziert_durch').references(() => nutzer.id, {
      onDelete: 'set null',
    }),
    verifiziertAm: timestamp('verifiziert_am', { withTimezone: true }),
    gueltigBis: timestamp('gueltig_bis', { withTimezone: true }),
    verwendetFuerBedarfe: integer('verwendet_fuer_bedarfe').notNull().default(0),
    erstelltAm: erstelltAm(),
  },
  (table) => ({
    nutzerIdx: index('werkstattbeitrag_nutzer_id_idx').on(table.nutzerId),
    statusIdx: index('werkstattbeitrag_status_idx').on(table.status),
  }),
);

export type Werkstattbeitrag = typeof werkstattbeitrag.$inferSelect;
export type NeuerWerkstattbeitrag = typeof werkstattbeitrag.$inferInsert;
