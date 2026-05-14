/**
 * Integration-Tests fuer die Bedarf-CRUD-API:
 *   POST   /api/v1/bedarfe
 *   GET    /api/v1/bedarfe
 *   GET    /api/v1/bedarfe/:id
 *   PATCH  /api/v1/bedarfe/:id
 *   POST   /api/v1/bedarfe/:id/einreichen   (mit Werkstattbeitrag-Gate + Sprach-Check)
 *   POST   /api/v1/bedarfe/:id/erfuellt
 *   POST   /api/v1/bedarfe/:id/einstellen
 *   GET    /api/v1/kurator/bedarfe-in-pruefung
 *   POST   /api/v1/kurator/bedarfe/:id/veroeffentlichen
 *   POST   /api/v1/kurator/bedarfe/:id/ablehnen
 *
 * Deckt PRD §F-601..§F-606, §14.3 (Statusmaschine), §11A Schutz S4.
 */

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createId } from '@paralleldrive/cuid2';
import { and, eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import {
  auditLog,
  bedarf,
  nutzer,
  session as sessionTable,
  werkstattbeitrag,
} from '@/lib/db/schema';
import { env } from '@/lib/env';
import { buildSessionCookie } from '@/lib/auth/session';

import {
  POST as listPost,
  GET as listGet,
} from '@/app/api/v1/bedarfe/route';
import {
  GET as detailGet,
  PATCH as detailPatch,
} from '@/app/api/v1/bedarfe/[id]/route';
import { POST as einreichenPost } from '@/app/api/v1/bedarfe/[id]/einreichen/route';
import { POST as erfuelltPost } from '@/app/api/v1/bedarfe/[id]/erfuellt/route';
import { POST as einstellenPost } from '@/app/api/v1/bedarfe/[id]/einstellen/route';
import { GET as inPruefungGet } from '@/app/api/v1/kurator/bedarfe-in-pruefung/route';
import { POST as veroeffentlichenPost } from '@/app/api/v1/kurator/bedarfe/[id]/veroeffentlichen/route';
import { POST as ablehnenPost } from '@/app/api/v1/kurator/bedarfe/[id]/ablehnen/route';

import { truncateAll } from '../_helpers/db-cleanup';

const APP_ORIGIN = new URL(env.APP_URL).origin;

type Rolle = 'macher' | 'bedarfstraeger' | 'foerderer' | 'kurator' | 'admin';

async function userAnlegen(opts: {
  email: string;
  stadtId?: string;
  rollen?: Rolle[];
  klarname?: string;
}): Promise<string> {
  const id = createId();
  await db.insert(nutzer).values({
    id,
    email: opts.email,
    klarname: opts.klarname ?? `Klar ${opts.email}`,
    anzeigename: `anz-${id.slice(0, 6)}`,
    stadtId: opts.stadtId ?? 'hh',
    rollen: opts.rollen ?? ['bedarfstraeger'],
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

async function werkstattbeitragAnlegen(opts: {
  nutzerId: string;
  status?: 'erfasst' | 'verifiziert' | 'abgelehnt';
  gueltigBis?: Date | null;
  verwendet?: number;
}): Promise<string> {
  const id = createId();
  const jetzt = new Date();
  await db.insert(werkstattbeitrag).values({
    id,
    nutzerId: opts.nutzerId,
    art: 'sachleistung',
    nachweisText: 'Test-Nachweis',
    status: opts.status ?? 'verifiziert',
    verifiziertAm: opts.status === 'verifiziert' ? jetzt : null,
    gueltigBis:
      opts.gueltigBis === null
        ? null
        : (opts.gueltigBis ??
          new Date(jetzt.getTime() + 6 * 30 * 24 * 60 * 60 * 1000)),
    verwendetFuerBedarfe: opts.verwendet ?? 0,
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

function fristInZukunft(tage = 14): Date {
  return new Date(Date.now() + tage * 24 * 60 * 60 * 1000);
}

const validBedarfBody = (extra: Record<string, unknown> = {}) => ({
  organisation: 'Hamburger Verein',
  titel: 'Wir brauchen eine kleine Microsite',
  problem: 'Aktuelle Seite veraltet, wir brauchen etwas Frisches.',
  nutzen: 'Wir sind sichtbarer fuer Nachwuchs.',
  stadt_id: 'hh',
  frist: fristInZukunft().toISOString(),
  ...extra,
});

describe('POST /api/v1/bedarfe', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  it('Bedarfstraeger:in mit Klarname legt Bedarf an → 201, status=entwurf', async () => {
    const userId = await userAnlegen({
      email: 'bed-anl@test.werkzirkel.de',
      rollen: ['bedarfstraeger'],
    });
    const sid = await sessionAnlegen(userId);

    const res = await listPost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/bedarfe',
        sessionId: sid,
        body: validBedarfBody(),
      }),
    );
    expect(res.status).toBe(201);
    const data = (await res.json()) as {
      bedarf: { id: string; status: string };
    };
    expect(data.bedarf.status).toBe('entwurf');
  });

  it('User ohne bedarfstraeger-Rolle → 403', async () => {
    const userId = await userAnlegen({
      email: 'bed-noforder@test.werkzirkel.de',
      rollen: ['macher'],
    });
    const sid = await sessionAnlegen(userId);

    const res = await listPost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/bedarfe',
        sessionId: sid,
        body: validBedarfBody(),
      }),
    );
    expect(res.status).toBe(403);
  });

  it('Bedarfstraeger:in ohne Klarname → 422 klarname_fehlt', async () => {
    const userId = await userAnlegen({
      email: 'bed-nokn@test.werkzirkel.de',
      rollen: ['bedarfstraeger'],
      klarname: '',
    });
    const sid = await sessionAnlegen(userId);

    const res = await listPost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/bedarfe',
        sessionId: sid,
        body: validBedarfBody(),
      }),
    );
    expect(res.status).toBe(422);
    const data = (await res.json()) as { error: { code: string } };
    expect(data.error.code).toBe('klarname_fehlt');
  });

  it('ohne Session → 401', async () => {
    const res = await listPost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/bedarfe',
        body: validBedarfBody(),
      }),
    );
    expect(res.status).toBe(401);
  });

  it('Validator: zu kurze Frist (heute) → 422', async () => {
    const userId = await userAnlegen({
      email: 'bed-frist@test.werkzirkel.de',
      rollen: ['bedarfstraeger'],
    });
    const sid = await sessionAnlegen(userId);
    const res = await listPost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/bedarfe',
        sessionId: sid,
        body: validBedarfBody({ frist: new Date().toISOString() }),
      }),
    );
    expect(res.status).toBe(422);
  });

  it('Geldrahmen Min > Max → 422', async () => {
    const userId = await userAnlegen({
      email: 'bed-geld@test.werkzirkel.de',
      rollen: ['bedarfstraeger'],
    });
    const sid = await sessionAnlegen(userId);
    const res = await listPost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/bedarfe',
        sessionId: sid,
        body: validBedarfBody({
          geldrahmen_min_euro_cent: 200000,
          geldrahmen_max_euro_cent: 100000,
        }),
      }),
    );
    expect(res.status).toBe(422);
  });
});

describe('POST /api/v1/bedarfe/:id/einreichen — Werkstattbeitrag-Gate', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  it('ohne Werkstattbeitrag → 422 werkstattbeitrag_fehlt', async () => {
    const userId = await userAnlegen({
      email: 'bed-nowb@test.werkzirkel.de',
      rollen: ['bedarfstraeger'],
    });
    const sid = await sessionAnlegen(userId);

    const createRes = await listPost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/bedarfe',
        sessionId: sid,
        body: validBedarfBody(),
      }),
    );
    const { bedarf: created } = (await createRes.json()) as {
      bedarf: { id: string };
    };
    const bedarfId = created.id;

    const res = await einreichenPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/bedarfe/${bedarfId}/einreichen`,
        sessionId: sid,
      }),
      { params: Promise.resolve({ id: bedarfId }) },
    );
    expect(res.status).toBe(422);
    const data = (await res.json()) as { error: { code: string } };
    expect(data.error.code).toBe('werkstattbeitrag_fehlt');
  });

  it('mit gueltigem Werkstattbeitrag → 200, status=in_pruefung, werkstattbeitrag_id gesetzt', async () => {
    const userId = await userAnlegen({
      email: 'bed-wb-ok@test.werkzirkel.de',
      rollen: ['bedarfstraeger'],
    });
    const sid = await sessionAnlegen(userId);
    const wbId = await werkstattbeitragAnlegen({ nutzerId: userId });

    const createRes = await listPost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/bedarfe',
        sessionId: sid,
        body: validBedarfBody(),
      }),
    );
    const { bedarf: created } = (await createRes.json()) as {
      bedarf: { id: string };
    };
    const bedarfId = created.id;

    const res = await einreichenPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/bedarfe/${bedarfId}/einreichen`,
        sessionId: sid,
      }),
      { params: Promise.resolve({ id: bedarfId }) },
    );
    expect(res.status).toBe(200);
    const row = (
      await db.select().from(bedarf).where(eq(bedarf.id, bedarfId)).limit(1)
    )[0]!;
    expect(row.status).toBe('in_pruefung');
    expect(row.werkstattbeitragId).toBe(wbId);
  });

  it('Werkstattbeitrag bereits 4-fach verwendet → 422', async () => {
    const userId = await userAnlegen({
      email: 'bed-wb-voll@test.werkzirkel.de',
      rollen: ['bedarfstraeger'],
    });
    const sid = await sessionAnlegen(userId);
    await werkstattbeitragAnlegen({ nutzerId: userId, verwendet: 4 });

    const createRes = await listPost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/bedarfe',
        sessionId: sid,
        body: validBedarfBody(),
      }),
    );
    const { bedarf: created } = (await createRes.json()) as {
      bedarf: { id: string };
    };

    const res = await einreichenPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/bedarfe/${created.id}/einreichen`,
        sessionId: sid,
      }),
      { params: Promise.resolve({ id: created.id }) },
    );
    expect(res.status).toBe(422);
    const data = (await res.json()) as { error: { code: string } };
    expect(data.error.code).toBe('werkstattbeitrag_fehlt');
  });

  it('Werkstattbeitrag abgelaufen → 422', async () => {
    const userId = await userAnlegen({
      email: 'bed-wb-old@test.werkzirkel.de',
      rollen: ['bedarfstraeger'],
    });
    const sid = await sessionAnlegen(userId);
    await werkstattbeitragAnlegen({
      nutzerId: userId,
      gueltigBis: new Date(Date.now() - 24 * 60 * 60 * 1000),
    });

    const createRes = await listPost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/bedarfe',
        sessionId: sid,
        body: validBedarfBody(),
      }),
    );
    const { bedarf: created } = (await createRes.json()) as {
      bedarf: { id: string };
    };
    const res = await einreichenPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/bedarfe/${created.id}/einreichen`,
        sessionId: sid,
      }),
      { params: Promise.resolve({ id: created.id }) },
    );
    expect(res.status).toBe(422);
  });
});

describe('Sprach-Check beim Einreichen', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  it('Treffer im Problem-Feld ("pitch") → status=in_pruefung + audit_log-Eintrag mit Treffern', async () => {
    const userId = await userAnlegen({
      email: 'bed-spr@test.werkzirkel.de',
      rollen: ['bedarfstraeger'],
    });
    const sid = await sessionAnlegen(userId);
    await werkstattbeitragAnlegen({ nutzerId: userId });

    const createRes = await listPost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/bedarfe',
        sessionId: sid,
        body: validBedarfBody({
          problem: 'Wir brauchen einen Pitch fuer Investoren.',
        }),
      }),
    );
    const { bedarf: created } = (await createRes.json()) as {
      bedarf: { id: string };
    };

    const res = await einreichenPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/bedarfe/${created.id}/einreichen`,
        sessionId: sid,
      }),
      { params: Promise.resolve({ id: created.id }) },
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      sprach_check: { ok: boolean; treffer: string[] };
    };
    expect(data.sprach_check.ok).toBe(false);
    expect(data.sprach_check.treffer).toContain('pitch');

    // audit_log Treffer ueberpruefen
    const logs = await db
      .select()
      .from(auditLog)
      .where(
        and(
          eq(auditLog.aktion, 'bedarf.eingereicht'),
          eq(auditLog.referenzId, created.id),
        ),
      );
    expect(logs.length).toBe(1);
    const meta = logs[0]!.metadaten as {
      sprach_check_treffer?: string[];
      sprach_check_ok?: boolean;
    };
    expect(meta.sprach_check_ok).toBe(false);
    expect(meta.sprach_check_treffer).toContain('pitch');
  });

  it('Sauberer Text → sprach_check.ok=true', async () => {
    const userId = await userAnlegen({
      email: 'bed-spr-clean@test.werkzirkel.de',
      rollen: ['bedarfstraeger'],
    });
    const sid = await sessionAnlegen(userId);
    await werkstattbeitragAnlegen({ nutzerId: userId });

    const createRes = await listPost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/bedarfe',
        sessionId: sid,
        body: validBedarfBody(),
      }),
    );
    const { bedarf: created } = (await createRes.json()) as {
      bedarf: { id: string };
    };

    const res = await einreichenPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/bedarfe/${created.id}/einreichen`,
        sessionId: sid,
      }),
      { params: Promise.resolve({ id: created.id }) },
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      sprach_check: { ok: boolean; treffer: string[] };
    };
    expect(data.sprach_check.ok).toBe(true);
    expect(data.sprach_check.treffer).toEqual([]);
  });
});

describe('Kurator-Workflow: veroeffentlichen + ablehnen', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  async function bedarfInPruefung(opts: { ownerEmail: string }) {
    const owner = await userAnlegen({
      email: opts.ownerEmail,
      rollen: ['bedarfstraeger'],
    });
    const ownerSid = await sessionAnlegen(owner);
    const wbId = await werkstattbeitragAnlegen({ nutzerId: owner });
    const createRes = await listPost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/bedarfe',
        sessionId: ownerSid,
        body: validBedarfBody(),
      }),
    );
    const { bedarf: created } = (await createRes.json()) as {
      bedarf: { id: string };
    };
    await einreichenPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/bedarfe/${created.id}/einreichen`,
        sessionId: ownerSid,
      }),
      { params: Promise.resolve({ id: created.id }) },
    );
    return { owner, ownerSid, bedarfId: created.id, wbId };
  }

  it('Kurator veroeffentlicht → status=oeffentlich + werkstattbeitrag.verwendet++', async () => {
    const { bedarfId, wbId } = await bedarfInPruefung({
      ownerEmail: 'bed-pub@test.werkzirkel.de',
    });
    const kurator = await userAnlegen({
      email: 'bed-pub-kur@test.werkzirkel.de',
      rollen: ['kurator'],
      stadtId: 'hh',
    });
    const ksid = await sessionAnlegen(kurator);

    const res = await veroeffentlichenPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/kurator/bedarfe/${bedarfId}/veroeffentlichen`,
        sessionId: ksid,
      }),
      { params: Promise.resolve({ id: bedarfId }) },
    );
    expect(res.status).toBe(200);
    const row = (
      await db.select().from(bedarf).where(eq(bedarf.id, bedarfId)).limit(1)
    )[0]!;
    expect(row.status).toBe('oeffentlich');

    const wbRow = (
      await db
        .select()
        .from(werkstattbeitrag)
        .where(eq(werkstattbeitrag.id, wbId))
        .limit(1)
    )[0]!;
    expect(wbRow.verwendetFuerBedarfe).toBe(1);
  });

  it('Kurator anderer Stadt → 403', async () => {
    const { bedarfId } = await bedarfInPruefung({
      ownerEmail: 'bed-othr@test.werkzirkel.de',
    });
    const fremdKurator = await userAnlegen({
      email: 'bed-othr-kur@test.werkzirkel.de',
      rollen: ['kurator'],
      stadtId: 'b',
    });
    const fkSid = await sessionAnlegen(fremdKurator);
    const res = await veroeffentlichenPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/kurator/bedarfe/${bedarfId}/veroeffentlichen`,
        sessionId: fkSid,
      }),
      { params: Promise.resolve({ id: bedarfId }) },
    );
    expect(res.status).toBe(403);
  });

  it('Kurator lehnt ab mit Grund → status=eingestellt, T-303 versendet (gemockt)', async () => {
    const { bedarfId } = await bedarfInPruefung({
      ownerEmail: 'bed-abl@test.werkzirkel.de',
    });
    const kurator = await userAnlegen({
      email: 'bed-abl-kur@test.werkzirkel.de',
      rollen: ['kurator'],
    });
    const ksid = await sessionAnlegen(kurator);

    const res = await ablehnenPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/kurator/bedarfe/${bedarfId}/ablehnen`,
        sessionId: ksid,
        body: { grund: 'Bitte konkretisieren, was du brauchst.' },
      }),
      { params: Promise.resolve({ id: bedarfId }) },
    );
    expect(res.status).toBe(200);
    const row = (
      await db.select().from(bedarf).where(eq(bedarf.id, bedarfId)).limit(1)
    )[0]!;
    expect(row.status).toBe('eingestellt');
  });

  it('Ablehnen ohne grund → 422', async () => {
    const { bedarfId } = await bedarfInPruefung({
      ownerEmail: 'bed-abl-noG@test.werkzirkel.de',
    });
    const kurator = await userAnlegen({
      email: 'bed-abl-noG-kur@test.werkzirkel.de',
      rollen: ['kurator'],
    });
    const ksid = await sessionAnlegen(kurator);

    const res = await ablehnenPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/kurator/bedarfe/${bedarfId}/ablehnen`,
        sessionId: ksid,
        body: {},
      }),
      { params: Promise.resolve({ id: bedarfId }) },
    );
    expect(res.status).toBe(422);
  });

  it('GET /api/v1/kurator/bedarfe-in-pruefung listet eingereichte Bedarfe der eigenen Stadt', async () => {
    const { bedarfId } = await bedarfInPruefung({
      ownerEmail: 'bed-prl@test.werkzirkel.de',
    });
    const kurator = await userAnlegen({
      email: 'bed-prl-kur@test.werkzirkel.de',
      rollen: ['kurator'],
      stadtId: 'hh',
    });
    const ksid = await sessionAnlegen(kurator);

    const res = await inPruefungGet(
      buildRequest({
        method: 'GET',
        path: '/api/v1/kurator/bedarfe-in-pruefung',
        sessionId: ksid,
      }),
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      bedarfe: Array<{ bedarf: { id: string }; sprach_check_treffer: string[] }>;
    };
    expect(data.bedarfe.some((b) => b.bedarf.id === bedarfId)).toBe(true);
  });
});

describe('Erfuellt / Einstellen', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  async function bedarfOeffentlich(opts: { ownerEmail: string }) {
    const owner = await userAnlegen({
      email: opts.ownerEmail,
      rollen: ['bedarfstraeger'],
    });
    const ownerSid = await sessionAnlegen(owner);
    await werkstattbeitragAnlegen({ nutzerId: owner });
    const createRes = await listPost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/bedarfe',
        sessionId: ownerSid,
        body: validBedarfBody(),
      }),
    );
    const { bedarf: created } = (await createRes.json()) as {
      bedarf: { id: string };
    };
    await einreichenPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/bedarfe/${created.id}/einreichen`,
        sessionId: ownerSid,
      }),
      { params: Promise.resolve({ id: created.id }) },
    );
    const kurator = await userAnlegen({
      email: `${opts.ownerEmail.split('@')[0]}-kur@test.werkzirkel.de`,
      rollen: ['kurator'],
      stadtId: 'hh',
    });
    const ksid = await sessionAnlegen(kurator);
    await veroeffentlichenPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/kurator/bedarfe/${created.id}/veroeffentlichen`,
        sessionId: ksid,
      }),
      { params: Promise.resolve({ id: created.id }) },
    );
    return { owner, ownerSid, bedarfId: created.id };
  }

  it('Owner markiert oeffentlichen Bedarf als erfuellt → status=erfuellt', async () => {
    const { ownerSid, bedarfId } = await bedarfOeffentlich({
      ownerEmail: 'bed-erf@test.werkzirkel.de',
    });
    const res = await erfuelltPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/bedarfe/${bedarfId}/erfuellt`,
        sessionId: ownerSid,
        body: { selbstauskunft_min_euro_cent: 50000, selbstauskunft_max_euro_cent: 100000 },
      }),
      { params: Promise.resolve({ id: bedarfId }) },
    );
    expect(res.status).toBe(200);
    const row = (
      await db.select().from(bedarf).where(eq(bedarf.id, bedarfId)).limit(1)
    )[0]!;
    expect(row.status).toBe('erfuellt');
    expect(row.erfuelltAm).toBeTruthy();
    expect(row.selbstauskunftGroesseEuroCentMin).toBe(50000);
  });

  it('Owner stellt einen Bedarf ein → status=eingestellt', async () => {
    const owner = await userAnlegen({
      email: 'bed-eins@test.werkzirkel.de',
      rollen: ['bedarfstraeger'],
    });
    const ownerSid = await sessionAnlegen(owner);
    const createRes = await listPost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/bedarfe',
        sessionId: ownerSid,
        body: validBedarfBody(),
      }),
    );
    const { bedarf: created } = (await createRes.json()) as {
      bedarf: { id: string };
    };
    const res = await einstellenPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/bedarfe/${created.id}/einstellen`,
        sessionId: ownerSid,
      }),
      { params: Promise.resolve({ id: created.id }) },
    );
    expect(res.status).toBe(200);
    const row = (
      await db.select().from(bedarf).where(eq(bedarf.id, created.id)).limit(1)
    )[0]!;
    expect(row.status).toBe('eingestellt');
  });

  it('Einstellen eines erfuellten Bedarfs → 422', async () => {
    const { ownerSid, bedarfId } = await bedarfOeffentlich({
      ownerEmail: 'bed-eins-err@test.werkzirkel.de',
    });
    await erfuelltPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/bedarfe/${bedarfId}/erfuellt`,
        sessionId: ownerSid,
      }),
      { params: Promise.resolve({ id: bedarfId }) },
    );
    const res = await einstellenPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/bedarfe/${bedarfId}/einstellen`,
        sessionId: ownerSid,
      }),
      { params: Promise.resolve({ id: bedarfId }) },
    );
    expect(res.status).toBe(422);
  });
});

describe('GET /api/v1/bedarfe (Liste) + Privacy', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  it('anonyme Liste → 401', async () => {
    const res = await listGet(
      buildRequest({ method: 'GET', path: '/api/v1/bedarfe' }),
    );
    expect(res.status).toBe(401);
  });

  it('eingeloggte Person sieht nur oeffentliche/in_gespraechen-Bedarfe (default)', async () => {
    const userA = await userAnlegen({
      email: 'bed-list-a@test.werkzirkel.de',
      rollen: ['bedarfstraeger'],
    });
    const userB = await userAnlegen({
      email: 'bed-list-b@test.werkzirkel.de',
      rollen: ['bedarfstraeger'],
    });
    await db.insert(bedarf).values({
      id: createId(),
      nutzerId: userA,
      organisation: 'OA',
      titel: 'Oeffentlich-Bedarf',
      problem: 'p',
      nutzen: 'n',
      stadtId: 'hh',
      frist: fristInZukunft(),
      status: 'oeffentlich',
    });
    await db.insert(bedarf).values({
      id: createId(),
      nutzerId: userB,
      organisation: 'OB',
      titel: 'Entwurf',
      problem: 'p',
      nutzen: 'n',
      stadtId: 'hh',
      frist: fristInZukunft(),
      status: 'entwurf',
    });
    const viewer = await userAnlegen({ email: 'bed-list-v@test.werkzirkel.de' });
    const sid = await sessionAnlegen(viewer);

    const res = await listGet(
      buildRequest({
        method: 'GET',
        path: '/api/v1/bedarfe',
        sessionId: sid,
      }),
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      bedarfe: Array<{ status: string; titel: string }>;
    };
    expect(data.bedarfe.length).toBe(1);
    expect(data.bedarfe[0]?.status).toBe('oeffentlich');
  });

  it('Owner sieht eigenen Entwurf via GET /:id (inklusive werkangebote_count)', async () => {
    const owner = await userAnlegen({
      email: 'bed-own@test.werkzirkel.de',
      rollen: ['bedarfstraeger'],
    });
    const sid = await sessionAnlegen(owner);
    const id = createId();
    await db.insert(bedarf).values({
      id,
      nutzerId: owner,
      organisation: 'O',
      titel: 'Mein Entwurf',
      problem: 'p',
      nutzen: 'n',
      stadtId: 'hh',
      frist: fristInZukunft(),
      status: 'entwurf',
    });
    const res = await detailGet(
      buildRequest({
        method: 'GET',
        path: `/api/v1/bedarfe/${id}`,
        sessionId: sid,
      }),
      { params: Promise.resolve({ id }) },
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      bedarf: { id: string };
      werkangebote_count: number;
    };
    expect(data.bedarf.id).toBe(id);
    expect(data.werkangebote_count).toBe(0);
  });

  it('Fremder User auf entwurf-Bedarf → 404 (privacy)', async () => {
    const owner = await userAnlegen({
      email: 'bed-priv@test.werkzirkel.de',
      rollen: ['bedarfstraeger'],
    });
    const id = createId();
    await db.insert(bedarf).values({
      id,
      nutzerId: owner,
      organisation: 'O',
      titel: 'Privat',
      problem: 'p',
      nutzen: 'n',
      stadtId: 'hh',
      frist: fristInZukunft(),
      status: 'entwurf',
    });
    const viewer = await userAnlegen({ email: 'bed-priv-v@test.werkzirkel.de' });
    const sid = await sessionAnlegen(viewer);
    const res = await detailGet(
      buildRequest({
        method: 'GET',
        path: `/api/v1/bedarfe/${id}`,
        sessionId: sid,
      }),
      { params: Promise.resolve({ id }) },
    );
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/v1/bedarfe/:id', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  it('Owner darf entwurf bearbeiten', async () => {
    const owner = await userAnlegen({
      email: 'bed-pat@test.werkzirkel.de',
      rollen: ['bedarfstraeger'],
    });
    const sid = await sessionAnlegen(owner);
    const id = createId();
    await db.insert(bedarf).values({
      id,
      nutzerId: owner,
      organisation: 'Alt',
      titel: 'Alt',
      problem: 'p',
      nutzen: 'n',
      stadtId: 'hh',
      frist: fristInZukunft(),
      status: 'entwurf',
    });
    const res = await detailPatch(
      buildRequest({
        method: 'PATCH',
        path: `/api/v1/bedarfe/${id}`,
        sessionId: sid,
        body: { titel: 'Neu' },
      }),
      { params: Promise.resolve({ id }) },
    );
    expect(res.status).toBe(200);
    const row = (
      await db.select().from(bedarf).where(eq(bedarf.id, id)).limit(1)
    )[0]!;
    expect(row.titel).toBe('Neu');
  });

  it('PATCH auf in_pruefung → 422 nicht_editierbar', async () => {
    const owner = await userAnlegen({
      email: 'bed-pat-ip@test.werkzirkel.de',
      rollen: ['bedarfstraeger'],
    });
    const sid = await sessionAnlegen(owner);
    const id = createId();
    await db.insert(bedarf).values({
      id,
      nutzerId: owner,
      organisation: 'Alt',
      titel: 'Alt',
      problem: 'p',
      nutzen: 'n',
      stadtId: 'hh',
      frist: fristInZukunft(),
      status: 'in_pruefung',
    });
    const res = await detailPatch(
      buildRequest({
        method: 'PATCH',
        path: `/api/v1/bedarfe/${id}`,
        sessionId: sid,
        body: { titel: 'Neu' },
      }),
      { params: Promise.resolve({ id }) },
    );
    expect(res.status).toBe(422);
  });

  it('Fremder darf NICHT bearbeiten → 403', async () => {
    const owner = await userAnlegen({
      email: 'bed-pat-own@test.werkzirkel.de',
      rollen: ['bedarfstraeger'],
    });
    const id = createId();
    await db.insert(bedarf).values({
      id,
      nutzerId: owner,
      organisation: 'A',
      titel: 'A',
      problem: 'p',
      nutzen: 'n',
      stadtId: 'hh',
      frist: fristInZukunft(),
      status: 'entwurf',
    });
    const fremd = await userAnlegen({
      email: 'bed-pat-fr@test.werkzirkel.de',
      rollen: ['bedarfstraeger'],
    });
    const sid = await sessionAnlegen(fremd);
    const res = await detailPatch(
      buildRequest({
        method: 'PATCH',
        path: `/api/v1/bedarfe/${id}`,
        sessionId: sid,
        body: { titel: 'X' },
      }),
      { params: Promise.resolve({ id }) },
    );
    expect(res.status).toBe(403);
  });
});
