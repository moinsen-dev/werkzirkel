import { pgTable, text, integer, numeric, timestamp } from 'drizzle-orm/pg-core';
import { idCol, erstelltAm } from './_helpers';
import { bedarf } from './bedarf';
import { nutzer } from './nutzer';
import type { ErfolgsbeitragStatus } from './enums';

/**
 * Freiwillige Spende an die Werkstatt-Kasse bei Bedarf-Erfüllung.
 * KEINE Provision — Plattform stellt keine Rechnung, vermittelt nichts.
 */
export const erfolgsbeitrag = pgTable('erfolgsbeitrag', {
  id: idCol(),
  bedarfId: text('bedarf_id').references(() => bedarf.id, { onDelete: 'set null' }),
  zahlerNutzerId: text('zahler_nutzer_id').references(() => nutzer.id, { onDelete: 'set null' }),
  hoeheEuroCent: integer('hoehe_euro_cent').notNull(),
  prozentSatz: numeric('prozent_satz', { precision: 5, scale: 2 }),
  stripeSessionId: text('stripe_session_id').notNull(),
  status: text('status').$type<ErfolgsbeitragStatus>().notNull().default('initiiert'),
  gezahltAm: timestamp('gezahlt_am', { withTimezone: true }),
  erstelltAm: erstelltAm(),
});

export type Erfolgsbeitrag = typeof erfolgsbeitrag.$inferSelect;
export type NeuerErfolgsbeitrag = typeof erfolgsbeitrag.$inferInsert;
