/**
 * POST + DELETE /api/v1/termine/:id/anmeldung
 *
 * Teilnehmer:innen-Anmeldung mit Slot- und Warteliste-Logik (PRD §F-402,
 * §F-404).
 *
 * - POST: Anmeldung.
 *     * Auth.
 *     * Termin muss status='veroeffentlicht' sein.
 *     * Termin muss in der Zukunft liegen.
 *     * Race-safer Slot-Check via Transaktion mit FOR UPDATE auf termin.
 *     * Wenn freie Plaetze (count `angemeldet` < max_teilnehmer) → status='angemeldet'.
 *     * Sonst → status='warteliste'.
 *     * UNIQUE(termin_id, nutzer_id): bestehende Storno-Row wird wiederbelebt.
 *     * Sendet T-401 mit slotPosition + iCal-URL.
 *
 * - DELETE: Eigene Anmeldung stornieren.
 *     * Auth.
 *     * Transaktion: SELECT FOR UPDATE auf termin → eigene Row finden →
 *       status='storniert'. Falls vorher 'angemeldet': aelteste Warteliste-
 *       Person nach oben auf 'angemeldet' heben.
 *     * Wenn jemand hochgerueckt wurde: T-401 mit slotPosition='angemeldet'
 *       (Hochrueck-Variante).
 */

import { and, eq, sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { db } from '@/lib/db';
import {
  auditLog,
  nutzer,
  terminAnmeldung,
} from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';
import { rejectIfBadOrigin } from '@/lib/auth/csrf';
import { sendMail } from '@/lib/email/send';
import { env } from '@/lib/env';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const APP_URL = env.APP_URL.replace(/\/+$/, '');

const TERMIN_TYP_LABEL: Record<string, string> = {
  pruefabend: 'Pruefabend',
  schauabend: 'Demo Night',
  bedarfsschau: 'Briefing Night',
  baurunde: 'Build-Runde',
  werkgespraech: 'Werkgespraech',
  kennenlernrunde: 'Kennenlernrunde',
};

function formatDatum(d: Date): string {
  return new Intl.DateTimeFormat('de-DE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Berlin',
  }).format(d);
}

function formatUhrzeit(d: Date): string {
  return new Intl.DateTimeFormat('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Europe/Berlin',
  }).format(d);
}

export async function POST(req: Request, ctx: RouteContext): Promise<Response> {
  const originResp = rejectIfBadOrigin(req);
  if (originResp) return originResp;

  const sess = await getSessionFromRequest(req);
  if (!sess) {
    return Response.json({ fehler: 'unauthenticated' }, { status: 401 });
  }

  const { id } = await ctx.params;

  type TxOutcome =
    | { kind: 'not_found' }
    | { kind: 'falscher_status' }
    | { kind: 'termin_vergangen' }
    | {
        kind: 'ok';
        anmeldungId: string;
        slotStatus: 'angemeldet' | 'warteliste';
        terminTitel: string;
        terminTyp: string;
        datumUhrzeit: Date;
        ortText: string | null;
        onlineLink: string | null;
        nutzerEmail: string;
      };

  const outcome = await db.transaction(async (tx): Promise<TxOutcome> => {
    // Termin-Row sperren (Race-Schutz beim Slot-Count).
    const rows = await tx.execute<{
      id: string;
      status: string;
      titel: string;
      typ: string;
      datum_uhrzeit: Date;
      ort_text: string | null;
      online_link: string | null;
      max_teilnehmer: number;
    }>(sql`
      SELECT id, status, titel, typ, datum_uhrzeit, ort_text, online_link,
             max_teilnehmer
        FROM termin
       WHERE id = ${id}
       FOR UPDATE
    `);
    const row = rows[0];
    if (!row) {
      return { kind: 'not_found' };
    }
    if (row.status !== 'veroeffentlicht') {
      return { kind: 'falscher_status' };
    }
    // Zeit-Check (Termin muss in der Zukunft liegen).
    const datum =
      row.datum_uhrzeit instanceof Date
        ? row.datum_uhrzeit
        : new Date(row.datum_uhrzeit);
    if (datum.getTime() <= Date.now()) {
      return { kind: 'termin_vergangen' };
    }

    // E-Mail-Adresse fuer T-401 holen.
    const userRows = await tx
      .select({ email: nutzer.email })
      .from(nutzer)
      .where(eq(nutzer.id, sess.nutzerId))
      .limit(1);
    const userEmail = userRows[0]?.email;
    if (!userEmail) {
      // Sollte nie passieren, wenn Session valide ist.
      return { kind: 'not_found' };
    }

    // Aktive Slots zaehlen (Statuse, die einen festen Platz belegen).
    const countRows = await tx.execute<{ anzahl: number }>(sql`
      SELECT COUNT(*)::int AS anzahl
        FROM termin_anmeldung
       WHERE termin_id = ${id}
         AND status IN ('angemeldet', 'anwesend')
    `);
    const aktive = countRows[0]?.anzahl ?? 0;
    const slotStatus: 'angemeldet' | 'warteliste' =
      aktive < row.max_teilnehmer ? 'angemeldet' : 'warteliste';

    // INSERT mit ON CONFLICT (UNIQUE termin_id + nutzer_id):
    //  - Wenn bisher 'storniert': UPDATE auf neuen slotStatus.
    //  - Sonst: bestehende Row bleibt unveraendert (DO NOTHING) und wir geben
    //    sie als bestehende zurueck.
    const newId = createId();
    const inserted = await tx.execute<{ id: string; status: string }>(sql`
      INSERT INTO termin_anmeldung (id, termin_id, nutzer_id, status)
      VALUES (${newId}, ${id}, ${sess.nutzerId}, ${slotStatus})
      ON CONFLICT (termin_id, nutzer_id) DO UPDATE
         SET status = EXCLUDED.status
       WHERE termin_anmeldung.status = 'storniert'
      RETURNING id, status
    `);
    let anmeldungId: string;
    let finalStatus: 'angemeldet' | 'warteliste';
    if (inserted[0]) {
      anmeldungId = inserted[0].id;
      finalStatus = inserted[0].status as 'angemeldet' | 'warteliste';
    } else {
      // Konflikt + bestehender Status nicht 'storniert' → bereits aktiv
      // angemeldet/warteliste/anwesend etc. Behandeln als idempotent: bestehende
      // Row zurueckgeben.
      const existing = await tx
        .select()
        .from(terminAnmeldung)
        .where(
          and(
            eq(terminAnmeldung.terminId, id),
            eq(terminAnmeldung.nutzerId, sess.nutzerId),
          ),
        )
        .limit(1);
      const ex = existing[0];
      if (!ex) {
        return { kind: 'not_found' };
      }
      anmeldungId = ex.id;
      // Wenn der bestehende Status nicht angemeldet/warteliste ist (z.B.
      // anwesend), fallen wir auf 'angemeldet' als Anzeige-Variante zurueck
      // — die Mail wird nicht erneut verschickt.
      finalStatus =
        ex.status === 'warteliste' ? 'warteliste' : 'angemeldet';
    }

    return {
      kind: 'ok',
      anmeldungId,
      slotStatus: finalStatus,
      terminTitel: row.titel,
      terminTyp: row.typ,
      datumUhrzeit: datum,
      ortText: row.ort_text,
      onlineLink: row.online_link,
      nutzerEmail: userEmail,
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
            'Anmeldungen sind nur fuer veroeffentlichte Termine moeglich.',
        },
      },
      { status: 422 },
    );
  }
  if (outcome.kind === 'termin_vergangen') {
    return Response.json(
      {
        error: {
          code: 'termin_vergangen',
          message:
            'Anmeldungen sind nur fuer zukuenftige Termine moeglich.',
        },
      },
      { status: 422 },
    );
  }

  // T-401 versenden — Mail-Failure darf den 201 nicht blockieren.
  try {
    await sendMail({
      to: outcome.nutzerEmail,
      nutzerId: sess.nutzerId,
      template: 'T-401',
      props: {
        terminTitel: outcome.terminTitel,
        terminTyp:
          TERMIN_TYP_LABEL[outcome.terminTyp] ?? outcome.terminTyp,
        terminDatum: formatDatum(outcome.datumUhrzeit),
        terminUhrzeit: formatUhrzeit(outcome.datumUhrzeit),
        ...(outcome.ortText ? { ortText: outcome.ortText } : {}),
        ...(outcome.onlineLink ? { onlineLink: outcome.onlineLink } : {}),
        terminUrl: `${APP_URL}/termine/${id}`,
        icalUrl: `${APP_URL}/api/v1/termine/${id}/ical`,
        slotPosition: outcome.slotStatus,
      },
    });
  } catch (err) {
    console.error('[termin-anmeldung] sendMail T-401 failed:', err);
  }

  try {
    await db.insert(auditLog).values({
      nutzerId: sess.nutzerId,
      aktion: 'termin.angemeldet',
      referenzTyp: 'termin',
      referenzId: id,
      metadaten: {
        anmeldungs_id: outcome.anmeldungId,
        slot_status: outcome.slotStatus,
      },
    });
  } catch {
    // Audit-Failure darf den Erfolg nicht blockieren.
  }

  return Response.json(
    {
      anmeldung: {
        id: outcome.anmeldungId,
        termin_id: id,
        nutzer_id: sess.nutzerId,
        status: outcome.slotStatus,
      },
      status: outcome.slotStatus,
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

  type TxOutcome =
    | { kind: 'not_found' }
    | { kind: 'bereits_storniert' }
    | {
        kind: 'ok';
        hochgerueckt: null | {
          anmeldungId: string;
          nutzerId: string;
          email: string;
          terminTitel: string;
          terminTyp: string;
          datumUhrzeit: Date;
          ortText: string | null;
          onlineLink: string | null;
        };
      };

  const outcome = await db.transaction(async (tx): Promise<TxOutcome> => {
    // Termin sperren (gleicher Lock-Key wie POST, damit DELETE + parallele
    // POSTs sich nicht verzanken).
    const terminRows = await tx.execute<{
      id: string;
      titel: string;
      typ: string;
      datum_uhrzeit: Date;
      ort_text: string | null;
      online_link: string | null;
    }>(sql`
      SELECT id, titel, typ, datum_uhrzeit, ort_text, online_link
        FROM termin
       WHERE id = ${id}
       FOR UPDATE
    `);
    const terminRow = terminRows[0];
    if (!terminRow) {
      return { kind: 'not_found' };
    }

    // Eigene Anmeldung suchen.
    const eigeneRows = await tx
      .select()
      .from(terminAnmeldung)
      .where(
        and(
          eq(terminAnmeldung.terminId, id),
          eq(terminAnmeldung.nutzerId, sess.nutzerId),
        ),
      )
      .limit(1);
    const eigene = eigeneRows[0];
    if (!eigene) {
      return { kind: 'not_found' };
    }
    if (eigene.status === 'storniert') {
      return { kind: 'bereits_storniert' };
    }

    const warVollerSlot = eigene.status === 'angemeldet';

    // Eigene Row auf 'storniert' setzen (Historie behalten).
    await tx
      .update(terminAnmeldung)
      .set({ status: 'storniert' })
      .where(eq(terminAnmeldung.id, eigene.id));

    if (!warVollerSlot) {
      return { kind: 'ok', hochgerueckt: null };
    }

    // Aelteste Warteliste-Person hochziehen.
    const warteRows = await tx.execute<{
      id: string;
      nutzer_id: string;
      email: string;
    }>(sql`
      SELECT ta.id, ta.nutzer_id, n.email
        FROM termin_anmeldung ta
        JOIN nutzer n ON n.id = ta.nutzer_id
       WHERE ta.termin_id = ${id}
         AND ta.status = 'warteliste'
       ORDER BY ta.erstellt_am ASC, ta.id ASC
       LIMIT 1
       FOR UPDATE OF ta
    `);
    const warte = warteRows[0];
    if (!warte) {
      return { kind: 'ok', hochgerueckt: null };
    }

    await tx
      .update(terminAnmeldung)
      .set({ status: 'angemeldet' })
      .where(eq(terminAnmeldung.id, warte.id));

    const datum =
      terminRow.datum_uhrzeit instanceof Date
        ? terminRow.datum_uhrzeit
        : new Date(terminRow.datum_uhrzeit);

    return {
      kind: 'ok',
      hochgerueckt: {
        anmeldungId: warte.id,
        nutzerId: warte.nutzer_id,
        email: warte.email,
        terminTitel: terminRow.titel,
        terminTyp: terminRow.typ,
        datumUhrzeit: datum,
        ortText: terminRow.ort_text,
        onlineLink: terminRow.online_link,
      },
    };
  });

  if (outcome.kind === 'not_found') {
    return Response.json({ fehler: 'nicht_gefunden' }, { status: 404 });
  }
  if (outcome.kind === 'bereits_storniert') {
    return Response.json(
      {
        error: {
          code: 'bereits_storniert',
          message: 'Deine Anmeldung ist bereits storniert.',
        },
      },
      { status: 422 },
    );
  }

  // T-401 an hochgerueckte Person (ausserhalb der Transaktion).
  if (outcome.hochgerueckt) {
    const h = outcome.hochgerueckt;
    try {
      await sendMail({
        to: h.email,
        nutzerId: h.nutzerId,
        template: 'T-401',
        props: {
          terminTitel: h.terminTitel,
          terminTyp: TERMIN_TYP_LABEL[h.terminTyp] ?? h.terminTyp,
          terminDatum: formatDatum(h.datumUhrzeit),
          terminUhrzeit: formatUhrzeit(h.datumUhrzeit),
          ...(h.ortText ? { ortText: h.ortText } : {}),
          ...(h.onlineLink ? { onlineLink: h.onlineLink } : {}),
          terminUrl: `${APP_URL}/termine/${id}`,
          icalUrl: `${APP_URL}/api/v1/termine/${id}/ical`,
          slotPosition: 'angemeldet',
        },
      });
    } catch (err) {
      console.error('[termin-anmeldung] sendMail T-401 (hochgerueckt) failed:', err);
    }
  }

  try {
    await db.insert(auditLog).values({
      nutzerId: sess.nutzerId,
      aktion: 'termin.storniert',
      referenzTyp: 'termin',
      referenzId: id,
      metadaten: {
        hochgerueckt: outcome.hochgerueckt
          ? {
              anmeldungs_id: outcome.hochgerueckt.anmeldungId,
              nutzer_id: outcome.hochgerueckt.nutzerId,
            }
          : null,
      },
    });
  } catch {
    // Audit-Failure darf den Erfolg nicht blockieren.
  }

  return new Response(null, { status: 204 });
}
