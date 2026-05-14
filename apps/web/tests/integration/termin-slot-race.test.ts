/**
 * Slot-Race-Test fuer Termin-Anmeldung.
 *
 * Seed Termin mit max_teilnehmer=2 + 4 Test-Nutzer:innen mit eigenen Sessions.
 * 4 parallele POSTs (Promise.all). Erwartung: genau 2 mit status='angemeldet',
 * 2 mit status='warteliste'.
 *
 * Verifiziert: FOR UPDATE-Lock auf termin-Row + Slot-COUNT in derselben
 * Transaktion verhindert Race-Conditions.
 *
 * PRD §F-402, §F-404.
 */

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createId } from '@paralleldrive/cuid2';
import { and, eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import {
  nutzer,
  session as sessionTable,
  termin,
  terminAnmeldung,
} from '@/lib/db/schema';
import { env } from '@/lib/env';
import { buildSessionCookie } from '@/lib/auth/session';

import { POST as anmeldungPost } from '@/app/api/v1/termine/[id]/anmeldung/route';

import { truncateAll } from '../_helpers/db-cleanup';

const APP_ORIGIN = new URL(env.APP_URL).origin;

function buildRequest(opts: { sessionId: string; tId: string }): Request {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    origin: APP_ORIGIN,
    'x-forwarded-for': '127.0.0.1',
    cookie: buildSessionCookie(opts.sessionId).split(';')[0]!,
  };
  return new Request(
    `${APP_ORIGIN}/api/v1/termine/${opts.tId}/anmeldung`,
    {
      method: 'POST',
      headers,
    },
  );
}

describe('POST /api/v1/termine/:id/anmeldung (Slot-Race)', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  it('4 parallele POSTs auf 2-Slot-Termin → 2 angemeldet, 2 warteliste', async () => {
    const kuratorId = createId();
    await db.insert(nutzer).values({
      id: kuratorId,
      email: 'race-kur@test.werkzirkel.de',
      klarname: 'Race Kurator',
      anzeigename: 'race-kur',
      stadtId: 'hh',
      rollen: ['kurator'],
      emailVerifiziertAm: new Date(),
    });
    const tId = createId();
    await db.insert(termin).values({
      id: tId,
      stadtId: 'hh',
      typ: 'schauabend',
      titel: 'Race-Schauabend',
      beschreibung: 'Stress-Test.',
      ortText: 'Werkstatt',
      datumUhrzeit: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      maxTeilnehmer: 2,
      erstelltVon: kuratorId,
      status: 'veroeffentlicht',
    });

    // 4 Teilnehmer:innen + eigene Sessions.
    const teilnehmer: Array<{ id: string; sid: string }> = [];
    for (let i = 0; i < 4; i += 1) {
      const id = createId();
      await db.insert(nutzer).values({
        id,
        email: `race-t-${i}@test.werkzirkel.de`,
        klarname: `Race T ${i}`,
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
      teilnehmer.push({ id, sid });
    }

    const responses = await Promise.all(
      teilnehmer.map((t) =>
        anmeldungPost(
          buildRequest({ sessionId: t.sid, tId }),
          { params: Promise.resolve({ id: tId }) },
        ),
      ),
    );

    // Alle 4 muessen 201 zurueckgeben.
    const statuse = responses.map((r) => r.status);
    expect(statuse.every((s) => s === 201)).toBe(true);

    const bodies = await Promise.all(
      responses.map((r) => r.clone().json() as Promise<{ status: string }>),
    );
    const slotStati = bodies.map((b) => b.status).sort();
    expect(slotStati).toEqual([
      'angemeldet',
      'angemeldet',
      'warteliste',
      'warteliste',
    ]);

    // DB-Assertion: 2x angemeldet, 2x warteliste.
    const angemeldete = await db
      .select()
      .from(terminAnmeldung)
      .where(
        and(
          eq(terminAnmeldung.terminId, tId),
          eq(terminAnmeldung.status, 'angemeldet'),
        ),
      );
    expect(angemeldete.length).toBe(2);
    const wartende = await db
      .select()
      .from(terminAnmeldung)
      .where(
        and(
          eq(terminAnmeldung.terminId, tId),
          eq(terminAnmeldung.status, 'warteliste'),
        ),
      );
    expect(wartende.length).toBe(2);
  });
});
