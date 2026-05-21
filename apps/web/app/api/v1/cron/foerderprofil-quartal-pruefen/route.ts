/**
 * POST/GET /api/v1/cron/foerderprofil-quartal-pruefen
 *
 * Taeglicher Cron. Sucht alle verifizierten Foerderprofile, deren letzte
 * Briefing Night-Teilnahme mehr als 12 Monate (4 Quartale) zurueckliegt,
 * pausiert sie automatisch und versendet T-504.
 *
 * PRD-Referenz: §11A Schutz Kulturverlust 4, §F-704, §19.
 *
 * Auth: `X-Cron-Secret`-Header (401 ohne).
 */

import { and, eq, isNotNull, lt } from 'drizzle-orm';

import { db } from '@/lib/db';
import { auditLog, foerderprofil, nutzer } from '@/lib/db/schema';
import { requireCronSecret } from '@/lib/auth/cron-secret';
import { sendMail } from '@/lib/email/send';
import { env } from '@/lib/env';

const APP_URL = env.APP_URL.replace(/\/+$/, '');

// 12 Monate als 365 Tage approximiert — exakte Monatsarithmetik ist hier
// nicht noetig, ein paar Tage Spiel sind tolerierbar (PRD §11A).
const ZWOELF_MONATE_MS = 365 * 24 * 60 * 60 * 1000;

export const AUDIT_AKTION_AUTO_PAUSE = 'foerderprofil.auto_pause';
export const AUDIT_AKTION_CRON_LAUF = 'cron.foerderprofil-quartal-pruefen';

async function findeKandidaten() {
  const schwelle = new Date(Date.now() - ZWOELF_MONATE_MS);

  const rows = await db
    .select({
      profil: foerderprofil,
      owner: {
        id: nutzer.id,
        email: nutzer.email,
        stadtId: nutzer.stadtId,
      },
    })
    .from(foerderprofil)
    .innerJoin(nutzer, eq(foerderprofil.nutzerId, nutzer.id))
    .where(
      and(
        eq(foerderprofil.verifikationStatus, 'verifiziert'),
        isNotNull(foerderprofil.letzteBedarfsschauAm),
        lt(foerderprofil.letzteBedarfsschauAm, schwelle),
      ),
    );

  return rows;
}

async function handler(req: Request): Promise<Response> {
  const denied = requireCronSecret(req);
  if (denied) return denied;

  const startMs = Date.now();

  const kandidaten = await findeKandidaten();
  let pausiert = 0;
  let mailFehler = 0;

  for (const k of kandidaten) {
    const jetzt = new Date();
    try {
      await db
        .update(foerderprofil)
        .set({
          verifikationStatus: 'pausiert',
          pausiertSeit: jetzt,
          aktualisiertAm: jetzt,
        })
        .where(eq(foerderprofil.id, k.profil.id));
      pausiert++;
    } catch (err) {
      console.error(
        '[cron foerderprofil-quartal-pruefen] update failed:',
        k.profil.id,
        err,
      );
      continue;
    }

    try {
      await sendMail({
        to: k.owner.email,
        nutzerId: k.owner.id,
        template: 'T-504',
        props: {
          organisation: k.profil.organisation,
          bedarfsschauUrl: `${APP_URL}/termine?typ=bedarfsschau`,
        },
      });
    } catch (err) {
      mailFehler++;
      console.error(
        '[cron foerderprofil-quartal-pruefen] sendMail T-504 failed:',
        k.profil.id,
        err,
      );
    }

    try {
      await db.insert(auditLog).values({
        nutzerId: null,
        aktion: AUDIT_AKTION_AUTO_PAUSE,
        referenzTyp: 'foerderprofil',
        referenzId: k.profil.id,
        metadaten: {
          owner_id: k.owner.id,
          letzte_bedarfsschau_am:
            k.profil.letzteBedarfsschauAm?.toISOString() ?? null,
        },
      });
    } catch {
      // Audit-Failure darf den Cron-Erfolg nicht blockieren.
    }
  }

  const result = {
    pausiert,
    mail_fehler: mailFehler,
  };

  const dauerMs = Date.now() - startMs;
  try {
    await db.insert(auditLog).values({
      nutzerId: null,
      aktion: AUDIT_AKTION_CRON_LAUF,
      metadaten: { ...result, dauer_ms: dauerMs },
    });
  } catch {
    // Audit-Failure tolerabel.
  }

  return Response.json(result);
}

export async function POST(req: Request): Promise<Response> {
  return handler(req);
}

export async function GET(req: Request): Promise<Response> {
  return handler(req);
}
