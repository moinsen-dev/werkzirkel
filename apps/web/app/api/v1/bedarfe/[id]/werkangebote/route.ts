/**
 * POST + GET /api/v1/bedarfe/:id/werkangebote
 *
 * POST: Macher:in legt ein Werkangebot zu einem oeffentlichen Bedarf an.
 *   - Auth + Macher:innen-Rolle.
 *   - Bedarf muss status IN ('oeffentlich', 'in_gespraechen') sein.
 *   - werk_id muss der Macher:in gehoeren.
 *   - UNIQUE(bedarf_id, werk_id) Constraint catcht Mehrfach-Werkangebote —
 *     ON CONFLICT DO NOTHING → 422 mit code='bereits_eingereicht'.
 *   - sendMail T-201 an Bedarfstraeger:in.
 *
 * GET: Werkangebote zu einem Bedarf — Privacy-Layer PRD §11A Schutz S2:
 *   - Anonym → 401.
 *   - Bedarfstraeger:in (Bedarf-Inhaber:in) → alle Werkangebote.
 *   - Beteiligte Macher:in (eigenes Werk hat Werkangebot) → NUR eigenes.
 *   - Alle anderen → 403.
 *   KEIN Counter-Endpoint fuer Aussenstehende.
 *
 * PRD-Referenz: §F-621..§F-625, §11A Schutz S2 + S3.
 */

import { createId } from '@paralleldrive/cuid2';
import { and, eq, sql } from 'drizzle-orm';
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
import { hasRolle } from '@/lib/auth/permissions';
import { sendMail } from '@/lib/email/send';
import { env } from '@/lib/env';
import { werkangebotAnlegenSchema } from '@/lib/validators/werkangebot';
import { serializeWerkangebot } from '@/lib/werkangebot/serialize';

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

  if (!hasRolle(sess.nutzer, 'macher')) {
    return Response.json(
      {
        error: {
          code: 'kein_macher',
          message:
            'Nur Macher:innen koennen Werkangebote einreichen. Lege erst einen Werkpass an.',
        },
      },
      { status: 403 },
    );
  }

  const { id: bedarfId } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ fehler: 'ungueltiger_body' }, { status: 400 });
  }
  const parsed = werkangebotAnlegenSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { fehler: 'validierung', details: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }
  const input = parsed.data;

  // Bedarf laden + Status pruefen.
  const bedarfRows = await db
    .select()
    .from(bedarf)
    .where(eq(bedarf.id, bedarfId))
    .limit(1);
  const bedarfRow = bedarfRows[0];
  if (!bedarfRow) {
    return Response.json({ fehler: 'nicht_gefunden' }, { status: 404 });
  }
  if (bedarfRow.status !== 'oeffentlich' && bedarfRow.status !== 'in_gespraechen') {
    return Response.json(
      {
        error: {
          code: 'bedarf_nicht_offen',
          message:
            'Zu diesem Bedarf koennen aktuell keine Werkangebote eingereicht werden.',
        },
      },
      { status: 422 },
    );
  }

  // Werk laden + Inhaberschaft pruefen.
  const werkRows = await db
    .select()
    .from(werk)
    .where(eq(werk.id, input.werk_id))
    .limit(1);
  const werkRow = werkRows[0];
  if (!werkRow) {
    return Response.json(
      {
        error: {
          code: 'werk_nicht_gefunden',
          message: 'Das angegebene Werk existiert nicht.',
        },
      },
      { status: 422 },
    );
  }
  if (werkRow.nutzerId !== sess.nutzerId) {
    return Response.json(
      {
        error: {
          code: 'kein_eigenes_werk',
          message:
            'Du kannst nur mit eigenen Werken auf Bedarfe antworten.',
        },
      },
      { status: 403 },
    );
  }

  // INSERT mit ON CONFLICT DO NOTHING — UNIQUE(bedarf_id, werk_id) catcht
  // Mehrfach-Werkangebote pro Werk × Bedarf. ID app-seitig generiert.
  const newId = createId();
  const inserted = await db.execute<{ id: string }>(sql`
    INSERT INTO werkangebot (
      id,
      bedarf_id,
      werk_id,
      macher_id,
      konkretes_vorgehen,
      ausdruecklicher_ausschluss,
      erster_liefer_meilenstein,
      status
    )
    VALUES (
      ${newId},
      ${bedarfId},
      ${input.werk_id},
      ${sess.nutzerId},
      ${input.konkretes_vorgehen},
      ${input.ausdruecklicher_ausschluss},
      ${input.erster_liefer_meilenstein},
      'eingereicht'
    )
    ON CONFLICT (bedarf_id, werk_id) DO NOTHING
    RETURNING id
  `);
  const newRow = inserted[0];
  if (!newRow) {
    return Response.json(
      {
        error: {
          code: 'bereits_eingereicht',
          message:
            'Du hast mit diesem Werk bereits ein Werkangebot zu diesem Bedarf eingereicht.',
        },
      },
      { status: 422 },
    );
  }

  // Fertige Row fuer Response laden.
  const rowAfter = (
    await db
      .select()
      .from(werkangebot)
      .where(eq(werkangebot.id, newRow.id))
      .limit(1)
  )[0]!;

  // Bedarf-Inhaber:in fuer T-201 E-Mail laden.
  const inhaberRows = await db
    .select({ email: nutzer.email })
    .from(nutzer)
    .where(eq(nutzer.id, bedarfRow.nutzerId))
    .limit(1);
  const inhaberEmail = inhaberRows[0]?.email;

  if (inhaberEmail) {
    try {
      await sendMail({
        to: inhaberEmail,
        nutzerId: bedarfRow.nutzerId,
        template: 'T-201',
        props: {
          bedarfTitel: bedarfRow.titel,
          werkName: werkRow.name,
          macherAnzeigename: sess.nutzer.anzeigename,
          werkangebotUrl: `${APP_URL}/uebersicht/bedarfe`,
        },
      });
    } catch (err) {
      console.error('[werkangebot-anlegen] sendMail T-201 failed:', err);
    }
  }

  try {
    await db.insert(auditLog).values({
      nutzerId: sess.nutzerId,
      aktion: 'werkangebot.eingereicht',
      referenzTyp: 'werkangebot',
      referenzId: rowAfter.id,
      metadaten: { bedarf_id: bedarfId, werk_id: input.werk_id },
    });
  } catch {
    // Audit-Failure darf den Erfolg nicht blockieren.
  }

  return Response.json(
    { werkangebot: serializeWerkangebot(rowAfter) },
    { status: 201 },
  );
}

export async function GET(req: Request, ctx: RouteContext): Promise<Response> {
  const sess = await getSessionFromRequest(req);
  if (!sess) {
    return Response.json({ fehler: 'unauthenticated' }, { status: 401 });
  }

  const { id: bedarfId } = await ctx.params;

  const bedarfRows = await db
    .select()
    .from(bedarf)
    .where(eq(bedarf.id, bedarfId))
    .limit(1);
  const bedarfRow = bedarfRows[0];
  if (!bedarfRow) {
    return Response.json({ fehler: 'nicht_gefunden' }, { status: 404 });
  }

  const isBedarfOwner = bedarfRow.nutzerId === sess.nutzerId;

  // Beteiligte Macher:in? = hat selbst ein Werkangebot zu diesem Bedarf.
  let eigeneWerkangebote: Array<typeof werkangebot.$inferSelect> = [];
  if (!isBedarfOwner) {
    eigeneWerkangebote = await db
      .select()
      .from(werkangebot)
      .where(
        and(
          eq(werkangebot.bedarfId, bedarfId),
          eq(werkangebot.macherId, sess.nutzerId),
        ),
      );
    if (eigeneWerkangebote.length === 0) {
      // Nicht-beteiligte Person — keine Sichtbarkeit (PRD §11A Schutz S2).
      return Response.json(
        {
          error: {
            code: 'kein_zugriff',
            message:
              'Werkangebote sind nur fuer die Bedarfstraeger:in und beteiligte Macher:innen sichtbar.',
          },
        },
        { status: 403 },
      );
    }
  }

  const rows = isBedarfOwner
    ? await db.select().from(werkangebot).where(eq(werkangebot.bedarfId, bedarfId))
    : eigeneWerkangebote;

  return Response.json({
    werkangebote: rows.map(serializeWerkangebot),
  });
}
