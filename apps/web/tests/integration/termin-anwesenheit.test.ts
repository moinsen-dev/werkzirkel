/**
 * Integration-Tests fuer die Anwesenheits-API:
 *   POST  /api/v1/termine/:id/anwesenheit
 *   PATCH /api/v1/termin-anmeldungen/:id/status
 *
 * Deckt PRD §8.8, §F-401..§F-405:
 *  - Bulk-Setzung 'anwesend' vs. 'nicht_anwesend'
 *  - Permission-Check (City-Lead der Stadt)
 *  - Termin-in-der-Vergangenheit-Pflicht
 *  - Notizen_nach_termin Persistenz
 *  - Werkstattbeitrag-Hook fuer Bedarfstraeger:innen auf Schauabend
 *  - Idempotenz des Hooks
 *  - Hook NICHT fuer fremde Termin-Typen
 *  - Hook NICHT fuer Personen ohne 'bedarfstraeger'-Rolle
 *
 * Methode: Route-Handler direkt importieren, synthetische Request-Objekte.
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
  werkstattbeitrag,
} from '@/lib/db/schema';
import { env } from '@/lib/env';
import { buildSessionCookie } from '@/lib/auth/session';

import { POST as anwesenheitPost } from '@/app/api/v1/termine/[id]/anwesenheit/route';
import { PATCH as statusPatch } from '@/app/api/v1/termin-anmeldungen/[id]/status/route';

import { truncateAll } from '../_helpers/db-cleanup';

const APP_ORIGIN = new URL(env.APP_URL).origin;

type Rolle = 'macher' | 'bedarfstraeger' | 'foerderer' | 'kurator' | 'admin';

async function userAnlegen(opts: {
  email: string;
  stadtId?: string;
  anzeigename?: string;
  rollen?: Rolle[];
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
  typ?:
    | 'pruefabend'
    | 'schauabend'
    | 'bedarfsschau'
    | 'baurunde'
    | 'werkgespraech'
    | 'kennenlernrunde';
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
    typ: opts.typ ?? 'schauabend',
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

async function anmeldungAnlegen(opts: {
  terminId: string;
  nutzerId: string;
  status?:
    | 'angemeldet'
    | 'warteliste'
    | 'anwesend'
    | 'nicht_anwesend'
    | 'storniert';
}): Promise<string> {
  const id = createId();
  await db.insert(terminAnmeldung).values({
    id,
    terminId: opts.terminId,
    nutzerId: opts.nutzerId,
    status: opts.status ?? 'angemeldet',
  });
  return id;
}

function buildRequest(opts: {
  method: 'POST' | 'PATCH';
  path: string;
  sessionId?: string;
  body?: unknown;
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
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

describe('POST /api/v1/termine/:id/anwesenheit', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  it('3 angemeldete, 2 in anwesend-Liste → 2 anwesend / 1 nicht_anwesend', async () => {
    const kuratorId = await userAnlegen({
      email: 'aw-kur-1@test.werkzirkel.de',
      rollen: ['kurator'],
    });
    const sid = await sessionAnlegen(kuratorId);
    const tId = await terminAnlegen({
      kuratorId,
      inDerVergangenheit: true,
    });

    const n1 = await userAnlegen({ email: 'aw-t1@test.werkzirkel.de' });
    const n2 = await userAnlegen({ email: 'aw-t2@test.werkzirkel.de' });
    const n3 = await userAnlegen({ email: 'aw-t3@test.werkzirkel.de' });
    const a1 = await anmeldungAnlegen({ terminId: tId, nutzerId: n1 });
    const a2 = await anmeldungAnlegen({ terminId: tId, nutzerId: n2 });
    const a3 = await anmeldungAnlegen({ terminId: tId, nutzerId: n3 });

    const res = await anwesenheitPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/termine/${tId}/anwesenheit`,
        sessionId: sid,
        body: { anmeldung_ids_anwesend: [a1, a2] },
      }),
      { params: Promise.resolve({ id: tId }) },
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      anwesend: number;
      nicht_anwesend: number;
    };
    expect(data.anwesend).toBe(2);
    expect(data.nicht_anwesend).toBe(1);

    const rows = await db
      .select()
      .from(terminAnmeldung)
      .where(eq(terminAnmeldung.terminId, tId));
    const map = new Map(rows.map((r) => [r.id, r.status]));
    expect(map.get(a1)).toBe('anwesend');
    expect(map.get(a2)).toBe('anwesend');
    expect(map.get(a3)).toBe('nicht_anwesend');
  });

  it('storniert-Eintrag bleibt unangetastet', async () => {
    const kuratorId = await userAnlegen({
      email: 'aw-kur-st@test.werkzirkel.de',
      rollen: ['kurator'],
    });
    const sid = await sessionAnlegen(kuratorId);
    const tId = await terminAnlegen({
      kuratorId,
      inDerVergangenheit: true,
    });

    const n1 = await userAnlegen({ email: 'aw-st1@test.werkzirkel.de' });
    const n2 = await userAnlegen({ email: 'aw-st2@test.werkzirkel.de' });
    const a1 = await anmeldungAnlegen({ terminId: tId, nutzerId: n1 });
    const a2 = await anmeldungAnlegen({
      terminId: tId,
      nutzerId: n2,
      status: 'storniert',
    });

    const res = await anwesenheitPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/termine/${tId}/anwesenheit`,
        sessionId: sid,
        body: { anmeldung_ids_anwesend: [a1, a2] },
      }),
      { params: Promise.resolve({ id: tId }) },
    );
    expect(res.status).toBe(200);

    const rows = await db
      .select()
      .from(terminAnmeldung)
      .where(eq(terminAnmeldung.terminId, tId));
    const map = new Map(rows.map((r) => [r.id, r.status]));
    expect(map.get(a1)).toBe('anwesend');
    expect(map.get(a2)).toBe('storniert');
  });

  it('fremder City-Lead (andere Stadt) → 403', async () => {
    const kuratorHH = await userAnlegen({
      email: 'aw-hh@test.werkzirkel.de',
      rollen: ['kurator'],
      stadtId: 'hh',
    });
    const tId = await terminAnlegen({
      kuratorId: kuratorHH,
      stadtId: 'hh',
      inDerVergangenheit: true,
    });

    const kuratorB = await userAnlegen({
      email: 'aw-b@test.werkzirkel.de',
      rollen: ['kurator'],
      stadtId: 'b',
    });
    const sid = await sessionAnlegen(kuratorB);

    const res = await anwesenheitPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/termine/${tId}/anwesenheit`,
        sessionId: sid,
        body: { anmeldung_ids_anwesend: [] },
      }),
      { params: Promise.resolve({ id: tId }) },
    );
    expect(res.status).toBe(403);
    const data = (await res.json()) as { error: { code: string } };
    expect(data.error.code).toBe('kein_zugriff');
  });

  it('Termin in der Zukunft → 422 termin_in_zukunft', async () => {
    const kuratorId = await userAnlegen({
      email: 'aw-z@test.werkzirkel.de',
      rollen: ['kurator'],
    });
    const sid = await sessionAnlegen(kuratorId);
    const tId = await terminAnlegen({ kuratorId }); // Default: 7 Tage in Zukunft

    const res = await anwesenheitPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/termine/${tId}/anwesenheit`,
        sessionId: sid,
        body: { anmeldung_ids_anwesend: [] },
      }),
      { params: Promise.resolve({ id: tId }) },
    );
    expect(res.status).toBe(422);
    const data = (await res.json()) as { error: { code: string } };
    expect(data.error.code).toBe('termin_in_zukunft');
  });

  it('Termin status=durchgefuehrt → erlaubt auch wenn datum in Zukunft', async () => {
    // Edge-Case: ein als 'durchgefuehrt' markierter Termin soll die
    // Anwesenheits-API immer erlauben, unabhaengig vom Datum.
    const kuratorId = await userAnlegen({
      email: 'aw-d@test.werkzirkel.de',
      rollen: ['kurator'],
    });
    const sid = await sessionAnlegen(kuratorId);
    const tId = await terminAnlegen({
      kuratorId,
      status: 'durchgefuehrt',
    });

    const res = await anwesenheitPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/termine/${tId}/anwesenheit`,
        sessionId: sid,
        body: { anmeldung_ids_anwesend: [] },
      }),
      { params: Promise.resolve({ id: tId }) },
    );
    expect(res.status).toBe(200);
  });

  it('notizen_nach_termin werden persistiert', async () => {
    const kuratorId = await userAnlegen({
      email: 'aw-n@test.werkzirkel.de',
      rollen: ['kurator'],
    });
    const sid = await sessionAnlegen(kuratorId);
    const tId = await terminAnlegen({
      kuratorId,
      inDerVergangenheit: true,
    });

    const notiz = 'Spannender Abend, sechs Teilnehmer:innen, viel Diskussion.';

    const res = await anwesenheitPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/termine/${tId}/anwesenheit`,
        sessionId: sid,
        body: {
          anmeldung_ids_anwesend: [],
          notizen_nach_termin: notiz,
        },
      }),
      { params: Promise.resolve({ id: tId }) },
    );
    expect(res.status).toBe(200);

    const rows = await db
      .select({ notizen: termin.notizenNachTermin })
      .from(termin)
      .where(eq(termin.id, tId));
    expect(rows[0]?.notizen).toBe(notiz);
  });

  it('ohne Session → 401', async () => {
    const kuratorId = await userAnlegen({
      email: 'aw-401@test.werkzirkel.de',
      rollen: ['kurator'],
    });
    const tId = await terminAnlegen({
      kuratorId,
      inDerVergangenheit: true,
    });

    const res = await anwesenheitPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/termine/${tId}/anwesenheit`,
        body: { anmeldung_ids_anwesend: [] },
      }),
      { params: Promise.resolve({ id: tId }) },
    );
    expect(res.status).toBe(401);
  });

  it('nicht-existenter Termin → 404', async () => {
    const kuratorId = await userAnlegen({
      email: 'aw-404@test.werkzirkel.de',
      rollen: ['kurator'],
    });
    const sid = await sessionAnlegen(kuratorId);

    const res = await anwesenheitPost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/termine/no-such/anwesenheit',
        sessionId: sid,
        body: { anmeldung_ids_anwesend: [] },
      }),
      { params: Promise.resolve({ id: 'no-such' }) },
    );
    expect(res.status).toBe(404);
  });

  it('ungueltiger Body (notizen zu lang) → 422 validierung', async () => {
    const kuratorId = await userAnlegen({
      email: 'aw-v@test.werkzirkel.de',
      rollen: ['kurator'],
    });
    const sid = await sessionAnlegen(kuratorId);
    const tId = await terminAnlegen({
      kuratorId,
      inDerVergangenheit: true,
    });

    const res = await anwesenheitPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/termine/${tId}/anwesenheit`,
        sessionId: sid,
        body: {
          anmeldung_ids_anwesend: [],
          notizen_nach_termin: 'x'.repeat(5001),
        },
      }),
      { params: Promise.resolve({ id: tId }) },
    );
    expect(res.status).toBe(422);
  });
});

describe('PATCH /api/v1/termin-anmeldungen/:id/status', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  it('City-Lead setzt Einzel-Anmeldung auf anwesend → 200, DB-Update', async () => {
    const kuratorId = await userAnlegen({
      email: 'st-kur@test.werkzirkel.de',
      rollen: ['kurator'],
    });
    const sid = await sessionAnlegen(kuratorId);
    const tId = await terminAnlegen({
      kuratorId,
      inDerVergangenheit: true,
    });
    const nId = await userAnlegen({ email: 'st-n@test.werkzirkel.de' });
    const aId = await anmeldungAnlegen({ terminId: tId, nutzerId: nId });

    const res = await statusPatch(
      buildRequest({
        method: 'PATCH',
        path: `/api/v1/termin-anmeldungen/${aId}/status`,
        sessionId: sid,
        body: { status: 'anwesend' },
      }),
      { params: Promise.resolve({ id: aId }) },
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      anmeldung: { status: string };
    };
    expect(data.anmeldung.status).toBe('anwesend');

    const rows = await db
      .select()
      .from(terminAnmeldung)
      .where(eq(terminAnmeldung.id, aId));
    expect(rows[0]?.status).toBe('anwesend');
  });

  it('fremder Nutzer (kein Kurator) → 403', async () => {
    const kuratorId = await userAnlegen({
      email: 'st-k2@test.werkzirkel.de',
      rollen: ['kurator'],
    });
    const tId = await terminAnlegen({
      kuratorId,
      inDerVergangenheit: true,
    });
    const nId = await userAnlegen({ email: 'st-n2@test.werkzirkel.de' });
    const aId = await anmeldungAnlegen({ terminId: tId, nutzerId: nId });

    const fremd = await userAnlegen({ email: 'st-fremd@test.werkzirkel.de' });
    const sid = await sessionAnlegen(fremd);

    const res = await statusPatch(
      buildRequest({
        method: 'PATCH',
        path: `/api/v1/termin-anmeldungen/${aId}/status`,
        sessionId: sid,
        body: { status: 'anwesend' },
      }),
      { params: Promise.resolve({ id: aId }) },
    );
    expect(res.status).toBe(403);
  });

  it('storniert-Anmeldung → 422', async () => {
    const kuratorId = await userAnlegen({
      email: 'st-k3@test.werkzirkel.de',
      rollen: ['kurator'],
    });
    const sid = await sessionAnlegen(kuratorId);
    const tId = await terminAnlegen({
      kuratorId,
      inDerVergangenheit: true,
    });
    const nId = await userAnlegen({ email: 'st-n3@test.werkzirkel.de' });
    const aId = await anmeldungAnlegen({
      terminId: tId,
      nutzerId: nId,
      status: 'storniert',
    });

    const res = await statusPatch(
      buildRequest({
        method: 'PATCH',
        path: `/api/v1/termin-anmeldungen/${aId}/status`,
        sessionId: sid,
        body: { status: 'anwesend' },
      }),
      { params: Promise.resolve({ id: aId }) },
    );
    expect(res.status).toBe(422);
    const data = (await res.json()) as { error: { code: string } };
    expect(data.error.code).toBe('storniert_nicht_aenderbar');
  });

  it('ohne Session → 401', async () => {
    const res = await statusPatch(
      buildRequest({
        method: 'PATCH',
        path: '/api/v1/termin-anmeldungen/whatever/status',
        body: { status: 'anwesend' },
      }),
      { params: Promise.resolve({ id: 'whatever' }) },
    );
    expect(res.status).toBe(401);
  });

  it('ungueltiger Status → 422 validierung', async () => {
    const kuratorId = await userAnlegen({
      email: 'st-v@test.werkzirkel.de',
      rollen: ['kurator'],
    });
    const sid = await sessionAnlegen(kuratorId);
    const tId = await terminAnlegen({
      kuratorId,
      inDerVergangenheit: true,
    });
    const nId = await userAnlegen({ email: 'st-vn@test.werkzirkel.de' });
    const aId = await anmeldungAnlegen({ terminId: tId, nutzerId: nId });

    const res = await statusPatch(
      buildRequest({
        method: 'PATCH',
        path: `/api/v1/termin-anmeldungen/${aId}/status`,
        sessionId: sid,
        body: { status: 'angemeldet' },
      }),
      { params: Promise.resolve({ id: aId }) },
    );
    expect(res.status).toBe(422);
  });
});

describe('Werkstattbeitrag-Hook bei Schauabend-Teilnahme', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  it('Bedarfstraeger:in auf Schauabend → werkstattbeitrag mit art=schauabend_teilnahme', async () => {
    const kuratorId = await userAnlegen({
      email: 'wb-kur@test.werkzirkel.de',
      rollen: ['kurator'],
    });
    const sid = await sessionAnlegen(kuratorId);
    const tId = await terminAnlegen({
      kuratorId,
      typ: 'schauabend',
      inDerVergangenheit: true,
    });

    const bedarftraegerId = await userAnlegen({
      email: 'wb-bt@test.werkzirkel.de',
      rollen: ['macher', 'bedarfstraeger'],
    });
    const aId = await anmeldungAnlegen({
      terminId: tId,
      nutzerId: bedarftraegerId,
    });

    const res = await anwesenheitPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/termine/${tId}/anwesenheit`,
        sessionId: sid,
        body: { anmeldung_ids_anwesend: [aId] },
      }),
      { params: Promise.resolve({ id: tId }) },
    );
    expect(res.status).toBe(200);

    const beitraege = await db
      .select()
      .from(werkstattbeitrag)
      .where(
        and(
          eq(werkstattbeitrag.nutzerId, bedarftraegerId),
          eq(werkstattbeitrag.terminId, tId),
        ),
      );
    expect(beitraege.length).toBe(1);
    expect(beitraege[0]?.art).toBe('schauabend_teilnahme');
    expect(beitraege[0]?.status).toBe('verifiziert');

    // gueltig_bis ~ now() + 6 Monate (Toleranz: zwischen 5 und 7 Monaten).
    const gueltigBis = beitraege[0]?.gueltigBis;
    expect(gueltigBis).toBeTruthy();
    const diffMs = gueltigBis!.getTime() - Date.now();
    const fuenfMonate = 5 * 30 * 24 * 60 * 60 * 1000;
    const siebenMonate = 7 * 30 * 24 * 60 * 60 * 1000;
    expect(diffMs).toBeGreaterThan(fuenfMonate);
    expect(diffMs).toBeLessThan(siebenMonate);
  });

  it('Bedarfstraeger:in auf Bedarfsschau → werkstattbeitrag wird ebenfalls angelegt', async () => {
    const kuratorId = await userAnlegen({
      email: 'wb-bs-kur@test.werkzirkel.de',
      rollen: ['kurator'],
    });
    const sid = await sessionAnlegen(kuratorId);
    const tId = await terminAnlegen({
      kuratorId,
      typ: 'bedarfsschau',
      inDerVergangenheit: true,
    });

    const bedarftraegerId = await userAnlegen({
      email: 'wb-bs-bt@test.werkzirkel.de',
      rollen: ['bedarfstraeger'],
    });
    const aId = await anmeldungAnlegen({
      terminId: tId,
      nutzerId: bedarftraegerId,
    });

    const res = await anwesenheitPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/termine/${tId}/anwesenheit`,
        sessionId: sid,
        body: { anmeldung_ids_anwesend: [aId] },
      }),
      { params: Promise.resolve({ id: tId }) },
    );
    expect(res.status).toBe(200);

    const beitraege = await db
      .select()
      .from(werkstattbeitrag)
      .where(eq(werkstattbeitrag.nutzerId, bedarftraegerId));
    expect(beitraege.length).toBe(1);
    expect(beitraege[0]?.art).toBe('schauabend_teilnahme');
  });

  it('Idempotenz: zweites Mal anwesend setzen erzeugt KEINEN zweiten Beitrag', async () => {
    const kuratorId = await userAnlegen({
      email: 'wb-id-kur@test.werkzirkel.de',
      rollen: ['kurator'],
    });
    const sid = await sessionAnlegen(kuratorId);
    const tId = await terminAnlegen({
      kuratorId,
      typ: 'schauabend',
      inDerVergangenheit: true,
    });
    const bedarftraegerId = await userAnlegen({
      email: 'wb-id-bt@test.werkzirkel.de',
      rollen: ['bedarfstraeger'],
    });
    const aId = await anmeldungAnlegen({
      terminId: tId,
      nutzerId: bedarftraegerId,
    });

    // Erstes Mal anwesend setzen.
    const res1 = await anwesenheitPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/termine/${tId}/anwesenheit`,
        sessionId: sid,
        body: { anmeldung_ids_anwesend: [aId] },
      }),
      { params: Promise.resolve({ id: tId }) },
    );
    expect(res1.status).toBe(200);

    // Zwischendurch wieder auf nicht_anwesend (alle leeren) und dann
    // wieder anwesend → der Hook darf KEINEN zweiten Beitrag anlegen.
    const res2 = await anwesenheitPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/termine/${tId}/anwesenheit`,
        sessionId: sid,
        body: { anmeldung_ids_anwesend: [] },
      }),
      { params: Promise.resolve({ id: tId }) },
    );
    expect(res2.status).toBe(200);

    const res3 = await anwesenheitPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/termine/${tId}/anwesenheit`,
        sessionId: sid,
        body: { anmeldung_ids_anwesend: [aId] },
      }),
      { params: Promise.resolve({ id: tId }) },
    );
    expect(res3.status).toBe(200);

    const beitraege = await db
      .select()
      .from(werkstattbeitrag)
      .where(eq(werkstattbeitrag.nutzerId, bedarftraegerId));
    expect(beitraege.length).toBe(1);
  });

  it('User OHNE bedarfstraeger-Rolle → KEIN werkstattbeitrag', async () => {
    const kuratorId = await userAnlegen({
      email: 'wb-no-kur@test.werkzirkel.de',
      rollen: ['kurator'],
    });
    const sid = await sessionAnlegen(kuratorId);
    const tId = await terminAnlegen({
      kuratorId,
      typ: 'schauabend',
      inDerVergangenheit: true,
    });
    const macherId = await userAnlegen({
      email: 'wb-no-m@test.werkzirkel.de',
      rollen: ['macher'],
    });
    const aId = await anmeldungAnlegen({
      terminId: tId,
      nutzerId: macherId,
    });

    const res = await anwesenheitPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/termine/${tId}/anwesenheit`,
        sessionId: sid,
        body: { anmeldung_ids_anwesend: [aId] },
      }),
      { params: Promise.resolve({ id: tId }) },
    );
    expect(res.status).toBe(200);

    const beitraege = await db
      .select()
      .from(werkstattbeitrag)
      .where(eq(werkstattbeitrag.nutzerId, macherId));
    expect(beitraege.length).toBe(0);
  });

  it('Termin-Typ baurunde → KEIN werkstattbeitrag selbst bei bedarfstraeger', async () => {
    const kuratorId = await userAnlegen({
      email: 'wb-bau-kur@test.werkzirkel.de',
      rollen: ['kurator'],
    });
    const sid = await sessionAnlegen(kuratorId);
    const tId = await terminAnlegen({
      kuratorId,
      typ: 'baurunde',
      inDerVergangenheit: true,
    });
    const bedarftraegerId = await userAnlegen({
      email: 'wb-bau-bt@test.werkzirkel.de',
      rollen: ['bedarfstraeger'],
    });
    const aId = await anmeldungAnlegen({
      terminId: tId,
      nutzerId: bedarftraegerId,
    });

    const res = await anwesenheitPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/termine/${tId}/anwesenheit`,
        sessionId: sid,
        body: { anmeldung_ids_anwesend: [aId] },
      }),
      { params: Promise.resolve({ id: tId }) },
    );
    expect(res.status).toBe(200);

    const beitraege = await db
      .select()
      .from(werkstattbeitrag)
      .where(eq(werkstattbeitrag.nutzerId, bedarftraegerId));
    expect(beitraege.length).toBe(0);
  });

  it('PATCH-Status auf anwesend triggert Hook ebenfalls', async () => {
    const kuratorId = await userAnlegen({
      email: 'wb-p-kur@test.werkzirkel.de',
      rollen: ['kurator'],
    });
    const sid = await sessionAnlegen(kuratorId);
    const tId = await terminAnlegen({
      kuratorId,
      typ: 'schauabend',
      inDerVergangenheit: true,
    });
    const bedarftraegerId = await userAnlegen({
      email: 'wb-p-bt@test.werkzirkel.de',
      rollen: ['bedarfstraeger'],
    });
    const aId = await anmeldungAnlegen({
      terminId: tId,
      nutzerId: bedarftraegerId,
      status: 'nicht_anwesend',
    });

    const res = await statusPatch(
      buildRequest({
        method: 'PATCH',
        path: `/api/v1/termin-anmeldungen/${aId}/status`,
        sessionId: sid,
        body: { status: 'anwesend' },
      }),
      { params: Promise.resolve({ id: aId }) },
    );
    expect(res.status).toBe(200);

    const beitraege = await db
      .select()
      .from(werkstattbeitrag)
      .where(eq(werkstattbeitrag.nutzerId, bedarftraegerId));
    expect(beitraege.length).toBe(1);
    expect(beitraege[0]?.art).toBe('schauabend_teilnahme');
  });

  it('PATCH-Status anwesend → anwesend triggert keinen zweiten Hook (idempotent)', async () => {
    const kuratorId = await userAnlegen({
      email: 'wb-id2-kur@test.werkzirkel.de',
      rollen: ['kurator'],
    });
    const sid = await sessionAnlegen(kuratorId);
    const tId = await terminAnlegen({
      kuratorId,
      typ: 'schauabend',
      inDerVergangenheit: true,
    });
    const bedarftraegerId = await userAnlegen({
      email: 'wb-id2-bt@test.werkzirkel.de',
      rollen: ['bedarfstraeger'],
    });
    const aId = await anmeldungAnlegen({
      terminId: tId,
      nutzerId: bedarftraegerId,
      status: 'anwesend',
    });

    // Beitrag manuell anlegen, um die Vorbedingung "schon anwesend, schon
    // Beitrag" zu simulieren.
    await db.insert(werkstattbeitrag).values({
      nutzerId: bedarftraegerId,
      art: 'schauabend_teilnahme',
      terminId: tId,
      status: 'verifiziert',
      gueltigBis: new Date(Date.now() + 6 * 30 * 24 * 60 * 60 * 1000),
    });

    const res = await statusPatch(
      buildRequest({
        method: 'PATCH',
        path: `/api/v1/termin-anmeldungen/${aId}/status`,
        sessionId: sid,
        body: { status: 'anwesend' },
      }),
      { params: Promise.resolve({ id: aId }) },
    );
    expect(res.status).toBe(200);

    const beitraege = await db
      .select()
      .from(werkstattbeitrag)
      .where(eq(werkstattbeitrag.nutzerId, bedarftraegerId));
    expect(beitraege.length).toBe(1);
  });
});
