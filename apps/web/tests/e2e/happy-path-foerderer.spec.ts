/**
 * E2E Happy-Path: Foerderer:in.
 *
 * PRD §38 Pre-Launch-QA + §42 Sprint 14.
 *
 * Voller Flow waere: registrieren → foerderprofil anlegen → kurator
 * verifizieren → bedarfsschau-anwesenheit. Hier der Public-Surface-Teil:
 *
 * 1. /foerdern Landingpage rendert.
 * 2. Foerder-Registrierung loest Magic-Link aus.
 * 3. /foerderprofile (oeffentliche Liste) ist erreichbar.
 * 4. /termine (Bedarfsschau-Liste) ist erreichbar.
 *
 * Die DB-getriebenen Schritte (foerderprofil anlegen, kurator
 * verifizieren, bedarfsschau-anwesenheit) liegen als Vitest-Integration-Tests
 * vor — siehe tests/integration/foerderprofil-*.test.ts und
 * tests/integration/bedarfsschau-termin.test.ts.
 */

import { test, expect } from '@playwright/test';

test.describe('Happy-Path: Foerderer:in', () => {
  test('Foerder-Landingpage rendert vollstaendig', async ({ page }) => {
    await page.goto('/foerdern');

    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('form')).toBeVisible();
  });

  test('Foerder-Registrierung sendet Magic-Link', async ({ page }) => {
    await page.goto('/anmelden');

    const email = `e2e-foerder-${Date.now()}@werkzirkel-test.local`;
    await page.locator('input#email').fill(email);
    await page
      .locator('button[name="zweck"][value="registrierung-foerder"]')
      .click();

    await expect(page.locator('[role="status"]')).toBeVisible();
  });

  test('Oeffentliche Foerderprofile-Liste ist erreichbar', async ({ page }) => {
    const response = await page.goto('/foerderprofile');
    expect(response?.status()).toBeLessThan(400);
  });

  test('Termine /termine (Bedarfsschau) sind oeffentlich erreichbar', async ({
    page,
  }) => {
    const response = await page.goto('/termine');
    expect(response?.status()).toBeLessThan(400);
  });
});
