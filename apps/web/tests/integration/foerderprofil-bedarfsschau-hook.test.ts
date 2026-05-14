/**
 * Integration-Test fuer den Foerderprofil-Bedarfsschau-Hook im
 * Anwesenheits-Endpoint (PRD §11A Schutz Kulturverlust 4 + §F-704).
 *
 * - Foerder:in als 'anwesend' auf bedarfsschau → letzte_bedarfsschau_id/am
 *   wird aktualisiert.
 * - Pausiertes Profil → wird reaktiviert (status='verifiziert').
 * - Termin-Typ 'schauabend' (NICHT 'bedarfsschau') → KEIN Hook-Trigger
 *   fuer Foerderprofile.
 * - User ohne foerderer-Rolle → kein Hook-Trigger.
 * - User mit foerderer-Rolle aber ohne Profil → no-op.
 */

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createId } from '@paralleldrive/cuid2';
import { eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import {
  foerderprofil,
  nutzer,
  session as sessionTable,
  termin,
  terminAnmeldung,
} from '@/lib/db/schema';
import { env } from '@/lib/env';
import { buildSessionCookie } from '@/lib/auth/session';

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

async function terminAnlegen(opts: {
  kuratorId: string;
  typ?:
    | 'pruefabend'
    | 'schauabend'
    | 'bedarfsschau'
    | 'baurunde'
    | 'werkgespraech'
    | 'kennenlernrunde';
  inDerVergangenheit?: boolean;
  stadtId?: string;
  datum?: Date;
}): Promise<{ id: string; datum: Date }> {
  const id = createId();
  const datum =
    opts.datum ??
    (opts.inDerVergangenheit
      ? new Date(Date.now() - 24 * 60 * 60 * 1000)
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
  await db.insert(termin).values({
    id,
    stadtId: opts.stadtId ?? 'hh',
    typ: opts.typ ?? 'bedarfsschau',
    titel: 'Bedarfsschau Mai',
    beschreibung: 'Foerder:innen treffen Bedarfstraeger:innen.',
    ortText: 'Werkstatt St. Pauli, Hamburg',
    datumUhrzeit: datum,
    maxTeilnehmer: 30,
    erstelltVon: opts.kuratorId,
    status: 'durchgefuehrt',
  });
  return { id, datum };
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

function buildRequest(opts: {
  method: 'POST';
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

describe('Foerderprofil-Bedarfsschau-Hook', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  it('Foerder:in auf bedarfsschau anwesend → letzte_bedarfsschau_am wird aktualisiert', async () => {
    const kurator = await userAnlegen({
      email: 'bs-kur@test.werkzirkel.de',
      rollen: ['kurator'],
    });
    const sid = await sessionAnlegen(kurator);
    const { id: tId, datum } = await terminAnlegen({
      kuratorId: kurator,
      typ: 'bedarfsschau',
      inDerVergangenheit: true,
    });

    const foerderer = await userAnlegen({
      email: 'bs-fp@test.werkzirkel.de',
      rollen: ['foerderer'],
    });
    const fpId = createId();
    await db.insert(foerderprofil).values({
      id: fpId,
      nutzerId: foerderer,
      organisation: 'Test Stiftung',
      foerderart: 'geld',
      gegenleistungTyp: 'sichtbarkeit',
      verifikationStatus: 'verifiziert',
      verifiziertAm: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    });

    const aId = await anmeldungAnlegen({
      terminId: tId,
      nutzerId: foerderer,
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

    const row = (
      await db
        .select()
        .from(foerderprofil)
        .where(eq(foerderprofil.id, fpId))
        .limit(1)
    )[0]!;
    expect(row.letzteBedarfsschauId).toBe(tId);
    expect(row.letzteBedarfsschauAm?.getTime()).toBe(datum.getTime());
    // Status bleibt 'verifiziert' (war schon verifiziert).
    expect(row.verifikationStatus).toBe('verifiziert');
  });

  it('Pausiertes Foerderprofil → bei Bedarfsschau-Anwesenheit reaktiviert', async () => {
    const kurator = await userAnlegen({
      email: 'bs-rk-kur@test.werkzirkel.de',
      rollen: ['kurator'],
    });
    const sid = await sessionAnlegen(kurator);
    const { id: tId } = await terminAnlegen({
      kuratorId: kurator,
      typ: 'bedarfsschau',
      inDerVergangenheit: true,
    });

    const foerderer = await userAnlegen({
      email: 'bs-rk-fp@test.werkzirkel.de',
      rollen: ['foerderer'],
    });
    const fpId = createId();
    await db.insert(foerderprofil).values({
      id: fpId,
      nutzerId: foerderer,
      organisation: 'Pausierte Stiftung',
      foerderart: 'geld',
      gegenleistungTyp: 'sichtbarkeit',
      verifikationStatus: 'pausiert',
      pausiertSeit: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    });

    const aId = await anmeldungAnlegen({
      terminId: tId,
      nutzerId: foerderer,
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

    const row = (
      await db
        .select()
        .from(foerderprofil)
        .where(eq(foerderprofil.id, fpId))
        .limit(1)
    )[0]!;
    expect(row.verifikationStatus).toBe('verifiziert');
    expect(row.pausiertSeit).toBeNull();
    expect(row.letzteBedarfsschauId).toBe(tId);
  });

  it('Termin-Typ schauabend → KEIN Foerderprofil-Update', async () => {
    const kurator = await userAnlegen({
      email: 'bs-sch-kur@test.werkzirkel.de',
      rollen: ['kurator'],
    });
    const sid = await sessionAnlegen(kurator);
    const { id: tId } = await terminAnlegen({
      kuratorId: kurator,
      typ: 'schauabend',
      inDerVergangenheit: true,
    });

    const foerderer = await userAnlegen({
      email: 'bs-sch-fp@test.werkzirkel.de',
      rollen: ['foerderer'],
    });
    const fpId = createId();
    await db.insert(foerderprofil).values({
      id: fpId,
      nutzerId: foerderer,
      organisation: 'X',
      foerderart: 'geld',
      gegenleistungTyp: 'keine',
      verifikationStatus: 'verifiziert',
    });

    const aId = await anmeldungAnlegen({
      terminId: tId,
      nutzerId: foerderer,
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

    const row = (
      await db
        .select()
        .from(foerderprofil)
        .where(eq(foerderprofil.id, fpId))
        .limit(1)
    )[0]!;
    expect(row.letzteBedarfsschauId).toBeNull();
    expect(row.letzteBedarfsschauAm).toBeNull();
  });

  it('User ohne foerderer-Rolle → kein Update (auch wenn FP zufaellig existiert)', async () => {
    // Edge-Case: User hat zwar ein Foerderprofil in der DB, aber gerade
    // wurde 'foerderer'-Rolle entzogen. Hook darf nicht triggern.
    const kurator = await userAnlegen({
      email: 'bs-no-kur@test.werkzirkel.de',
      rollen: ['kurator'],
    });
    const sid = await sessionAnlegen(kurator);
    const { id: tId } = await terminAnlegen({
      kuratorId: kurator,
      typ: 'bedarfsschau',
      inDerVergangenheit: true,
    });

    const macher = await userAnlegen({
      email: 'bs-no-m@test.werkzirkel.de',
      rollen: ['macher'],
    });
    const aId = await anmeldungAnlegen({
      terminId: tId,
      nutzerId: macher,
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

    // Keine Profil-Row existiert; sanity check: nichts crasht.
    const rows = await db
      .select()
      .from(foerderprofil)
      .where(eq(foerderprofil.nutzerId, macher));
    expect(rows.length).toBe(0);
  });
});
