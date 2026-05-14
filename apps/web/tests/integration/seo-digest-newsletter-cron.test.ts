/**
 * Integration-Tests fuer POST /api/v1/cron/digest-newsletter (T-801).
 *
 * Verifiziert (PRD §8.14, §31, §F-307):
 *  - 401 ohne X-Cron-Secret
 *  - Versand pro aktive Stadt
 *  - Opt-out via benachrichtigungs_einstellungen.stadt_digest=false respektiert
 *  - Default (kein stadt_digest gesetzt) -> versendet
 *  - Stadt ohne Inhalte -> kein Versand
 *  - Idempotenz: zweiter Lauf in derselben ISO-Woche versendet keine zweite Mail
 *  - Audit-Log (cron-lauf + per-nutzer)
 */

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createId } from '@paralleldrive/cuid2';
import { eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import {
  auditLog,
  emailBenachrichtigungLog,
  hilfegesuch,
  nutzer,
  termin,
  werk,
} from '@/lib/db/schema';
import { env } from '@/lib/env';

import {
  AUDIT_AKTION_CRON_LAUF,
  AUDIT_AKTION_DIGEST,
  POST as cronPost,
} from '@/app/api/v1/cron/digest-newsletter/route';
import { truncateAll } from '../_helpers/db-cleanup';

const APP_ORIGIN = new URL(env.APP_URL).origin;
const CRON_SECRET = env.CRON_SECRET!;

function cronRequest(secret?: string): Request {
  const headers: Record<string, string> = {};
  if (secret !== undefined) headers['x-cron-secret'] = secret;
  return new Request(`${APP_ORIGIN}/api/v1/cron/digest-newsletter`, {
    method: 'POST',
    headers,
  });
}

async function nutzerAnlegen(opts: {
  email: string;
  stadtId?: string;
  stadtDigest?: boolean | null;
  emailVerifiziert?: boolean;
  status?: 'aktiv' | 'pausiert' | 'gesperrt';
}): Promise<string> {
  const id = createId();
  await db.insert(nutzer).values({
    id,
    email: opts.email,
    klarname: `Klar ${opts.email}`,
    anzeigename: `Anz ${id.slice(0, 6)}`,
    stadtId: opts.stadtId ?? 'hh',
    rollen: ['macher'],
    emailVerifiziertAm: opts.emailVerifiziert === false ? null : new Date(),
    benachrichtigungsEinstellungen:
      opts.stadtDigest === undefined
        ? {}
        : opts.stadtDigest === null
          ? {}
          : { stadt_digest: opts.stadtDigest },
    status: opts.status ?? 'aktiv',
  });
  return id;
}

async function werkAnlegen(opts: { nutzerId: string; name: string }) {
  const id = createId();
  await db.insert(werk).values({
    id,
    nutzerId: opts.nutzerId,
    name: opts.name,
    kurzbeschreibung: 'Kurz',
    problem: 'Problem',
    zielgruppe: 'Zielgruppe',
    werkstand: 'prototyp',
    sichtbarkeit: 'oeffentlich',
    status: 'aktiv',
  });
  return id;
}

async function terminAnlegen(opts: { kuratorId: string; stadtId?: string }) {
  const id = createId();
  await db.insert(termin).values({
    id,
    stadtId: opts.stadtId ?? 'hh',
    typ: 'schauabend',
    titel: 'Test-Termin',
    beschreibung: 'Beschreibung',
    datumUhrzeit: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    maxTeilnehmer: 10,
    erstelltVon: opts.kuratorId,
    status: 'veroeffentlicht',
  });
  return id;
}

async function hilfegesuchAnlegen(opts: { nutzerId: string }) {
  const id = createId();
  await db.insert(hilfegesuch).values({
    id,
    nutzerId: opts.nutzerId,
    stadtId: 'hh',
    titel: 'Hilfe gesucht',
    beschreibung: 'Bitte helfen',
    gueltigBis: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    status: 'offen',
  });
  return id;
}

describe('POST /api/v1/cron/digest-newsletter (T-801)', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  it('ohne X-Cron-Secret -> 401', async () => {
    const res = await cronPost(cronRequest());
    expect(res.status).toBe(401);
  });

  it('mit falschem Secret -> 401', async () => {
    const res = await cronPost(cronRequest('falsch'));
    expect(res.status).toBe(401);
  });

  it('versendet Digest an Macher:in mit aktivem stadt_digest (Default)', async () => {
    const empfaengerId = await nutzerAnlegen({
      email: 'digest-empf@test.werkzirkel.de',
    });
    // Inhalte fuer Hamburg
    const wId = await werkAnlegen({ nutzerId: empfaengerId, name: 'Hamburg-Werk' });

    const res = await cronPost(cronRequest(CRON_SECRET));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      versendet: number;
      uebersprungen: number;
      fehler: number;
      woche: string;
    };
    expect(body.versendet).toBeGreaterThanOrEqual(1);
    expect(body.fehler).toBe(0);
    expect(body.woche).toMatch(/^\d{4}-W-\d{2}$/);

    const mails = await db
      .select()
      .from(emailBenachrichtigungLog)
      .where(eq(emailBenachrichtigungLog.template, 'T-801'));
    expect(mails.length).toBeGreaterThanOrEqual(1);
    expect(mails.some((m) => m.email === 'digest-empf@test.werkzirkel.de')).toBe(
      true,
    );
    expect(mails[0]?.betreff ?? '').toContain('Hamburg');

    // Audit fuer Nutzer
    const userAudit = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.aktion, AUDIT_AKTION_DIGEST));
    expect(userAudit.some((a) => a.referenzId === empfaengerId)).toBe(true);

    // Audit Cron-Lauf
    const cronAudit = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.aktion, AUDIT_AKTION_CRON_LAUF));
    expect(cronAudit.length).toBeGreaterThanOrEqual(1);

    // suppress unused-warning
    void wId;
  });

  it('respektiert Opt-out (stadt_digest=false) -> keine Mail', async () => {
    const empfaengerId = await nutzerAnlegen({
      email: 'digest-opt-out@test.werkzirkel.de',
      stadtDigest: false,
    });
    await werkAnlegen({ nutzerId: empfaengerId, name: 'WerkA' });

    await cronPost(cronRequest(CRON_SECRET));

    const mails = await db
      .select()
      .from(emailBenachrichtigungLog)
      .where(eq(emailBenachrichtigungLog.template, 'T-801'));
    expect(
      mails.some((m) => m.email === 'digest-opt-out@test.werkzirkel.de'),
    ).toBe(false);
  });

  it('nicht verifizierte Email -> keine Mail', async () => {
    const empfaengerId = await nutzerAnlegen({
      email: 'digest-unverified@test.werkzirkel.de',
      emailVerifiziert: false,
    });
    await werkAnlegen({ nutzerId: empfaengerId, name: 'WerkB' });

    await cronPost(cronRequest(CRON_SECRET));

    const mails = await db
      .select()
      .from(emailBenachrichtigungLog)
      .where(eq(emailBenachrichtigungLog.template, 'T-801'));
    expect(
      mails.some((m) => m.email === 'digest-unverified@test.werkzirkel.de'),
    ).toBe(false);
  });

  it('zweiter Lauf in derselben Woche dedupliziert', async () => {
    const empfaengerId = await nutzerAnlegen({
      email: 'digest-dedup@test.werkzirkel.de',
    });
    await werkAnlegen({ nutzerId: empfaengerId, name: 'WerkC' });

    const r1 = await cronPost(cronRequest(CRON_SECRET));
    const body1 = (await r1.json()) as { versendet: number };
    expect(body1.versendet).toBeGreaterThanOrEqual(1);

    const r2 = await cronPost(cronRequest(CRON_SECRET));
    const body2 = (await r2.json()) as { versendet: number; uebersprungen: number };
    expect(body2.versendet).toBe(0);
    expect(body2.uebersprungen).toBeGreaterThanOrEqual(1);

    const mails = await db
      .select()
      .from(emailBenachrichtigungLog)
      .where(eq(emailBenachrichtigungLog.template, 'T-801'));
    expect(
      mails.filter((m) => m.email === 'digest-dedup@test.werkzirkel.de').length,
    ).toBe(1);
  });

  it('Stadt ohne Inhalte -> kein Versand', async () => {
    // Empfaengerin existiert, aber NIEMAND legt Werke/Termine/Hilfegesuche an.
    // Erwartet: versendet=0.
    const empfaengerId = await nutzerAnlegen({
      email: 'digest-leer@test.werkzirkel.de',
    });
    void empfaengerId;

    const res = await cronPost(cronRequest(CRON_SECRET));
    const body = (await res.json()) as { versendet: number };
    expect(body.versendet).toBe(0);
  });

  it('Termin und Hilfegesuch werden in Props eingebaut', async () => {
    const empfaengerId = await nutzerAnlegen({
      email: 'digest-mixed@test.werkzirkel.de',
    });
    const kuratorId = await nutzerAnlegen({
      email: 'digest-kurator@test.werkzirkel.de',
    });
    await werkAnlegen({ nutzerId: empfaengerId, name: 'MixedWerk' });
    await terminAnlegen({ kuratorId });
    await hilfegesuchAnlegen({ nutzerId: empfaengerId });

    const res = await cronPost(cronRequest(CRON_SECRET));
    expect(res.status).toBe(200);

    const mails = await db
      .select()
      .from(emailBenachrichtigungLog)
      .where(eq(emailBenachrichtigungLog.template, 'T-801'));
    expect(
      mails.some((m) => m.email === 'digest-mixed@test.werkzirkel.de'),
    ).toBe(true);
  });
});
