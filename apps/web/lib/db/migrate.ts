/**
 * Migrations-Runner für `pnpm db:migrate`.
 * Wendet alle SQL-Migrationen aus lib/db/migrations/ auf die in DATABASE_URL
 * referenzierte Datenbank an. Idempotent.
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://werkzirkel:werkzirkel_dev@localhost:5432/werkzirkel';

const client = postgres(DATABASE_URL, { max: 1 });
const db = drizzle(client);

async function run() {
  console.log('▸ Wende Migrationen an gegen', DATABASE_URL.replace(/:[^:]*@/, ':***@'));
  await migrate(db, {
    migrationsFolder: path.resolve(__dirname, 'migrations'),
  });
  console.log('✓ Migrationen erfolgreich.');
  await client.end();
}

run().catch((err) => {
  console.error('✗ Migration fehlgeschlagen:', err);
  process.exit(1);
});
