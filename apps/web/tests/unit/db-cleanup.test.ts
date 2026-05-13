/**
 * Tests fuer den Test-DB-Cleanup-Helper.
 *
 * Diese Tests laufen gegen die echte Test-DB (wie die Integration-Tests auch).
 * Wir liegen unter `tests/unit/` aus historischen Gruenden — der Helper wird
 * nicht von App-Code importiert, also passt "Unit" als Kategorie auf den
 * Helper als Black-Box.
 */

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { eq, like } from 'drizzle-orm';

import { db } from '@/lib/db';
import { nutzer } from '@/lib/db/schema/nutzer';
import { stadt } from '@/lib/db/schema/stadt';

import { deleteTestNutzer, truncateAll } from '../_helpers/db-cleanup';

const TEST_USERS = [
  { email: 'cleanup-test1@test.local', klarname: 'Test 1', anzeigename: 'T1' },
  {
    email: 'cleanup-seed1@test.werkzirkel.de',
    klarname: 'Seed 1',
    anzeigename: 'S1',
  },
  {
    email: 'cleanup-protected@werkzirkel.de',
    klarname: 'Protected',
    anzeigename: 'P',
  },
];

async function seedThree(): Promise<void> {
  for (const u of TEST_USERS) {
    await db
      .insert(nutzer)
      .values({
        email: u.email,
        klarname: u.klarname,
        anzeigename: u.anzeigename,
        stadtId: 'hh',
      })
      .onConflictDoNothing({ target: nutzer.email });
  }
}

async function removeOurTestUsers(): Promise<void> {
  // Aufraeumen unserer eigenen Test-Spuren — die Helper-Tests sollen die
  // restliche DB-Welt nicht beeinflussen.
  await db.delete(nutzer).where(like(nutzer.email, 'cleanup-%'));
}

describe('db-cleanup helper', () => {
  beforeEach(async () => {
    await removeOurTestUsers();
  });

  afterAll(async () => {
    await removeOurTestUsers();
  });

  it('deleteTestNutzer entfernt nur matchende Patterns', async () => {
    await seedThree();

    const deleted = await deleteTestNutzer('%@test.local');
    expect(deleted).toBe(1);

    const rest = await db
      .select({ email: nutzer.email })
      .from(nutzer)
      .where(like(nutzer.email, 'cleanup-%'));
    const emails = rest.map((r) => r.email).sort();
    expect(emails).toEqual([
      'cleanup-protected@werkzirkel.de',
      'cleanup-seed1@test.werkzirkel.de',
    ]);
  });

  it('deleteTestNutzer mit nicht-matchendem Pattern returnt 0', async () => {
    await seedThree();
    const deleted = await deleteTestNutzer('%@gibt-es-nicht.example');
    expect(deleted).toBe(0);
  });

  it('truncateAll leert nutzer und laesst stadt unangetastet', async () => {
    await seedThree();

    // Vorab: stadt hat (mindestens) drei Eintraege durch Seed (hh/b/m).
    const staedteVor = await db.select({ id: stadt.id }).from(stadt);
    expect(staedteVor.length).toBeGreaterThanOrEqual(3);

    await truncateAll();

    // Nutzer-Tabelle ist komplett leer — TRUNCATE haelt keine Ausnahmen.
    const nachherNutzer = await db.select({ id: nutzer.id }).from(nutzer);
    expect(nachherNutzer.length).toBe(0);

    // Stadt-Tabelle bleibt unveraendert.
    const staedteNach = await db.select({ id: stadt.id }).from(stadt);
    expect(staedteNach.length).toBe(staedteVor.length);
    const ids = staedteNach.map((s) => s.id).sort();
    expect(ids).toContain('hh');
    expect(ids).toContain('b');
    expect(ids).toContain('m');
  });

  it('truncateAll ist idempotent (zweimal in Folge funktioniert)', async () => {
    await truncateAll();
    await truncateAll();
    const rows = await db.select({ id: nutzer.id }).from(nutzer);
    expect(rows.length).toBe(0);
  });
});

describe('db schema bleibt nach truncateAll funktional', () => {
  it('INSERT nach truncate funktioniert (FK auf stadt intakt)', async () => {
    await truncateAll();
    await db.insert(nutzer).values({
      email: 'post-truncate@test.local',
      klarname: 'Post Truncate',
      anzeigename: 'PT',
      stadtId: 'hh',
    });
    const rows = await db
      .select()
      .from(nutzer)
      .where(eq(nutzer.email, 'post-truncate@test.local'));
    expect(rows.length).toBe(1);
    await db.delete(nutzer).where(eq(nutzer.email, 'post-truncate@test.local'));
  });
});
