/**
 * Integration-Tests fuer die Bedarfsschau-Termin-Integration
 * (PRD §8.8, §13.19, §13.20, §F-401..§F-405 + Foerderprofil-Hook).
 *
 *  - POST /api/v1/termine/:id/bedarfe setzt termin_bedarf_bezug-Rows
 *    (Kurator-only, typ='bedarfsschau', TX: DELETE existing + INSERT new).
 *  - POST /api/v1/termine/:id/foerderprofile analog fuer Foerderprofile.
 *  - GET /api/v1/termine/:id liefert bei typ='bedarfsschau' bedarfe und
 *    foerderprofile in der Response mit.
 *  - Wiederholtes POST mit anderer Wunsch-Liste ersetzt die bestehenden
 *    Bezuege (Idempotenz).
 *  - Fremde Stadt → 422.
 *  - Falscher Termin-Typ (z.B. schauabend) → 422.
 *  - Kein Kurator → 403.
 *  - Anwesenheits-Hook: Foerder:in bei Bedarfsschau-Anwesenheit aktualisiert
 *    letzte_bedarfsschau_am und reaktiviert pausierte Profile.
 */

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createId } from '@paralleldrive/cuid2';
import { eq, sql } from 'drizzle-orm';

import { db } from '@/lib/db';
import {
  bedarf,
  foerderprofil,
  nutzer,
  session as sessionTable,
  termin,
  terminAnmeldung,
  terminBedarfBezug,
  terminFoerderprofilBezug,
} from '@/lib/db/schema';
import { env } from '@/lib/env';
import { buildSessionCookie } from '@/lib/auth/session';

import { POST as bedarfeSetzenPost } from '@/app/api/v1/termine/[id]/bedarfe/route';
import { POST as foerderprofileSetzenPost } from '@/app/api/v1/termine/[id]/foerderprofile/route';
import { GET as terminGet } from '@/app/api/v1/termine/[id]/route';
import { POST as anwesenheitPost } from '@/app/api/v1/termine/[id]/anwesenheit/route';

import { truncateAll } from '../_helpers/db-cleanup';

const APP_ORIGIN = new URL(env.APP_URL).origin;

type Rolle = 'macher' | 'bedarfstraeger' | 'foerderer' | 'kurator' | 'admin';

async function userAnlegen(opts: {
  email: string;
  stadtId?: string;
  rollen?: Rolle[];
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

async function bedarfsschauAnlegen(opts: {
  kuratorId: string;
  stadtId?: string;
  inDerVergangenheit?: boolean;
}): Promise<{ id: string; datum: Date }> {
  const id = createId();
  const datum = opts.inDerVergangenheit
    ? new Date(Date.now() - 24 * 60 * 60 * 1000)
    : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await db.insert(termin).values({
    id,
    stadtId: opts.stadtId ?? 'hh',
    typ: 'bedarfsschau',
    titel: 'Bedarfsschau Test',
    beschreibung: 'Foerder:innen treffen Bedarfstraeger:innen.',
    ortText: 'Werkstatt St. Pauli',
    datumUhrzeit: datum,
    maxTeilnehmer: 30,
    erstelltVon: opts.kuratorId,
    status: opts.inDerVergangenheit ? 'durchgefuehrt' : 'veroeffentlicht',
  });
  return { id, datum };
}

async function bedarfAnlegen(opts: {
  nutzerId: string;
  stadtId?: string;
  status?: 'entwurf' | 'oeffentlich' | 'in_gespraechen';
  titel?: string;
}): Promise<string> {
  const id = createId();
  await db.insert(bedarf).values({
    id,
    nutzerId: opts.nutzerId,
    organisation: 'Test Org',
    titel: opts.titel ?? 'Bedarf Test',
    problem: 'Wir brauchen Hilfe bei einer konkreten Aufgabe.',
    nutzen: 'Klare Nutzerinnen-Wirkung.',
    stadtId: opts.stadtId ?? 'hh',
    frist: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    status: opts.status ?? 'oeffentlich',
  });
  return id;
}

async function foerderprofilAnlegen(opts: {
  nutzerId: string;
  organisation?: string;
  status?: 'entwurf' | 'verifiziert' | 'pausiert';
}): Promise<string> {
  const id = createId();
  await db.insert(foerderprofil).values({
    id,
    nutzerId: opts.nutzerId,
    organisation: opts.organisation ?? 'Test Stiftung',
    foerderart: 'geld',
    gegenleistungTyp: 'sichtbarkeit',
    verifikationStatus: opts.status ?? 'verifiziert',
    ...(opts.status === 'pausiert'
      ? { pausiertSeit: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      : {}),
  });
  return id;
}

function buildRequest(opts: {
  method: 'GET' | 'POST';
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

async function anmeldungAnlegen(opts: {
  terminId: string;
  nutzerId: string;
}): Promise<string> {
  const id = createId();
  await db.insert(terminAnmeldung).values({
    id,
    terminId: opts.terminId,
    nutzerId: opts.nutzerId,
    status: 'angemeldet',
  });
  return id;
}

describe('Bedarfsschau-Termin-Integration', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  it('POST bedarfe legt termin_bedarf_bezug-Rows an', async () => {
    const kurator = await userAnlegen({
      email: 'bs1-k@test.werkzirkel.de',
      rollen: ['kurator'],
    });
    const sid = await sessionAnlegen(kurator);
    const { id: tId } = await bedarfsschauAnlegen({ kuratorId: kurator });

    const bt = await userAnlegen({
      email: 'bs1-bt@test.werkzirkel.de',
      rollen: ['bedarfstraeger'],
    });
    const b1 = await bedarfAnlegen({ nutzerId: bt, titel: 'Bedarf A' });
    const b2 = await bedarfAnlegen({ nutzerId: bt, titel: 'Bedarf B' });

    const res = await bedarfeSetzenPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/termine/${tId}/bedarfe`,
        sessionId: sid,
        body: { bedarf_ids: [b1, b2] },
      }),
      { params: Promise.resolve({ id: tId }) },
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { anzahl: number };
    expect(json.anzahl).toBe(2);

    const rows = await db
      .select()
      .from(terminBedarfBezug)
      .where(eq(terminBedarfBezug.terminId, tId));
    expect(rows.length).toBe(2);
    expect(rows.map((r) => r.bedarfId).sort()).toEqual([b1, b2].sort());
  });

  it('POST bedarfe ersetzt bestehende Bezuege (Idempotenz)', async () => {
    const kurator = await userAnlegen({
      email: 'bs2-k@test.werkzirkel.de',
      rollen: ['kurator'],
    });
    const sid = await sessionAnlegen(kurator);
    const { id: tId } = await bedarfsschauAnlegen({ kuratorId: kurator });

    const bt = await userAnlegen({
      email: 'bs2-bt@test.werkzirkel.de',
      rollen: ['bedarfstraeger'],
    });
    const b1 = await bedarfAnlegen({ nutzerId: bt, titel: 'A' });
    const b2 = await bedarfAnlegen({ nutzerId: bt, titel: 'B' });
    const b3 = await bedarfAnlegen({ nutzerId: bt, titel: 'C' });

    // Erst-Set: b1+b2.
    await bedarfeSetzenPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/termine/${tId}/bedarfe`,
        sessionId: sid,
        body: { bedarf_ids: [b1, b2] },
      }),
      { params: Promise.resolve({ id: tId }) },
    );

    // Replace mit b3 only.
    const res2 = await bedarfeSetzenPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/termine/${tId}/bedarfe`,
        sessionId: sid,
        body: { bedarf_ids: [b3] },
      }),
      { params: Promise.resolve({ id: tId }) },
    );
    expect(res2.status).toBe(200);

    const rows = await db
      .select()
      .from(terminBedarfBezug)
      .where(eq(terminBedarfBezug.terminId, tId));
    expect(rows.length).toBe(1);
    expect(rows[0]!.bedarfId).toBe(b3);
  });

  it('POST bedarfe ohne Kurator-Rolle → 403', async () => {
    const kurator = await userAnlegen({
      email: 'bs3-k@test.werkzirkel.de',
      rollen: ['kurator'],
    });
    const { id: tId } = await bedarfsschauAnlegen({ kuratorId: kurator });

    const fremd = await userAnlegen({
      email: 'bs3-m@test.werkzirkel.de',
      rollen: ['macher'],
    });
    const sidFremd = await sessionAnlegen(fremd);

    const bt = await userAnlegen({
      email: 'bs3-bt@test.werkzirkel.de',
      rollen: ['bedarfstraeger'],
    });
    const b1 = await bedarfAnlegen({ nutzerId: bt });

    const res = await bedarfeSetzenPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/termine/${tId}/bedarfe`,
        sessionId: sidFremd,
        body: { bedarf_ids: [b1] },
      }),
      { params: Promise.resolve({ id: tId }) },
    );
    expect(res.status).toBe(403);
  });

  it('POST bedarfe bei schauabend → 422 (falscher Typ)', async () => {
    const kurator = await userAnlegen({
      email: 'bs4-k@test.werkzirkel.de',
      rollen: ['kurator'],
    });
    const sid = await sessionAnlegen(kurator);
    // Schauabend-Termin direkt anlegen statt bedarfsschauAnlegen.
    const tId = createId();
    await db.insert(termin).values({
      id: tId,
      stadtId: 'hh',
      typ: 'schauabend',
      titel: 'Schauabend',
      beschreibung: 'Schauabend Test.',
      ortText: 'Werkstatt',
      datumUhrzeit: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      maxTeilnehmer: 30,
      erstelltVon: kurator,
      status: 'veroeffentlicht',
    });

    const bt = await userAnlegen({
      email: 'bs4-bt@test.werkzirkel.de',
      rollen: ['bedarfstraeger'],
    });
    const b1 = await bedarfAnlegen({ nutzerId: bt });

    const res = await bedarfeSetzenPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/termine/${tId}/bedarfe`,
        sessionId: sid,
        body: { bedarf_ids: [b1] },
      }),
      { params: Promise.resolve({ id: tId }) },
    );
    expect(res.status).toBe(422);
    const json = (await res.json()) as { error?: { code?: string } };
    expect(json.error?.code).toBe('falscher_typ');
  });

  it('POST bedarfe mit Bedarf aus fremder Stadt → 422', async () => {
    const kurator = await userAnlegen({
      email: 'bs5-k@test.werkzirkel.de',
      rollen: ['kurator'],
    });
    const sid = await sessionAnlegen(kurator);
    const { id: tId } = await bedarfsschauAnlegen({
      kuratorId: kurator,
      stadtId: 'hh',
    });

    const bt = await userAnlegen({
      email: 'bs5-bt@test.werkzirkel.de',
      rollen: ['bedarfstraeger'],
      stadtId: 'hh',
    });
    const b1 = await bedarfAnlegen({ nutzerId: bt, stadtId: 'hh' });

    // Suche eine andere Stadt aus dem Seed (Berlin/Muenchen/...).
    const stadtRows = await db.execute<{ id: string }>(
      sql`SELECT id FROM stadt WHERE id != 'hh' LIMIT 1`,
    );
    const otherId = stadtRows[0]?.id;
    if (!otherId) {
      // Ohne zweite Stadt im Seed kann der echte Stadt-Mismatch nicht
      // ausgeloest werden. Smoke-Aufruf: muss 200 sein, weil Bedarf und
      // Termin in derselben (einzigen) Stadt liegen.
      const ok = await bedarfeSetzenPost(
        buildRequest({
          method: 'POST',
          path: `/api/v1/termine/${tId}/bedarfe`,
          sessionId: sid,
          body: { bedarf_ids: [b1] },
        }),
        { params: Promise.resolve({ id: tId }) },
      );
      expect(ok.status).toBe(200);
      return;
    }
    await db
      .update(bedarf)
      .set({ stadtId: otherId })
      .where(eq(bedarf.id, b1));

    const res = await bedarfeSetzenPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/termine/${tId}/bedarfe`,
        sessionId: sid,
        body: { bedarf_ids: [b1] },
      }),
      { params: Promise.resolve({ id: tId }) },
    );
    expect(res.status).toBe(422);
    const json = (await res.json()) as { error?: { code?: string } };
    expect(json.error?.code).toBe('fremde_stadt');
  });

  it('POST foerderprofile legt termin_foerderprofil_bezug-Rows an', async () => {
    const kurator = await userAnlegen({
      email: 'bs6-k@test.werkzirkel.de',
      rollen: ['kurator'],
    });
    const sid = await sessionAnlegen(kurator);
    const { id: tId } = await bedarfsschauAnlegen({ kuratorId: kurator });

    const foerd1 = await userAnlegen({
      email: 'bs6-f1@test.werkzirkel.de',
      rollen: ['foerderer'],
    });
    const foerd2 = await userAnlegen({
      email: 'bs6-f2@test.werkzirkel.de',
      rollen: ['foerderer'],
    });
    const fp1 = await foerderprofilAnlegen({
      nutzerId: foerd1,
      organisation: 'Stiftung A',
    });
    const fp2 = await foerderprofilAnlegen({
      nutzerId: foerd2,
      organisation: 'Stiftung B',
    });

    const res = await foerderprofileSetzenPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/termine/${tId}/foerderprofile`,
        sessionId: sid,
        body: { foerderprofil_ids: [fp1, fp2] },
      }),
      { params: Promise.resolve({ id: tId }) },
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { anzahl: number };
    expect(json.anzahl).toBe(2);

    const rows = await db
      .select()
      .from(terminFoerderprofilBezug)
      .where(eq(terminFoerderprofilBezug.terminId, tId));
    expect(rows.length).toBe(2);
    expect(rows.map((r) => r.foerderprofilId).sort()).toEqual(
      [fp1, fp2].sort(),
    );
  });

  it('GET /api/v1/termine/:id liefert bedarfe + foerderprofile bei bedarfsschau', async () => {
    const kurator = await userAnlegen({
      email: 'bs7-k@test.werkzirkel.de',
      rollen: ['kurator'],
    });
    const sid = await sessionAnlegen(kurator);
    const { id: tId } = await bedarfsschauAnlegen({ kuratorId: kurator });

    const bt = await userAnlegen({
      email: 'bs7-bt@test.werkzirkel.de',
      rollen: ['bedarfstraeger'],
    });
    const b1 = await bedarfAnlegen({ nutzerId: bt, titel: 'B1' });

    const foerd = await userAnlegen({
      email: 'bs7-f@test.werkzirkel.de',
      rollen: ['foerderer'],
    });
    const fp = await foerderprofilAnlegen({ nutzerId: foerd });

    await bedarfeSetzenPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/termine/${tId}/bedarfe`,
        sessionId: sid,
        body: { bedarf_ids: [b1] },
      }),
      { params: Promise.resolve({ id: tId }) },
    );
    await foerderprofileSetzenPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/termine/${tId}/foerderprofile`,
        sessionId: sid,
        body: { foerderprofil_ids: [fp] },
      }),
      { params: Promise.resolve({ id: tId }) },
    );

    const res = await terminGet(
      buildRequest({
        method: 'GET',
        path: `/api/v1/termine/${tId}`,
        sessionId: sid,
      }),
      { params: Promise.resolve({ id: tId }) },
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      termin: { typ: string };
      bedarfe?: Array<{ bedarf: { id: string; titel: string } }>;
      foerderprofile?: Array<{
        foerderprofil: { id: string; organisation: string };
      }>;
    };
    expect(json.termin.typ).toBe('bedarfsschau');
    expect(json.bedarfe).toBeDefined();
    expect(json.bedarfe!.length).toBe(1);
    expect(json.bedarfe![0]!.bedarf.id).toBe(b1);
    expect(json.foerderprofile).toBeDefined();
    expect(json.foerderprofile!.length).toBe(1);
    expect(json.foerderprofile![0]!.foerderprofil.id).toBe(fp);
  });

  it('GET /api/v1/termine/:id ohne bedarfsschau-Typ → KEIN bedarfe/foerderprofile-Feld', async () => {
    const kurator = await userAnlegen({
      email: 'bs8-k@test.werkzirkel.de',
      rollen: ['kurator'],
    });
    const sid = await sessionAnlegen(kurator);
    const tId = createId();
    await db.insert(termin).values({
      id: tId,
      stadtId: 'hh',
      typ: 'schauabend',
      titel: 'Schauabend',
      beschreibung: 'Schauabend Test.',
      ortText: 'Werkstatt',
      datumUhrzeit: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      maxTeilnehmer: 30,
      erstelltVon: kurator,
      status: 'veroeffentlicht',
    });

    const res = await terminGet(
      buildRequest({
        method: 'GET',
        path: `/api/v1/termine/${tId}`,
        sessionId: sid,
      }),
      { params: Promise.resolve({ id: tId }) },
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as Record<string, unknown>;
    expect(json.bedarfe).toBeUndefined();
    expect(json.foerderprofile).toBeUndefined();
  });

  it('Foerder:in bei Bedarfsschau-Anwesenheit → letzte_bedarfsschau_am gesetzt', async () => {
    const kurator = await userAnlegen({
      email: 'bs9-k@test.werkzirkel.de',
      rollen: ['kurator'],
    });
    const sid = await sessionAnlegen(kurator);
    const { id: tId, datum } = await bedarfsschauAnlegen({
      kuratorId: kurator,
      inDerVergangenheit: true,
    });

    const foerd = await userAnlegen({
      email: 'bs9-f@test.werkzirkel.de',
      rollen: ['foerderer'],
    });
    const fpId = await foerderprofilAnlegen({ nutzerId: foerd });

    const aId = await anmeldungAnlegen({ terminId: tId, nutzerId: foerd });

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

    const row = (
      await db
        .select()
        .from(foerderprofil)
        .where(eq(foerderprofil.id, fpId))
        .limit(1)
    )[0]!;
    expect(row.letzteBedarfsschauId).toBe(tId);
    expect(row.letzteBedarfsschauAm?.getTime()).toBe(datum.getTime());
  });

  it('Pausiertes Foerderprofil + Bedarfsschau-Anwesenheit → reaktiviert auf verifiziert', async () => {
    const kurator = await userAnlegen({
      email: 'bs10-k@test.werkzirkel.de',
      rollen: ['kurator'],
    });
    const sid = await sessionAnlegen(kurator);
    const { id: tId } = await bedarfsschauAnlegen({
      kuratorId: kurator,
      inDerVergangenheit: true,
    });

    const foerd = await userAnlegen({
      email: 'bs10-f@test.werkzirkel.de',
      rollen: ['foerderer'],
    });
    const fpId = await foerderprofilAnlegen({
      nutzerId: foerd,
      status: 'pausiert',
    });

    const aId = await anmeldungAnlegen({ terminId: tId, nutzerId: foerd });

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

    const row = (
      await db
        .select()
        .from(foerderprofil)
        .where(eq(foerderprofil.id, fpId))
        .limit(1)
    )[0]!;
    expect(row.verifikationStatus).toBe('verifiziert');
    expect(row.pausiertSeit).toBeNull();
  });
});
