/**
 * Integration-Tests fuer das Melde-System:
 *   POST  /api/v1/meldungen                       (anonym + eingeloggt)
 *   GET   /api/v1/kurator/meldungen               (Permission + Filter)
 *   PATCH /api/v1/kurator/meldungen/:id           (Resolution + Aktionen)
 *
 * Deckt task-meldungen-system Akzeptanz-Kriterien (PRD §27, §F-501..§F-504).
 */

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createId } from '@paralleldrive/cuid2';
import { eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import {
  auditLog,
  bedarf,
  foerderprofil,
  meldung,
  nutzer,
  session as sessionTable,
  werk,
} from '@/lib/db/schema';
import { env } from '@/lib/env';
import { buildSessionCookie } from '@/lib/auth/session';

import { POST as meldungPost } from '@/app/api/v1/meldungen/route';
import { GET as kuratorList } from '@/app/api/v1/kurator/meldungen/route';
import { PATCH as kuratorPatch } from '@/app/api/v1/kurator/meldungen/[id]/route';

import { truncateAll } from '../_helpers/db-cleanup';

const APP_ORIGIN = new URL(env.APP_URL).origin;

async function nutzerAnlegen(opts: {
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

async function werkAnlegen(nutzerId: string): Promise<string> {
  const id = createId();
  await db.insert(werk).values({
    id,
    nutzerId,
    name: `Werk-${id.slice(0, 6)}`,
    kurzbeschreibung: 'kurz',
    problem: 'problem',
    zielgruppe: 'zielgruppe',
    werkstand: 'prototyp',
    hilfebedarf: [],
    sichtbarkeit: 'oeffentlich',
    status: 'aktiv',
  });
  return id;
}

async function bedarfAnlegen(nutzerId: string): Promise<string> {
  const id = createId();
  await db.insert(bedarf).values({
    id,
    nutzerId,
    organisation: 'TestOrg',
    titel: `Bedarf-${id.slice(0, 6)}`,
    problem: 'lorem ipsum problem',
    nutzen: 'lorem ipsum nutzen',
    stadtId: 'hh',
    frist: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    status: 'oeffentlich',
  });
  return id;
}

async function foerderprofilAnlegen(nutzerId: string): Promise<string> {
  const id = createId();
  await db.insert(foerderprofil).values({
    id,
    nutzerId,
    organisation: 'TestFoerd',
    foerderart: 'geld',
    gegenleistungTyp: 'keine',
    verifikationStatus: 'verifiziert',
  });
  return id;
}

function buildRequest(opts: {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  sessionId?: string;
  body?: unknown;
  ip?: string;
}): Request {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    origin: APP_ORIGIN,
    'x-forwarded-for': opts.ip ?? '127.0.0.1',
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

describe('POST /api/v1/meldungen', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  it('anonym → 201, gemeldet_von=null', async () => {
    const owner = await nutzerAnlegen({ email: 'anon-werk-owner@test.werkzirkel.de' });
    const werkId = await werkAnlegen(owner);

    const res = await meldungPost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/meldungen',
        body: {
          referenz_typ: 'werk',
          referenz_id: werkId,
          kategorie: 'spam',
          beschreibung: 'Sieht wie Spam aus.',
        },
        ip: '198.51.100.10',
      }),
    );
    expect(res.status).toBe(201);
    const data = (await res.json()) as {
      meldung: { id: string; gemeldetVon: string | null };
    };
    expect(data.meldung.gemeldetVon).toBeNull();

    const audit = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.aktion, 'meldung.angelegt'));
    expect(audit.length).toBe(1);
    expect((audit[0]!.metadaten as Record<string, unknown>).anonym).toBe(true);
  });

  it('eingeloggt → 201, gemeldet_von=user.id', async () => {
    const owner = await nutzerAnlegen({ email: 'eing-werk-owner@test.werkzirkel.de' });
    const werkId = await werkAnlegen(owner);
    const melder = await nutzerAnlegen({ email: 'eing-melder@test.werkzirkel.de' });
    const sid = await sessionAnlegen(melder);

    const res = await meldungPost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/meldungen',
        sessionId: sid,
        body: {
          referenz_typ: 'werk',
          referenz_id: werkId,
          kategorie: 'cold_outreach',
        },
        ip: '198.51.100.11',
      }),
    );
    expect(res.status).toBe(201);
    const data = (await res.json()) as {
      meldung: { gemeldetVon: string | null };
    };
    expect(data.meldung.gemeldetVon).toBe(melder);
  });

  it('falscher Origin → 403', async () => {
    const req = new Request('https://evil.example.com/api/v1/meldungen', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'https://evil.example.com',
      },
      body: JSON.stringify({
        referenz_typ: 'werk',
        referenz_id: 'irgendwas',
        kategorie: 'spam',
      }),
    });
    const res = await meldungPost(req);
    expect(res.status).toBe(403);
  });

  it('Validierungs-Fehler bei ungueltiger kategorie → 422', async () => {
    const res = await meldungPost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/meldungen',
        body: {
          referenz_typ: 'werk',
          referenz_id: 'whatever',
          kategorie: 'kein-enum',
        },
        ip: '198.51.100.12',
      }),
    );
    expect(res.status).toBe(422);
  });
});

describe('GET /api/v1/kurator/meldungen', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  it('Nicht-eingeloggt → 401', async () => {
    const res = await kuratorList(
      buildRequest({
        method: 'GET',
        path: '/api/v1/kurator/meldungen',
      }),
    );
    expect(res.status).toBe(401);
  });

  it('Eingeloggt ohne kurator-Rolle → 403', async () => {
    const u = await nutzerAnlegen({ email: 'k-noperm@test.werkzirkel.de' });
    const sid = await sessionAnlegen(u);
    const res = await kuratorList(
      buildRequest({
        method: 'GET',
        path: '/api/v1/kurator/meldungen',
        sessionId: sid,
      }),
    );
    expect(res.status).toBe(403);
  });

  it('Kurator → 200, status-Filter funktioniert', async () => {
    const kurator = await nutzerAnlegen({
      email: 'k-yes@test.werkzirkel.de',
      rollen: ['macher', 'kurator'],
    });
    const sid = await sessionAnlegen(kurator);

    const owner = await nutzerAnlegen({ email: 'k-werk-owner@test.werkzirkel.de' });
    const werkId = await werkAnlegen(owner);

    // 2 offene + 1 erledigte Meldung
    await db.insert(meldung).values([
      {
        id: createId(),
        gemeldetVon: null,
        referenzTyp: 'werk',
        referenzId: werkId,
        kategorie: 'spam',
        status: 'offen',
      },
      {
        id: createId(),
        gemeldetVon: null,
        referenzTyp: 'werk',
        referenzId: werkId,
        kategorie: 'sales_sprech',
        status: 'offen',
      },
      {
        id: createId(),
        gemeldetVon: null,
        referenzTyp: 'werk',
        referenzId: werkId,
        kategorie: 'cold_outreach',
        status: 'erledigt',
        geschlossenAm: new Date(),
      },
    ]);

    // alle laden
    const resAll = await kuratorList(
      buildRequest({
        method: 'GET',
        path: '/api/v1/kurator/meldungen',
        sessionId: sid,
      }),
    );
    expect(resAll.status).toBe(200);
    const dAll = (await resAll.json()) as { meldungen: unknown[] };
    expect(dAll.meldungen.length).toBe(3);

    // nur offene
    const resOpen = await kuratorList(
      buildRequest({
        method: 'GET',
        path: '/api/v1/kurator/meldungen?status=offen',
        sessionId: sid,
      }),
    );
    expect(resOpen.status).toBe(200);
    const dOpen = (await resOpen.json()) as {
      meldungen: Array<{ status: string }>;
    };
    expect(dOpen.meldungen.length).toBe(2);
    for (const m of dOpen.meldungen) {
      expect(m.status).toBe('offen');
    }
  });
});

describe('PATCH /api/v1/kurator/meldungen/:id', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  async function legeMeldungAn(opts: {
    referenzTyp:
      | 'werk'
      | 'bedarf'
      | 'foerderprofil'
      | 'nutzer';
    referenzId: string;
  }): Promise<string> {
    const id = createId();
    await db.insert(meldung).values({
      id,
      gemeldetVon: null,
      referenzTyp: opts.referenzTyp,
      referenzId: opts.referenzId,
      kategorie: 'spam',
      status: 'offen',
    });
    return id;
  }

  it('Aktion inhalt_ausgeblendet auf werk → werk.status="ausgeblendet"', async () => {
    const kurator = await nutzerAnlegen({
      email: 'p-k-werk@test.werkzirkel.de',
      rollen: ['macher', 'kurator'],
    });
    const sid = await sessionAnlegen(kurator);
    const owner = await nutzerAnlegen({ email: 'p-werk-o@test.werkzirkel.de' });
    const werkId = await werkAnlegen(owner);
    const meldungId = await legeMeldungAn({
      referenzTyp: 'werk',
      referenzId: werkId,
    });

    const res = await kuratorPatch(
      buildRequest({
        method: 'PATCH',
        path: `/api/v1/kurator/meldungen/${meldungId}`,
        sessionId: sid,
        body: {
          status: 'erledigt',
          aktion: 'inhalt_ausgeblendet',
          ergebnis_notiz: 'War tatsaechlich Spam.',
        },
      }),
      { params: Promise.resolve({ id: meldungId }) },
    );
    expect(res.status).toBe(200);

    const werkRow = (
      await db.select().from(werk).where(eq(werk.id, werkId)).limit(1)
    )[0]!;
    expect(werkRow.status).toBe('ausgeblendet');

    const meldungRow = (
      await db.select().from(meldung).where(eq(meldung.id, meldungId)).limit(1)
    )[0]!;
    expect(meldungRow.status).toBe('erledigt');
    expect(meldungRow.geschlossenAm).not.toBeNull();
    expect(meldungRow.bearbeiterId).toBe(kurator);
    expect(meldungRow.ergebnisNotiz).toBe('War tatsaechlich Spam.');

    // Audit-Log pro Resolution
    const audits = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.aktion, 'meldung.resolviert'));
    expect(audits.length).toBe(1);
  });

  it('Aktion inhalt_ausgeblendet auf bedarf → bedarf.status="eingestellt"', async () => {
    const kurator = await nutzerAnlegen({
      email: 'p-k-bedarf@test.werkzirkel.de',
      rollen: ['kurator'],
    });
    const sid = await sessionAnlegen(kurator);
    const owner = await nutzerAnlegen({
      email: 'p-bedarf-o@test.werkzirkel.de',
      rollen: ['bedarfstraeger'],
    });
    const bedarfId = await bedarfAnlegen(owner);
    const meldungId = await legeMeldungAn({
      referenzTyp: 'bedarf',
      referenzId: bedarfId,
    });

    const res = await kuratorPatch(
      buildRequest({
        method: 'PATCH',
        path: `/api/v1/kurator/meldungen/${meldungId}`,
        sessionId: sid,
        body: { status: 'erledigt', aktion: 'inhalt_ausgeblendet' },
      }),
      { params: Promise.resolve({ id: meldungId }) },
    );
    expect(res.status).toBe(200);
    const bedarfRow = (
      await db.select().from(bedarf).where(eq(bedarf.id, bedarfId)).limit(1)
    )[0]!;
    expect(bedarfRow.status).toBe('eingestellt');
  });

  it('Aktion inhalt_ausgeblendet auf foerderprofil → verifikationStatus="pausiert"', async () => {
    const kurator = await nutzerAnlegen({
      email: 'p-k-fp@test.werkzirkel.de',
      rollen: ['kurator'],
    });
    const sid = await sessionAnlegen(kurator);
    const owner = await nutzerAnlegen({
      email: 'p-fp-o@test.werkzirkel.de',
      rollen: ['foerderer'],
    });
    const fpId = await foerderprofilAnlegen(owner);
    const meldungId = await legeMeldungAn({
      referenzTyp: 'foerderprofil',
      referenzId: fpId,
    });

    const res = await kuratorPatch(
      buildRequest({
        method: 'PATCH',
        path: `/api/v1/kurator/meldungen/${meldungId}`,
        sessionId: sid,
        body: { status: 'erledigt', aktion: 'inhalt_ausgeblendet' },
      }),
      { params: Promise.resolve({ id: meldungId }) },
    );
    expect(res.status).toBe(200);
    const fpRow = (
      await db
        .select()
        .from(foerderprofil)
        .where(eq(foerderprofil.id, fpId))
        .limit(1)
    )[0]!;
    expect(fpRow.verifikationStatus).toBe('pausiert');
  });

  it('Aktion nutzer_gesperrt → nutzer.status="gesperrt"', async () => {
    const kurator = await nutzerAnlegen({
      email: 'p-k-sperr@test.werkzirkel.de',
      rollen: ['kurator'],
    });
    const sid = await sessionAnlegen(kurator);
    const ziel = await nutzerAnlegen({ email: 'p-ziel@test.werkzirkel.de' });
    const meldungId = await legeMeldungAn({
      referenzTyp: 'nutzer',
      referenzId: ziel,
    });

    const res = await kuratorPatch(
      buildRequest({
        method: 'PATCH',
        path: `/api/v1/kurator/meldungen/${meldungId}`,
        sessionId: sid,
        body: { status: 'erledigt', aktion: 'nutzer_gesperrt' },
      }),
      { params: Promise.resolve({ id: meldungId }) },
    );
    expect(res.status).toBe(200);

    const zielRow = (
      await db.select().from(nutzer).where(eq(nutzer.id, ziel)).limit(1)
    )[0]!;
    expect(zielRow.status).toBe('gesperrt');
  });

  it('Aktion keine + Status in_pruefung → kein geschlossen_am', async () => {
    const kurator = await nutzerAnlegen({
      email: 'p-k-pruef@test.werkzirkel.de',
      rollen: ['kurator'],
    });
    const sid = await sessionAnlegen(kurator);
    const owner = await nutzerAnlegen({ email: 'p-pruef-o@test.werkzirkel.de' });
    const werkId = await werkAnlegen(owner);
    const meldungId = await legeMeldungAn({
      referenzTyp: 'werk',
      referenzId: werkId,
    });

    const res = await kuratorPatch(
      buildRequest({
        method: 'PATCH',
        path: `/api/v1/kurator/meldungen/${meldungId}`,
        sessionId: sid,
        body: { status: 'in_pruefung', aktion: 'keine' },
      }),
      { params: Promise.resolve({ id: meldungId }) },
    );
    expect(res.status).toBe(200);
    const meldungRow = (
      await db.select().from(meldung).where(eq(meldung.id, meldungId)).limit(1)
    )[0]!;
    expect(meldungRow.status).toBe('in_pruefung');
    expect(meldungRow.geschlossenAm).toBeNull();
    // werk bleibt unveraendert
    const werkRow = (
      await db.select().from(werk).where(eq(werk.id, werkId)).limit(1)
    )[0]!;
    expect(werkRow.status).toBe('aktiv');
  });

  it('Nicht-Kurator → 403', async () => {
    const u = await nutzerAnlegen({ email: 'p-no@test.werkzirkel.de' });
    const sid = await sessionAnlegen(u);
    const owner = await nutzerAnlegen({ email: 'p-no-owner@test.werkzirkel.de' });
    const werkId = await werkAnlegen(owner);
    const meldungId = await legeMeldungAn({
      referenzTyp: 'werk',
      referenzId: werkId,
    });

    const res = await kuratorPatch(
      buildRequest({
        method: 'PATCH',
        path: `/api/v1/kurator/meldungen/${meldungId}`,
        sessionId: sid,
        body: { status: 'erledigt', aktion: 'keine' },
      }),
      { params: Promise.resolve({ id: meldungId }) },
    );
    expect(res.status).toBe(403);
  });
});
