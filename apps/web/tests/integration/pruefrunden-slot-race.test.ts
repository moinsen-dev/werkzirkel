/**
 * Slot-Race-Test: 5 parallele Anmeldungen auf eine Pruefrunde mit
 * gesuchte_tester=3. Genau 3 muessen erfolgreich anlegen, 2 mit
 * 422 'pruefrunde_voll' abgewiesen werden. DB-COUNT bestaetigt am Ende
 * exakt 3 Rows mit status='angemeldet'.
 *
 * Verifiziert: FOR UPDATE-Sperre + Slot-COUNT in derselben Transaktion
 * verhindert Race-Conditions beim parallelen INSERT.
 *
 * PRD §F-203, §8.4 (Slot-System), Acceptance-Criterion:
 *   'Slot-Limit via Race-safe SQL FOR UPDATE durchgesetzt (Unit-Test mit
 *    5 parallelen Calls auf 3-Slot-Pruefrunde verifiziert: genau 3
 *    success, 2 422)'.
 */

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createId } from '@paralleldrive/cuid2';
import { and, eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import {
  nutzer,
  pruefrunde,
  pruefrundenAnmeldung,
  session as sessionTable,
  werk,
} from '@/lib/db/schema';
import { env } from '@/lib/env';
import { buildSessionCookie } from '@/lib/auth/session';

import { POST as anmeldungPost } from '@/app/api/v1/pruefrunden/[id]/anmeldung/route';

import { truncateAll } from '../_helpers/db-cleanup';

const APP_ORIGIN = new URL(env.APP_URL).origin;

function buildRequest(opts: { sessionId: string; prId: string }): Request {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    origin: APP_ORIGIN,
    'x-forwarded-for': '127.0.0.1',
    cookie: buildSessionCookie(opts.sessionId).split(';')[0]!,
  };
  return new Request(
    `${APP_ORIGIN}/api/v1/pruefrunden/${opts.prId}/anmeldung`,
    {
      method: 'POST',
      headers,
    },
  );
}

describe('POST /api/v1/pruefrunden/:id/anmeldung (Slot-Race)', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  it('5 parallele Anmeldungen auf 3-Slot-Pruefrunde → genau 3x 201, 2x 422', async () => {
    // Inhaber:in + Werk + Pruefrunde mit gesuchte_tester=3 + status='oeffentlich'.
    const inhaberId = createId();
    await db.insert(nutzer).values({
      id: inhaberId,
      email: 'race-inhaber@test.werkzirkel.de',
      klarname: 'Race Inhaber',
      anzeigename: 'race-inhaber',
      stadtId: 'hh',
      rollen: ['macher'],
      emailVerifiziertAm: new Date(),
    });
    const werkId = createId();
    await db.insert(werk).values({
      id: werkId,
      nutzerId: inhaberId,
      name: 'Race-Werk',
      kurzbeschreibung: 'kb',
      problem: 'problem',
      zielgruppe: 'zg',
      werkstand: 'idee',
    });
    const prId = createId();
    await db.insert(pruefrunde).values({
      id: prId,
      werkId,
      titel: 'Race-Pruefrunde',
      testziel: 'tz',
      testaufgabe: 'ta',
      zielgruppe: 'zg',
      zeitbedarfMinuten: 30,
      gesuchteTester: 3,
      feedbackKategorien: ['erster_eindruck'],
      frist: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      status: 'oeffentlich',
    });

    // 5 Tester:innen + eigene Sessions anlegen.
    const tester: Array<{ id: string; sid: string }> = [];
    for (let i = 0; i < 5; i += 1) {
      const id = createId();
      await db.insert(nutzer).values({
        id,
        email: `race-tester-${i}@test.werkzirkel.de`,
        klarname: `Race Tester ${i}`,
        anzeigename: `race-t-${i}`,
        stadtId: 'hh',
        rollen: ['macher'],
        emailVerifiziertAm: new Date(),
      });
      const sid = createId();
      await db.insert(sessionTable).values({
        id: sid,
        nutzerId: id,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      });
      tester.push({ id, sid });
    }

    // 5 parallele POST-Calls. JEDER hat seine eigene Session (=eigenen Tester),
    // sodass UNIQUE(pruefrunde_id, tester_id) keinen abfaengt — die Race-Schutz-
    // Logik muss ueber den Slot-COUNT in der Transaktion entscheiden.
    const responses = await Promise.all(
      tester.map((t) =>
        anmeldungPost(
          buildRequest({ sessionId: t.sid, prId }),
          { params: Promise.resolve({ id: prId }) },
        ),
      ),
    );

    const status = responses.map((r) => r.status).sort();
    const bodies = await Promise.all(
      responses.map((r) => r.clone().json() as Promise<unknown>),
    );

    // Genau 3x 201, 2x 422.
    const success = status.filter((s) => s === 201).length;
    const conflict = status.filter((s) => s === 422).length;
    expect(success).toBe(3);
    expect(conflict).toBe(2);

    // Die 422er muessen alle 'pruefrunde_voll' sein (nicht z.B. eigenes_werk).
    const conflictCodes = bodies
      .filter((_, idx) => responses[idx]!.status === 422)
      .map((b) => (b as { error: { code: string } }).error.code);
    expect(conflictCodes).toEqual(['pruefrunde_voll', 'pruefrunde_voll']);

    // DB-Assertion: Genau 3 Anmeldungen mit status='angemeldet'.
    const rows = await db
      .select()
      .from(pruefrundenAnmeldung)
      .where(
        and(
          eq(pruefrundenAnmeldung.pruefrundeId, prId),
          eq(pruefrundenAnmeldung.status, 'angemeldet'),
        ),
      );
    expect(rows.length).toBe(3);
  });
});
