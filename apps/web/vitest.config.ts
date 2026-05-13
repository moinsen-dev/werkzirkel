import { defineConfig } from 'vitest/config';
import path from 'node:path';
import fs from 'node:fs';

// .env liegt im Workspace-Root (../../.env), nicht in apps/web — daher
// explizit aus dem Repo-Root laden, damit Tests DATABASE_URL etc. sehen.
// Minimaler Parser (kein dotenv-Dependency), reicht fuer KEY=VALUE-Zeilen.
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
const env = loadEnvFile(path.resolve(__dirname, '../..', '.env'));

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['tests/**/*.test.{ts,tsx}'],
    env,
    // Integration-Tests stossen Route-Handler direkt an und brauchen das echte
    // Node-Web-API (insb. `Request` mit `Origin`-Header). Happy-DOM uebersteuert
    // sonst die Header-Behandlung.
    environmentMatchGlobs: [['tests/integration/**', 'node']],
    // Integration-Tests teilen sich EINE Postgres-Test-DB. Manche Suiten
    // raeumen global (z.B. `auth-magic-link.test.ts` macht `delete from
    // magic_link_token` ohne Email-Filter) und wuerden bei paralleler
    // Ausfuehrung Token anderer Suiten loeschen. Wir deaktivieren daher die
    // Datei-parallele Ausfuehrung — Stabilitaet vor Geschwindigkeit.
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['lib/**/*.{ts,tsx}', 'app/**/*.{ts,tsx}'],
      exclude: ['**/*.test.{ts,tsx}', '**/migrations/**'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
