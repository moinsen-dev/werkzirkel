/**
 * Integration-Tests fuer GET /api/v1/termine/:id/ical.
 *
 * Deckt PRD §8.8 (iCal-Export pro Termin) + §15.8:
 *  - 'veroeffentlicht' → 200, Content-Type text/calendar, Content-Disposition attachment.
 *  - 'durchgefuehrt' → 200.
 *  - 'abgesagt' → 200 (STATUS:CANCELLED im .ics, damit Kalender Updates uebernehmen).
 *  - 'geplant' → 404 (nicht oeffentlich).
 *  - nicht-existente ID → 404.
 *  - Response-Body enthaelt BEGIN:VCALENDAR.
 */

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createId } from '@paralleldrive/cuid2';

import { db } from '@/lib/db';
import { nutzer, termin } from '@/lib/db/schema';
import type { TerminStatus } from '@/lib/db/schema/enums';

import { GET as icalGet } from '@/app/api/v1/termine/[id]/ical/route';

import { truncateAll } from '../_helpers/db-cleanup';

async function kuratorAnlegen(): Promise<string> {
  const id = createId();
  await db.insert(nutzer).values({
    id,
    email: `ical-kur-${id.slice(0, 6)}@test.werkzirkel.de`,
    klarname: `Klar ${id}`,
    anzeigename: `anz-${id.slice(0, 6)}`,
    stadtId: 'hh',
    rollen: ['kurator'],
    emailVerifiziertAm: new Date(),
  });
  return id;
}

async function terminAnlegen(opts: {
  erstelltVon: string;
  status: TerminStatus;
  typ?: string;
  titel?: string;
  ortText?: string | null;
  onlineLink?: string | null;
  datumUhrzeit?: Date;
}): Promise<string> {
  const id = createId();
  await db.insert(termin).values({
    id,
    stadtId: 'hh',
    typ: (opts.typ ?? 'schauabend') as 'schauabend',
    titel: opts.titel ?? 'Schauabend Mai',
    beschreibung: 'Drei Werke stellen sich vor.',
    ortText: opts.ortText === undefined ? 'Werkstatt St. Pauli' : opts.ortText,
    onlineLink: opts.onlineLink ?? null,
    datumUhrzeit: opts.datumUhrzeit ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    maxTeilnehmer: 20,
    erstelltVon: opts.erstelltVon,
    status: opts.status,
  });
  return id;
}

function buildRequest(id: string): Request {
  return new Request(`http://localhost/api/v1/termine/${id}/ical`, {
    method: 'GET',
  });
}

function ctxFor(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

describe('GET /api/v1/termine/:id/ical', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  it('veroeffentlichter Termin → 200 mit text/calendar + attachment', async () => {
    const kurId = await kuratorAnlegen();
    const tId = await terminAnlegen({
      erstelltVon: kurId,
      status: 'veroeffentlicht',
      typ: 'schauabend',
    });

    const res = await icalGet(buildRequest(tId), ctxFor(tId));
    expect(res.status).toBe(200);

    const contentType = res.headers.get('content-type') ?? '';
    expect(contentType).toContain('text/calendar');
    expect(contentType).toContain('charset=utf-8');

    const disposition = res.headers.get('content-disposition') ?? '';
    expect(disposition).toContain('attachment');
    expect(disposition).toContain(`werkzirkel-schauabend-${tId}.ics`);

    const body = await res.text();
    expect(body).toContain('BEGIN:VCALENDAR');
    expect(body).toContain('END:VCALENDAR');
    expect(body).toContain('STATUS:CONFIRMED');
  });

  it("durchgefuehrter Termin → 200", async () => {
    const kurId = await kuratorAnlegen();
    const tId = await terminAnlegen({
      erstelltVon: kurId,
      status: 'durchgefuehrt',
      datumUhrzeit: new Date(Date.now() - 24 * 60 * 60 * 1000),
    });

    const res = await icalGet(buildRequest(tId), ctxFor(tId));
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('STATUS:CONFIRMED');
  });

  it("abgesagter Termin → 200 mit STATUS:CANCELLED", async () => {
    const kurId = await kuratorAnlegen();
    const tId = await terminAnlegen({
      erstelltVon: kurId,
      status: 'abgesagt',
    });

    const res = await icalGet(buildRequest(tId), ctxFor(tId));
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('STATUS:CANCELLED');
  });

  it("'geplant'-Termin → 404 (nicht oeffentlich)", async () => {
    const kurId = await kuratorAnlegen();
    const tId = await terminAnlegen({
      erstelltVon: kurId,
      status: 'geplant',
    });

    const res = await icalGet(buildRequest(tId), ctxFor(tId));
    expect(res.status).toBe(404);
  });

  it('nicht-existente ID → 404', async () => {
    const fakeId = createId();
    const res = await icalGet(buildRequest(fakeId), ctxFor(fakeId));
    expect(res.status).toBe(404);
  });

  it('Body enthaelt VTIMEZONE Europe/Berlin und VEVENT', async () => {
    const kurId = await kuratorAnlegen();
    const tId = await terminAnlegen({
      erstelltVon: kurId,
      status: 'veroeffentlicht',
    });

    const res = await icalGet(buildRequest(tId), ctxFor(tId));
    const body = await res.text();
    expect(body).toContain('BEGIN:VTIMEZONE');
    expect(body).toContain('TZID:Europe/Berlin');
    expect(body).toContain('BEGIN:VEVENT');
    expect(body).toContain(`UID:termin-${tId}@werkzirkel.de`);
  });
});
