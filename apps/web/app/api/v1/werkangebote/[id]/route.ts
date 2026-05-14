/**
 * PATCH /api/v1/werkangebote/:id
 *
 * Status-Uebergaenge eines Werkangebots:
 *  - Bedarfstraeger:in (Bedarf-Inhaber:in) darf setzen:
 *      eingereicht → in_gespraechen
 *      eingereicht | in_gespraechen → beauftragt
 *      eingereicht | in_gespraechen → nicht_gewaehlt
 *  - Macher:in (Werkangebot-Inhaber:in) darf setzen:
 *      eingereicht | in_gespraechen → zurueckgezogen
 *
 * Beim Bedarfstraeger:innen-Wechsel wird T-202 an die Macher:in versendet.
 * Beim Macher:innen-Rueckzug informieren wir aktuell *nicht* per Mail
 * (kein Mail-Spam an die Bedarfstraeger:in noetig — sie sieht den Status
 * in der Uebersicht).
 *
 * PRD-Referenz: §F-624, §F-625, §11A Schutz S2.
 */

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  auditLog,
  bedarf,
  nutzer,
  werk,
  werkangebot,
} from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';
import { rejectIfBadOrigin } from '@/lib/auth/csrf';
import { sendMail } from '@/lib/email/send';
import { env } from '@/lib/env';
import { werkangebotStatusPatchSchema } from '@/lib/validators/werkangebot';
import { serializeWerkangebot } from '@/lib/werkangebot/serialize';
import type { WerkangebotStatus } from '@/lib/db/schema/enums';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const APP_URL = env.APP_URL.replace(/\/+$/, '');

const BEDARFSTRAEGER_TARGETS: WerkangebotStatus[] = [
  'in_gespraechen',
  'beauftragt',
  'nicht_gewaehlt',
];
const MACHER_TARGETS: WerkangebotStatus[] = ['zurueckgezogen'];

/**
 * Erlaubte Start-Stati pro Ziel-Status. Schliesst u.a. aus, dass aus
 * 'beauftragt' oder 'zurueckgezogen' weiter geblaettert wird — diese Zustaende
 * sind Endpunkte.
 */
const ALLOWED_FROM: Record<WerkangebotStatus, WerkangebotStatus[]> = {
  eingereicht: [],
  in_gespraechen: ['eingereicht'],
  beauftragt: ['eingereicht', 'in_gespraechen'],
  nicht_gewaehlt: ['eingereicht', 'in_gespraechen'],
  zurueckgezogen: ['eingereicht', 'in_gespraechen'],
};

export async function PATCH(req: Request, ctx: RouteContext): Promise<Response> {
  const originResp = rejectIfBadOrigin(req);
  if (originResp) return originResp;

  const sess = await getSessionFromRequest(req);
  if (!sess) {
    return Response.json({ fehler: 'unauthenticated' }, { status: 401 });
  }

  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ fehler: 'ungueltiger_body' }, { status: 400 });
  }
  const parsed = werkangebotStatusPatchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { fehler: 'validierung', details: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }
  const { status: target } = parsed.data;

  // Werkangebot + Bedarf zusammen laden — wir brauchen den Bedarf-Owner
  // fuer die Bedarfstraeger:innen-Pruefung und den Bedarf-Titel fuer die Mail.
  const rows = await db
    .select({
      werkangebot,
      bedarfNutzerId: bedarf.nutzerId,
      bedarfTitel: bedarf.titel,
    })
    .from(werkangebot)
    .innerJoin(bedarf, eq(bedarf.id, werkangebot.bedarfId))
    .where(eq(werkangebot.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) {
    return Response.json({ fehler: 'nicht_gefunden' }, { status: 404 });
  }

  const istBedarfsOwner = row.bedarfNutzerId === sess.nutzerId;
  const istMacher = row.werkangebot.macherId === sess.nutzerId;

  if (!istBedarfsOwner && !istMacher) {
    return Response.json(
      {
        error: {
          code: 'kein_zugriff',
          message: 'Du darfst dieses Werkangebot nicht aendern.',
        },
      },
      { status: 403 },
    );
  }

  // Rolle ↔ erlaubter Ziel-Status.
  if (istBedarfsOwner && !BEDARFSTRAEGER_TARGETS.includes(target)) {
    return Response.json(
      {
        error: {
          code: 'unerlaubter_uebergang',
          message:
            'Als Bedarfstraeger:in kannst du nur "in_gespraechen", "beauftragt" oder "nicht_gewaehlt" setzen.',
        },
      },
      { status: 422 },
    );
  }
  if (!istBedarfsOwner && istMacher && !MACHER_TARGETS.includes(target)) {
    return Response.json(
      {
        error: {
          code: 'unerlaubter_uebergang',
          message:
            'Als Macher:in kannst du dein Werkangebot nur "zurueckgezogen" setzen.',
        },
      },
      { status: 422 },
    );
  }

  // Start-Status erlaubt? (Endpunkte 'beauftragt' / 'zurueckgezogen' /
  // 'nicht_gewaehlt' sind nicht weiter aenderbar.)
  const aktuellerStatus = row.werkangebot.status as WerkangebotStatus;
  if (aktuellerStatus === target) {
    // Idempotent: nichts zu tun.
    return Response.json({ werkangebot: serializeWerkangebot(row.werkangebot) });
  }
  if (!ALLOWED_FROM[target].includes(aktuellerStatus)) {
    return Response.json(
      {
        error: {
          code: 'falscher_status',
          message: `Wechsel von "${aktuellerStatus}" zu "${target}" ist nicht erlaubt.`,
        },
      },
      { status: 422 },
    );
  }

  const updated = await db
    .update(werkangebot)
    .set({ status: target, aktualisiertAm: new Date() })
    .where(eq(werkangebot.id, id))
    .returning();
  const updatedRow = updated[0]!;

  // T-202 nur, wenn die Bedarfstraeger:in den Status gesetzt hat. Beim
  // Macher:innen-Rueckzug informieren wir die Bedarfstraeger:in nicht
  // gesondert per Mail (sie sieht den Status in der Uebersicht).
  if (
    istBedarfsOwner &&
    (target === 'in_gespraechen' ||
      target === 'beauftragt' ||
      target === 'nicht_gewaehlt')
  ) {
    const macherRows = await db
      .select({ email: nutzer.email })
      .from(nutzer)
      .where(eq(nutzer.id, updatedRow.macherId))
      .limit(1);
    const macherEmail = macherRows[0]?.email;

    const werkRows = await db
      .select({ name: werk.name })
      .from(werk)
      .where(eq(werk.id, updatedRow.werkId))
      .limit(1);
    const werkName = werkRows[0]?.name ?? '';

    if (macherEmail) {
      try {
        await sendMail({
          to: macherEmail,
          nutzerId: updatedRow.macherId,
          template: 'T-202',
          props: {
            bedarfTitel: row.bedarfTitel,
            werkName,
            neuerStatus: target,
            werkangebotUrl: `${APP_URL}/uebersicht/werkangebote`,
          },
        });
      } catch (err) {
        console.error('[werkangebot-patch] sendMail T-202 failed:', err);
      }
    }
  }

  try {
    await db.insert(auditLog).values({
      nutzerId: sess.nutzerId,
      aktion: 'werkangebot.status_geaendert',
      referenzTyp: 'werkangebot',
      referenzId: updatedRow.id,
      metadaten: {
        von: aktuellerStatus,
        zu: target,
        rolle: istBedarfsOwner ? 'bedarfstraeger' : 'macher',
      },
    });
  } catch {
    // Audit-Failure darf den Erfolg nicht blockieren.
  }

  return Response.json({ werkangebot: serializeWerkangebot(updatedRow) });
}
