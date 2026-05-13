import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { env } from '../env';

/**
 * Globaler Postgres-Client.
 *
 * In Next.js werden Module pro Build initialisiert; in Dev kann HMR mehrfach
 * importieren. Wir hängen die Connection an `globalThis`, damit kein
 * Connection-Pool-Leak entsteht.
 */
declare global {
  // eslint-disable-next-line no-var
  var __werkzirkelDb: ReturnType<typeof postgres> | undefined;
}

const client =
  globalThis.__werkzirkelDb ??
  postgres(env.DATABASE_URL, {
    max: env.NODE_ENV === 'production' ? 10 : 3,
    prepare: false,
  });

if (env.NODE_ENV !== 'production') {
  globalThis.__werkzirkelDb = client;
}

export const db = drizzle(client, { schema, casing: 'snake_case' });
export type Db = typeof db;
export { schema };
