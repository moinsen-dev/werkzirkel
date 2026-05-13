/**
 * POST + DELETE /api/v1/pruefrunden/:id/anmeldung
 *
 * Tester:innen-Anmeldung mit Slot-System (PRD §F-203, §8.4, §15.4).
 *
 * - POST: Anmeldung als Tester:in.
 *     * Auth + Rolle 'macher'.
 *     * Pruefrunde muss status='oeffentlich' sein.
 *     * Tester:in darf nicht Werk-Inhaber:in sein.
 *     * Race-safer Slot-Check via Transaktion mit FOR UPDATE auf pruefrunde.
 *     * UNIQUE(pruefrunde_id, tester_id) verhindert Doppel-Anmeldung.
 *     * Sendet T-101 an Werk-Inhaber:in. Audit-Log-Eintrag.
 * - DELETE: Eigene Anmeldung zuruecknehmen.
 *     * Auth.
 *     * Nur in status='angemeldet' moeglich. status='feedback_gegeben' ist
 *       endgueltig (keine Rollbacks nach Feedback-Abgabe).
 */

import { and, eq, sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { db } from '@/lib/db';
import {
  auditLog,
  nutzer,
  pruefrunde,
  pruefrundenAnmeldung,
  werk,
} from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';
import { rejectIfBadOrigin } from '@/lib/auth/csrf';
import { sendMail } from '@/lib/email/send';
import { env } from '@/lib/env';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const APP_URL = env.APP_URL.replace(/\/+$/, '');

export async function POST(req: Request, ctx: RouteContext): Promise<Response> {
  const originResp = rejectIfBadOrigin(req);
  if (originResp) return originResp;

  const sess = await getSessionFromRequest(req);
  if (!sess) {
    return Response.json({ fehler: 'unauthenticated' }, { status: 401 });
  }

  if (!sess.nutzer.rollen.includes('macher')) {
    return Response.json(
      {
        error: {
          code: 'rolle_fehlt',
          message:
            'Nur Macher:innen koennen sich als Tester:in fuer Pruefrunden anmelden.',
        },
      },
      { status: 403 },
    );
  }

  const { id } = await ctx.params;

  // Race-safer Slot-Check in einer Transaktion:
  //  - Lock pruefrunde-Row mit FOR UPDATE.
  //  - Status + Inhaber-Check.
  //  - COUNT der aktiven Anmeldungen.
  //  - INSERT mit ON CONFLICT DO NOTHING (UNIQUE-Constraint deckt Doppel-Anmeldung).
  type TxOutcome =
    | { kind: 'not_found' }
    | { kind: 'falscher_status' }
    | { kind: 'eigenes_werk' }
    | { kind: 'pruefrunde_voll' }
    | { kind: 'bereits_angemeldet' }
    | {
        kind: 'ok';
        anmeldungId: string;
        anzahlAngemeldet: number;
        gesuchteTester: number;
        pruefrundeTitel: string;
        werkName: string;
        werkInhaberId: string;
        werkInhaberEmail: string;
      };

  const outcome = await db.transaction(async (tx): Promise<TxOutcome> => {
    // Pruefrunde + Werk + Inhaber zusammen laden + Pruefrunde-Row sperren.
    // postgres-js + Drizzle: `for update` direkt im select() unterstuetzt;
    // wir nehmen raw SQL um den JOIN ohne Lock auf werk/nutzer zu machen.
    const rows = await tx.execute<{
      pruefrunde_id: string;
      pruefrunde_status: string;
      gesuchte_tester: number;
      pruefrunde_titel: string;
      werk_id: string;
      werk_name: string;
      werk_nutzer_id: string;
      inhaber_email: string;
    }>(sql`
      SELECT pr.id          AS pruefrunde_id,
             pr.status      AS pruefrunde_status,
             pr.gesuchte_tester,
             pr.titel       AS pruefrunde_titel,
             w.id           AS werk_id,
             w.name         AS werk_name,
             w.nutzer_id    AS werk_nutzer_id,
             n.email        AS inhaber_email
        FROM pruefrunde pr
        JOIN werk w   ON w.id   = pr.werk_id
        JOIN nutzer n ON n.id   = w.nutzer_id
       WHERE pr.id = ${id}
       FOR UPDATE OF pr
    `);
    const row = rows[0];
    if (!row) {
      return { kind: 'not_found' };
    }

    if (row.pruefrunde_status !== 'oeffentlich') {
      return { kind: 'falscher_status' };
    }
    if (row.werk_nutzer_id === sess.nutzerId) {
      return { kind: 'eigenes_werk' };
    }

    // Aktive Slots zaehlen.
    const countRows = await tx.execute<{ anzahl: number }>(sql`
      SELECT COUNT(*)::int AS anzahl
        FROM pruefrunden_anmeldung
       WHERE pruefrunde_id = ${id}
         AND status IN ('angemeldet', 'feedback_gegeben')
    `);
    const aktive = countRows[0]?.anzahl ?? 0;
    if (aktive >= row.gesuchte_tester) {
      return { kind: 'pruefrunde_voll' };
    }

    // INSERT mit ON CONFLICT DO NOTHING — UNIQUE(pruefrunde_id, tester_id).
    // ID wird app-seitig generiert (cuid2), genauso wie idCol() es im
    // Drizzle-Pfad tut — Raw-SQL umgeht das $defaultFn-Hook.
    const newId = createId();
    const inserted = await tx.execute<{ id: string }>(sql`
      INSERT INTO pruefrunden_anmeldung (id, pruefrunde_id, tester_id, status)
      VALUES (${newId}, ${id}, ${sess.nutzerId}, 'angemeldet')
      ON CONFLICT (pruefrunde_id, tester_id) DO NOTHING
      RETURNING id
    `);
    const newRow = inserted[0];
    if (!newRow) {
      return { kind: 'bereits_angemeldet' };
    }

    return {
      kind: 'ok',
      anmeldungId: newRow.id,
      anzahlAngemeldet: aktive + 1,
      gesuchteTester: row.gesuchte_tester,
      pruefrundeTitel: row.pruefrunde_titel,
      werkName: row.werk_name,
      werkInhaberId: row.werk_nutzer_id,
      werkInhaberEmail: row.inhaber_email,
    };
  });

  if (outcome.kind === 'not_found') {
    return Response.json({ fehler: 'nicht_gefunden' }, { status: 404 });
  }
  if (outcome.kind === 'falscher_status') {
    return Response.json(
      {
        error: {
          code: 'falscher_status',
          message:
            'Anmeldungen sind nur fuer veroeffentlichte Pruefrunden moeglich.',
        },
      },
      { status: 422 },
    );
  }
  if (outcome.kind === 'eigenes_werk') {
    return Response.json(
      {
        error: {
          code: 'eigenes_werk',
          message:
            'Du kannst dich nicht fuer eine Pruefrunde deines eigenen Werks als Tester:in anmelden.',
        },
      },
      { status: 422 },
    );
  }
  if (outcome.kind === 'pruefrunde_voll') {
    return Response.json(
      {
        error: {
          code: 'pruefrunde_voll',
          message: 'Die Pruefrunde hat keine freien Tester:innen-Plaetze mehr.',
        },
      },
      { status: 422 },
    );
  }
  if (outcome.kind === 'bereits_angemeldet') {
    return Response.json(
      {
        error: {
          code: 'bereits_angemeldet',
          message: 'Du bist bereits fuer diese Pruefrunde angemeldet.',
        },
      },
      { status: 422 },
    );
  }

  // T-101 an Werk-Inhaber:in senden (ausserhalb der Transaktion).
  try {
    await sendMail({
      to: outcome.werkInhaberEmail,
      nutzerId: outcome.werkInhaberId,
      template: 'T-101',
      props: {
        werkName: outcome.werkName,
        pruefrundeTitel: outcome.pruefrundeTitel,
        testerAnzeigename: sess.nutzer.anzeigename,
        pruefrundeUrl: `${APP_URL}/pruefrunden/${id}`,
        anzahlAngemeldet: outcome.anzahlAngemeldet,
        gesuchteTester: outcome.gesuchteTester,
      },
    });
  } catch (err) {
    // Mail-Failure darf die Anmeldung nicht blockieren — der Tester:in-Slot
    // ist schon gebucht, die Inhaber:in wird die Anmeldung in der UI sehen.
    console.error('[pruefrunde-anmeldung] sendMail T-101 failed:', err);
  }

  try {
    await db.insert(auditLog).values({
      nutzerId: sess.nutzerId,
      aktion: 'pruefrunde.angemeldet',
      referenzTyp: 'pruefrunde',
      referenzId: id,
      metadaten: { anmeldungs_id: outcome.anmeldungId },
    });
  } catch {
    // Audit-Failure darf den Erfolg nicht blockieren.
  }

  return Response.json(
    {
      anmeldung: {
        id: outcome.anmeldungId,
        pruefrunde_id: id,
        tester_id: sess.nutzerId,
        status: 'angemeldet' as const,
      },
      counts: {
        angemeldet: outcome.anzahlAngemeldet,
        gesuchte_tester: outcome.gesuchteTester,
      },
    },
    { status: 201 },
  );
}

export async function DELETE(req: Request, ctx: RouteContext): Promise<Response> {
  const originResp = rejectIfBadOrigin(req);
  if (originResp) return originResp;

  const sess = await getSessionFromRequest(req);
  if (!sess) {
    return Response.json({ fehler: 'unauthenticated' }, { status: 401 });
  }

  const { id } = await ctx.params;

  // Eigene Anmeldung suchen.
  const rows = await db
    .select()
    .from(pruefrundenAnmeldung)
    .where(
      and(
        eq(pruefrundenAnmeldung.pruefrundeId, id),
        eq(pruefrundenAnmeldung.testerId, sess.nutzerId),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) {
    return Response.json({ fehler: 'nicht_gefunden' }, { status: 404 });
  }

  if (row.status === 'feedback_gegeben') {
    return Response.json(
      {
        error: {
          code: 'feedback_bereits_gegeben',
          message:
            'Nach Abgabe des Feedbacks kannst du die Anmeldung nicht mehr zuruecknehmen.',
        },
      },
      { status: 422 },
    );
  }

  if (row.status !== 'angemeldet') {
    return Response.json(
      {
        error: {
          code: 'falscher_status',
          message: 'Diese Anmeldung kann nicht zurueckgenommen werden.',
        },
      },
      { status: 422 },
    );
  }

  await db
    .delete(pruefrundenAnmeldung)
    .where(eq(pruefrundenAnmeldung.id, row.id));

  try {
    await db.insert(auditLog).values({
      nutzerId: sess.nutzerId,
      aktion: 'pruefrunde.anmeldung_zurueckgenommen',
      referenzTyp: 'pruefrunde',
      referenzId: id,
      metadaten: { anmeldungs_id: row.id },
    });
  } catch {
    // Audit-Failure darf den Erfolg nicht blockieren.
  }

  // Anker, damit pruefrunde/werk/nutzer-Imports nicht als ungenutzt gelten,
  // falls die DELETE-Pfade in Zukunft auch JOINs brauchen.
  void pruefrunde;
  void werk;
  void nutzer;

  return new Response(null, { status: 204 });
}
