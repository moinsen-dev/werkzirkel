import { pgTable, text, jsonb, index } from 'drizzle-orm/pg-core';
import { idCol, erstelltAm } from './_helpers';
import { nutzer } from './nutzer';
import type { EmailStatus } from './enums';

/**
 * Audit-Log für sicherheits- und governance-relevante Aktionen.
 * Wird von allen Statusübergängen, Verifikationen und Sperrungen befüllt.
 */
export const auditLog = pgTable(
  'audit_log',
  {
    id: idCol(),
    nutzerId: text('nutzer_id').references(() => nutzer.id, { onDelete: 'set null' }),
    aktion: text('aktion').notNull(), // z.B. 'werk.veroeffentlicht', 'bedarf.erfuellt', 'foerderprofil.verifiziert'
    referenzTyp: text('referenz_typ'),
    referenzId: text('referenz_id'),
    metadaten: jsonb('metadaten').notNull().default({}),
    ipAdresse: text('ip_adresse'),
    userAgent: text('user_agent'),
    erstelltAm: erstelltAm(),
  },
  (table) => ({
    nutzerIdx: index('audit_log_nutzer_id_idx').on(table.nutzerId),
    aktionIdx: index('audit_log_aktion_idx').on(table.aktion),
    erstelltIdx: index('audit_log_erstellt_am_idx').on(table.erstelltAm),
  }),
);

export type AuditLog = typeof auditLog.$inferSelect;
export type NeuerAuditLog = typeof auditLog.$inferInsert;

/**
 * Log aller versendeten E-Mails (für Bounce-Handling und SLA-Telemetrie).
 */
export const emailBenachrichtigungLog = pgTable(
  'email_benachrichtigung_log',
  {
    id: idCol(),
    nutzerId: text('nutzer_id').references(() => nutzer.id, { onDelete: 'set null' }),
    email: text('email').notNull(),
    template: text('template').notNull(), // z.B. 'T-101 pruefrunde-neue-anmeldung'
    betreff: text('betreff').notNull(),
    status: text('status').$type<EmailStatus>().notNull(),
    resendId: text('resend_id'),
    fehlerMeldung: text('fehler_meldung'),
    erstelltAm: erstelltAm(),
  },
  (table) => ({
    nutzerIdx: index('email_log_nutzer_id_idx').on(table.nutzerId),
    erstelltIdx: index('email_log_erstellt_am_idx').on(table.erstelltAm),
  }),
);

export type EmailLog = typeof emailBenachrichtigungLog.$inferSelect;
