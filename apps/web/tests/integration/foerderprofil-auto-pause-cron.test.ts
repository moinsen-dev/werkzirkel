/**
 * Integration-Tests fuer den Auto-Pause-Cron:
 *   POST/GET /api/v1/cron/foerderprofil-quartal-pruefen
 *
 * Deckt PRD §11A Schutz Kulturverlust 4 + §F-704 + §19.
 */

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createId } from '@paralleldrive/cuid2';
import { eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { foerderprofil, nutzer } from '@/lib/db/schema';
import { env } from '@/lib/env';

import { POST as cronPost } from '@/app/api/v1/cron/foerderprofil-quartal-pruefen/route';

import { truncateAll } from '../_helpers/db-cleanup';

const APP_ORIGIN = new URL(env.APP_URL).origin;
const CRON_SECRET = env.CRON_SECRET ?? '';

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
    rollen: opts.rollen ?? ['foerderer'],
    emailVerifiziertAm: new Date(),
  });
  return id;
}

function cronRequest(): Request {
  return new Request(
    `${APP_ORIGIN}/api/v1/cron/foerderprofil-quartal-pruefen`,
    {
      method: 'POST',
      headers: {
        'x-cron-secret': CRON_SECRET,
        'content-type': 'application/json',
      },
    },
  );
}

describe('Auto-Pause-Cron foerderprofil-quartal-pruefen', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  it('ohne X-Cron-Secret → 401', async () => {
    const req = new Request(
      `${APP_ORIGIN}/api/v1/cron/foerderprofil-quartal-pruefen`,
      { method: 'POST' },
    );
    const res = await cronPost(req);
    expect(res.status).toBe(401);
  });

  it('Profil mit letzter Bedarfsschau vor 13 Monaten → pausiert', async () => {
    const owner = await userAnlegen({
      email: 'fp-cron-alt@test.werkzirkel.de',
    });
    const fpId = createId();
    const vor13Monaten = new Date(Date.now() - 13 * 30 * 24 * 60 * 60 * 1000);
    await db.insert(foerderprofil).values({
      id: fpId,
      nutzerId: owner,
      organisation: 'Alte Stiftung',
      foerderart: 'geld',
      gegenleistungTyp: 'sichtbarkeit',
      verifikationStatus: 'verifiziert',
      letzteBedarfsschauAm: vor13Monaten,
      verifiziertAm: new Date(Date.now() - 14 * 30 * 24 * 60 * 60 * 1000),
    });

    const res = await cronPost(cronRequest());
    expect(res.status).toBe(200);
    const data = (await res.json()) as { pausiert: number };
    expect(data.pausiert).toBe(1);

    const row = (
      await db
        .select()
        .from(foerderprofil)
        .where(eq(foerderprofil.id, fpId))
        .limit(1)
    )[0]!;
    expect(row.verifikationStatus).toBe('pausiert');
    expect(row.pausiertSeit).toBeTruthy();
  });

  it('Profil mit letzter Bedarfsschau vor 6 Monaten → bleibt verifiziert', async () => {
    const owner = await userAnlegen({
      email: 'fp-cron-fresh@test.werkzirkel.de',
    });
    const fpId = createId();
    const vor6Monaten = new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000);
    await db.insert(foerderprofil).values({
      id: fpId,
      nutzerId: owner,
      organisation: 'Frische Stiftung',
      foerderart: 'geld',
      gegenleistungTyp: 'sichtbarkeit',
      verifikationStatus: 'verifiziert',
      letzteBedarfsschauAm: vor6Monaten,
      verifiziertAm: new Date(Date.now() - 7 * 30 * 24 * 60 * 60 * 1000),
    });

    const res = await cronPost(cronRequest());
    expect(res.status).toBe(200);
    const data = (await res.json()) as { pausiert: number };
    expect(data.pausiert).toBe(0);

    const row = (
      await db
        .select()
        .from(foerderprofil)
        .where(eq(foerderprofil.id, fpId))
        .limit(1)
    )[0]!;
    expect(row.verifikationStatus).toBe('verifiziert');
  });

  it('Profil mit letzte_bedarfsschau_am NULL → bleibt verifiziert (kein Auto-Pause)', async () => {
    // Frisch verifiziert, aber noch nie auf Bedarfsschau gewesen. Soll nicht
    // sofort pausiert werden — der Auto-Pause greift erst, wenn es eine
    // letzte Teilnahme gab.
    const owner = await userAnlegen({
      email: 'fp-cron-null@test.werkzirkel.de',
    });
    const fpId = createId();
    await db.insert(foerderprofil).values({
      id: fpId,
      nutzerId: owner,
      organisation: 'Neue Stiftung',
      foerderart: 'geld',
      gegenleistungTyp: 'keine',
      verifikationStatus: 'verifiziert',
      letzteBedarfsschauAm: null,
      verifiziertAm: new Date(),
    });

    const res = await cronPost(cronRequest());
    expect(res.status).toBe(200);
    const data = (await res.json()) as { pausiert: number };
    expect(data.pausiert).toBe(0);

    const row = (
      await db
        .select()
        .from(foerderprofil)
        .where(eq(foerderprofil.id, fpId))
        .limit(1)
    )[0]!;
    expect(row.verifikationStatus).toBe('verifiziert');
  });

  it('bereits pausierte Profile werden nicht erneut pausiert', async () => {
    const owner = await userAnlegen({
      email: 'fp-cron-paus@test.werkzirkel.de',
    });
    const fpId = createId();
    const vor13Monaten = new Date(Date.now() - 13 * 30 * 24 * 60 * 60 * 1000);
    const altePausierungSeit = new Date(
      Date.now() - 30 * 24 * 60 * 60 * 1000,
    );
    await db.insert(foerderprofil).values({
      id: fpId,
      nutzerId: owner,
      organisation: 'Schon pausiert',
      foerderart: 'geld',
      gegenleistungTyp: 'keine',
      verifikationStatus: 'pausiert',
      pausiertSeit: altePausierungSeit,
      letzteBedarfsschauAm: vor13Monaten,
    });

    const res = await cronPost(cronRequest());
    expect(res.status).toBe(200);
    const data = (await res.json()) as { pausiert: number };
    expect(data.pausiert).toBe(0);

    const row = (
      await db
        .select()
        .from(foerderprofil)
        .where(eq(foerderprofil.id, fpId))
        .limit(1)
    )[0]!;
    expect(row.pausiertSeit?.getTime()).toBe(altePausierungSeit.getTime());
  });
});
