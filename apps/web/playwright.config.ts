/**
 * Playwright-Konfiguration fuer Werkzirkel-E2E-Tests.
 *
 * PRD §38 (Pre-Launch-QA) + §42 Sprint 14: 3 Happy-Paths gegen die laufende
 * Anwendung (Macher, Bedarfstraeger, Foerderer).
 *
 * Lokale Ausfuehrung:
 *   pnpm --filter @werkzirkel/web exec playwright install chromium
 *   pnpm --filter @werkzirkel/web exec playwright test
 *
 * Voraussetzung lokal:
 *   - Postgres laeuft mit DATABASE_URL aus ../../.env
 *   - `pnpm db:migrate` + `pnpm db:seed` wurden gelaufen
 *   - `pnpm dev` laeuft auf Port 3210
 *
 * In CI uebernimmt `.github/workflows/e2e.yml` das Aufsetzen.
 */

import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PORT ?? 3210);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Lokal: dev-Server starten falls noch nicht oben. In CI startet der Workflow
  // den Server selbst und wir setzen PLAYWRIGHT_BASE_URL.
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: 'pnpm dev',
        url: `http://localhost:${PORT}`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        stdout: 'ignore',
        stderr: 'pipe',
      },
});
