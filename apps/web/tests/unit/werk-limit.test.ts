/**
 * Tests fuer die Werk-Limit-Logik.
 *
 * Verwendet die echte DB (kein Mock) und testet:
 * - 5 Werke ohne Foerdermitgliedschaft erlaubt, 6. blockiert.
 * - Foerdermitgliedschaft 'aktiv' hebt das Limit auf.
 * - Foerdermitgliedschaft 'gekuendigt' hebt das Limit NICHT auf.
 *
 * Liegt unter `tests/unit/` aus historischen Gruenden, ist aber technisch
 * eine Integration-Test (faehrt gegen Postgres). Wir verschieben das nicht,
 * weil die Task-Spec den Pfad festlegt.
 */

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createId } from '@paralleldrive/cuid2';

import { db } from '@/lib/db';
import { foerdermitgliedschaft, nutzer, werk } from '@/lib/db/schema';
import { pruefeWerkAnlegenLimit, MAX_WERKE_FREI } from '@/lib/werk/limit';
import { truncateAll } from '../_helpers/db-cleanup';

async function macherAnlegen(email: string): Promise<string> {
  const id = createId();
  await db.insert(nutzer).values({
    id,
    email,
    klarname: 'Limit Tester',
    anzeigename: `limit-${id.slice(0, 6)}`,
    stadtId: 'hh',
    rollen: ['macher'],
    emailVerifiziertAm: new Date(),
  });
  return id;
}

async function werkAnlegen(nutzerId: string, suffix: number): Promise<void> {
  await db.insert(werk).values({
    nutzerId,
    name: `Werk ${suffix}`,
    kurzbeschreibung: `Beschreibung ${suffix}`,
    problem: 'Problem.',
    zielgruppe: 'Zielgruppe.',
    werkstand: 'idee',
    hilfebedarf: [],
  });
}

describe('pruefeWerkAnlegenLimit', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  it('erlaubt das erste Werk', async () => {
    const id = await macherAnlegen('limit-1@test.werkzirkel.de');
    const r = await pruefeWerkAnlegenLimit(id);
    expect(r.erlaubt).toBe(true);
    expect(r.anzahlBestehend).toBe(0);
    expect(r.foerdermitgliedAktiv).toBe(false);
  });

  it('blockiert das 6. Werk ohne Foerdermitgliedschaft', async () => {
    const id = await macherAnlegen('limit-2@test.werkzirkel.de');
    for (let i = 1; i <= MAX_WERKE_FREI; i++) {
      await werkAnlegen(id, i);
    }
    const r = await pruefeWerkAnlegenLimit(id);
    expect(r.erlaubt).toBe(false);
    expect(r.anzahlBestehend).toBe(5);
    expect(r.foerdermitgliedAktiv).toBe(false);
  });

  it('erlaubt das 6. Werk mit aktiver Foerdermitgliedschaft (monatlich)', async () => {
    const id = await macherAnlegen('limit-3@test.werkzirkel.de');
    for (let i = 1; i <= MAX_WERKE_FREI; i++) {
      await werkAnlegen(id, i);
    }
    await db.insert(foerdermitgliedschaft).values({
      nutzerId: id,
      stufe: 'monatlich',
      stripeCustomerId: 'cus_test',
      beginn: new Date(),
      status: 'aktiv',
    });
    const r = await pruefeWerkAnlegenLimit(id);
    expect(r.erlaubt).toBe(true);
    expect(r.foerdermitgliedAktiv).toBe(true);
  });

  it('erlaubt das 6. Werk mit aktiver Foerdermitgliedschaft (jaehrlich)', async () => {
    const id = await macherAnlegen('limit-4@test.werkzirkel.de');
    for (let i = 1; i <= MAX_WERKE_FREI; i++) {
      await werkAnlegen(id, i);
    }
    await db.insert(foerdermitgliedschaft).values({
      nutzerId: id,
      stufe: 'jaehrlich',
      stripeCustomerId: 'cus_test_j',
      beginn: new Date(),
      status: 'aktiv',
    });
    const r = await pruefeWerkAnlegenLimit(id);
    expect(r.erlaubt).toBe(true);
  });

  it('blockiert das 6. Werk wenn Foerdermitgliedschaft gekuendigt', async () => {
    const id = await macherAnlegen('limit-5@test.werkzirkel.de');
    for (let i = 1; i <= MAX_WERKE_FREI; i++) {
      await werkAnlegen(id, i);
    }
    await db.insert(foerdermitgliedschaft).values({
      nutzerId: id,
      stufe: 'monatlich',
      stripeCustomerId: 'cus_test_g',
      beginn: new Date(),
      status: 'gekuendigt',
    });
    const r = await pruefeWerkAnlegenLimit(id);
    expect(r.erlaubt).toBe(false);
    expect(r.foerdermitgliedAktiv).toBe(false);
  });
});
