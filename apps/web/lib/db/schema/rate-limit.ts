/**
 * Rate-Limit-Bucket — schlanke Postgres-backed Sliding-Window-Tabelle.
 *
 * Jeder rate-limited Treffer (Magic-Link-Versand, Konto-Loeschungs-Anforderung,
 * DSGVO-Export) erzeugt eine Zeile mit `key` (z.B. `email:foo@bar` oder
 * `ip:1.2.3.4`) + `endpoint` + `erstellt_am`. Der Check zaehlt Eintraege im
 * Fenster und entscheidet ueber 429.
 *
 * Cleanup: `magic-link-cleanup`-Cron loescht Eintraege aelter als 1 Tag mit.
 * PRD-Referenz: §16 (Rate-Limits 5 Magic-Links/E-Mail/Std, 30/IP/Std).
 */

import { pgTable, text, index } from 'drizzle-orm/pg-core';
import { idCol, erstelltAm } from './_helpers';

export const rateLimitBucket = pgTable(
  'rate_limit_bucket',
  {
    id: idCol(),
    key: text('key').notNull(),
    endpoint: text('endpoint').notNull(),
    erstelltAm: erstelltAm(),
  },
  (t) => ({
    keyEndpointIdx: index('rate_limit_key_endpoint_idx').on(
      t.key,
      t.endpoint,
      t.erstelltAm,
    ),
  }),
);

export type RateLimitBucket = typeof rateLimitBucket.$inferSelect;
