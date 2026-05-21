/**
 * Integration-Tests fuer die Werkangebot-API:
 *   POST   /api/v1/bedarfe/:id/werkangebote
 *   GET    /api/v1/bedarfe/:id/werkangebote
 *   GET    /api/v1/me/werkangebote
 *   PATCH  /api/v1/werkangebote/:id
 *
 * Schwerpunkt: PRD §11A Schutz S2 (Werkangebote sind NICHT oeffentlich)
 * + UNIQUE(bedarf_id, werk_id) Constraint + Status-Maschine.
 *
 * Privacy-Matrix:
 *   - anonym                  → 401
 *   - fremde Macher:in        → 403 (kein Zugriff)
 *   - Bedarfstraeger:in       → 200 mit ALLEN Werkangeboten
 *   - beteiligte Macher:in    → 200 mit NUR eigenen
 *
 * Werk-Detail-Response darf KEINEN werkangebote-Counter enthalten (S2).
 */

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createId } from '@paralleldrive/cuid2';
import { eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import {
  bedarf,
  nutzer,
  session as sessionTable,
  werk,
  werkangebot,
} from '@/lib/db/schema';
import { env } from '@/lib/env';
import { buildSessionCookie } from '@/lib/auth/session';
import { WERKANGEBOT_PUBLIC_FIELDS } from '@/lib/werkangebot/serialize';

import {
  POST as werkangebotePost,
  GET as werkangeboteGet,
} from '@/app/api/v1/bedarfe/[id]/werkangebote/route';
import { GET as meWerkangeboteGet } from '@/app/api/v1/me/werkangebote/route';
import { PATCH as werkangebotPatch } from '@/app/api/v1/werkangebote/[id]/route';
import { GET as werkDetailGet } from '@/app/api/v1/werke/[id]/route';

import { truncateAll } from '../_helpers/db-cleanup';

const APP_ORIGIN = new URL(env.APP_URL).origin;

type Rolle = 'macher' | 'bedarfstraeger' | 'foerderer' | 'kurator' | 'admin';

async function userAnlegen(opts: {
  email: string;
  rollen?: Rolle[];
  klarname?: string;
  anzeigename?: string;
  stadtId?: string;
}): Promise<string> {
  const id = createId();
  await db.insert(nutzer).values({
    id,
    email: opts.email,
    klarname: opts.klarname ?? `Klar ${opts.email}`,
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

async function werkAnlegen(opts: { nutzerId: string; name?: string }): Promise<string> {
  const id = createId();
  await db.insert(werk).values({
    id,
    nutzerId: opts.nutzerId,
    name: opts.name ?? 'Mein Build',
    kurzbeschreibung: 'Kurz',
    problem: 'Problem',
    zielgruppe: 'Zielgruppe',
    werkstand: 'idee',
  });
  return id;
}

async function bedarfAnlegen(opts: {
  nutzerId: string;
  status?: 'entwurf' | 'in_pruefung' | 'oeffentlich' | 'in_gespraechen' | 'erfuellt' | 'eingestellt';
  titel?: string;
}): Promise<string> {
  const id = createId();
  await db.insert(bedarf).values({
    id,
    nutzerId: opts.nutzerId,
    organisation: 'Org',
    titel: opts.titel ?? 'Bedarf',
    problem: 'p',
    nutzen: 'n',
    stadtId: 'hh',
    frist: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    status: opts.status ?? 'oeffentlich',
  });
  return id;
}

function buildRequest(opts: {
  method: 'GET' | 'POST' | 'PATCH';
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

const validWerkangebotBody = (extra: Record<string, unknown> = {}) => ({
  werk_id: extra.werk_id ?? 'PLACEHOLDER',
  konkretes_vorgehen:
    'Ich wuerde in drei Schritten arbeiten und nach jedem Schritt einen Stand zeigen.',
  ausdruecklicher_ausschluss:
    'Kein dauerhaftes Hosting, kein Logo-Design.',
  erster_liefer_meilenstein:
    'Nach einer Woche: ein klickbarer Entwurf der Startseite.',
  ...extra,
});

describe('POST /api/v1/bedarfe/:id/werkangebote', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  it('Macher:in mit eigenem Werk reicht Werkangebot ein → 201', async () => {
    const bedTraeger = await userAnlegen({
      email: 'wa-bed1@test.werkzirkel.de',
      rollen: ['bedarfstraeger'],
    });
    const bedarfId = await bedarfAnlegen({ nutzerId: bedTraeger });

    const macherId = await userAnlegen({
      email: 'wa-mach1@test.werkzirkel.de',
      rollen: ['macher'],
    });
    const sid = await sessionAnlegen(macherId);
    const werkId = await werkAnlegen({ nutzerId: macherId });

    const res = await werkangebotePost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/bedarfe/${bedarfId}/werkangebote`,
        sessionId: sid,
        body: validWerkangebotBody({ werk_id: werkId }),
      }),
      { params: Promise.resolve({ id: bedarfId }) },
    );
    expect(res.status).toBe(201);
    const data = (await res.json()) as {
      werkangebot: { id: string; status: string; bedarf_id: string };
    };
    expect(data.werkangebot.status).toBe('eingereicht');
    expect(data.werkangebot.bedarf_id).toBe(bedarfId);
  });

  it('Doppel-Einreichung mit demselben Werk → 422 bereits_eingereicht (UNIQUE)', async () => {
    const bedTraeger = await userAnlegen({
      email: 'wa-dup-bed@test.werkzirkel.de',
      rollen: ['bedarfstraeger'],
    });
    const bedarfId = await bedarfAnlegen({ nutzerId: bedTraeger });
    const macherId = await userAnlegen({
      email: 'wa-dup-mach@test.werkzirkel.de',
      rollen: ['macher'],
    });
    const sid = await sessionAnlegen(macherId);
    const werkId = await werkAnlegen({ nutzerId: macherId });

    const first = await werkangebotePost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/bedarfe/${bedarfId}/werkangebote`,
        sessionId: sid,
        body: validWerkangebotBody({ werk_id: werkId }),
      }),
      { params: Promise.resolve({ id: bedarfId }) },
    );
    expect(first.status).toBe(201);

    const second = await werkangebotePost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/bedarfe/${bedarfId}/werkangebote`,
        sessionId: sid,
        body: validWerkangebotBody({ werk_id: werkId }),
      }),
      { params: Promise.resolve({ id: bedarfId }) },
    );
    expect(second.status).toBe(422);
    const data = (await second.json()) as { error: { code: string } };
    expect(data.error.code).toBe('bereits_eingereicht');
  });

  it('Macher:in mit fremdem Werk → 403 kein_eigenes_werk', async () => {
    const bedTraeger = await userAnlegen({
      email: 'wa-fw-bed@test.werkzirkel.de',
      rollen: ['bedarfstraeger'],
    });
    const bedarfId = await bedarfAnlegen({ nutzerId: bedTraeger });

    const fremdMacher = await userAnlegen({
      email: 'wa-fw-fremd@test.werkzirkel.de',
      rollen: ['macher'],
    });
    const fremdWerkId = await werkAnlegen({ nutzerId: fremdMacher });

    const macherId = await userAnlegen({
      email: 'wa-fw-mach@test.werkzirkel.de',
      rollen: ['macher'],
    });
    const sid = await sessionAnlegen(macherId);

    const res = await werkangebotePost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/bedarfe/${bedarfId}/werkangebote`,
        sessionId: sid,
        body: validWerkangebotBody({ werk_id: fremdWerkId }),
      }),
      { params: Promise.resolve({ id: bedarfId }) },
    );
    expect(res.status).toBe(403);
    const data = (await res.json()) as { error: { code: string } };
    expect(data.error.code).toBe('kein_eigenes_werk');
  });

  it('User ohne macher-Rolle → 403', async () => {
    const bedTraeger = await userAnlegen({
      email: 'wa-nrl-bed@test.werkzirkel.de',
      rollen: ['bedarfstraeger'],
    });
    const bedarfId = await bedarfAnlegen({ nutzerId: bedTraeger });

    const userId = await userAnlegen({
      email: 'wa-nrl@test.werkzirkel.de',
      rollen: ['bedarfstraeger'],
    });
    const sid = await sessionAnlegen(userId);

    const res = await werkangebotePost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/bedarfe/${bedarfId}/werkangebote`,
        sessionId: sid,
        body: validWerkangebotBody({ werk_id: 'wirdNichtErreicht' }),
      }),
      { params: Promise.resolve({ id: bedarfId }) },
    );
    expect(res.status).toBe(403);
  });

  it('Bedarf nicht offen (entwurf) → 422 bedarf_nicht_offen', async () => {
    const bedTraeger = await userAnlegen({
      email: 'wa-no-bed@test.werkzirkel.de',
      rollen: ['bedarfstraeger'],
    });
    const bedarfId = await bedarfAnlegen({
      nutzerId: bedTraeger,
      status: 'entwurf',
    });
    const macherId = await userAnlegen({
      email: 'wa-no-mach@test.werkzirkel.de',
      rollen: ['macher'],
    });
    const sid = await sessionAnlegen(macherId);
    const werkId = await werkAnlegen({ nutzerId: macherId });

    const res = await werkangebotePost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/bedarfe/${bedarfId}/werkangebote`,
        sessionId: sid,
        body: validWerkangebotBody({ werk_id: werkId }),
      }),
      { params: Promise.resolve({ id: bedarfId }) },
    );
    expect(res.status).toBe(422);
    const data = (await res.json()) as { error: { code: string } };
    expect(data.error.code).toBe('bedarf_nicht_offen');
  });

  it('anonym → 401', async () => {
    const bedTraeger = await userAnlegen({
      email: 'wa-anon-bed@test.werkzirkel.de',
      rollen: ['bedarfstraeger'],
    });
    const bedarfId = await bedarfAnlegen({ nutzerId: bedTraeger });
    const res = await werkangebotePost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/bedarfe/${bedarfId}/werkangebote`,
        body: validWerkangebotBody({ werk_id: 'x' }),
      }),
      { params: Promise.resolve({ id: bedarfId }) },
    );
    expect(res.status).toBe(401);
  });

  it('Validator: zu kurzes konkretes_vorgehen → 422', async () => {
    const bedTraeger = await userAnlegen({
      email: 'wa-val-bed@test.werkzirkel.de',
      rollen: ['bedarfstraeger'],
    });
    const bedarfId = await bedarfAnlegen({ nutzerId: bedTraeger });
    const macherId = await userAnlegen({
      email: 'wa-val-mach@test.werkzirkel.de',
      rollen: ['macher'],
    });
    const sid = await sessionAnlegen(macherId);
    const werkId = await werkAnlegen({ nutzerId: macherId });

    const res = await werkangebotePost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/bedarfe/${bedarfId}/werkangebote`,
        sessionId: sid,
        body: validWerkangebotBody({
          werk_id: werkId,
          konkretes_vorgehen: 'zu kurz',
        }),
      }),
      { params: Promise.resolve({ id: bedarfId }) },
    );
    expect(res.status).toBe(422);
  });
});

describe('GET /api/v1/bedarfe/:id/werkangebote — Privacy-Matrix (PRD §11A S2)', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  /**
   * Setup-Helper: ein Bedarf, zwei Macher:innen, je ein Werkangebot,
   * plus ein dritter Macher ohne Beteiligung — alles ready fuer die
   * Privacy-Matrix-Asserts.
   */
  async function setup() {
    const bedTraegerId = await userAnlegen({
      email: 'wa-priv-bed@test.werkzirkel.de',
      rollen: ['bedarfstraeger'],
    });
    const bedTraegerSid = await sessionAnlegen(bedTraegerId);
    const bedarfId = await bedarfAnlegen({ nutzerId: bedTraegerId });

    const macherA = await userAnlegen({
      email: 'wa-priv-A@test.werkzirkel.de',
      rollen: ['macher'],
    });
    const macherASid = await sessionAnlegen(macherA);
    const werkAId = await werkAnlegen({ nutzerId: macherA, name: 'Werk A' });

    const macherB = await userAnlegen({
      email: 'wa-priv-B@test.werkzirkel.de',
      rollen: ['macher'],
    });
    const macherBSid = await sessionAnlegen(macherB);
    const werkBId = await werkAnlegen({ nutzerId: macherB, name: 'Werk B' });

    // Macher A reicht ein.
    await werkangebotePost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/bedarfe/${bedarfId}/werkangebote`,
        sessionId: macherASid,
        body: validWerkangebotBody({ werk_id: werkAId }),
      }),
      { params: Promise.resolve({ id: bedarfId }) },
    );

    // Macher B reicht ein.
    await werkangebotePost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/bedarfe/${bedarfId}/werkangebote`,
        sessionId: macherBSid,
        body: validWerkangebotBody({ werk_id: werkBId }),
      }),
      { params: Promise.resolve({ id: bedarfId }) },
    );

    const aussenstehenderMacher = await userAnlegen({
      email: 'wa-priv-aus@test.werkzirkel.de',
      rollen: ['macher'],
    });
    const aussenSid = await sessionAnlegen(aussenstehenderMacher);

    return {
      bedTraegerSid,
      macherASid,
      macherBSid,
      aussenSid,
      bedarfId,
      werkAId,
      werkBId,
    };
  }

  it('anonymer GET → 401', async () => {
    const { bedarfId } = await setup();
    const res = await werkangeboteGet(
      buildRequest({
        method: 'GET',
        path: `/api/v1/bedarfe/${bedarfId}/werkangebote`,
      }),
      { params: Promise.resolve({ id: bedarfId }) },
    );
    expect(res.status).toBe(401);
  });

  it('fremde Macher:in (kein eigenen Buildangebot) → 403 kein_zugriff', async () => {
    const { bedarfId, aussenSid } = await setup();
    const res = await werkangeboteGet(
      buildRequest({
        method: 'GET',
        path: `/api/v1/bedarfe/${bedarfId}/werkangebote`,
        sessionId: aussenSid,
      }),
      { params: Promise.resolve({ id: bedarfId }) },
    );
    expect(res.status).toBe(403);
    const data = (await res.json()) as { error: { code: string } };
    expect(data.error.code).toBe('kein_zugriff');
  });

  it('Bedarfstraeger:in → 200 mit ALLEN Werkangeboten', async () => {
    const { bedarfId, bedTraegerSid, werkAId, werkBId } = await setup();
    const res = await werkangeboteGet(
      buildRequest({
        method: 'GET',
        path: `/api/v1/bedarfe/${bedarfId}/werkangebote`,
        sessionId: bedTraegerSid,
      }),
      { params: Promise.resolve({ id: bedarfId }) },
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      werkangebote: Array<{ werk_id: string }>;
    };
    expect(data.werkangebote.length).toBe(2);
    const werkIds = data.werkangebote.map((w) => w.werk_id).sort();
    expect(werkIds).toEqual([werkAId, werkBId].sort());
  });

  it('beteiligte Macher:in → 200 mit NUR eigenem Werkangebot', async () => {
    const { bedarfId, macherASid, werkAId, werkBId } = await setup();
    const res = await werkangeboteGet(
      buildRequest({
        method: 'GET',
        path: `/api/v1/bedarfe/${bedarfId}/werkangebote`,
        sessionId: macherASid,
      }),
      { params: Promise.resolve({ id: bedarfId }) },
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      werkangebote: Array<{ werk_id: string }>;
    };
    expect(data.werkangebote.length).toBe(1);
    expect(data.werkangebote[0]?.werk_id).toBe(werkAId);
    expect(data.werkangebote[0]?.werk_id).not.toBe(werkBId);
  });
});

describe('Werk-Detail-Response — KEIN werkangebote-Counter (PRD §11A S2)', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  it('GET /api/v1/werke/:id liefert KEINEN werkangebote-Counter im JSON', async () => {
    const macherId = await userAnlegen({
      email: 'wa-cnt-mach@test.werkzirkel.de',
      rollen: ['macher'],
    });
    const werkId = await werkAnlegen({ nutzerId: macherId });

    const bedTraeger = await userAnlegen({
      email: 'wa-cnt-bed@test.werkzirkel.de',
      rollen: ['bedarfstraeger'],
    });
    const bedarfId = await bedarfAnlegen({ nutzerId: bedTraeger });
    const sid = await sessionAnlegen(macherId);
    await werkangebotePost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/bedarfe/${bedarfId}/werkangebote`,
        sessionId: sid,
        body: validWerkangebotBody({ werk_id: werkId }),
      }),
      { params: Promise.resolve({ id: bedarfId }) },
    );

    const res = await werkDetailGet(
      buildRequest({ method: 'GET', path: `/api/v1/werke/${werkId}` }),
      { params: Promise.resolve({ id: werkId }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    const json = JSON.stringify(body);
    // Schema-Scan: weder Werk-Level- noch verschachtelter werkangebote-Counter.
    expect(json).not.toMatch(/werkangebote_count/);
    expect(json).not.toMatch(/werkangebote_anzahl/);
    expect((body as Record<string, unknown>).werkangebote).toBeUndefined();
  });

  it('WERKANGEBOT_PUBLIC_FIELDS enthaelt keine privat-Felder', () => {
    // Allowlist-Sanity-Check: keine Mail-, Klarname- oder Audit-Felder.
    for (const f of WERKANGEBOT_PUBLIC_FIELDS) {
      expect(f).not.toMatch(/email|klarname|ip|audit/);
    }
  });
});

describe('GET /api/v1/me/werkangebote', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  it('eigene Werkangebote der Macher:in → 200', async () => {
    const bedTraeger = await userAnlegen({
      email: 'wa-me-bed@test.werkzirkel.de',
      rollen: ['bedarfstraeger'],
    });
    const bedarfId = await bedarfAnlegen({ nutzerId: bedTraeger });
    const macherId = await userAnlegen({
      email: 'wa-me-mach@test.werkzirkel.de',
      rollen: ['macher'],
    });
    const sid = await sessionAnlegen(macherId);
    const werkId = await werkAnlegen({ nutzerId: macherId });

    await werkangebotePost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/bedarfe/${bedarfId}/werkangebote`,
        sessionId: sid,
        body: validWerkangebotBody({ werk_id: werkId }),
      }),
      { params: Promise.resolve({ id: bedarfId }) },
    );

    const res = await meWerkangeboteGet(
      buildRequest({
        method: 'GET',
        path: '/api/v1/me/werkangebote',
        sessionId: sid,
      }),
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      werkangebote: Array<{ bedarf_id: string }>;
    };
    expect(data.werkangebote.length).toBe(1);
    expect(data.werkangebote[0]?.bedarf_id).toBe(bedarfId);
  });

  it('anonym → 401', async () => {
    const res = await meWerkangeboteGet(
      buildRequest({ method: 'GET', path: '/api/v1/me/werkangebote' }),
    );
    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/v1/werkangebote/:id — Status-Transitions', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  async function setupWerkangebot() {
    const bedTraegerId = await userAnlegen({
      email: 'wa-st-bed@test.werkzirkel.de',
      rollen: ['bedarfstraeger'],
    });
    const bedTraegerSid = await sessionAnlegen(bedTraegerId);
    const bedarfId = await bedarfAnlegen({ nutzerId: bedTraegerId });

    const macherId = await userAnlegen({
      email: 'wa-st-mach@test.werkzirkel.de',
      rollen: ['macher'],
    });
    const macherSid = await sessionAnlegen(macherId);
    const werkId = await werkAnlegen({ nutzerId: macherId });

    const postRes = await werkangebotePost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/bedarfe/${bedarfId}/werkangebote`,
        sessionId: macherSid,
        body: validWerkangebotBody({ werk_id: werkId }),
      }),
      { params: Promise.resolve({ id: bedarfId }) },
    );
    const { werkangebot: created } = (await postRes.json()) as {
      werkangebot: { id: string };
    };

    return {
      werkangebotId: created.id,
      bedTraegerSid,
      macherSid,
    };
  }

  it('Bedarfstraeger:in setzt in_gespraechen → 200', async () => {
    const { werkangebotId, bedTraegerSid } = await setupWerkangebot();
    const res = await werkangebotPatch(
      buildRequest({
        method: 'PATCH',
        path: `/api/v1/werkangebote/${werkangebotId}`,
        sessionId: bedTraegerSid,
        body: { status: 'in_gespraechen' },
      }),
      { params: Promise.resolve({ id: werkangebotId }) },
    );
    expect(res.status).toBe(200);
    const row = (
      await db
        .select()
        .from(werkangebot)
        .where(eq(werkangebot.id, werkangebotId))
        .limit(1)
    )[0]!;
    expect(row.status).toBe('in_gespraechen');
  });

  it('Bedarfstraeger:in setzt beauftragt direkt von eingereicht → 200', async () => {
    const { werkangebotId, bedTraegerSid } = await setupWerkangebot();
    const res = await werkangebotPatch(
      buildRequest({
        method: 'PATCH',
        path: `/api/v1/werkangebote/${werkangebotId}`,
        sessionId: bedTraegerSid,
        body: { status: 'beauftragt' },
      }),
      { params: Promise.resolve({ id: werkangebotId }) },
    );
    expect(res.status).toBe(200);
  });

  it('Bedarfstraeger:in setzt nicht_gewaehlt → 200', async () => {
    const { werkangebotId, bedTraegerSid } = await setupWerkangebot();
    const res = await werkangebotPatch(
      buildRequest({
        method: 'PATCH',
        path: `/api/v1/werkangebote/${werkangebotId}`,
        sessionId: bedTraegerSid,
        body: { status: 'nicht_gewaehlt' },
      }),
      { params: Promise.resolve({ id: werkangebotId }) },
    );
    expect(res.status).toBe(200);
  });

  it('Macher:in zieht zurueck → 200', async () => {
    const { werkangebotId, macherSid } = await setupWerkangebot();
    const res = await werkangebotPatch(
      buildRequest({
        method: 'PATCH',
        path: `/api/v1/werkangebote/${werkangebotId}`,
        sessionId: macherSid,
        body: { status: 'zurueckgezogen' },
      }),
      { params: Promise.resolve({ id: werkangebotId }) },
    );
    expect(res.status).toBe(200);
    const row = (
      await db
        .select()
        .from(werkangebot)
        .where(eq(werkangebot.id, werkangebotId))
        .limit(1)
    )[0]!;
    expect(row.status).toBe('zurueckgezogen');
  });

  it('Bedarfstraeger:in versucht zurueckgezogen zu setzen → 422 unerlaubter_uebergang', async () => {
    const { werkangebotId, bedTraegerSid } = await setupWerkangebot();
    const res = await werkangebotPatch(
      buildRequest({
        method: 'PATCH',
        path: `/api/v1/werkangebote/${werkangebotId}`,
        sessionId: bedTraegerSid,
        body: { status: 'zurueckgezogen' },
      }),
      { params: Promise.resolve({ id: werkangebotId }) },
    );
    expect(res.status).toBe(422);
    const data = (await res.json()) as { error: { code: string } };
    expect(data.error.code).toBe('unerlaubter_uebergang');
  });

  it('Macher:in versucht beauftragt zu setzen → 422 unerlaubter_uebergang', async () => {
    const { werkangebotId, macherSid } = await setupWerkangebot();
    const res = await werkangebotPatch(
      buildRequest({
        method: 'PATCH',
        path: `/api/v1/werkangebote/${werkangebotId}`,
        sessionId: macherSid,
        body: { status: 'beauftragt' },
      }),
      { params: Promise.resolve({ id: werkangebotId }) },
    );
    expect(res.status).toBe(422);
  });

  it('fremder User → 403 kein_zugriff', async () => {
    const { werkangebotId } = await setupWerkangebot();
    const fremd = await userAnlegen({
      email: 'wa-st-fremd@test.werkzirkel.de',
      rollen: ['macher'],
    });
    const fremdSid = await sessionAnlegen(fremd);
    const res = await werkangebotPatch(
      buildRequest({
        method: 'PATCH',
        path: `/api/v1/werkangebote/${werkangebotId}`,
        sessionId: fremdSid,
        body: { status: 'in_gespraechen' },
      }),
      { params: Promise.resolve({ id: werkangebotId }) },
    );
    expect(res.status).toBe(403);
  });

  it('Wechsel von beauftragt → in_gespraechen ist nicht erlaubt (Endpunkt-Status) → 422 falscher_status', async () => {
    const { werkangebotId, bedTraegerSid } = await setupWerkangebot();
    // Erst beauftragt setzen.
    await werkangebotPatch(
      buildRequest({
        method: 'PATCH',
        path: `/api/v1/werkangebote/${werkangebotId}`,
        sessionId: bedTraegerSid,
        body: { status: 'beauftragt' },
      }),
      { params: Promise.resolve({ id: werkangebotId }) },
    );
    // Versuche zurueck.
    const res = await werkangebotPatch(
      buildRequest({
        method: 'PATCH',
        path: `/api/v1/werkangebote/${werkangebotId}`,
        sessionId: bedTraegerSid,
        body: { status: 'in_gespraechen' },
      }),
      { params: Promise.resolve({ id: werkangebotId }) },
    );
    expect(res.status).toBe(422);
    const data = (await res.json()) as { error: { code: string } };
    expect(data.error.code).toBe('falscher_status');
  });

  it('anonym → 401', async () => {
    const { werkangebotId } = await setupWerkangebot();
    const res = await werkangebotPatch(
      buildRequest({
        method: 'PATCH',
        path: `/api/v1/werkangebote/${werkangebotId}`,
        body: { status: 'in_gespraechen' },
      }),
      { params: Promise.resolve({ id: werkangebotId }) },
    );
    expect(res.status).toBe(401);
  });
});
