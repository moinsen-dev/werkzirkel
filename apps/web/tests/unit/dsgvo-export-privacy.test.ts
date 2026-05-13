/**
 * Unit-Tests fuer den Privacy-Cross-Cut im DSGVO-Export.
 *
 * Schluessel-Annahme: Wenn Nutzer:in T (Tester) Feedback zu einem fremden Werk
 * gegeben hat (das Werk gehoert Nutzer:in O), dann darf der Export von T NICHT
 * die Identitaet von O leaken (keine Email, kein Klarname, kein Anzeigename,
 * auch nicht versteckt unter einem anderen Schluessel).
 *
 * Wir brauchen die echte Node-Web-API (Cookie-Header in `Request`), daher:
 * @vitest-environment node
 */

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createId } from '@paralleldrive/cuid2';
import { eq, inArray } from 'drizzle-orm';

import { db } from '@/lib/db';
import {
  feedback,
  nutzer,
  pruefrunde,
  rateLimitBucket,
  session as sessionTable,
  werk,
} from '@/lib/db/schema';

import { GET as exportGet } from '@/app/api/v1/me/export/route';
import { buildSessionCookie } from '@/lib/auth/session';

const TESTER_EMAIL = 'unit-tester@test.werkzirkel.de';
const OWNER_EMAIL = 'unit-owner@test.werkzirkel.de';
const OWNER_KLARNAME = 'Olivia Werkinhaberin';
const OWNER_ANZEIGENAME = 'olivia';

async function cleanup(): Promise<void> {
  // Reihenfolge: feedback → pruefrunde → werk → session → nutzer.
  // Wir loeschen ueber unsere Test-Mails, um andere Tests nicht zu stoeren.
  const testNutzer = await db
    .select({ id: nutzer.id })
    .from(nutzer)
    .where(inArray(nutzer.email, [TESTER_EMAIL, OWNER_EMAIL]));
  const ids = testNutzer.map((n) => n.id);
  if (ids.length > 0) {
    await db.delete(rateLimitBucket);
    await db.delete(sessionTable).where(inArray(sessionTable.nutzerId, ids));
    // feedback/pruefrunde/werk werden per ON DELETE CASCADE entfernt.
    await db.delete(nutzer).where(inArray(nutzer.id, ids));
  }
}

async function seedScenario(): Promise<{
  testerId: string;
  ownerId: string;
  werkId: string;
}> {
  const ownerId = createId();
  const testerId = createId();

  await db.insert(nutzer).values([
    {
      id: ownerId,
      email: OWNER_EMAIL,
      klarname: OWNER_KLARNAME,
      anzeigename: OWNER_ANZEIGENAME,
      stadtId: 'hh',
      rollen: ['macher'],
      emailVerifiziertAm: new Date(),
    },
    {
      id: testerId,
      email: TESTER_EMAIL,
      klarname: 'Tilda Testerin',
      anzeigename: 'tilda',
      stadtId: 'hh',
      rollen: ['macher'],
      emailVerifiziertAm: new Date(),
    },
  ]);

  const werkId = createId();
  await db.insert(werk).values({
    id: werkId,
    nutzerId: ownerId,
    name: 'Olivias Test-Werk',
    kurzbeschreibung: 'Eine kurze Beschreibung.',
    problem: 'Ein Problem.',
    zielgruppe: 'Eine Zielgruppe.',
    werkstand: 'prototyp',
  });

  const pruefrundeId = createId();
  await db.insert(pruefrunde).values({
    id: pruefrundeId,
    werkId,
    titel: 'Olivias erste Pruefrunde',
    testziel: 'Funktioniert die Onboarding-Strecke?',
    testaufgabe: 'Logge dich ein und finde X.',
    zielgruppe: 'Power-User',
    zeitbedarfMinuten: 20,
    gesuchteTester: 5,
    feedbackKategorien: ['erster_eindruck', 'bedienbarkeit'],
    frist: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    status: 'oeffentlich',
  });

  await db.insert(feedback).values({
    pruefrundeId,
    testerId,
    gesamteindruck: 'Solides Onboarding, ein paar Hopser.',
    ersterEindruck: 'Klar.',
    bedienbarkeit: 'Drei Klicks zu viel.',
  });

  return { testerId, ownerId, werkId };
}

async function createSessionRow(nutzerId: string): Promise<string> {
  const id = createId();
  await db.insert(sessionTable).values({
    id,
    nutzerId,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    userAgent: 'test',
    ipAdresse: '127.0.0.1',
  });
  return id;
}

function exportRequest(sessionId: string): Request {
  return new Request('http://localhost:3210/api/v1/me/export', {
    method: 'GET',
    headers: {
      cookie: buildSessionCookie(sessionId).split(';')[0]!,
      'x-forwarded-for': '127.0.0.1',
    },
  });
}

describe('DSGVO-Export Privacy-Cross-Cut', () => {
  beforeEach(async () => {
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
  });

  it('liefert werk_titel im pruefrunden_gegebene-Block', async () => {
    const { testerId } = await seedScenario();
    const sessId = await createSessionRow(testerId);

    const res = await exportGet(exportRequest(sessId));
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      pruefrunden_gegebene: Array<Record<string, unknown>>;
    };

    expect(Array.isArray(data.pruefrunden_gegebene)).toBe(true);
    expect(data.pruefrunden_gegebene.length).toBe(1);
    expect(data.pruefrunden_gegebene[0]!.werk_titel).toBe('Olivias Test-Werk');
  });

  it('leakt NIRGENDS im Export die Identitaet des Werk-Inhabers', async () => {
    const { testerId } = await seedScenario();
    const sessId = await createSessionRow(testerId);

    const res = await exportGet(exportRequest(sessId));
    expect(res.status).toBe(200);
    const raw = await res.text();

    // Brute-force-Check: keine der Identitaets-Strings darf irgendwo im
    // serialisierten Dump auftauchen.
    expect(raw).not.toContain(OWNER_EMAIL);
    expect(raw).not.toContain(OWNER_KLARNAME);
    expect(raw).not.toContain(OWNER_ANZEIGENAME);
  });

  it('pruefrunden_gegebene[0] enthaelt KEIN werk_inhaber-Feld', async () => {
    const { testerId } = await seedScenario();
    const sessId = await createSessionRow(testerId);

    const res = await exportGet(exportRequest(sessId));
    const data = (await res.json()) as {
      pruefrunden_gegebene: Array<Record<string, unknown>>;
    };
    const entry = data.pruefrunden_gegebene[0]!;

    // Keine versteckten Inhaber-Felder.
    expect(entry.werk_inhaber).toBeUndefined();
    expect(entry.werk_inhaber_id).toBeUndefined();
    expect(entry.werk_inhaber_email).toBeUndefined();
    expect(entry.werk_inhaber_klarname).toBeUndefined();
    expect(entry.werk_inhaber_anzeigename).toBeUndefined();
    expect(entry.nutzerId).toBeUndefined();
    expect(entry.nutzer_id).toBeUndefined();
  });
});

describe('DSGVO-Export Tester-Anonymisierung in feedbacks_erhalten', () => {
  beforeEach(async () => {
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
  });

  it('feedbacks_erhalten ersetzt die testerId durch null', async () => {
    const { ownerId } = await seedScenario();
    const sessId = await createSessionRow(ownerId);

    const res = await exportGet(exportRequest(sessId));
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      pruefrunden_eigene: Array<{ feedbacks_erhalten: Array<Record<string, unknown>> }>;
    };

    expect(data.pruefrunden_eigene.length).toBe(1);
    const erhalten = data.pruefrunden_eigene[0]!.feedbacks_erhalten;
    expect(erhalten.length).toBe(1);
    expect(erhalten[0]!.testerId).toBeNull();
  });
});
