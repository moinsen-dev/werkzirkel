/**
 * Integration-Tests fuer den Cron-Endpunkt
 *   POST /api/v1/cron/konto-loeschung-frist-abgelaufen
 *
 * Verifiziert (PRD §34, §15.15):
 *  - 401 ohne X-Cron-Secret
 *  - 200 + processed=1 mit faelliger Loeschung
 *  - Nutzer-Row geloescht, Feedback pseudonymisiert (tester_id=NULL),
 *    audit_log-Eintrag aktion='konto.geloescht' existiert.
 *  - Idempotenz: zweite Ausfuehrung → processed=0.
 *  - T-004-Erinnerung wird nur einmal verschickt (audit_log-basierte Idempotenz).
 */

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createId } from '@paralleldrive/cuid2';
import { and, eq, inArray } from 'drizzle-orm';

import { db } from '@/lib/db';
import {
  auditLog,
  emailBenachrichtigungLog,
  feedback,
  magicLinkToken,
  nutzer,
  pruefrunde,
  session as sessionTable,
  werk,
} from '@/lib/db/schema';
import { env } from '@/lib/env';

import { POST as cronPost } from '@/app/api/v1/cron/konto-loeschung-frist-abgelaufen/route';

const APP_ORIGIN = new URL(env.APP_URL).origin;
const CRON_SECRET = env.CRON_SECRET!;
const TEST_EMAIL = 'cron-konto-loeschung@test.werkzirkel.de';
const TEST_EMAIL_REM = 'cron-konto-erinnerung@test.werkzirkel.de';
const TESTER_EMAIL = 'cron-konto-tester@test.werkzirkel.de';
const WERKINHABER_EMAIL = 'cron-konto-werkinhaber@test.werkzirkel.de';
const ALL_EMAILS = [TEST_EMAIL, TEST_EMAIL_REM, TESTER_EMAIL, WERKINHABER_EMAIL];

async function cleanup(): Promise<void> {
  const ids = (
    await db.select({ id: nutzer.id }).from(nutzer).where(inArray(nutzer.email, ALL_EMAILS))
  ).map((n) => n.id);
  if (ids.length) {
    await db.delete(sessionTable).where(inArray(sessionTable.nutzerId, ids));
    await db
      .delete(emailBenachrichtigungLog)
      .where(inArray(emailBenachrichtigungLog.nutzerId, ids));
    await db.delete(auditLog).where(inArray(auditLog.referenzId, ids));
    await db.delete(nutzer).where(inArray(nutzer.id, ids));
  }
  await db.delete(magicLinkToken).where(inArray(magicLinkToken.email, ALL_EMAILS));
  // Cron-Run-Audit-Log auch saeubern.
  await db
    .delete(auditLog)
    .where(
      inArray(auditLog.aktion, [
        'cron.konto-loeschung-frist-abgelaufen',
        'konto.geloescht',
        'konto.loeschung-erinnerung',
      ]),
    );
}

function cronRequest(opts: { secret?: string } = {}): Request {
  const headers: Record<string, string> = {};
  if (opts.secret !== undefined) headers['x-cron-secret'] = opts.secret;
  return new Request(
    `${APP_ORIGIN}/api/v1/cron/konto-loeschung-frist-abgelaufen`,
    { method: 'POST', headers },
  );
}

async function createFaelligenNutzer(): Promise<string> {
  const id = createId();
  await db.insert(nutzer).values({
    id,
    email: TEST_EMAIL,
    klarname: 'Konto Loeschung',
    anzeigename: 'cron-test',
    stadtId: 'hh',
    rollen: ['macher'],
    emailVerifiziertAm: new Date(),
    status: 'loeschung_anstehend',
    loeschungAnstehendBis: new Date(Date.now() - 60 * 60 * 1000), // 1h ueberfaellig
  });
  return id;
}

describe('POST /api/v1/cron/konto-loeschung-frist-abgelaufen', () => {
  beforeEach(cleanup);
  afterAll(cleanup);

  it('ohne X-Cron-Secret → 401', async () => {
    const res = await cronPost(cronRequest());
    expect(res.status).toBe(401);
  });

  it('mit falschem Secret → 401', async () => {
    const res = await cronPost(cronRequest({ secret: 'totally-wrong' }));
    expect(res.status).toBe(401);
  });

  it('faelliger Nutzer → processed=1, Hard-Delete + Feedback pseudonymisiert + audit', async () => {
    // Setup: ueberfaellige Nutzer:in + ein Werk mit Pruefrunde + Feedback
    // einer anderen Tester:in (deren testerId zeigt auf zu loeschende Person
    // ... nein, andersrum: zu loeschende Person hat selbst Feedback abgegeben.
    // Wir bauen: Werkinhaber + Werk + Pruefrunde, dann Tester (= zu loeschen)
    // gibt Feedback. Nach Loeschung muss tester_id NULL sein, Werk + Feedback
    // bleiben.
    const werkinhaberId = createId();
    await db.insert(nutzer).values({
      id: werkinhaberId,
      email: WERKINHABER_EMAIL,
      klarname: 'Werk Inhaber',
      anzeigename: 'werkinhaber',
      stadtId: 'hh',
      rollen: ['macher'],
      emailVerifiziertAm: new Date(),
    });
    const werkId = createId();
    await db.insert(werk).values({
      id: werkId,
      nutzerId: werkinhaberId,
      name: 'Test-Werk',
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

    const testerId = await createFaelligenNutzer();
    const feedbackId = createId();
    await db.insert(feedback).values({
      id: feedbackId,
      pruefrundeId,
      testerId,
      gesamteindruck: 'super',
    });

    // Cron triggern
    const res = await cronPost(cronRequest({ secret: CRON_SECRET }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { processed: number };
    expect(body.processed).toBe(1);

    // Nutzer geloescht
    const remaining = await db.select().from(nutzer).where(eq(nutzer.id, testerId));
    expect(remaining.length).toBe(0);

    // Feedback bleibt, tester_id ist NULL
    const fb = await db.select().from(feedback).where(eq(feedback.id, feedbackId));
    expect(fb.length).toBe(1);
    expect(fb[0]!.testerId).toBeNull();
    expect(fb[0]!.gesamteindruck).toBe('super');

    // Audit-Log konto.geloescht existiert
    const audit = await db
      .select()
      .from(auditLog)
      .where(
        and(eq(auditLog.aktion, 'konto.geloescht'), eq(auditLog.referenzId, testerId)),
      );
    expect(audit.length).toBe(1);
  });

  it('Idempotenz: zweiter Aufruf → processed=0', async () => {
    await createFaelligenNutzer();
    const first = await cronPost(cronRequest({ secret: CRON_SECRET }));
    expect(first.status).toBe(200);
    expect(((await first.json()) as { processed: number }).processed).toBe(1);

    const second = await cronPost(cronRequest({ secret: CRON_SECRET }));
    expect(second.status).toBe(200);
    expect(((await second.json()) as { processed: number }).processed).toBe(0);
  });

  it('T-004-Erinnerung: in Fenster (now+2d) wird einmal verschickt, beim zweiten Aufruf nicht erneut', async () => {
    const id = createId();
    const fristIn2Tagen = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    await db.insert(nutzer).values({
      id,
      email: TEST_EMAIL_REM,
      klarname: 'Erinnerung Empfaenger',
      anzeigename: 'cron-erin',
      stadtId: 'hh',
      rollen: ['macher'],
      emailVerifiziertAm: new Date(),
      status: 'loeschung_anstehend',
      loeschungAnstehendBis: fristIn2Tagen,
    });

    const first = await cronPost(cronRequest({ secret: CRON_SECRET }));
    expect(first.status).toBe(200);
    const firstBody = (await first.json()) as { erinnerungen: number };
    expect(firstBody.erinnerungen).toBe(1);

    // Audit-Log konto.loeschung-erinnerung existiert
    const audit1 = await db
      .select()
      .from(auditLog)
      .where(
        and(
          eq(auditLog.aktion, 'konto.loeschung-erinnerung'),
          eq(auditLog.referenzId, id),
        ),
      );
    expect(audit1.length).toBe(1);

    // Zweiter Aufruf → keine Erinnerung mehr (idempotent ueber audit_log)
    const second = await cronPost(cronRequest({ secret: CRON_SECRET }));
    expect(second.status).toBe(200);
    const secondBody = (await second.json()) as { erinnerungen: number };
    expect(secondBody.erinnerungen).toBe(0);

    // Audit-Log immer noch nur ein Eintrag
    const audit2 = await db
      .select()
      .from(auditLog)
      .where(
        and(
          eq(auditLog.aktion, 'konto.loeschung-erinnerung'),
          eq(auditLog.referenzId, id),
        ),
      );
    expect(audit2.length).toBe(1);
  });
});
