/**
 * Integration-Tests fuer Hilfegesuche-API:
 *   POST   /api/v1/hilfegesuche
 *   GET    /api/v1/hilfegesuche
 *   GET    /api/v1/hilfegesuche/:id
 *   DELETE /api/v1/hilfegesuche/:id
 *   POST   /api/v1/hilfegesuche/:id/antwort
 *   DELETE /api/v1/hilfegesuch-antworten/:id
 *   GET    /api/v1/cron/hilfegesuche-ablaufen   (Cron-Lauf)
 *
 * Deckt PRD §8.15 + Akzeptanz-Kriterien des Tasks
 * `task-hilfegesuche-api-und-pages`.
 */

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createId } from '@paralleldrive/cuid2';
import { eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import {
  hilfegesuch,
  hilfegesuchAntwort,
  nutzer,
  session as sessionTable,
} from '@/lib/db/schema';
import { env } from '@/lib/env';
import { buildSessionCookie } from '@/lib/auth/session';

import { POST as listPost, GET as listGet } from '@/app/api/v1/hilfegesuche/route';
import {
  GET as detailGet,
  DELETE as detailDelete,
} from '@/app/api/v1/hilfegesuche/[id]/route';
import { POST as antwortPost } from '@/app/api/v1/hilfegesuche/[id]/antwort/route';
import { DELETE as antwortDelete } from '@/app/api/v1/hilfegesuch-antworten/[id]/route';
import { GET as cronGet } from '@/app/api/v1/cron/hilfegesuche-ablaufen/route';

import { truncateAll } from '../_helpers/db-cleanup';

const APP_ORIGIN = new URL(env.APP_URL).origin;

async function userAnlegen(opts: {
  email: string;
  stadtId?: string;
  rollen?: ('macher' | 'bedarfstraeger' | 'foerderer' | 'kurator' | 'admin')[];
}): Promise<string> {
  const id = createId();
  await db.insert(nutzer).values({
    id,
    email: opts.email,
    klarname: `Klar ${opts.email}`,
    anzeigename: `anz-${id.slice(0, 6)}`,
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

function buildRequest(opts: {
  method: 'GET' | 'POST' | 'DELETE';
  path: string;
  sessionId?: string;
  body?: unknown;
  cronSecret?: string;
}): Request {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    origin: APP_ORIGIN,
    'x-forwarded-for': '127.0.0.1',
  };
  if (opts.sessionId) {
    headers.cookie = buildSessionCookie(opts.sessionId).split(';')[0]!;
  }
  if (opts.cronSecret) {
    headers['x-cron-secret'] = opts.cronSecret;
  }
  return new Request(`${APP_ORIGIN}${opts.path}`, {
    method: opts.method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

function isoIn(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

const validHgBody = (extra: Record<string, unknown> = {}) => ({
  titel: 'Brauche schnellen UX-Rat',
  beschreibung: 'Onboarding ist holprig — bitte einmal drueberschauen.',
  tags: ['ux'],
  gueltig_bis: isoIn(10),
  ...extra,
});

describe('POST /api/v1/hilfegesuche', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  it('Anonymer Aufruf → 401', async () => {
    const res = await listPost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/hilfegesuche',
        body: validHgBody(),
      }),
    );
    expect(res.status).toBe(401);
  });

  it('Eingeloggter Aufruf → 201 + Stadt erbt vom Nutzer', async () => {
    const u = await userAnlegen({ email: 'hg-create@test.werkzirkel.de' });
    const sid = await sessionAnlegen(u);
    const res = await listPost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/hilfegesuche',
        sessionId: sid,
        body: validHgBody(),
      }),
    );
    expect(res.status).toBe(201);
    const data = (await res.json()) as {
      hilfegesuch: { id: string; stadtId: string; status: string };
    };
    expect(data.hilfegesuch.status).toBe('offen');
    expect(data.hilfegesuch.stadtId).toBe('hh');
  });

  it('gueltig_bis > now + 14 Tage → 422 mit deutscher Message', async () => {
    const u = await userAnlegen({ email: 'hg-toolong@test.werkzirkel.de' });
    const sid = await sessionAnlegen(u);
    const res = await listPost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/hilfegesuche',
        sessionId: sid,
        body: validHgBody({ gueltig_bis: isoIn(20) }),
      }),
    );
    expect(res.status).toBe(422);
    const data = (await res.json()) as {
      fehler: string;
      details: Record<string, string[]>;
    };
    expect(data.fehler).toBe('validierung');
    const msg = data.details.gueltig_bis?.[0] ?? '';
    expect(msg.toLowerCase()).toContain('14 tage');
  });
});

describe('GET /api/v1/hilfegesuche', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  it('liefert nur offene Hilfegesuche der eigenen Stadt (default)', async () => {
    const userA = await userAnlegen({ email: 'hg-l-a@test.werkzirkel.de' });
    const userB = await userAnlegen({
      email: 'hg-l-b@test.werkzirkel.de',
      stadtId: 'b',
    });
    await db.insert(hilfegesuch).values({
      id: createId(),
      nutzerId: userA,
      stadtId: 'hh',
      titel: 'HH-offen',
      beschreibung: 'lorem ipsum hilfetext genug',
      tags: ['marketing'],
      gueltigBis: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      status: 'offen',
    });
    await db.insert(hilfegesuch).values({
      id: createId(),
      nutzerId: userB,
      stadtId: 'b',
      titel: 'B-offen',
      beschreibung: 'lorem ipsum hilfetext genug',
      tags: [],
      gueltigBis: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      status: 'offen',
    });
    await db.insert(hilfegesuch).values({
      id: createId(),
      nutzerId: userA,
      stadtId: 'hh',
      titel: 'HH-abgelaufen',
      beschreibung: 'lorem ipsum hilfetext genug',
      tags: [],
      gueltigBis: new Date(Date.now() - 24 * 60 * 60 * 1000),
      status: 'abgelaufen',
    });
    const viewer = await userAnlegen({ email: 'hg-l-v@test.werkzirkel.de' });
    const sid = await sessionAnlegen(viewer);

    const res = await listGet(
      buildRequest({
        method: 'GET',
        path: '/api/v1/hilfegesuche?stadt_id=hh',
        sessionId: sid,
      }),
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      hilfegesuche: Array<{ titel: string; status: string }>;
    };
    expect(data.hilfegesuche.length).toBe(1);
    expect(data.hilfegesuche[0]?.titel).toBe('HH-offen');
  });

  it('Filter ?tag=marketing → nur Hilfegesuche mit Tag', async () => {
    const u = await userAnlegen({ email: 'hg-tag@test.werkzirkel.de' });
    const sid = await sessionAnlegen(u);
    await db.insert(hilfegesuch).values({
      id: createId(),
      nutzerId: u,
      stadtId: 'hh',
      titel: 'mit-mk',
      beschreibung: 'lorem ipsum hilfetext genug',
      tags: ['marketing'],
      gueltigBis: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      status: 'offen',
    });
    await db.insert(hilfegesuch).values({
      id: createId(),
      nutzerId: u,
      stadtId: 'hh',
      titel: 'ohne',
      beschreibung: 'lorem ipsum hilfetext genug',
      tags: ['ux'],
      gueltigBis: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      status: 'offen',
    });
    const res = await listGet(
      buildRequest({
        method: 'GET',
        path: '/api/v1/hilfegesuche?tag=marketing',
        sessionId: sid,
      }),
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      hilfegesuche: Array<{ titel: string }>;
    };
    expect(data.hilfegesuche.map((h) => h.titel)).toEqual(['mit-mk']);
  });

  it('anonyme Liste → 401', async () => {
    const res = await listGet(
      buildRequest({ method: 'GET', path: '/api/v1/hilfegesuche' }),
    );
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/hilfegesuche/:id/antwort', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  it('Antwort posten → 201 + status wechselt von offen auf beantwortet', async () => {
    const owner = await userAnlegen({ email: 'hg-ans-o@test.werkzirkel.de' });
    const ownerSid = await sessionAnlegen(owner);
    const helper = await userAnlegen({ email: 'hg-ans-h@test.werkzirkel.de' });
    const helperSid = await sessionAnlegen(helper);

    const cr = await listPost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/hilfegesuche',
        sessionId: ownerSid,
        body: validHgBody(),
      }),
    );
    const { hilfegesuch: created } = (await cr.json()) as {
      hilfegesuch: { id: string };
    };
    const id = created.id;

    const res = await antwortPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/hilfegesuche/${id}/antwort`,
        sessionId: helperSid,
        body: { text: 'Hier ein konkreter Hinweis.' },
      }),
      { params: Promise.resolve({ id }) },
    );
    expect(res.status).toBe(201);

    const row = (
      await db.select().from(hilfegesuch).where(eq(hilfegesuch.id, id)).limit(1)
    )[0]!;
    expect(row.status).toBe('beantwortet');
  });

  it('Antwort < 10 Zeichen → 422', async () => {
    const u = await userAnlegen({ email: 'hg-shortans@test.werkzirkel.de' });
    const sid = await sessionAnlegen(u);
    const cr = await listPost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/hilfegesuche',
        sessionId: sid,
        body: validHgBody(),
      }),
    );
    const { hilfegesuch: created } = (await cr.json()) as {
      hilfegesuch: { id: string };
    };
    const res = await antwortPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/hilfegesuche/${created.id}/antwort`,
        sessionId: sid,
        body: { text: 'kurz' },
      }),
      { params: Promise.resolve({ id: created.id }) },
    );
    expect(res.status).toBe(422);
  });

  it('Antwort an abgelaufenes Hilfegesuch → 422', async () => {
    const owner = await userAnlegen({ email: 'hg-exp-o@test.werkzirkel.de' });
    const ownerSid = await sessionAnlegen(owner);
    const helper = await userAnlegen({ email: 'hg-exp-h@test.werkzirkel.de' });
    const helperSid = await sessionAnlegen(helper);

    const id = createId();
    await db.insert(hilfegesuch).values({
      id,
      nutzerId: owner,
      stadtId: 'hh',
      titel: 'expired',
      beschreibung: 'lorem ipsum hilfetext genug',
      tags: [],
      gueltigBis: new Date(Date.now() - 24 * 60 * 60 * 1000),
      status: 'abgelaufen',
    });
    void ownerSid;

    const res = await antwortPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/hilfegesuche/${id}/antwort`,
        sessionId: helperSid,
        body: { text: 'Hilfreiche Antwort hier.' },
      }),
      { params: Promise.resolve({ id }) },
    );
    expect(res.status).toBe(422);
    const data = (await res.json()) as { error: { code: string } };
    expect(data.error.code).toBe('hilfegesuch_abgelaufen');
  });

  it('GET Detail liefert Antworten in Reihenfolge', async () => {
    const owner = await userAnlegen({ email: 'hg-dt-o@test.werkzirkel.de' });
    const ownerSid = await sessionAnlegen(owner);
    const helper = await userAnlegen({ email: 'hg-dt-h@test.werkzirkel.de' });
    const helperSid = await sessionAnlegen(helper);

    const cr = await listPost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/hilfegesuche',
        sessionId: ownerSid,
        body: validHgBody(),
      }),
    );
    const { hilfegesuch: created } = (await cr.json()) as {
      hilfegesuch: { id: string };
    };

    await antwortPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/hilfegesuche/${created.id}/antwort`,
        sessionId: helperSid,
        body: { text: 'Erste Antwort hier.' },
      }),
      { params: Promise.resolve({ id: created.id }) },
    );
    await antwortPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/hilfegesuche/${created.id}/antwort`,
        sessionId: ownerSid,
        body: { text: 'Zweite Antwort folgt.' },
      }),
      { params: Promise.resolve({ id: created.id }) },
    );

    const detail = await detailGet(
      buildRequest({
        method: 'GET',
        path: `/api/v1/hilfegesuche/${created.id}`,
        sessionId: ownerSid,
      }),
      { params: Promise.resolve({ id: created.id }) },
    );
    expect(detail.status).toBe(200);
    const data = (await detail.json()) as {
      antworten: Array<{ text: string; autor: { id: string } }>;
    };
    expect(data.antworten.length).toBe(2);
    expect(data.antworten[0]!.text).toBe('Erste Antwort hier.');
  });
});

describe('DELETE-Endpoints', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  it('Owner loescht eigenes Hilfegesuch → 204, kaskadiert Antworten', async () => {
    const owner = await userAnlegen({ email: 'hg-del-o@test.werkzirkel.de' });
    const ownerSid = await sessionAnlegen(owner);
    const helper = await userAnlegen({ email: 'hg-del-h@test.werkzirkel.de' });
    const helperSid = await sessionAnlegen(helper);

    const cr = await listPost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/hilfegesuche',
        sessionId: ownerSid,
        body: validHgBody(),
      }),
    );
    const { hilfegesuch: created } = (await cr.json()) as {
      hilfegesuch: { id: string };
    };

    await antwortPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/hilfegesuche/${created.id}/antwort`,
        sessionId: helperSid,
        body: { text: 'Soll mit dem Hilfegesuch verschwinden.' },
      }),
      { params: Promise.resolve({ id: created.id }) },
    );

    const del = await detailDelete(
      buildRequest({
        method: 'DELETE',
        path: `/api/v1/hilfegesuche/${created.id}`,
        sessionId: ownerSid,
      }),
      { params: Promise.resolve({ id: created.id }) },
    );
    expect(del.status).toBe(204);

    const hg = await db
      .select()
      .from(hilfegesuch)
      .where(eq(hilfegesuch.id, created.id));
    expect(hg.length).toBe(0);

    const ant = await db
      .select()
      .from(hilfegesuchAntwort)
      .where(eq(hilfegesuchAntwort.hilfegesuchId, created.id));
    expect(ant.length).toBe(0);
  });

  it('Fremder kann nicht loeschen → 403', async () => {
    const owner = await userAnlegen({ email: 'hg-fr-o@test.werkzirkel.de' });
    const ownerSid = await sessionAnlegen(owner);
    const fremd = await userAnlegen({ email: 'hg-fr-f@test.werkzirkel.de' });
    const fremdSid = await sessionAnlegen(fremd);
    const cr = await listPost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/hilfegesuche',
        sessionId: ownerSid,
        body: validHgBody(),
      }),
    );
    const { hilfegesuch: created } = (await cr.json()) as {
      hilfegesuch: { id: string };
    };
    const res = await detailDelete(
      buildRequest({
        method: 'DELETE',
        path: `/api/v1/hilfegesuche/${created.id}`,
        sessionId: fremdSid,
      }),
      { params: Promise.resolve({ id: created.id }) },
    );
    expect(res.status).toBe(403);
  });

  it('Autor:in loescht eigene Antwort → 204', async () => {
    const owner = await userAnlegen({ email: 'hg-da-o@test.werkzirkel.de' });
    const ownerSid = await sessionAnlegen(owner);
    const helper = await userAnlegen({ email: 'hg-da-h@test.werkzirkel.de' });
    const helperSid = await sessionAnlegen(helper);
    const cr = await listPost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/hilfegesuche',
        sessionId: ownerSid,
        body: validHgBody(),
      }),
    );
    const { hilfegesuch: created } = (await cr.json()) as {
      hilfegesuch: { id: string };
    };
    const ap = await antwortPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/hilfegesuche/${created.id}/antwort`,
        sessionId: helperSid,
        body: { text: 'Loesch mich gleich wieder.' },
      }),
      { params: Promise.resolve({ id: created.id }) },
    );
    const { antwort } = (await ap.json()) as { antwort: { id: string } };

    const res = await antwortDelete(
      buildRequest({
        method: 'DELETE',
        path: `/api/v1/hilfegesuch-antworten/${antwort.id}`,
        sessionId: helperSid,
      }),
      { params: Promise.resolve({ id: antwort.id }) },
    );
    expect(res.status).toBe(204);
    const rows = await db
      .select()
      .from(hilfegesuchAntwort)
      .where(eq(hilfegesuchAntwort.id, antwort.id));
    expect(rows.length).toBe(0);
  });

  it('Fremde:r loescht Antwort nicht → 403', async () => {
    const owner = await userAnlegen({ email: 'hg-da2-o@test.werkzirkel.de' });
    const ownerSid = await sessionAnlegen(owner);
    const helper = await userAnlegen({ email: 'hg-da2-h@test.werkzirkel.de' });
    const helperSid = await sessionAnlegen(helper);
    const fremd = await userAnlegen({ email: 'hg-da2-f@test.werkzirkel.de' });
    const fremdSid = await sessionAnlegen(fremd);
    const cr = await listPost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/hilfegesuche',
        sessionId: ownerSid,
        body: validHgBody(),
      }),
    );
    const { hilfegesuch: created } = (await cr.json()) as {
      hilfegesuch: { id: string };
    };
    const ap = await antwortPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/hilfegesuche/${created.id}/antwort`,
        sessionId: helperSid,
        body: { text: 'Bleibt bestehen.' },
      }),
      { params: Promise.resolve({ id: created.id }) },
    );
    const { antwort } = (await ap.json()) as { antwort: { id: string } };

    const res = await antwortDelete(
      buildRequest({
        method: 'DELETE',
        path: `/api/v1/hilfegesuch-antworten/${antwort.id}`,
        sessionId: fremdSid,
      }),
      { params: Promise.resolve({ id: antwort.id }) },
    );
    expect(res.status).toBe(403);
  });
});

describe('GET /api/v1/cron/hilfegesuche-ablaufen', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  it('Ohne X-Cron-Secret → 401', async () => {
    const res = await cronGet(
      new Request(`${APP_ORIGIN}/api/v1/cron/hilfegesuche-ablaufen`),
    );
    expect(res.status).toBe(401);
  });

  it('Mit Secret: setzt abgelaufene Hilfegesuche auf status="abgelaufen"', async () => {
    const u = await userAnlegen({ email: 'hg-cr@test.werkzirkel.de' });
    const idAbgelaufen = createId();
    const idOffen = createId();
    const idBeantwortet = createId();

    await db.insert(hilfegesuch).values([
      {
        id: idAbgelaufen,
        nutzerId: u,
        stadtId: 'hh',
        titel: 'past',
        beschreibung: 'lorem ipsum hilfetext genug',
        tags: [],
        gueltigBis: new Date(Date.now() - 24 * 60 * 60 * 1000),
        status: 'offen',
      },
      {
        id: idOffen,
        nutzerId: u,
        stadtId: 'hh',
        titel: 'future',
        beschreibung: 'lorem ipsum hilfetext genug',
        tags: [],
        gueltigBis: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        status: 'offen',
      },
      {
        id: idBeantwortet,
        nutzerId: u,
        stadtId: 'hh',
        titel: 'past-answered',
        beschreibung: 'lorem ipsum hilfetext genug',
        tags: [],
        gueltigBis: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        status: 'beantwortet',
      },
    ]);

    const secret = env.CRON_SECRET?.trim();
    expect(secret, 'CRON_SECRET muss fuer Cron-Test gesetzt sein').toBeTruthy();
    const res = await cronGet(
      buildRequest({
        method: 'GET',
        path: '/api/v1/cron/hilfegesuche-ablaufen',
        cronSecret: secret!,
      }),
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { abgelaufen: number };
    expect(data.abgelaufen).toBe(2);

    const reload = await db.select().from(hilfegesuch);
    const map = new Map(reload.map((r) => [r.id, r.status]));
    expect(map.get(idAbgelaufen)).toBe('abgelaufen');
    expect(map.get(idBeantwortet)).toBe('abgelaufen');
    expect(map.get(idOffen)).toBe('offen');
  });
});
