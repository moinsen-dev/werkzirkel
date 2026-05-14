/**
 * E2E Happy-Path: Macher:in.
 *
 * PRD §38 Pre-Launch-QA + §42 Sprint 14.
 *
 * Voller Flow waere: registrieren → werk anlegen → pruefrunde starten →
 * tester gibt feedback. Da die Auth ueber Magic-Link laeuft (kein Passwort,
 * Server-RAM-Token), muesste der Test die Mailbox inspizieren oder direkt in
 * die Test-DB greifen. Wir machen das hier in zwei Stufen:
 *
 * 1. Public-Smoke gegen die Macher-Landingpage + Anmelden-Flow-Start
 *    (registrieren-Button → Magic-Link-Anfrage gesendet → Erfolgs-Banner).
 * 2. Navigations-Smoke: /werke ist erreichbar (auch ohne Login zeigt sie die
 *    public Werke aus dem Seed). Sitemap und robots.txt sind erreichbar.
 *
 * Die tiefere Werk-Anlage + Pruefrunde laeuft als Vitest-Integration-Test
 * (siehe tests/integration/werk-anlegen.test.ts und feedback-abgabe.test.ts).
 * E2E kostet hier nichts dazu, weil die Bauteile dort schon abgedeckt sind —
 * E2E ist Sicherheits-Netz fuer Routing + JS-Bundle + Hydration.
 */

import { test, expect } from '@playwright/test';

test.describe('Happy-Path: Macher:in', () => {
  test('Landingpage rendert und fuehrt zum Anmelden-Flow', async ({ page }) => {
    await page.goto('/');

    // Hero-Headline ist sichtbar.
    await expect(page.locator('h1')).toBeVisible();

    // JSON-LD Organization-Schema ist eingebettet (PRD §31).
    const jsonLd = await page
      .locator('script[type="application/ld+json"]')
      .first()
      .textContent();
    expect(jsonLd).toContain('"@type": "Organization"');
    expect(jsonLd).toContain('Werkzirkel');

    // Skip-Link ist vorhanden (PRD §29 A11y).
    await expect(page.locator('a[href="#hauptinhalt"]').first()).toHaveCount(1);
  });

  test('Macher-Registrierung sendet Magic-Link', async ({ page }) => {
    await page.goto('/anmelden');

    // Formular ist da.
    await expect(page.locator('input#email')).toBeVisible();

    // Email eingeben + Registrierungs-Knopf.
    const email = `e2e-macher-${Date.now()}@werkzirkel-test.local`;
    await page.locator('input#email').fill(email);
    await page.locator('button[name="zweck"][value="registrierung"]').click();

    // Erfolg-Banner erscheint nach Submit (Server-Action redirect).
    await expect(page.locator('[role="status"]')).toBeVisible();
  });

  test('Werke-Uebersicht ist oeffentlich erreichbar', async ({ page }) => {
    const response = await page.goto('/werke');
    expect(response?.status()).toBeLessThan(400);
    await expect(page).toHaveTitle(/Werke|Werkzirkel/i);
  });

  test('sitemap.xml + robots.txt sind erreichbar (PRD §31)', async ({
    request,
  }) => {
    const sitemap = await request.get('/sitemap.xml');
    expect(sitemap.status()).toBe(200);
    expect(sitemap.headers()['content-type']).toContain('xml');

    const robots = await request.get('/robots.txt');
    expect(robots.status()).toBe(200);
    const robotsBody = await robots.text();
    expect(robotsBody).toContain('User-Agent');
    expect(robotsBody).toContain('Disallow: /api');
  });
});
