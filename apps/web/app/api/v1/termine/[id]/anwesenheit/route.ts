/**
 * POST /api/v1/termine/:id/anwesenheit
 *
 * Anwesenheits-Dokumentation durch die City-Lead nach dem Termin (PRD §8.8,
 * §F-401..§F-405). In einer Bulk-Operation werden alle Anmeldungen eines
 * Termins auf 'anwesend' oder 'nicht_anwesend' gesetzt.
 *
 * - Auth + `istKuratorVon(termin.stadt_id)` — sonst 403.
 * - Termin muss in der Vergangenheit liegen ODER status='durchgefuehrt'.
 * - Body Zod-validiert:
 *     { anmeldung_ids_anwesend: string[],
 *       notizen_nach_termin?: string }
 * - Transaktion:
 *     1. Lade alle Anmeldungen des Termins.
 *     2. Setze alle aktiven (angemeldet/warteliste/anwesend/nicht_anwesend)
 *        DEFAULT auf 'nicht_anwesend'. 'storniert' bleibt unangetastet.
 *     3. Setze die in `anmeldung_ids_anwesend` aufgelisteten Anmeldungen auf
 *        'anwesend' — aber nur, wenn ihre Row zum Termin gehoert und nicht
 *        'storniert' ist.
 *     4. UPDATE termin.notizen_nach_termin wenn body-Feld gesetzt.
 * - Membership-Beitrag-Hook nach Transaktion fuer jeden frisch 'anwesend'-
 *   markierten Nutzer mit Rolle 'bedarfstraeger' auf Demo Night/Briefing Night.
 * - Audit-Log.
 * - Returns 200 mit { anwesend: N, nicht_anwesend: M }.
 */

import { eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { auditLog, termin, terminAnmeldung } from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';
import { rejectIfBadOrigin } from '@/lib/auth/csrf';
import { istKuratorVon } from '@/lib/auth/permissions';
import { maybeCreateSchauabendBeitrag } from '@/lib/werkstattbeitrag/schauabend-hook';
import { maybeUpdateFoerderprofilBedarfsschau } from '@/lib/foerderprofil/bedarfsschau-hook';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const anwesenheitSchema = z
  .object({
    anmeldung_ids_anwesend: z
      .array(
        z
          .string({ errorMap: () => ({ message: 'Anmeldung-ID ist ungueltig.' }) })
          .min(1, { message: 'Anmeldung-ID darf nicht leer sein.' })
          .max(40, { message: 'Anmeldung-ID ist zu lang.' }),
      )
      .max(500, { message: 'Maximal 500 Anmeldungen pro Aufruf.' }),
    notizen_nach_termin: z
      .string()
      .max(5000, {
        message: 'Notizen sind zu lang (max. 5000 Zeichen).',
      })
      .optional(),
  })
  .strict();

export async function POST(req: Request, ctx: RouteContext): Promise<Response> {
  const originResp = rejectIfBadOrigin(req);
  if (originResp) return originResp;

  const sess = await getSessionFromRequest(req);
  if (!sess) {
    return Response.json({ fehler: 'unauthenticated' }, { status: 401 });
  }

  const { id } = await ctx.params;

  const terminRows = await db
    .select()
    .from(termin)
    .where(eq(termin.id, id))
    .limit(1);
  const terminRow = terminRows[0];
  if (!terminRow) {
    return Response.json({ fehler: 'nicht_gefunden' }, { status: 404 });
  }

  const erlaubt = await istKuratorVon(sess.nutzerId, terminRow.stadtId);
  if (!erlaubt) {
    return Response.json(
      {
        error: {
          code: 'kein_zugriff',
          message:
            'Nur City-Leads der jeweiligen Stadt koennen die Anwesenheit dokumentieren.',
        },
      },
      { status: 403 },
    );
  }

  const istVergangen = terminRow.datumUhrzeit.getTime() < Date.now();
  if (!istVergangen && terminRow.status !== 'durchgefuehrt') {
    return Response.json(
      {
        error: {
          code: 'termin_in_zukunft',
          message:
            'Anwesenheit kann erst nach dem Termin dokumentiert werden.',
        },
      },
      { status: 422 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ fehler: 'ungueltiger_body' }, { status: 400 });
  }

  const parsed = anwesenheitSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {
        fehler: 'validierung',
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 422 },
    );
  }
  const { anmeldung_ids_anwesend, notizen_nach_termin } = parsed.data;
  const anwesendSet = new Set(anmeldung_ids_anwesend);

  type FreshAnwesend = { anmeldungId: string; nutzerId: string };

  const result = await db.transaction(async (tx) => {
    // Alle Anmeldungen des Termins laden — wir entscheiden in App-Logik, was
    // welcher Endzustand sein soll.
    const alle = await tx
      .select({
        id: terminAnmeldung.id,
        nutzerId: terminAnmeldung.nutzerId,
        status: terminAnmeldung.status,
      })
      .from(terminAnmeldung)
      .where(eq(terminAnmeldung.terminId, id));

    const idsAlle = new Set(alle.map((a) => a.id));

    // Gueltige anwesend-IDs: die in der Anfrage gelistet UND zum Termin
    // gehoerig UND nicht 'storniert'.
    const anwesendIds: string[] = [];
    const freshlyAnwesend: FreshAnwesend[] = [];

    for (const a of alle) {
      if (a.status === 'storniert') continue;
      if (!anwesendSet.has(a.id)) continue;
      anwesendIds.push(a.id);
      if (a.status !== 'anwesend') {
        freshlyAnwesend.push({ anmeldungId: a.id, nutzerId: a.nutzerId });
      }
    }

    // Default: alle nicht-stornierten → 'nicht_anwesend'.
    const nichtStorniertIds = alle
      .filter((a) => a.status !== 'storniert')
      .map((a) => a.id);

    if (nichtStorniertIds.length > 0) {
      await tx
        .update(terminAnmeldung)
        .set({ status: 'nicht_anwesend' })
        .where(inArray(terminAnmeldung.id, nichtStorniertIds));
    }

    // Dann die gelisteten anwesenden Personen auf 'anwesend' heben.
    if (anwesendIds.length > 0) {
      await tx
        .update(terminAnmeldung)
        .set({ status: 'anwesend' })
        .where(inArray(terminAnmeldung.id, anwesendIds));
    }

    // Termin-Notizen aktualisieren wenn gesetzt.
    if (notizen_nach_termin !== undefined) {
      await tx
        .update(termin)
        .set({
          notizenNachTermin: notizen_nach_termin,
          aktualisiertAm: new Date(),
        })
        .where(eq(termin.id, id));
    }

    const anwesendCount = anwesendIds.length;
    const nichtAnwesendCount = nichtStorniertIds.length - anwesendIds.length;
    const ignoriert = anmeldung_ids_anwesend.filter(
      (idCandidate) => !idsAlle.has(idCandidate),
    );

    return {
      anwesendCount,
      nichtAnwesendCount,
      ignoriert,
      freshlyAnwesend,
    };
  });

  // Membership-Beitrag-Hook ausserhalb der Transaktion fuer jede frisch
  // 'anwesend'-markierte Person. Defensive: einzelne Fehler werden geloggt,
  // verhindern aber kein erfolgreiches Bulk-Update.
  for (const fa of result.freshlyAnwesend) {
    try {
      await maybeCreateSchauabendBeitrag({
        nutzer_id: fa.nutzerId,
        termin_id: id,
        termin_typ: terminRow.typ,
      });
    } catch (err) {
      console.error(
        '[anwesenheit] maybeCreateSchauabendBeitrag failed:',
        err,
      );
    }
    try {
      await maybeUpdateFoerderprofilBedarfsschau({
        nutzer_id: fa.nutzerId,
        termin_id: id,
        termin_typ: terminRow.typ,
      });
    } catch (err) {
      console.error(
        '[anwesenheit] maybeUpdateFoerderprofilBedarfsschau failed:',
        err,
      );
    }
  }

  try {
    await db.insert(auditLog).values({
      nutzerId: sess.nutzerId,
      aktion: 'termin.anwesenheit_dokumentiert',
      referenzTyp: 'termin',
      referenzId: id,
      metadaten: {
        anwesend: result.anwesendCount,
        nicht_anwesend: result.nichtAnwesendCount,
        ignorierte_ids: result.ignoriert,
        notizen_gesetzt: notizen_nach_termin !== undefined,
      },
    });
  } catch {
    // Audit-Failure darf den Erfolg nicht blockieren.
  }

  return Response.json({
    anwesend: result.anwesendCount,
    nicht_anwesend: result.nichtAnwesendCount,
    ...(result.ignoriert.length > 0
      ? { ignoriert: result.ignoriert }
      : {}),
  });
}
