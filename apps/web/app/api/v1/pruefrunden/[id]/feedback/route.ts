/**
 * POST /api/v1/pruefrunden/:id/feedback
 *
 * Feedback-Abgabe einer Tester:in zu einer Pruefrunde (PRD §F-204, §13.9, §8.4).
 *
 * - Auth + Rolle 'macher'.
 * - Pruefrunde muss status='oeffentlich' sein (geschlossene/abgeschlossene
 *   Runden nehmen keine neuen Feedbacks an).
 * - Tester:in muss eine pruefrunden_anmeldung mit status='angemeldet' haben.
 * - Builder:in darf nicht zur eigenen Pruefrunde feedbacken (defense in
 *   depth — Anmeldung-API blockt das schon).
 * - Transaktion:
 *     * INSERT feedback (UNIQUE(pruefrunde_id, tester_id) faengt Doppel-Feedback
 *       ab → 422 'bereits_feedback_gegeben').
 *     * UPDATE pruefrunden_anmeldung SET status='feedback_gegeben'.
 *     * Reziprozitaets-Engine: feedbackGegeben(tester) + feedbackErhalten(werk_inhaber).
 * - Ausserhalb der Transaktion: T-102 an Builder:in + Audit-Log.
 * - Returns 201.
 */

import { and, eq, sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';

import { db } from '@/lib/db';
import {
  auditLog,
  pruefrunde,
  pruefrundenAnmeldung,
  werk,
} from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';
import { rejectIfBadOrigin } from '@/lib/auth/csrf';
import { sendMail } from '@/lib/email/send';
import { env } from '@/lib/env';
import { feedbackAbgebenSchema } from '@/lib/validators/feedback';
import {
  feedbackErhalten,
  feedbackGegeben,
} from '@/lib/reziprozitaet/engine';

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
            'Nur Builder:innen koennen Feedback zu Pruefrunden abgeben.',
        },
      },
      { status: 403 },
    );
  }

  const { id: pruefrundeId } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ fehler: 'ungueltiger_body' }, { status: 400 });
  }

  const parsed = feedbackAbgebenSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { fehler: 'validierung', details: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }
  const input = parsed.data;

  // Pruefrunde + Werk + Inhaber laden — Status- und Eigentums-Check.
  const prRows = await db
    .select({
      pruefrundeId: pruefrunde.id,
      pruefrundeStatus: pruefrunde.status,
      pruefrundeTitel: pruefrunde.titel,
      werkId: werk.id,
      werkName: werk.name,
      werkNutzerId: werk.nutzerId,
    })
    .from(pruefrunde)
    .innerJoin(werk, eq(werk.id, pruefrunde.werkId))
    .where(eq(pruefrunde.id, pruefrundeId))
    .limit(1);
  const pr = prRows[0];
  if (!pr) {
    return Response.json({ fehler: 'nicht_gefunden' }, { status: 404 });
  }

  if (pr.pruefrundeStatus !== 'oeffentlich') {
    return Response.json(
      {
        error: {
          code: 'falscher_status',
          message:
            'Feedback ist nur fuer offene Pruefrunden moeglich.',
        },
      },
      { status: 422 },
    );
  }

  if (pr.werkNutzerId === sess.nutzerId) {
    return Response.json(
      {
        error: {
          code: 'eigenes_werk',
          message:
            'Du kannst zu deiner eigenen Pruefrunde kein Feedback abgeben.',
        },
      },
      { status: 422 },
    );
  }

  // Anmeldung muss existieren und Status='angemeldet' sein.
  const anmeldungRows = await db
    .select()
    .from(pruefrundenAnmeldung)
    .where(
      and(
        eq(pruefrundenAnmeldung.pruefrundeId, pruefrundeId),
        eq(pruefrundenAnmeldung.testerId, sess.nutzerId),
      ),
    )
    .limit(1);
  const anmeldung = anmeldungRows[0];
  if (!anmeldung) {
    return Response.json(
      {
        error: {
          code: 'nicht_angemeldet',
          message:
            'Du bist nicht als Tester:in fuer diese Pruefrunde angemeldet.',
        },
      },
      { status: 422 },
    );
  }
  if (anmeldung.status === 'feedback_gegeben') {
    return Response.json(
      {
        error: {
          code: 'bereits_feedback_gegeben',
          message:
            'Du hast zu dieser Pruefrunde bereits Feedback abgegeben.',
        },
      },
      { status: 422 },
    );
  }
  if (anmeldung.status !== 'angemeldet') {
    return Response.json(
      {
        error: {
          code: 'nicht_angemeldet',
          message:
            'Du bist nicht als Tester:in fuer diese Pruefrunde angemeldet.',
        },
      },
      { status: 422 },
    );
  }

  // Transaktion: INSERT feedback + UPDATE anmeldung + Reziprozitaets-Updates.
  type TxOutcome =
    | { kind: 'ok'; feedbackId: string; anzahlFeedbacks: number }
    | { kind: 'duplicate' };

  let outcome: TxOutcome;
  try {
    outcome = await db.transaction(async (tx): Promise<TxOutcome> => {
      const feedbackId = createId();

      // INSERT mit ON CONFLICT DO NOTHING — UNIQUE(pruefrunde_id, tester_id).
      const inserted = await tx.execute<{ id: string }>(sql`
        INSERT INTO feedback (
          id, pruefrunde_id, tester_id,
          erster_eindruck, verstaendlichkeit, nutzen, bedienbarkeit,
          fehler, positionierung, zahlungsbereitschaft, verbesserungen,
          gesamteindruck
        )
        VALUES (
          ${feedbackId}, ${pruefrundeId}, ${sess.nutzerId},
          ${input.erster_eindruck ?? null}, ${input.verstaendlichkeit ?? null},
          ${input.nutzen ?? null}, ${input.bedienbarkeit ?? null},
          ${input.fehler ?? null}, ${input.positionierung ?? null},
          ${input.zahlungsbereitschaft ?? null}, ${input.verbesserungen ?? null},
          ${input.gesamteindruck}
        )
        ON CONFLICT (pruefrunde_id, tester_id) DO NOTHING
        RETURNING id
      `);
      const newRow = inserted[0];
      if (!newRow) {
        return { kind: 'duplicate' };
      }

      // Anmeldung-Status hochsetzen.
      await tx
        .update(pruefrundenAnmeldung)
        .set({ status: 'feedback_gegeben' })
        .where(
          and(
            eq(pruefrundenAnmeldung.pruefrundeId, pruefrundeId),
            eq(pruefrundenAnmeldung.testerId, sess.nutzerId),
          ),
        );

      // Reziprozitaets-Engine — innerhalb derselben Transaktion, damit
      // entweder alle Schritte committen oder gar keine.
      await feedbackGegeben(sess.nutzerId, newRow.id, tx);
      await feedbackErhalten(pr.werkNutzerId, 1, tx);

      // Anzahl Feedbacks fuer T-102-Mail.
      const countRows = await tx.execute<{ anzahl: number }>(sql`
        SELECT COUNT(*)::int AS anzahl
          FROM feedback
         WHERE pruefrunde_id = ${pruefrundeId}
      `);
      const anzahl = countRows[0]?.anzahl ?? 1;

      return {
        kind: 'ok',
        feedbackId: newRow.id,
        anzahlFeedbacks: anzahl,
      };
    });
  } catch (err) {
    // UNIQUE-Violation kann auch durch parallelen INSERT auftreten — ON CONFLICT
    // sollte das aber bereits abfangen. Wir mappen den Fall trotzdem auf 422.
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('feedback_uniq')) {
      return Response.json(
        {
          error: {
            code: 'bereits_feedback_gegeben',
            message:
              'Du hast zu dieser Pruefrunde bereits Feedback abgegeben.',
          },
        },
        { status: 422 },
      );
    }
    throw err;
  }

  if (outcome.kind === 'duplicate') {
    return Response.json(
      {
        error: {
          code: 'bereits_feedback_gegeben',
          message:
            'Du hast zu dieser Pruefrunde bereits Feedback abgegeben.',
        },
      },
      { status: 422 },
    );
  }

  // T-102 an Builder:in — Inhaber-E-Mail nachladen (nicht in Tx noetig).
  try {
    const inhaberRows = await db.execute<{ email: string }>(sql`
      SELECT email FROM nutzer WHERE id = ${pr.werkNutzerId} LIMIT 1
    `);
    const inhaberEmail = inhaberRows[0]?.email;
    if (inhaberEmail) {
      await sendMail({
        to: inhaberEmail,
        nutzerId: pr.werkNutzerId,
        template: 'T-102',
        props: {
          werkName: pr.werkName,
          pruefrundeTitel: pr.pruefrundeTitel,
          pruefrundeUrl: `${APP_URL}/pruefrunden/${pruefrundeId}`,
          anzahlFeedbacks: outcome.anzahlFeedbacks,
        },
      });
    }
  } catch (err) {
    // Mail-Failure darf das Feedback nicht blockieren.
    console.error('[feedback] sendMail T-102 failed:', err);
  }

  try {
    await db.insert(auditLog).values({
      nutzerId: sess.nutzerId,
      aktion: 'pruefrunde.feedback_gegeben',
      referenzTyp: 'feedback',
      referenzId: outcome.feedbackId,
      metadaten: { pruefrunde_id: pruefrundeId },
    });
  } catch {
    // Audit-Failure darf den Erfolg nicht blockieren.
  }

  return Response.json(
    {
      feedback: {
        id: outcome.feedbackId,
        pruefrunde_id: pruefrundeId,
        tester_id: sess.nutzerId,
      },
      anzahl_feedbacks: outcome.anzahlFeedbacks,
    },
    { status: 201 },
  );
}
