/**
 * Integration-Tests fuer die Foerderprofil-API:
 *   POST   /api/v1/foerderprofile
 *   GET    /api/v1/foerderprofile
 *   GET    /api/v1/foerderprofile/:id
 *   PATCH  /api/v1/foerderprofile/:id
 *   POST   /api/v1/foerderprofile/:id/einreichen
 *   POST   /api/v1/foerderprofile/:id/pausieren
 *   POST   /api/v1/foerderprofile/:id/reaktivieren
 *   POST   /api/v1/kurator/foerderprofile/:id/verifizieren
 *   POST   /api/v1/kurator/foerderprofile/:id/ablehnen
 *
 * Deckt PRD §F-701..§F-706, §11A Schutz Kulturverlust 5, §19.
 */

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createId } from '@paralleldrive/cuid2';
import { eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import {
  foerderprofil,
  nutzer,
  session as sessionTable,
} from '@/lib/db/schema';
import { env } from '@/lib/env';
import { buildSessionCookie } from '@/lib/auth/session';

import { POST as listPost, GET as listGet } from '@/app/api/v1/foerderprofile/route';
import {
  GET as detailGet,
  PATCH as detailPatch,
} from '@/app/api/v1/foerderprofile/[id]/route';
import { POST as einreichenPost } from '@/app/api/v1/foerderprofile/[id]/einreichen/route';
import { POST as pausierenPost } from '@/app/api/v1/foerderprofile/[id]/pausieren/route';
import { POST as reaktivierenPost } from '@/app/api/v1/foerderprofile/[id]/reaktivieren/route';
import { POST as verifizierenPost } from '@/app/api/v1/kurator/foerderprofile/[id]/verifizieren/route';
import { POST as ablehnenPost } from '@/app/api/v1/kurator/foerderprofile/[id]/ablehnen/route';
import {
  EQUITY_HINWEISTEXT,
  FOERDERPROFIL_PUBLIC_FIELDS,
} from '@/lib/foerderprofil/serialize';

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

describe('POST /api/v1/foerderprofile', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  it('Foerder:in legt Profil an → 201 mit Status entwurf', async () => {
    const userId = await userAnlegen({
      email: 'fp-anl@test.werkzirkel.de',
      rollen: ['foerderer'],
    });
    const sid = await sessionAnlegen(userId);

    const res = await listPost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/foerderprofile',
        sessionId: sid,
        body: {
          organisation: 'Stiftung Werkstattkultur',
          foerderart: 'geld',
          gegenleistung_typ: 'sichtbarkeit',
        },
      }),
    );
    expect(res.status).toBe(201);
    const data = (await res.json()) as {
      foerderprofil: { id: string; verifikation_status: string };
    };
    expect(data.foerderprofil.verifikation_status).toBe('entwurf');
  });

  it('User ohne foerderer-Rolle → 403', async () => {
    const userId = await userAnlegen({
      email: 'fp-noforder@test.werkzirkel.de',
      rollen: ['macher'],
    });
    const sid = await sessionAnlegen(userId);

    const res = await listPost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/foerderprofile',
        sessionId: sid,
        body: {
          organisation: 'Test GmbH',
          foerderart: 'geld',
          gegenleistung_typ: 'keine',
        },
      }),
    );
    expect(res.status).toBe(403);
  });

  it('zweites Profil pro User → 422 bereits_vorhanden', async () => {
    const userId = await userAnlegen({
      email: 'fp-dup@test.werkzirkel.de',
      rollen: ['foerderer'],
    });
    const sid = await sessionAnlegen(userId);

    await listPost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/foerderprofile',
        sessionId: sid,
        body: {
          organisation: 'Erst',
          foerderart: 'geld',
          gegenleistung_typ: 'keine',
        },
      }),
    );
    const res2 = await listPost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/foerderprofile',
        sessionId: sid,
        body: {
          organisation: 'Zweit',
          foerderart: 'geld',
          gegenleistung_typ: 'keine',
        },
      }),
    );
    expect(res2.status).toBe(422);
    const data = (await res2.json()) as { error: { code: string } };
    expect(data.error.code).toBe('bereits_vorhanden');
  });

  it('ohne Session → 401', async () => {
    const res = await listPost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/foerderprofile',
        body: { organisation: 'x', foerderart: 'geld', gegenleistung_typ: 'keine' },
      }),
    );
    expect(res.status).toBe(401);
  });

  it('Validator fehlerhafte Daten → 422', async () => {
    const userId = await userAnlegen({
      email: 'fp-v@test.werkzirkel.de',
      rollen: ['foerderer'],
    });
    const sid = await sessionAnlegen(userId);
    const res = await listPost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/foerderprofile',
        sessionId: sid,
        body: { organisation: '', foerderart: 'ungueltig', gegenleistung_typ: 'keine' },
      }),
    );
    expect(res.status).toBe(422);
  });
});

describe('Lifecycle: einreichen → verifizieren → pausieren → reaktivieren', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  it('Voller Happy-Path', async () => {
    const foerderer = await userAnlegen({
      email: 'fp-life@test.werkzirkel.de',
      rollen: ['foerderer'],
    });
    const foerdererSid = await sessionAnlegen(foerderer);

    // Anlegen
    const createRes = await listPost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/foerderprofile',
        sessionId: foerdererSid,
        body: {
          organisation: 'Hamburger Lokalstiftung',
          foerderart: 'mischung',
          gegenleistung_typ: 'sichtbarkeit',
        },
      }),
    );
    expect(createRes.status).toBe(201);
    const { foerderprofil: created } = (await createRes.json()) as {
      foerderprofil: { id: string };
    };
    const fpId = created.id;

    // Einreichen
    const einreichenRes = await einreichenPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/foerderprofile/${fpId}/einreichen`,
        sessionId: foerdererSid,
      }),
      { params: Promise.resolve({ id: fpId }) },
    );
    expect(einreichenRes.status).toBe(200);
    const row1 = (await db.select().from(foerderprofil).where(eq(foerderprofil.id, fpId)).limit(1))[0]!;
    expect(row1.verifikationStatus).toBe('in_verifikation');

    // Kurator verifiziert
    const kurator = await userAnlegen({
      email: 'fp-life-kur@test.werkzirkel.de',
      rollen: ['kurator'],
      stadtId: 'hh',
    });
    const kuratorSid = await sessionAnlegen(kurator);

    const verifRes = await verifizierenPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/kurator/foerderprofile/${fpId}/verifizieren`,
        sessionId: kuratorSid,
      }),
      { params: Promise.resolve({ id: fpId }) },
    );
    expect(verifRes.status).toBe(200);
    const row2 = (await db.select().from(foerderprofil).where(eq(foerderprofil.id, fpId)).limit(1))[0]!;
    expect(row2.verifikationStatus).toBe('verifiziert');
    expect(row2.verifiziererId).toBe(kurator);
    expect(row2.verifiziertAm).toBeTruthy();

    // Pausieren
    const pausRes = await pausierenPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/foerderprofile/${fpId}/pausieren`,
        sessionId: foerdererSid,
      }),
      { params: Promise.resolve({ id: fpId }) },
    );
    expect(pausRes.status).toBe(200);
    const row3 = (await db.select().from(foerderprofil).where(eq(foerderprofil.id, fpId)).limit(1))[0]!;
    expect(row3.verifikationStatus).toBe('pausiert');
    expect(row3.pausiertSeit).toBeTruthy();

    // Reaktivieren
    const reakRes = await reaktivierenPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/foerderprofile/${fpId}/reaktivieren`,
        sessionId: foerdererSid,
      }),
      { params: Promise.resolve({ id: fpId }) },
    );
    expect(reakRes.status).toBe(200);
    const row4 = (await db.select().from(foerderprofil).where(eq(foerderprofil.id, fpId)).limit(1))[0]!;
    expect(row4.verifikationStatus).toBe('in_verifikation');
    expect(row4.pausiertSeit).toBeNull();
  });

  it('Kurator anderer Stadt → 403 beim Verifizieren', async () => {
    const foerderer = await userAnlegen({
      email: 'fp-kur-fr@test.werkzirkel.de',
      rollen: ['foerderer'],
      stadtId: 'hh',
    });
    const foerdererSid = await sessionAnlegen(foerderer);

    const createRes = await listPost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/foerderprofile',
        sessionId: foerdererSid,
        body: { organisation: 'X', foerderart: 'geld', gegenleistung_typ: 'keine' },
      }),
    );
    const { foerderprofil: created } = (await createRes.json()) as {
      foerderprofil: { id: string };
    };
    const fpId = created.id;

    await einreichenPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/foerderprofile/${fpId}/einreichen`,
        sessionId: foerdererSid,
      }),
      { params: Promise.resolve({ id: fpId }) },
    );

    const fremdKurator = await userAnlegen({
      email: 'fp-kur-b@test.werkzirkel.de',
      rollen: ['kurator'],
      stadtId: 'b',
    });
    const fkSid = await sessionAnlegen(fremdKurator);

    const res = await verifizierenPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/kurator/foerderprofile/${fpId}/verifizieren`,
        sessionId: fkSid,
      }),
      { params: Promise.resolve({ id: fpId }) },
    );
    expect(res.status).toBe(403);
  });

  it('Ablehnen mit Grund → status=abgelehnt', async () => {
    const foerderer = await userAnlegen({
      email: 'fp-abl@test.werkzirkel.de',
      rollen: ['foerderer'],
    });
    const foerdererSid = await sessionAnlegen(foerderer);
    const createRes = await listPost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/foerderprofile',
        sessionId: foerdererSid,
        body: { organisation: 'X', foerderart: 'geld', gegenleistung_typ: 'keine' },
      }),
    );
    const { foerderprofil: created } = (await createRes.json()) as {
      foerderprofil: { id: string };
    };
    const fpId = created.id;
    await einreichenPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/foerderprofile/${fpId}/einreichen`,
        sessionId: foerdererSid,
      }),
      { params: Promise.resolve({ id: fpId }) },
    );

    const kurator = await userAnlegen({
      email: 'fp-abl-kur@test.werkzirkel.de',
      rollen: ['kurator'],
    });
    const ksid = await sessionAnlegen(kurator);

    const res = await ablehnenPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/kurator/foerderprofile/${fpId}/ablehnen`,
        sessionId: ksid,
        body: { grund: 'Klarname noch nicht verifizierbar.' },
      }),
      { params: Promise.resolve({ id: fpId }) },
    );
    expect(res.status).toBe(200);
    const row = (await db.select().from(foerderprofil).where(eq(foerderprofil.id, fpId)).limit(1))[0]!;
    expect(row.verifikationStatus).toBe('abgelehnt');
  });
});

describe('GET /api/v1/foerderprofile/:id — Equity-Hinweistext + Privacy', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  it('Equity-Offline-Profil rendert equity_hinweistext explizit', async () => {
    const foerderer = await userAnlegen({
      email: 'fp-eq@test.werkzirkel.de',
      rollen: ['foerderer'],
    });
    // Direkt in DB anlegen (status='verifiziert') statt durch Workflow:
    const fpId = createId();
    await db.insert(foerderprofil).values({
      id: fpId,
      nutzerId: foerderer,
      organisation: 'Equity Hamburg',
      foerderart: 'mischung',
      gegenleistungTyp: 'equity_offline',
      gegenleistungText: 'Wir reden ueber Beteiligungen offline.',
      verifikationStatus: 'verifiziert',
      verifiziertAm: new Date(),
    });

    const sid = await sessionAnlegen(foerderer);
    const res = await detailGet(
      buildRequest({
        method: 'GET',
        path: `/api/v1/foerderprofile/${fpId}`,
        sessionId: sid,
      }),
      { params: Promise.resolve({ id: fpId }) },
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      foerderprofil: { equity_hinweistext?: string };
    };
    expect(data.foerderprofil.equity_hinweistext).toBe(EQUITY_HINWEISTEXT);
  });

  it('NICHT-Equity-Profil hat KEIN equity_hinweistext', async () => {
    const foerderer = await userAnlegen({
      email: 'fp-noneq@test.werkzirkel.de',
      rollen: ['foerderer'],
    });
    const fpId = createId();
    await db.insert(foerderprofil).values({
      id: fpId,
      nutzerId: foerderer,
      organisation: 'Geld Hamburg',
      foerderart: 'geld',
      gegenleistungTyp: 'sichtbarkeit',
      verifikationStatus: 'verifiziert',
      verifiziertAm: new Date(),
    });
    const sid = await sessionAnlegen(foerderer);
    const res = await detailGet(
      buildRequest({
        method: 'GET',
        path: `/api/v1/foerderprofile/${fpId}`,
        sessionId: sid,
      }),
      { params: Promise.resolve({ id: fpId }) },
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      foerderprofil: Record<string, unknown>;
    };
    expect('equity_hinweistext' in data.foerderprofil).toBe(false);
  });

  it('JSON enthaelt KEINE Stripe-IDs (sensible Felder)', async () => {
    const foerderer = await userAnlegen({
      email: 'fp-stripe@test.werkzirkel.de',
      rollen: ['foerderer'],
    });
    const fpId = createId();
    await db.insert(foerderprofil).values({
      id: fpId,
      nutzerId: foerderer,
      organisation: 'Stripe Test',
      foerderart: 'geld',
      gegenleistungTyp: 'keine',
      verifikationStatus: 'verifiziert',
      verifiziertAm: new Date(),
    });
    const sid = await sessionAnlegen(foerderer);
    const res = await detailGet(
      buildRequest({
        method: 'GET',
        path: `/api/v1/foerderprofile/${fpId}`,
        sessionId: sid,
      }),
      { params: Promise.resolve({ id: fpId }) },
    );
    const data = (await res.json()) as {
      foerderprofil: Record<string, unknown>;
    };
    const keys = Object.keys(data.foerderprofil);
    // Sensitive Felder duerfen nicht im JSON erscheinen.
    expect(keys).not.toContain('stripe_customer_id');
    expect(keys).not.toContain('stripe_subscription_id');
    // alle gelieferten Felder muessen in der Allowlist sein.
    for (const k of keys) {
      expect(FOERDERPROFIL_PUBLIC_FIELDS as readonly string[]).toContain(k);
    }
  });

  it('anonymer GET auf verifiziertes Profil → 401', async () => {
    const foerderer = await userAnlegen({
      email: 'fp-anon@test.werkzirkel.de',
      rollen: ['foerderer'],
    });
    const fpId = createId();
    await db.insert(foerderprofil).values({
      id: fpId,
      nutzerId: foerderer,
      organisation: 'Anon Test',
      foerderart: 'geld',
      gegenleistungTyp: 'keine',
      verifikationStatus: 'verifiziert',
    });
    const res = await detailGet(
      buildRequest({
        method: 'GET',
        path: `/api/v1/foerderprofile/${fpId}`,
      }),
      { params: Promise.resolve({ id: fpId }) },
    );
    expect(res.status).toBe(401);
  });

  it('GET auf entwurf-Profil eines fremden Users → 404 (privacy)', async () => {
    const owner = await userAnlegen({
      email: 'fp-own@test.werkzirkel.de',
      rollen: ['foerderer'],
    });
    const fpId = createId();
    await db.insert(foerderprofil).values({
      id: fpId,
      nutzerId: owner,
      organisation: 'Entwurf',
      foerderart: 'geld',
      gegenleistungTyp: 'keine',
      verifikationStatus: 'entwurf',
    });
    const fremd = await userAnlegen({ email: 'fp-fremd@test.werkzirkel.de' });
    const sid = await sessionAnlegen(fremd);
    const res = await detailGet(
      buildRequest({
        method: 'GET',
        path: `/api/v1/foerderprofile/${fpId}`,
        sessionId: sid,
      }),
      { params: Promise.resolve({ id: fpId }) },
    );
    expect(res.status).toBe(404);
  });
});

describe('GET /api/v1/foerderprofile (Liste)', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  it('Liefert nur verifizierte Profile (eingeloggt)', async () => {
    const user = await userAnlegen({ email: 'fp-list@test.werkzirkel.de' });
    const sid = await sessionAnlegen(user);

    const ownerA = await userAnlegen({
      email: 'fp-list-a@test.werkzirkel.de',
      rollen: ['foerderer'],
    });
    const ownerB = await userAnlegen({
      email: 'fp-list-b@test.werkzirkel.de',
      rollen: ['foerderer'],
    });
    await db.insert(foerderprofil).values({
      id: createId(),
      nutzerId: ownerA,
      organisation: 'Verif',
      foerderart: 'geld',
      gegenleistungTyp: 'keine',
      verifikationStatus: 'verifiziert',
    });
    await db.insert(foerderprofil).values({
      id: createId(),
      nutzerId: ownerB,
      organisation: 'Entwurf',
      foerderart: 'geld',
      gegenleistungTyp: 'keine',
      verifikationStatus: 'entwurf',
    });

    const res = await listGet(
      buildRequest({
        method: 'GET',
        path: '/api/v1/foerderprofile',
        sessionId: sid,
      }),
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      foerderprofile: Array<{ verifikation_status: string }>;
    };
    expect(data.foerderprofile.length).toBe(1);
    expect(data.foerderprofile[0]?.verifikation_status).toBe('verifiziert');
  });

  it('anonyme Liste → 401', async () => {
    const res = await listGet(
      buildRequest({
        method: 'GET',
        path: '/api/v1/foerderprofile',
      }),
    );
    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/v1/foerderprofile/:id', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  it('Owner darf editieren wenn status=entwurf', async () => {
    const owner = await userAnlegen({
      email: 'fp-pat@test.werkzirkel.de',
      rollen: ['foerderer'],
    });
    const sid = await sessionAnlegen(owner);
    const fpId = createId();
    await db.insert(foerderprofil).values({
      id: fpId,
      nutzerId: owner,
      organisation: 'Alt',
      foerderart: 'geld',
      gegenleistungTyp: 'keine',
      verifikationStatus: 'entwurf',
    });

    const res = await detailPatch(
      buildRequest({
        method: 'PATCH',
        path: `/api/v1/foerderprofile/${fpId}`,
        sessionId: sid,
        body: { organisation: 'Neu' },
      }),
      { params: Promise.resolve({ id: fpId }) },
    );
    expect(res.status).toBe(200);
    const row = (await db.select().from(foerderprofil).where(eq(foerderprofil.id, fpId)).limit(1))[0]!;
    expect(row.organisation).toBe('Neu');
  });

  it('Fremder darf NICHT editieren → 403', async () => {
    const owner = await userAnlegen({
      email: 'fp-pat-own@test.werkzirkel.de',
      rollen: ['foerderer'],
    });
    const fpId = createId();
    await db.insert(foerderprofil).values({
      id: fpId,
      nutzerId: owner,
      organisation: 'Alt',
      foerderart: 'geld',
      gegenleistungTyp: 'keine',
      verifikationStatus: 'entwurf',
    });
    const fremd = await userAnlegen({ email: 'fp-pat-fr@test.werkzirkel.de' });
    const sid = await sessionAnlegen(fremd);
    const res = await detailPatch(
      buildRequest({
        method: 'PATCH',
        path: `/api/v1/foerderprofile/${fpId}`,
        sessionId: sid,
        body: { organisation: 'Hijack' },
      }),
      { params: Promise.resolve({ id: fpId }) },
    );
    expect(res.status).toBe(403);
  });

  it('PATCH bei status=in_verifikation → 422 nicht_editierbar', async () => {
    const owner = await userAnlegen({
      email: 'fp-pat-iv@test.werkzirkel.de',
      rollen: ['foerderer'],
    });
    const sid = await sessionAnlegen(owner);
    const fpId = createId();
    await db.insert(foerderprofil).values({
      id: fpId,
      nutzerId: owner,
      organisation: 'A',
      foerderart: 'geld',
      gegenleistungTyp: 'keine',
      verifikationStatus: 'in_verifikation',
    });
    const res = await detailPatch(
      buildRequest({
        method: 'PATCH',
        path: `/api/v1/foerderprofile/${fpId}`,
        sessionId: sid,
        body: { organisation: 'B' },
      }),
      { params: Promise.resolve({ id: fpId }) },
    );
    expect(res.status).toBe(422);
  });
});
