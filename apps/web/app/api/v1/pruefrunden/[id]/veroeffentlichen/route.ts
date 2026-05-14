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
import {
  findeOffenePruefrundenAnderer,
  kannPruefrundeStarten,
} from '@/lib/reziprozitaet/engine';
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

  // Body optional — wenn der Client `verpflichtung_akzeptiert: true` sendet,
  // hat die Nutzer:in die 14-Tage-Verpflichtung in der UI bewusst gewaehlt.
  // Ohne diesen Flag blockt die Engine bei Saldo<2 mit `saldo_zu_niedrig`.
  let verpflichtungAkzeptiert = false;
  try {
    const raw = await req.text();
    if (raw && raw.trim().length > 0) {
      const parsed = JSON.parse(raw) as { verpflichtung_akzeptiert?: unknown };
      verpflichtungAkzeptiert = parsed.verpflichtung_akzeptiert === true;
    }
  } catch {
    // ignorieren — ohne Body bleibt verpflichtungAkzeptiert=false.
  }

  // Reziprozitaets-Check.
  const check = await kannPruefrundeStarten(
    sess.nutzerId,
    row.pruefrunde.frist,
    row.pruefrunde.id,
    undefined,
    { verpflichtung_akzeptiert: verpflichtungAkzeptiert },
  );

  if (check.ok === false) {
    if (check.grund === 'frist_abgelaufen') {
      return Response.json(
        {
          error: {
            code: 'reziprozitaet_blockiert',
            grund: 'frist_abgelaufen',
            offene_anzahl: check.offene_anzahl,
          },
          deutsche_message:
            'Du hast eine abgelaufene Reziprozitaets-Verpflichtung. Bitte gib zuerst Feedback zu offenen Pruefrunden anderer Werke, bevor du eine neue veroeffentlichst.',
        },
        { status: 422 },
      );
    }
    // saldo_zu_niedrig: User hat keine Verpflichtung akzeptiert + zu wenig
    // Tests gegeben. Wir liefern die offenen Prüfrunden anderer als
    // Wahl-Hilfe direkt mit, damit das UI sie ohne Round-Trip rendern kann.
    const offeneAndere = await findeOffenePruefrundenAnderer(sess.nutzerId, 2);
    return Response.json(
      {
        error: {
          code: 'saldo_zu_niedrig',
          tests_gegeben: check.tests_gegeben,
        },
        offene_pruefrunden_anderer: offeneAndere.map((p) => ({
          id: p.id,
          titel: p.titel,
          werk_name: p.werkName,
          frist: p.frist,
        })),
        deutsche_message:
          'Du hast noch keine zwei Tests gegeben. Wähle: gib zuerst Feedback zu zwei Prüfrunden anderer Werke, oder bestätige explizit die 14-Tage-Verpflichtung beim Veröffentlichen.',
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
