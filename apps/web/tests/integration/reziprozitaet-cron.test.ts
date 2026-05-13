/**
 * Integration-Tests fuer den Cron-Endpunkt
 *   POST /api/v1/cron/reziprozitaet-frist-pruefen
 *
 * Verifiziert (PRD §17, §11, §15.15):
 *  - 401 ohne X-Cron-Secret
 *  - Abgelaufene offene Verpflichtungen werden 'verfallen' gesetzt
 *  - test_saldo des betroffenen Nutzers wird re-aggregiert
 *  - T-103-Erinnerung wird verschickt bei frist in (now+3d +/- 1h)
 *  - Idempotenz: zweiter Lauf innerhalb 7d → keine Doppel-Mail (audit_log)
 *  - T-104-Erinnerung wird verschickt bei frist in (now+1d +/- 1h)
 *  - Audit-Log fuer den Cron-Lauf selbst existiert
 */

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createId } from '@paralleldrive/cuid2';
import { and, eq, inArray } from 'drizzle-orm';

import { db } from '@/lib/db';
import {
  auditLog,
  emailBenachrichtigungLog,
  nutzer,
  pruefrunde,
  pruefrundenVerpflichtung,
  testSaldo,
  werk,
} from '@/lib/db/schema';
import { env } from '@/lib/env';

import {
  AUDIT_AKTION_CRON_LAUF,
  AUDIT_AKTION_ERINNERUNG_1D,
  AUDIT_AKTION_ERINNERUNG_3D,
  POST as cronPost,
} from '@/app/api/v1/cron/reziprozitaet-frist-pruefen/route';
import { truncateAll } from '../_helpers/db-cleanup';

const APP_ORIGIN = new URL(env.APP_URL).origin;
const CRON_SECRET = env.CRON_SECRET!;

const EMAILS = {
  verfallen: 'rezi-cron-verfallen@test.werkzirkel.de',
  drei: 'rezi-cron-3d@test.werkzirkel.de',
  eins: 'rezi-cron-1d@test.werkzirkel.de',
  inhaber: 'rezi-cron-inhaber@test.werkzirkel.de',
} as const;

function cronRequest(secret?: string): Request {
  const headers: Record<string, string> = {};
  if (secret !== undefined) headers['x-cron-secret'] = secret;
  return new Request(
    `${APP_ORIGIN}/api/v1/cron/reziprozitaet-frist-pruefen`,
    { method: 'POST', headers },
  );
}

async function setupBaseWerkUndPruefrunde(): Promise<{
  inhaberId: string;
  pruefrundeId: string;
}> {
  const inhaberId = createId();
  await db.insert(nutzer).values({
    id: inhaberId,
    email: EMAILS.inhaber,
    klarname: 'Rezi Cron Inhaber',
    anzeigename: 'rezi-cron-inhaber',
    stadtId: 'hh',
    rollen: ['macher'],
    emailVerifiziertAm: new Date(),
  });
  const werkId = createId();
  await db.insert(werk).values({
    id: werkId,
    nutzerId: inhaberId,
    name: 'CronWerk',
    kurzbeschreibung: 'k',
    problem: 'p',
    zielgruppe: 'z',
    werkstand: 'idee',
  });
  const pruefrundeId = createId();
  await db.insert(pruefrunde).values({
    id: pruefrundeId,
    werkId,
    titel: 't',
    testziel: 'tz',
    testaufgabe: 'ta',
    zielgruppe: 'z',
    zeitbedarfMinuten: 30,
    gesuchteTester: 3,
    feedbackKategorien: ['erster_eindruck'],
    frist: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    status: 'oeffentlich',
  });
  return { inhaberId, pruefrundeId };
}

async function seedNutzer(email: string): Promise<string> {
  const id = createId();
  await db.insert(nutzer).values({
    id,
    email,
    klarname: 'Rezi Cron Empf',
    anzeigename: email.split('@')[0]!.slice(0, 30),
    stadtId: 'hh',
    rollen: ['macher'],
    emailVerifiziertAm: new Date(),
  });
  return id;
}

describe('POST /api/v1/cron/reziprozitaet-frist-pruefen', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  it('ohne X-Cron-Secret → 401', async () => {
    const res = await cronPost(cronRequest());
    expect(res.status).toBe(401);
  });

  it('mit falschem Secret → 401', async () => {
    const res = await cronPost(cronRequest('totally-wrong'));
    expect(res.status).toBe(401);
  });

  it('markiert abgelaufene Verpflichtungen als verfallen + recomputed test_saldo', async () => {
    const { pruefrundeId } = await setupBaseWerkUndPruefrunde();
    const nutzerId = await seedNutzer(EMAILS.verfallen);

    // Eine abgelaufene + eine noch laufende Verpflichtung
    await db.insert(pruefrundenVerpflichtung).values([
      {
        nutzerId,
        ausPruefrundeId: pruefrundeId,
        frist: new Date(Date.now() - 24 * 60 * 60 * 1000), // gestern
        status: 'offen',
      },
      {
        nutzerId,
        ausPruefrundeId: pruefrundeId,
        frist: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // in 7d
        status: 'offen',
      },
    ]);
    // Saldo: 0 gegeben, 2 offen, naechste_frist = die gestrige
    await db.insert(testSaldo).values({
      nutzerId,
      offeneVerpflichtungAnzahl: 2,
      naechsteVerpflichtungFrist: new Date(Date.now() - 24 * 60 * 60 * 1000),
    });

    const res = await cronPost(cronRequest(CRON_SECRET));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      verfallen: number;
      t103_versendet: number;
      t104_versendet: number;
    };
    expect(body.verfallen).toBeGreaterThanOrEqual(1);

    // Abgelaufene Verpflichtung jetzt 'verfallen'
    const verpfl = await db
      .select()
      .from(pruefrundenVerpflichtung)
      .where(eq(pruefrundenVerpflichtung.nutzerId, nutzerId));
    expect(verpfl.length).toBe(2);
    const verfallene = verpfl.filter((v) => v.status === 'verfallen');
    const offene = verpfl.filter((v) => v.status === 'offen');
    expect(verfallene.length).toBe(1);
    expect(offene.length).toBe(1);

    // Saldo recomputed: offene_anzahl = 1, naechste_frist = die in 7d
    const saldo = await db
      .select()
      .from(testSaldo)
      .where(eq(testSaldo.nutzerId, nutzerId));
    expect(saldo[0]!.offeneVerpflichtungAnzahl).toBe(1);
    expect(saldo[0]!.naechsteVerpflichtungFrist?.getTime()).toBe(
      offene[0]!.frist.getTime(),
    );
  });

  it('T-103: Verpflichtung mit frist=now+3d → Mail versendet + audit_log + zweiter Lauf kein Doppel-Versand', async () => {
    const { pruefrundeId } = await setupBaseWerkUndPruefrunde();
    const nutzerId = await seedNutzer(EMAILS.drei);

    const fristIn3d = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    await db.insert(pruefrundenVerpflichtung).values({
      nutzerId,
      ausPruefrundeId: pruefrundeId,
      frist: fristIn3d,
      status: 'offen',
    });

    // Erster Lauf → T-103 raus
    const r1 = await cronPost(cronRequest(CRON_SECRET));
    expect(r1.status).toBe(200);
    const body1 = (await r1.json()) as { t103_versendet: number };
    expect(body1.t103_versendet).toBe(1);

    // Email-Log enthaelt einen T-103-Eintrag fuer diesen Nutzer
    const mails = await db
      .select()
      .from(emailBenachrichtigungLog)
      .where(eq(emailBenachrichtigungLog.email, EMAILS.drei));
    const t103Mails = mails.filter((m) => m.template === 'T-103');
    expect(t103Mails.length).toBe(1);

    // Audit-Log fuer Erinnerung existiert
    const audit = await db
      .select()
      .from(auditLog)
      .where(
        and(
          eq(auditLog.aktion, AUDIT_AKTION_ERINNERUNG_3D),
          eq(auditLog.referenzId, nutzerId),
        ),
      );
    expect(audit.length).toBe(1);

    // Zweiter Lauf — dedup-Pruefung greift, keine zweite Mail
    const r2 = await cronPost(cronRequest(CRON_SECRET));
    expect(r2.status).toBe(200);
    const body2 = (await r2.json()) as { t103_versendet: number };
    expect(body2.t103_versendet).toBe(0);

    const mails2 = await db
      .select()
      .from(emailBenachrichtigungLog)
      .where(eq(emailBenachrichtigungLog.email, EMAILS.drei));
    expect(mails2.filter((m) => m.template === 'T-103').length).toBe(1);
  });

  it('T-104: Verpflichtung mit frist=now+1d → Mail versendet', async () => {
    const { pruefrundeId } = await setupBaseWerkUndPruefrunde();
    const nutzerId = await seedNutzer(EMAILS.eins);

    const fristIn1d = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000);
    await db.insert(pruefrundenVerpflichtung).values({
      nutzerId,
      ausPruefrundeId: pruefrundeId,
      frist: fristIn1d,
      status: 'offen',
    });

    const res = await cronPost(cronRequest(CRON_SECRET));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { t104_versendet: number };
    expect(body.t104_versendet).toBe(1);

    const audit = await db
      .select()
      .from(auditLog)
      .where(
        and(
          eq(auditLog.aktion, AUDIT_AKTION_ERINNERUNG_1D),
          eq(auditLog.referenzId, nutzerId),
        ),
      );
    expect(audit.length).toBe(1);
  });

  it('Audit-Log fuer den Cron-Lauf selbst existiert', async () => {
    await cronPost(cronRequest(CRON_SECRET));
    const audit = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.aktion, AUDIT_AKTION_CRON_LAUF));
    expect(audit.length).toBeGreaterThanOrEqual(1);
  });

  // sanity-anchor
  it('imports geprueft', () => {
    void inArray;
    expect(typeof cronPost).toBe('function');
  });
});
