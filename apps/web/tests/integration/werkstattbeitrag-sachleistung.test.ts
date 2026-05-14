/**
 * Integration-Tests fuer den Sachleistungs-Pfad + Kurator-Verifikation/-Ablehnen:
 *   POST  /api/v1/werkstattbeitrag/sachleistung
 *   POST  /api/v1/kurator/werkstattbeitraege/:id/verifizieren
 *   POST  /api/v1/kurator/werkstattbeitraege/:id/ablehnen
 *
 * Deckt PRD §10.5, §18 (Pfad C).
 */

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createId } from '@paralleldrive/cuid2';
import { eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import {
  emailBenachrichtigungLog,
  nutzer,
  session as sessionTable,
  werkstattbeitrag,
} from '@/lib/db/schema';
import { env } from '@/lib/env';
import { buildSessionCookie } from '@/lib/auth/session';

import { POST as sachleistungPost } from '@/app/api/v1/werkstattbeitrag/sachleistung/route';
import { POST as verifizierenPost } from '@/app/api/v1/kurator/werkstattbeitraege/[id]/verifizieren/route';
import { POST as ablehnenPost } from '@/app/api/v1/kurator/werkstattbeitraege/[id]/ablehnen/route';

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

describe('POST /api/v1/werkstattbeitrag/sachleistung', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  it('Bedarfstraeger:in mit Nachweis-Text → 201, status=erfasst', async () => {
    const userId = await userAnlegen({
      email: 'wb-sach-1@test.werkzirkel.de',
      rollen: ['bedarfstraeger'],
    });
    const sid = await sessionAnlegen(userId);
    const res = await sachleistungPost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/werkstattbeitrag/sachleistung',
        sessionId: sid,
        body: {
          nachweis_text: 'Raum fuer Schauabend zur Verfuegung gestellt.',
        },
      }),
    );
    expect(res.status).toBe(201);
    const data = (await res.json()) as {
      werkstattbeitrag: { id: string; status: string; art: string };
    };
    expect(data.werkstattbeitrag.status).toBe('erfasst');
    expect(data.werkstattbeitrag.art).toBe('sachleistung');
  });

  it('Zu kurzer Nachweis → 422', async () => {
    const userId = await userAnlegen({
      email: 'wb-sach-2@test.werkzirkel.de',
      rollen: ['bedarfstraeger'],
    });
    const sid = await sessionAnlegen(userId);
    const res = await sachleistungPost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/werkstattbeitrag/sachleistung',
        sessionId: sid,
        body: { nachweis_text: 'kurz' },
      }),
    );
    expect(res.status).toBe(422);
  });

  it('Ohne bedarfstraeger-Rolle → 403', async () => {
    const userId = await userAnlegen({
      email: 'wb-sach-3@test.werkzirkel.de',
      rollen: ['macher'],
    });
    const sid = await sessionAnlegen(userId);
    const res = await sachleistungPost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/werkstattbeitrag/sachleistung',
        sessionId: sid,
        body: {
          nachweis_text: 'Ich biete eine Werkzeug-Spende, aktiver Beitrag.',
        },
      }),
    );
    expect(res.status).toBe(403);
  });

  it('Ohne Session → 401', async () => {
    const res = await sachleistungPost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/werkstattbeitrag/sachleistung',
        body: {
          nachweis_text: 'irrelevant fuer den 401-Pfad mit ausreichender Laenge.',
        },
      }),
    );
    expect(res.status).toBe(401);
  });
});

describe('Kurator-Verifizieren + Ablehnen', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  it('Kurator verifiziert Sachleistung → status=verifiziert, gueltig_bis ~6 Monate, T-602 verschickt', async () => {
    const bedarf = await userAnlegen({
      email: 'wb-sach-kver@test.werkzirkel.de',
      rollen: ['bedarfstraeger'],
    });
    const bsid = await sessionAnlegen(bedarf);
    const sachRes = await sachleistungPost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/werkstattbeitrag/sachleistung',
        sessionId: bsid,
        body: { nachweis_text: 'Doku-Tag organisiert mit zwei Macher:innen.' },
      }),
    );
    const { werkstattbeitrag: created } = (await sachRes.json()) as {
      werkstattbeitrag: { id: string };
    };
    const wbId = created.id;

    const kurator = await userAnlegen({
      email: 'wb-sach-kur@test.werkzirkel.de',
      rollen: ['kurator'],
      stadtId: 'hh',
    });
    const ksid = await sessionAnlegen(kurator);
    const res = await verifizierenPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/kurator/werkstattbeitraege/${wbId}/verifizieren`,
        sessionId: ksid,
      }),
      { params: Promise.resolve({ id: wbId }) },
    );
    expect(res.status).toBe(200);

    const row = (
      await db
        .select()
        .from(werkstattbeitrag)
        .where(eq(werkstattbeitrag.id, wbId))
    )[0]!;
    expect(row.status).toBe('verifiziert');
    expect(row.verifiziertDurch).toBe(kurator);
    expect(row.verifiziertAm).toBeTruthy();
    expect(row.gueltigBis).toBeTruthy();
    const monateDiff =
      (row.gueltigBis!.getTime() - Date.now()) /
      (1000 * 60 * 60 * 24 * 30);
    expect(monateDiff).toBeGreaterThan(5);
    expect(monateDiff).toBeLessThan(7);

    // T-602 versendet.
    const mailRows = await db
      .select()
      .from(emailBenachrichtigungLog)
      .where(eq(emailBenachrichtigungLog.template, 'T-602'));
    expect(mailRows.length).toBe(1);
    expect(mailRows[0]?.status).toBe('gesendet');
  });

  it('Kurator anderer Stadt → 403', async () => {
    const bedarf = await userAnlegen({
      email: 'wb-stadt-bedarf@test.werkzirkel.de',
      rollen: ['bedarfstraeger'],
      stadtId: 'hh',
    });
    const bsid = await sessionAnlegen(bedarf);
    const sachRes = await sachleistungPost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/werkstattbeitrag/sachleistung',
        sessionId: bsid,
        body: { nachweis_text: 'Beitrag der Stadt Hamburg, getestet.' },
      }),
    );
    const { werkstattbeitrag: created } = (await sachRes.json()) as {
      werkstattbeitrag: { id: string };
    };
    const wbId = created.id;

    const fremdKurator = await userAnlegen({
      email: 'wb-stadt-kur-b@test.werkzirkel.de',
      rollen: ['kurator'],
      stadtId: 'b',
    });
    const ksid = await sessionAnlegen(fremdKurator);
    const res = await verifizierenPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/kurator/werkstattbeitraege/${wbId}/verifizieren`,
        sessionId: ksid,
      }),
      { params: Promise.resolve({ id: wbId }) },
    );
    expect(res.status).toBe(403);
  });

  it('Kurator lehnt mit Grund ab → status=abgelehnt', async () => {
    const bedarf = await userAnlegen({
      email: 'wb-abl-bedarf@test.werkzirkel.de',
      rollen: ['bedarfstraeger'],
    });
    const bsid = await sessionAnlegen(bedarf);
    const sachRes = await sachleistungPost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/werkstattbeitrag/sachleistung',
        sessionId: bsid,
        body: { nachweis_text: 'Sehr vage Sachleistung ohne Details bisher.' },
      }),
    );
    const { werkstattbeitrag: created } = (await sachRes.json()) as {
      werkstattbeitrag: { id: string };
    };
    const wbId = created.id;

    const kurator = await userAnlegen({
      email: 'wb-abl-kur@test.werkzirkel.de',
      rollen: ['kurator'],
    });
    const ksid = await sessionAnlegen(kurator);
    const res = await ablehnenPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/kurator/werkstattbeitraege/${wbId}/ablehnen`,
        sessionId: ksid,
        body: { grund: 'Bitte konkrete Sachleistung beschreiben.' },
      }),
      { params: Promise.resolve({ id: wbId }) },
    );
    expect(res.status).toBe(200);
    const row = (
      await db
        .select()
        .from(werkstattbeitrag)
        .where(eq(werkstattbeitrag.id, wbId))
    )[0]!;
    expect(row.status).toBe('abgelehnt');
  });

  it('Verifizieren bei art=geldbeitrag → 422 falsche_art (laeuft ueber Webhook)', async () => {
    const bedarf = await userAnlegen({
      email: 'wb-geld-vermanuell@test.werkzirkel.de',
      rollen: ['bedarfstraeger'],
    });
    const wbId = createId();
    await db.insert(werkstattbeitrag).values({
      id: wbId,
      nutzerId: bedarf,
      art: 'geldbeitrag',
      hoeheEuroCent: 10000,
      status: 'erfasst',
    });
    const kurator = await userAnlegen({
      email: 'wb-geld-vermanuell-kur@test.werkzirkel.de',
      rollen: ['kurator'],
    });
    const ksid = await sessionAnlegen(kurator);
    const res = await verifizierenPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/kurator/werkstattbeitraege/${wbId}/verifizieren`,
        sessionId: ksid,
      }),
      { params: Promise.resolve({ id: wbId }) },
    );
    expect(res.status).toBe(422);
    const data = (await res.json()) as { error: { code: string } };
    expect(data.error.code).toBe('falsche_art');
  });
});
