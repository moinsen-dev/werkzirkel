import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { idCol, erstelltAm } from './_helpers';
import { nutzer } from './nutzer';
import type { FoermitglStufe, FoermitglStatus } from './enums';

export const foerdermitgliedschaft = pgTable('foerdermitgliedschaft', {
  id: idCol(),
  nutzerId: text('nutzer_id')
    .notNull()
    .unique()
    .references(() => nutzer.id, { onDelete: 'cascade' }),
  stufe: text('stufe').$type<FoermitglStufe>().notNull(),
  stripeCustomerId: text('stripe_customer_id').notNull(),
  stripeSubscriptionId: text('stripe_subscription_id'),
  beginn: timestamp('beginn', { withTimezone: true }).notNull(),
  ende: timestamp('ende', { withTimezone: true }),
  status: text('status').$type<FoermitglStatus>().notNull(),
  erstelltAm: erstelltAm(),
});

export type Foerdermitgliedschaft = typeof foerdermitgliedschaft.$inferSelect;
