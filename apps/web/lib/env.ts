/**
 * Typsichere Env-Variablen mit Zod-Validierung.
 * Beim App-Start wird einmal geparst — wirft, wenn Pflichtfelder fehlen.
 */

import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_URL: z.string().url().default('http://localhost:3210'),

  DATABASE_URL: z.string().url(),

  BETTER_AUTH_SECRET: z.string().min(32).optional(),
  BETTER_AUTH_URL: z.string().url().optional(),

  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),

  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().default('werkzirkel-public'),
  R2_PUBLIC_URL: z.string().url().optional(),

  CRON_SECRET: z.string().optional(),
  SENTRY_DSN: z.string().optional(),

  SEED_ADMIN_EMAIL: z.string().email().default('admin@werkzirkel.de'),
  SEED_KURATOR_HH_EMAIL: z.string().email().default('hamburg@werkzirkel.de'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Ungültige Umgebungsvariablen:', parsed.error.flatten().fieldErrors);
  throw new Error('Umgebungsvariablen-Validierung fehlgeschlagen.');
}

export const env = parsed.data;
export type Env = typeof env;
