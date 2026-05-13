/**
 * POST /api/v1/pruefrunden/:id/veroeffentlichen
 *
 * Statusuebergang `entwurf` → `oeffentlich` (PRD §14.2).
 *
 * - Auth + Inhaber:innen-Check.
 * - Status muss 'entwurf' sein.
 * - Reziprozitaets-Check via `kannPruefrundeStarten` (PRD §17):
 *   - Bei abgelaufener offener Verpflichtung: 422 mit deutscher Fehler-Message.
 *   - Sonst: ggf. neue Verpflichtung erzeugt, Pruefrunde-Status hochgesetzt.
 * - Audit-Log + Antwort enthaelt `reziprozitaet: { modus, frist?, verpflichtungs_id? }`.
 */

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  auditLog,
  nutzer,
  pruefrunde,
  werk,
} from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';
import { rejectIfBadOrigin } from '@/lib/auth/csrf';
import { kannPruefrundeStarten } from '@/lib/reziprozitaet/engine';
import { serializePruefrunde } from '@/lib/pruefrunde/serialize';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: Request, ctx: RouteContext): Promise<Response> {
  const originResp = rejectIfBadOrigin(req);
  if (originResp) return originResp;

  const sess = await getSessionFromRequest(req);
  if (!sess) {
    return Response.json({ fehler: 'unauthenticated' }, { status: 401 });
  }

  const { id } = await ctx.params;

  const rows = await db
    .select({ pruefrunde, werkNutzerId: werk.nutzerId })
    .from(pruefrunde)
    .innerJoin(werk, eq(werk.id, pruefrunde.werkId))
    .innerJoin(nutzer, eq(nutzer.id, werk.nutzerId))
    .where(eq(pruefrunde.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) {
    return Response.json({ fehler: 'nicht_gefunden' }, { status: 404 });
  }
  if (row.werkNutzerId !== sess.nutzerId) {
    return Response.json(
      {
        error: {
          code: 'kein_zugriff',
          message: 'Du kannst nur eigene Pruefrunden veroeffentlichen.',
        },
      },
      { status: 403 },
    );
  }
  if (row.pruefrunde.status !== 'entwurf') {
    return Response.json(
      {
        error: {
          code: 'falscher_status',
          message:
            'Nur Entwuerfe koennen veroeffentlicht werden. Diese Pruefrunde ist bereits in einem spaeteren Status.',
        },
      },
      { status: 422 },
    );
  }

  // Reziprozitaets-Check (Engine handhabt Verpflichtungs-Anlage selbst).
  const check = await kannPruefrundeStarten(
    sess.nutzerId,
    row.pruefrunde.frist,
    row.pruefrunde.id,
  );

  if (check.ok === false) {
    return Response.json(
      {
        error: {
          code: 'reziprozitaet_blockiert',
          grund: check.grund,
          offene_anzahl: check.offene_anzahl,
        },
        deutsche_message:
          'Du hast eine abgelaufene Reziprozitaets-Verpflichtung. Bitte gib zuerst Feedback zu offenen Pruefrunden anderer Werke, bevor du eine neue veroeffentlichst.',
      },
      { status: 422 },
    );
  }

  // Status hochsetzen.
  const updated = await db
    .update(pruefrunde)
    .set({ status: 'oeffentlich', aktualisiertAm: new Date() })
    .where(eq(pruefrunde.id, row.pruefrunde.id))
    .returning();
  const updatedRow = updated[0];
  if (!updatedRow) {
    return Response.json({ fehler: 'unbekannt' }, { status: 500 });
  }

  try {
    await db.insert(auditLog).values({
      nutzerId: sess.nutzerId,
      aktion: 'pruefrunde.veroeffentlicht',
      referenzTyp: 'pruefrunde',
      referenzId: updatedRow.id,
      metadaten:
        check.modus === 'neue_verpflichtung'
          ? {
              reziprozitaet_modus: 'neue_verpflichtung',
              verpflichtungs_id: check.verpflichtungs_id,
            }
          : { reziprozitaet_modus: 'saldo_erfuellt' },
    });
  } catch {
    // Audit-Failure darf den Erfolg nicht blockieren.
  }

  const reziprozitaet =
    check.modus === 'neue_verpflichtung'
      ? {
          modus: 'neue_verpflichtung' as const,
          frist: check.frist,
          verpflichtungs_id: check.verpflichtungs_id,
        }
      : {
          modus: 'saldo_erfuellt' as const,
          tests_gegeben: check.tests_gegeben,
        };

  return Response.json({
    pruefrunde: serializePruefrunde(updatedRow),
    reziprozitaet,
  });
}
