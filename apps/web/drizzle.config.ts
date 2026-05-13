import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './lib/db/schema/index.ts',
  out: './lib/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgresql://werkzirkel:werkzirkel_dev@localhost:5432/werkzirkel',
  },
  strict: true,
  verbose: true,
  casing: 'snake_case',
});
