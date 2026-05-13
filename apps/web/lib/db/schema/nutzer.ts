import { pgTable, text, timestamp, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { idCol, erstelltAm, aktualisiertAm } from './_helpers';
import { stadt } from './stadt';
import type { Rolle, NutzerStatus, Teilnahmeart, MagicLinkZweck } from './enums';

/**
 * Benachrichtigungs-Einstellungen pro Konto.
 * Defaults werden vom Lifecycle-Hook gesetzt; hier nur Schema.
 */
export type BenachrichtigungsEinstellungen = {
  pruefrunde_anmeldungen?: boolean;
  pruefrunde_feedback?: boolean;
  pruefrunde_frist?: boolean;
  werkangebote?: boolean;
  bedarf_passend?: boolean;
  termin_erinnerungen?: boolean;
  stadt_digest?: boolean;
  kurator_mitteilungen?: boolean;
};

export const nutzer = pgTable(
  'nutzer',
  {
    id: idCol(),
    email: text('email').notNull(),
    emailVerifiziertAm: timestamp('email_verifiziert_am', { withTimezone: true }),
    klarname: text('klarname').notNull(),
    anzeigename: text('anzeigename').notNull(),
    stadtId: text('stadt_id')
      .notNull()
      .references(() => stadt.id),
    kurzbeschreibung: text('kurzbeschreibung'),
    faehigkeiten: text('faehigkeiten')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    interessen: text('interessen')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    rollen: text('rollen')
      .array()
      .$type<Rolle[]>()
      .notNull()
      .default(sql`'{macher}'::text[]`),
    website: text('website'),
    github: text('github'),
    linkedin: text('linkedin'),
    mastodon: text('mastodon'),
    avatarUrl: text('avatar_url'),
    teilnahmeart: text('teilnahmeart').$type<Teilnahmeart>(),
    foerdermitgliedSeit: timestamp('foerdermitglied_seit', { withTimezone: true }),
    foerdermitgliedBis: timestamp('foerdermitglied_bis', { withTimezone: true }),
    benachrichtigungsEinstellungen: jsonb('benachrichtigungs_einstellungen')
      .$type<BenachrichtigungsEinstellungen>()
      .notNull()
      .default({}),
    status: text('status').$type<NutzerStatus>().notNull().default('aktiv'),
    loeschungAnstehendBis: timestamp('loeschung_anstehend_bis', { withTimezone: true }),
    erstelltAm: erstelltAm(),
    aktualisiertAm: aktualisiertAm(),
  },
  (table) => ({
    emailIdx: uniqueIndex('nutzer_email_idx').on(table.email),
    stadtIdx: index('nutzer_stadt_id_idx').on(table.stadtId),
    statusIdx: index('nutzer_status_idx').on(table.status),
  }),
);

export type Nutzer = typeof nutzer.$inferSelect;
export type NeuerNutzer = typeof nutzer.$inferInsert;

/**
 * Sessions (gilt für Better-Auth-Backend).
 * Better-Auth verwaltet diese Tabelle; wir definieren das Schema, damit Drizzle-Studio
 * und Migrationen es kennen.
 */
export const session = pgTable(
  'session',
  {
    id: idCol(),
    nutzerId: text('nutzer_id')
      .notNull()
      .references(() => nutzer.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    userAgent: text('user_agent'),
    ipAdresse: text('ip_adresse'),
    erstelltAm: erstelltAm(),
  },
  (table) => ({
    nutzerIdx: index('session_nutzer_id_idx').on(table.nutzerId),
    expiresIdx: index('session_expires_at_idx').on(table.expiresAt),
  }),
);

export type Session = typeof session.$inferSelect;

/**
 * Magic-Link-Tokens — Klartext-Token wird nie gespeichert, nur Hash.
 */
export const magicLinkToken = pgTable(
  'magic_link_token',
  {
    id: idCol(),
    email: text('email').notNull(),
    tokenHash: text('token_hash').notNull(),
    zweck: text('zweck').$type<MagicLinkZweck>().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    verwendetAm: timestamp('verwendet_am', { withTimezone: true }),
    erstelltAm: erstelltAm(),
  },
  (table) => ({
    emailIdx: index('magic_link_email_idx').on(table.email),
    tokenIdx: uniqueIndex('magic_link_token_idx').on(table.tokenHash),
    expiresIdx: index('magic_link_expires_at_idx').on(table.expiresAt),
  }),
);

export type MagicLinkToken = typeof magicLinkToken.$inferSelect;
