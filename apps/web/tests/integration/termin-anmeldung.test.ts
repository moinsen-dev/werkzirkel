/**
 * Integration-Tests fuer die Termin-Anmeldung-API.
 *
 * Deckt PRD §F-402, §F-404, §15.8:
 *  - POST: Anmeldung mit Slot- und Warteliste-Logik (T-401 Mock-Log)
 *  - POST: nur veroeffentlichte Termine, nur zukuenftige Termine
 *  - POST: Doppel-Anmeldung idempotent (oder reaktiviert nach Storno)
 *  - DELETE: storniert + zieht aelteste Warteliste-Person hoch (T-401)
 *  - GET: Kurator:in sieht Liste, fremder Nutzer 403
 *
 * Methode: Route-Handler direkt importieren, synthetische Request-Objekte.
 */

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createId } from '@paralleldrive/cuid2';
import { and, eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import {
  emailBenachrichtigungLog,
  nutzer,
  session as sessionTable,
  termin,
  terminAnmeldung,
} from '@/lib/db/schema';
import { env } from '@/lib/env';
import { buildSessionCookie } from '@/lib/auth/session';

import {
  POST as anmeldungPost,
  DELETE as anmeldungDelete,
} from '@/app/api/v1/termine/[id]/anmeldung/route';
import { GET as anmeldungenGet } from '@/app/api/v1/termine/[id]/anmeldungen/route';

import { truncateAll } from '../_helpers/db-cleanup';

const APP_ORIGIN = new URL(env.APP_URL).origin;

async function userAnlegen(opts: {
  email: string;
  stadtId?: string;
  anzeigename?: string;
  rollen?: Array<'macher' | 'bedarfstraeger' | 'foerderer' | 'kurator' | 'admin'>;
}): Promise<string> {
  const id = createId();
  await db.insert(nutzer).values({
    id,
    email: opts.email,
    klarname: `Klar ${opts.email}`,
    anzeigename: opts.anzeigename ?? `anz-${id.slice(0, 6)}`,
    stadtId: opts.stadtId ?? 'hh',
    rollen: opts.rollen ?? ['macher'],
    emailVerifiziertAm: new Date(),
  });
  return id;
}

async function sessionAnlegen(nutzerId: string): Promise<string> {
  const sid = createId();
  await db.insert(sessionTable).values({
    id: sid,
    nutzerId,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });
  return sid;
}

async function terminAnlegen(opts: {
  kuratorId: string;
  status?: 'geplant' | 'veroeffentlicht' | 'abgesagt' | 'durchgefuehrt';
  maxTeilnehmer?: number;
  inDerVergangenheit?: boolean;
  stadtId?: string;
}): Promise<string> {
  const id = createId();
  const datum = opts.inDerVergangenheit
    ? new Date(Date.now() - 24 * 60 * 60 * 1000)
    : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await db.insert(termin).values({
    id,
    stadtId: opts.stadtId ?? 'hh',
    typ: 'schauabend',
    titel: 'Schauabend Mai',
    beschreibung: 'Drei Werke stellen sich vor.',
    ortText: 'Werkstatt St. Pauli, Hamburg',
    datumUhrzeit: datum,
    maxTeilnehmer: opts.maxTeilnehmer ?? 20,
    erstelltVon: opts.kuratorId,
    status: opts.status ?? 'veroeffentlicht',
  });
  return id;
}

function buildRequest(opts: {
  method: 'GET' | 'POST' | 'DELETE';
  path: string;
  sessionId?: string;
}): Request {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    origin: APP_ORIGIN,
    'x-forwarded-for': '127.0.0.1',
  };
  if (opts.sessionId) {
    headers.cookie = buildSessionCookie(opts.sessionId).split(';')[0]!;
  }
  return new Request(`${APP_ORIGIN}${opts.path}`, {
    method: opts.method,
    headers,
  });
}

describe('POST /api/v1/termine/:id/anmeldung', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  it('Anmeldung auf freien Slot → 201 status=angemeldet + T-401', async () => {
    const kuratorId = await userAnlegen({
      email: 'tk-kur-1@test.werkzirkel.de',
      rollen: ['kurator'],
    });
    const tId = await terminAnlegen({ kuratorId, maxTeilnehmer: 5 });

    const teilnehmerEmail = 'tk-t-1@test.werkzirkel.de';
    const tnId = await userAnlegen({ email: teilnehmerEmail });
    const sid = await sessionAnlegen(tnId);

    const res = await anmeldungPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/termine/${tId}/anmeldung`,
        sessionId: sid,
      }),
      { params: Promise.resolve({ id: tId }) },
    );
    expect(res.status).toBe(201);
    const data = (await res.json()) as {
      anmeldung: { id: string; status: string };
      status: string;
    };
    expect(data.status).toBe('angemeldet');
    expect(data.anmeldung.status).toBe('angemeldet');

    const rows = await db
      .select()
      .from(terminAnmeldung)
      .where(
        and(
          eq(terminAnmeldung.terminId, tId),
          eq(terminAnmeldung.nutzerId, tnId),
        ),
      );
    expect(rows.length).toBe(1);
    expect(rows[0]?.status).toBe('angemeldet');

    const mailLog = await db
      .select()
      .from(emailBenachrichtigungLog)
      .where(eq(emailBenachrichtigungLog.template, 'T-401'));
    expect(mailLog.length).toBe(1);
    expect(mailLog[0]?.email).toBe(teilnehmerEmail);
    expect(mailLog[0]?.nutzerId).toBe(tnId);
    expect(mailLog[0]?.status).toBe('gesendet');
  });

  it('Anmeldung wenn Termin voll → 201 status=warteliste', async () => {
    const kuratorId = await userAnlegen({
      email: 'tk-kur-2@test.werkzirkel.de',
      rollen: ['kurator'],
    });
    const tId = await terminAnlegen({ kuratorId, maxTeilnehmer: 2 });
    // 2 Slots vorab belegen.
    const tn1 = await userAnlegen({ email: 'tk-pre-a@test.werkzirkel.de' });
    const tn2 = await userAnlegen({ email: 'tk-pre-b@test.werkzirkel.de' });
    await db.insert(terminAnmeldung).values([
      { terminId: tId, nutzerId: tn1, status: 'angemeldet' },
      { terminId: tId, nutzerId: tn2, status: 'angemeldet' },
    ]);

    const tnId = await userAnlegen({ email: 'tk-wartet@test.werkzirkel.de' });
    const sid = await sessionAnlegen(tnId);

    const res = await anmeldungPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/termine/${tId}/anmeldung`,
        sessionId: sid,
      }),
      { params: Promise.resolve({ id: tId }) },
    );
    expect(res.status).toBe(201);
    const data = (await res.json()) as { status: string };
    expect(data.status).toBe('warteliste');

    const rows = await db
      .select()
      .from(terminAnmeldung)
      .where(
        and(
          eq(terminAnmeldung.terminId, tId),
          eq(terminAnmeldung.nutzerId, tnId),
        ),
      );
    expect(rows[0]?.status).toBe('warteliste');
  });

  it('Anmeldung gegen geplanten (nicht veroeffentlichten) Termin → 422', async () => {
    const kuratorId = await userAnlegen({
      email: 'tk-kur-3@test.werkzirkel.de',
      rollen: ['kurator'],
    });
    const tId = await terminAnlegen({ kuratorId, status: 'geplant' });
    const tnId = await userAnlegen({ email: 'tk-t-3@test.werkzirkel.de' });
    const sid = await sessionAnlegen(tnId);

    const res = await anmeldungPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/termine/${tId}/anmeldung`,
        sessionId: sid,
      }),
      { params: Promise.resolve({ id: tId }) },
    );
    expect(res.status).toBe(422);
    const data = (await res.json()) as { error: { code: string } };
    expect(data.error.code).toBe('falscher_status');
  });

  it('Anmeldung auf Termin in der Vergangenheit → 422 termin_vergangen', async () => {
    const kuratorId = await userAnlegen({
      email: 'tk-kur-4@test.werkzirkel.de',
      rollen: ['kurator'],
    });
    const tId = await terminAnlegen({
      kuratorId,
      inDerVergangenheit: true,
    });
    const tnId = await userAnlegen({ email: 'tk-t-4@test.werkzirkel.de' });
    const sid = await sessionAnlegen(tnId);

    const res = await anmeldungPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/termine/${tId}/anmeldung`,
        sessionId: sid,
      }),
      { params: Promise.resolve({ id: tId }) },
    );
    expect(res.status).toBe(422);
    const data = (await res.json()) as { error: { code: string } };
    expect(data.error.code).toBe('termin_vergangen');
  });

  it('ohne Session → 401', async () => {
    const kuratorId = await userAnlegen({
      email: 'tk-kur-5@test.werkzirkel.de',
      rollen: ['kurator'],
    });
    const tId = await terminAnlegen({ kuratorId });

    const res = await anmeldungPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/termine/${tId}/anmeldung`,
      }),
      { params: Promise.resolve({ id: tId }) },
    );
    expect(res.status).toBe(401);
  });

  it('nicht-existenter Termin → 404', async () => {
    const tnId = await userAnlegen({ email: 'tk-t-9@test.werkzirkel.de' });
    const sid = await sessionAnlegen(tnId);

    const res = await anmeldungPost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/termine/no-such-id/anmeldung',
        sessionId: sid,
      }),
      { params: Promise.resolve({ id: 'no-such-id' }) },
    );
    expect(res.status).toBe(404);
  });

  it('Anmeldung nach Storno reaktiviert die Row', async () => {
    const kuratorId = await userAnlegen({
      email: 'tk-kur-r@test.werkzirkel.de',
      rollen: ['kurator'],
    });
    const tId = await terminAnlegen({ kuratorId, maxTeilnehmer: 5 });

    const tnId = await userAnlegen({ email: 'tk-r@test.werkzirkel.de' });
    const sid = await sessionAnlegen(tnId);
    await db.insert(terminAnmeldung).values({
      terminId: tId,
      nutzerId: tnId,
      status: 'storniert',
    });

    const res = await anmeldungPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/termine/${tId}/anmeldung`,
        sessionId: sid,
      }),
      { params: Promise.resolve({ id: tId }) },
    );
    expect(res.status).toBe(201);
    const data = (await res.json()) as { status: string };
    expect(data.status).toBe('angemeldet');

    const rows = await db
      .select()
      .from(terminAnmeldung)
      .where(
        and(
          eq(terminAnmeldung.terminId, tId),
          eq(terminAnmeldung.nutzerId, tnId),
        ),
      );
    expect(rows.length).toBe(1);
    expect(rows[0]?.status).toBe('angemeldet');
  });
});

describe('DELETE /api/v1/termine/:id/anmeldung', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  it('storniert eigene Anmeldung → 204, Historie bleibt', async () => {
    const kuratorId = await userAnlegen({
      email: 'td-kur-1@test.werkzirkel.de',
      rollen: ['kurator'],
    });
    const tId = await terminAnlegen({ kuratorId, maxTeilnehmer: 5 });
    const tnId = await userAnlegen({ email: 'td-t-1@test.werkzirkel.de' });
    const sid = await sessionAnlegen(tnId);
    await db.insert(terminAnmeldung).values({
      terminId: tId,
      nutzerId: tnId,
      status: 'angemeldet',
    });

    const res = await anmeldungDelete(
      buildRequest({
        method: 'DELETE',
        path: `/api/v1/termine/${tId}/anmeldung`,
        sessionId: sid,
      }),
      { params: Promise.resolve({ id: tId }) },
    );
    expect(res.status).toBe(204);

    const rows = await db
      .select()
      .from(terminAnmeldung)
      .where(
        and(
          eq(terminAnmeldung.terminId, tId),
          eq(terminAnmeldung.nutzerId, tnId),
        ),
      );
    expect(rows.length).toBe(1);
    expect(rows[0]?.status).toBe('storniert');
  });

  it('storniert + zieht aelteste Warteliste-Person hoch + T-401', async () => {
    const kuratorId = await userAnlegen({
      email: 'td-kur-2@test.werkzirkel.de',
      rollen: ['kurator'],
    });
    const tId = await terminAnlegen({ kuratorId, maxTeilnehmer: 1 });

    // Volle Anmeldung.
    const tnFest = await userAnlegen({ email: 'td-fest@test.werkzirkel.de' });
    const sidFest = await sessionAnlegen(tnFest);
    await db.insert(terminAnmeldung).values({
      terminId: tId,
      nutzerId: tnFest,
      status: 'angemeldet',
    });

    // Zwei Warteliste-Eintraege; aelterer muss zuerst hochrutschen.
    const wartetEmail = 'td-warte-a@test.werkzirkel.de';
    const wartet1 = await userAnlegen({ email: wartetEmail });
    await db.insert(terminAnmeldung).values({
      terminId: tId,
      nutzerId: wartet1,
      status: 'warteliste',
      erstelltAm: new Date(Date.now() - 60_000),
    } as unknown as typeof terminAnmeldung.$inferInsert);
    const wartet2 = await userAnlegen({ email: 'td-warte-b@test.werkzirkel.de' });
    await db.insert(terminAnmeldung).values({
      terminId: tId,
      nutzerId: wartet2,
      status: 'warteliste',
      erstelltAm: new Date(),
    } as unknown as typeof terminAnmeldung.$inferInsert);

    const res = await anmeldungDelete(
      buildRequest({
        method: 'DELETE',
        path: `/api/v1/termine/${tId}/anmeldung`,
        sessionId: sidFest,
      }),
      { params: Promise.resolve({ id: tId }) },
    );
    expect(res.status).toBe(204);

    const rows = await db
      .select()
      .from(terminAnmeldung)
      .where(eq(terminAnmeldung.terminId, tId));
    const map = new Map(rows.map((r) => [r.nutzerId, r.status]));
    expect(map.get(tnFest)).toBe('storniert');
    expect(map.get(wartet1)).toBe('angemeldet');
    expect(map.get(wartet2)).toBe('warteliste');

    // T-401 an die hochgerueckte Person.
    const mailLog = await db
      .select()
      .from(emailBenachrichtigungLog)
      .where(eq(emailBenachrichtigungLog.template, 'T-401'));
    const empfaenger = mailLog.map((m) => m.email);
    expect(empfaenger).toContain(wartetEmail);
  });

  it('storniert Warteliste-Eintrag → niemand wird hochgezogen', async () => {
    const kuratorId = await userAnlegen({
      email: 'td-kur-3@test.werkzirkel.de',
      rollen: ['kurator'],
    });
    const tId = await terminAnlegen({ kuratorId, maxTeilnehmer: 1 });

    const tnFest = await userAnlegen({ email: 'td3-fest@test.werkzirkel.de' });
    await db.insert(terminAnmeldung).values({
      terminId: tId,
      nutzerId: tnFest,
      status: 'angemeldet',
    });
    const tnWartet = await userAnlegen({
      email: 'td3-warte@test.werkzirkel.de',
    });
    const sid = await sessionAnlegen(tnWartet);
    await db.insert(terminAnmeldung).values({
      terminId: tId,
      nutzerId: tnWartet,
      status: 'warteliste',
    });

    const res = await anmeldungDelete(
      buildRequest({
        method: 'DELETE',
        path: `/api/v1/termine/${tId}/anmeldung`,
        sessionId: sid,
      }),
      { params: Promise.resolve({ id: tId }) },
    );
    expect(res.status).toBe(204);

    const festStatus = (
      await db
        .select()
        .from(terminAnmeldung)
        .where(
          and(
            eq(terminAnmeldung.terminId, tId),
            eq(terminAnmeldung.nutzerId, tnFest),
          ),
        )
    )[0]?.status;
    expect(festStatus).toBe('angemeldet');

    // Keine zusaetzliche T-401-Mail (es gab keinen Hochrueck-Empfaenger).
    const mailLog = await db
      .select()
      .from(emailBenachrichtigungLog)
      .where(eq(emailBenachrichtigungLog.template, 'T-401'));
    expect(mailLog.length).toBe(0);
  });

  it('keine Anmeldung vorhanden → 404', async () => {
    const kuratorId = await userAnlegen({
      email: 'td-kur-4@test.werkzirkel.de',
      rollen: ['kurator'],
    });
    const tId = await terminAnlegen({ kuratorId });
    const tnId = await userAnlegen({ email: 'td-t-4@test.werkzirkel.de' });
    const sid = await sessionAnlegen(tnId);

    const res = await anmeldungDelete(
      buildRequest({
        method: 'DELETE',
        path: `/api/v1/termine/${tId}/anmeldung`,
        sessionId: sid,
      }),
      { params: Promise.resolve({ id: tId }) },
    );
    expect(res.status).toBe(404);
  });

  it('ohne Session → 401', async () => {
    const res = await anmeldungDelete(
      buildRequest({
        method: 'DELETE',
        path: '/api/v1/termine/whatever/anmeldung',
      }),
      { params: Promise.resolve({ id: 'whatever' }) },
    );
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/termine/:id/anmeldungen', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  it('Kurator:in der Stadt → 200 mit Liste', async () => {
    const kuratorId = await userAnlegen({
      email: 'tg-kur-1@test.werkzirkel.de',
      rollen: ['kurator'],
    });
    const sid = await sessionAnlegen(kuratorId);
    const tId = await terminAnlegen({ kuratorId, maxTeilnehmer: 5 });

    const a = await userAnlegen({
      email: 'tg-a@test.werkzirkel.de',
      anzeigename: 'Person A',
    });
    const b = await userAnlegen({
      email: 'tg-b@test.werkzirkel.de',
      anzeigename: 'Person B',
    });
    await db.insert(terminAnmeldung).values([
      { terminId: tId, nutzerId: a, status: 'angemeldet' },
      { terminId: tId, nutzerId: b, status: 'warteliste' },
    ]);

    const res = await anmeldungenGet(
      buildRequest({
        method: 'GET',
        path: `/api/v1/termine/${tId}/anmeldungen`,
        sessionId: sid,
      }),
      { params: Promise.resolve({ id: tId }) },
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      anmeldungen: Array<{
        status: string;
        nutzer: { anzeigename: string };
      }>;
    };
    expect(data.anmeldungen.length).toBe(2);
    const namen = data.anmeldungen.map((a) => a.nutzer.anzeigename).sort();
    expect(namen).toEqual(['Person A', 'Person B']);
    const stati = data.anmeldungen.map((a) => a.status).sort();
    expect(stati).toEqual(['angemeldet', 'warteliste']);
  });

  it('Admin (nicht Kurator:in dieser Stadt) → 200 mit Liste', async () => {
    // Admin lebt in einer "anderen Stadt"-Konstellation: er hat keinen
    // expliziten Kurator-Bezug auf den Termin, aber die admin-Rolle
    // ueberschreibt das in `istKuratorVon`.
    const adminId = await userAnlegen({
      email: 'tg-admin@test.werkzirkel.de',
      rollen: ['admin'],
      stadtId: 'hh',
    });
    const sid = await sessionAnlegen(adminId);

    const kuratorId = await userAnlegen({
      email: 'tg-kur-x@test.werkzirkel.de',
      rollen: ['kurator'],
    });
    const tId = await terminAnlegen({ kuratorId });

    const res = await anmeldungenGet(
      buildRequest({
        method: 'GET',
        path: `/api/v1/termine/${tId}/anmeldungen`,
        sessionId: sid,
      }),
      { params: Promise.resolve({ id: tId }) },
    );
    expect(res.status).toBe(200);
  });

  it('fremder Nutzer → 403', async () => {
    const kuratorId = await userAnlegen({
      email: 'tg-kur-2@test.werkzirkel.de',
      rollen: ['kurator'],
    });
    const tId = await terminAnlegen({ kuratorId });

    const fremdId = await userAnlegen({ email: 'tg-fremd@test.werkzirkel.de' });
    const sid = await sessionAnlegen(fremdId);

    const res = await anmeldungenGet(
      buildRequest({
        method: 'GET',
        path: `/api/v1/termine/${tId}/anmeldungen`,
        sessionId: sid,
      }),
      { params: Promise.resolve({ id: tId }) },
    );
    expect(res.status).toBe(403);
    const data = (await res.json()) as { error: { code: string } };
    expect(data.error.code).toBe('kein_zugriff');
  });

  it('ohne Session → 401', async () => {
    const res = await anmeldungenGet(
      buildRequest({
        method: 'GET',
        path: '/api/v1/termine/whatever/anmeldungen',
      }),
      { params: Promise.resolve({ id: 'whatever' }) },
    );
    expect(res.status).toBe(401);
  });

  it('nicht-existenter Termin → 404', async () => {
    const kuratorId = await userAnlegen({
      email: 'tg-kur-3@test.werkzirkel.de',
      rollen: ['kurator'],
    });
    const sid = await sessionAnlegen(kuratorId);

    const res = await anmeldungenGet(
      buildRequest({
        method: 'GET',
        path: '/api/v1/termine/does-not-exist/anmeldungen',
        sessionId: sid,
      }),
      { params: Promise.resolve({ id: 'does-not-exist' }) },
    );
    expect(res.status).toBe(404);
  });
});
