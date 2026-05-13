/**
 * Einmal-Cleanup-Skript: entfernt Test-Reste aus der Dev-DB.
 *
 * Loescht:
 *  - `nutzer` deren E-Mail einem der Test-Pattern entspricht (CASCADE
 *    raeumt Werke/Bedarfe/Werkangebote/Sessions/etc. mit weg)
 *  - `magic_link_token`-Rows mit denselben Pattern
 *  - `email_benachrichtigung_log`-Rows mit denselben Pattern
 *
 * Geschuetzte Seed-Konten (NICHT loeschen):
 *  - admin@werkzirkel.de
 *  - hamburg@werkzirkel.de
 *
 * Sicherheit: bricht mit Fehler ab, wenn NODE_ENV=production gesetzt ist.
 * Aufruf: `pnpm db:cleanup-test`
 *
 * Liest DATABASE_URL direkt aus process.env (analog zu `seed.ts` und
 * `migrate.ts`), damit kein zwingender Import der App-Env-Validierung
 * noetig ist — sonst muesste man fuer dieses Wegwerf-Skript alle
 * App-Env-Variablen befuellen.
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import { and, like, notInArray, or } from 'drizzle-orm';
import postgres from 'postgres';
import fs from 'node:fs';
import path from 'node:path';

import * as schema from './schema';
import {
  emailBenachrichtigungLog,
  magicLinkToken,
  nutzer,
} from './schema';

const PATTERNS = [
  '%@test.local',
  'seed%@%',
  'cron-konto-loeschung@%',
  'test@example.com',
  '%@test.werkzirkel.de',
  'anmelden-action-test@%',
  'verify-next-test@%',
] as const;

const PROTECTED_EMAILS = ['admin@werkzirkel.de', 'hamburg@werkzirkel.de'];

/**
 * Minimaler .env-Loader (kein dotenv-Dependency) — gleiche Logik wie in
 * `vitest.config.ts`. .env liegt im Workspace-Root.
 */
function loadEnvFile(file: string): Record<string, string> {
  if (!fs.existsSync(file)) return {};
  const out: Record<string, string> = {};
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

async function run(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    console.error('✗ Abbruch: cleanup-test darf niemals in production laufen.');
    process.exit(1);
  }

  // .env aus Repo-Root nachladen, damit das Skript ohne `pnpm` -Wrapper
  // (z.B. direkt aufgerufen) trotzdem an DATABASE_URL kommt.
  const envFile = path.resolve(import.meta.dirname ?? '.', '../../../..', '.env');
  const fileEnv = loadEnvFile(envFile);
  for (const [k, v] of Object.entries(fileEnv)) {
    if (process.env[k] === undefined) process.env[k] = v;
  }

  const DATABASE_URL =
    process.env.DATABASE_URL ??
    'postgresql://werkzirkel:werkzirkel_dev@localhost:5432/werkzirkel';

  const client = postgres(DATABASE_URL, { max: 1 });
  const db = drizzle(client, { schema, casing: 'snake_case' });

  try {
    // OR-Verknuepfung aller Pattern: email LIKE p1 OR email LIKE p2 OR ...
    const nutzerEmailMatches = or(
      ...PATTERNS.map((p) => like(nutzer.email, p)),
    )!;
    const mltEmailMatches = or(
      ...PATTERNS.map((p) => like(magicLinkToken.email, p)),
    )!;
    const logEmailMatches = or(
      ...PATTERNS.map((p) => like(emailBenachrichtigungLog.email, p)),
    )!;

    // 1) Nutzer:innen loeschen — CASCADE klaert Werke/Bedarfe/Sessions etc.
    const deletedNutzer = await db
      .delete(nutzer)
      .where(and(nutzerEmailMatches, notInArray(nutzer.email, PROTECTED_EMAILS)))
      .returning({ id: nutzer.id, email: nutzer.email });

    // 2) Verwaiste magic-link-Tokens (Pattern-Match, falls Nutzer schon weg war).
    const deletedTokens = await db
      .delete(magicLinkToken)
      .where(mltEmailMatches)
      .returning({ id: magicLinkToken.id });

    // 3) Verwaiste E-Mail-Logs (Pattern-Match).
    const deletedLogs = await db
      .delete(emailBenachrichtigungLog)
      .where(logEmailMatches)
      .returning({ id: emailBenachrichtigungLog.id });

    console.log('✓ Cleanup abgeschlossen');
    console.log(`  - nutzer:                     ${deletedNutzer.length} geloescht`);
    console.log(`  - magic_link_token:           ${deletedTokens.length} geloescht`);
    console.log(`  - email_benachrichtigung_log: ${deletedLogs.length} geloescht`);
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  console.error('✗ Cleanup fehlgeschlagen:', err);
  process.exit(1);
});
