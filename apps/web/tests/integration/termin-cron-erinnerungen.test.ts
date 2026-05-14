/**
 * Integration-Tests fuer den Cron-Endpunkt
 *   POST /api/v1/cron/termin-erinnerung-versenden
 *
 * Verifiziert (PRD §F-405, §11, §15.15):
 *  - 401 ohne X-Cron-Secret
 *  - T-402 wird im 7d-Fenster an angemeldete Personen versendet,
 *    Wartelisten-Personen bekommen KEINE Mail
 *  - Idempotenz: zweiter Lauf → keine Doppel-Mails (audit_log-Dedup)
 *  - T-403 wird im 1d-Fenster versendet
 *  - Termine ausserhalb des Fensters triggern nichts
 *  - status='abgesagt' oder 'durchgefuehrt' triggern nichts
 *  - Audit-Log fuer Cron-Lauf wird geschrieben
 */

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createId } from '@paralleldrive/cuid2';
import { and, eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import {
  auditLog,
  emailBenachrichtigungLog,
  nutzer,
  termin,
  terminAnmeldung,
} from '@/lib/db/schema';
import { env } from '@/lib/env';

import {
  AUDIT_AKTION_CRON_LAUF,
  AUDIT_AKTION_ERINNERUNG_1D,
  AUDIT_AKTION_ERINNERUNG_7D,
  POST as cronPost,
} from '@/app/api/v1/cron/termin-erinnerung-versenden/route';
import { truncateAll } from '../_helpers/db-cleanup';

const APP_ORIGIN = new URL(env.APP_URL).origin;
const CRON_SECRET = env.CRON_SECRET!;
const TAG_MS = 24 * 60 * 60 * 1000;

function cronRequest(secret?: string): Request {
  const headers: Record<string, string> = {};
  if (secret !== undefined) headers['x-cron-secret'] = secret;
  return new Request(
    `${APP_ORIGIN}/api/v1/cron/termin-erinnerung-versenden`,
    { method: 'POST', headers },
  );
}

async function userAnlegen(opts: {
  email: string;
  rollen?: Array<'macher' | 'bedarfstraeger' | 'foerderer' | 'kurator' | 'admin'>;
}): Promise<string> {
  const id = createId();
  await db.insert(nutzer).values({
    id,
    email: opts.email,
    klarname: `Klar ${opts.email}`,
    anzeigename: `anz-${id.slice(0, 6)}`,
    stadtId: 'hh',
    rollen: opts.rollen ?? ['macher'],
    emailVerifiziertAm: new Date(),
  });
  return id;
}

async function terminAnlegen(opts: {
  kuratorId: string;
  status?: 'geplant' | 'veroeffentlicht' | 'abgesagt' | 'durchgefuehrt';
  datumOffsetMs: number;
  titel?: string;
  maxTeilnehmer?: number;
}): Promise<string> {
  const id = createId();
  await db.insert(termin).values({
    id,
    stadtId: 'hh',
    typ: 'schauabend',
    titel: opts.titel ?? 'Schauabend',
    beschreibung: 'Beschreibung.',
    ortText: 'Werkstatt St. Pauli',
    datumUhrzeit: new Date(Date.now() + opts.datumOffsetMs),
    maxTeilnehmer: opts.maxTeilnehmer ?? 20,
    erstelltVon: opts.kuratorId,
    status: opts.status ?? 'veroeffentlicht',
  });
  return id;
}

async function anmeldungAnlegen(opts: {
  terminId: string;
  nutzerId: string;
  status?: 'angemeldet' | 'warteliste' | 'anwesend' | 'nicht_anwesend' | 'storniert';
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

describe('POST /api/v1/cron/termin-erinnerung-versenden', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  it('ohne X-Cron-Secret -> 401', async () => {
    const res = await cronPost(cronRequest());
    expect(res.status).toBe(401);
  });

  it('mit falschem Secret -> 401', async () => {
    const res = await cronPost(cronRequest('totally-wrong'));
    expect(res.status).toBe(401);
  });

  it('T-402: 7d-Fenster, 3 angemeldete + 1 Warteliste -> 3 Mails, dedup beim zweiten Lauf', async () => {
    const kuratorId = await userAnlegen({
      email: 'erin-kurator@test.werkzirkel.de',
      rollen: ['kurator'],
    });
    const terminId = await terminAnlegen({
      kuratorId,
      status: 'veroeffentlicht',
      datumOffsetMs: 7 * TAG_MS, // genau in 7d
    });
    const teilnehmerEmails = [
      'erin-7d-a@test.werkzirkel.de',
      'erin-7d-b@test.werkzirkel.de',
      'erin-7d-c@test.werkzirkel.de',
    ];
    const angemeldeteIds: string[] = [];
    for (const email of teilnehmerEmails) {
      const uid = await userAnlegen({ email });
      const aid = await anmeldungAnlegen({
        terminId,
        nutzerId: uid,
        status: 'angemeldet',
      });
      angemeldeteIds.push(aid);
    }
    const wartelistenUserId = await userAnlegen({
      email: 'erin-7d-warte@test.werkzirkel.de',
    });
    const wartelistenAnmId = await anmeldungAnlegen({
      terminId,
      nutzerId: wartelistenUserId,
      status: 'warteliste',
    });

    // Erster Lauf -> 3 T-402-Mails
    const r1 = await cronPost(cronRequest(CRON_SECRET));
    expect(r1.status).toBe(200);
    const body1 = (await r1.json()) as {
      t402_versendet: number;
      t403_versendet: number;
    };
    expect(body1.t402_versendet).toBe(3);
    expect(body1.t403_versendet).toBe(0);

    // Email-Log: genau 3 T-402-Eintraege, keiner an die Wartelisten-Person
    const mails1 = await db
      .select()
      .from(emailBenachrichtigungLog)
      .where(eq(emailBenachrichtigungLog.template, 'T-402'));
    expect(mails1.length).toBe(3);
    const empfaengerSet = new Set(mails1.map((m) => m.email));
    for (const e of teilnehmerEmails) expect(empfaengerSet.has(e)).toBe(true);
    expect(empfaengerSet.has('erin-7d-warte@test.werkzirkel.de')).toBe(false);

    // Audit-Log: 3 'termin.erinnerung-7d'-Eintraege, je einer pro Anmeldung
    const audit7d = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.aktion, AUDIT_AKTION_ERINNERUNG_7D));
    expect(audit7d.length).toBe(3);
    const auditRefs = new Set(audit7d.map((a) => a.referenzId));
    for (const aid of angemeldeteIds) expect(auditRefs.has(aid)).toBe(true);
    expect(auditRefs.has(wartelistenAnmId)).toBe(false);

    // Zweiter Lauf -> dedup greift, keine zweite Mail
    const r2 = await cronPost(cronRequest(CRON_SECRET));
    expect(r2.status).toBe(200);
    const body2 = (await r2.json()) as { t402_versendet: number };
    expect(body2.t402_versendet).toBe(0);

    const mailsNachZweitemLauf = await db
      .select()
      .from(emailBenachrichtigungLog)
      .where(eq(emailBenachrichtigungLog.template, 'T-402'));
    expect(mailsNachZweitemLauf.length).toBe(3);
  });

  it('T-403: 1d-Fenster, 2 angemeldete -> 2 Mails', async () => {
    const kuratorId = await userAnlegen({
      email: 'erin-kurator-1d@test.werkzirkel.de',
      rollen: ['kurator'],
    });
    const terminId = await terminAnlegen({
      kuratorId,
      status: 'veroeffentlicht',
      datumOffsetMs: 24 * 60 * 60 * 1000, // in 24h
    });
    const u1 = await userAnlegen({ email: 'erin-1d-a@test.werkzirkel.de' });
    const u2 = await userAnlegen({ email: 'erin-1d-b@test.werkzirkel.de' });
    await anmeldungAnlegen({ terminId, nutzerId: u1, status: 'angemeldet' });
    await anmeldungAnlegen({ terminId, nutzerId: u2, status: 'angemeldet' });

    const res = await cronPost(cronRequest(CRON_SECRET));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      t402_versendet: number;
      t403_versendet: number;
    };
    expect(body.t403_versendet).toBe(2);
    expect(body.t402_versendet).toBe(0);

    const mails = await db
      .select()
      .from(emailBenachrichtigungLog)
      .where(eq(emailBenachrichtigungLog.template, 'T-403'));
    expect(mails.length).toBe(2);

    const audit1d = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.aktion, AUDIT_AKTION_ERINNERUNG_1D));
    expect(audit1d.length).toBe(2);
  });

  it('Termin ausserhalb beider Fenster (+30d) -> keine Mail', async () => {
    const kuratorId = await userAnlegen({
      email: 'erin-out-kur@test.werkzirkel.de',
      rollen: ['kurator'],
    });
    const terminId = await terminAnlegen({
      kuratorId,
      status: 'veroeffentlicht',
      datumOffsetMs: 30 * TAG_MS,
    });
    const u = await userAnlegen({ email: 'erin-out@test.werkzirkel.de' });
    await anmeldungAnlegen({ terminId, nutzerId: u, status: 'angemeldet' });

    const res = await cronPost(cronRequest(CRON_SECRET));
    const body = (await res.json()) as {
      t402_versendet: number;
      t403_versendet: number;
    };
    expect(body.t402_versendet).toBe(0);
    expect(body.t403_versendet).toBe(0);

    const mails = await db.select().from(emailBenachrichtigungLog);
    expect(mails.length).toBe(0);
  });

  it("status='abgesagt' im 7d-Fenster -> keine Mail", async () => {
    const kuratorId = await userAnlegen({
      email: 'erin-cancel-kur@test.werkzirkel.de',
      rollen: ['kurator'],
    });
    const terminId = await terminAnlegen({
      kuratorId,
      status: 'abgesagt',
      datumOffsetMs: 7 * TAG_MS,
    });
    const u = await userAnlegen({ email: 'erin-cancel@test.werkzirkel.de' });
    await anmeldungAnlegen({ terminId, nutzerId: u, status: 'angemeldet' });

    const res = await cronPost(cronRequest(CRON_SECRET));
    const body = (await res.json()) as { t402_versendet: number };
    expect(body.t402_versendet).toBe(0);

    const mails = await db.select().from(emailBenachrichtigungLog);
    expect(mails.length).toBe(0);
  });

  it("status='durchgefuehrt' im 7d-Fenster -> keine Mail", async () => {
    const kuratorId = await userAnlegen({
      email: 'erin-done-kur@test.werkzirkel.de',
      rollen: ['kurator'],
    });
    const terminId = await terminAnlegen({
      kuratorId,
      status: 'durchgefuehrt',
      datumOffsetMs: 7 * TAG_MS,
    });
    const u = await userAnlegen({ email: 'erin-done@test.werkzirkel.de' });
    await anmeldungAnlegen({ terminId, nutzerId: u, status: 'angemeldet' });

    const res = await cronPost(cronRequest(CRON_SECRET));
    const body = (await res.json()) as { t402_versendet: number };
    expect(body.t402_versendet).toBe(0);

    const mails = await db.select().from(emailBenachrichtigungLog);
    expect(mails.length).toBe(0);
  });

  it('Audit-Log fuer Cron-Lauf wird geschrieben', async () => {
    const res = await cronPost(cronRequest(CRON_SECRET));
    expect(res.status).toBe(200);
    const audit = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.aktion, AUDIT_AKTION_CRON_LAUF));
    expect(audit.length).toBeGreaterThanOrEqual(1);
    const metadaten = audit[0]!.metadaten as Record<string, unknown>;
    expect(metadaten).toHaveProperty('t402_versendet');
    expect(metadaten).toHaveProperty('t403_versendet');
    expect(metadaten).toHaveProperty('dauer_ms');
  });

  // sanity-anchor
  it('imports geprueft', () => {
    void and;
    expect(typeof cronPost).toBe('function');
  });
});
