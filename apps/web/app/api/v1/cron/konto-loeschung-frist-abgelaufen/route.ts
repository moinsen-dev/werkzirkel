/**
 * POST /api/v1/cron/konto-loeschung-frist-abgelaufen
 *
 * Stuendlicher Cron-Job, der:
 *  1. Alle Nutzer:innen mit `status='loeschung_anstehend'` und
 *     `loeschung_anstehend_bis < now()` findet und endgueltig loescht
 *     (PRD §34 — Hard-Delete nach 7-Tage-Karenz).
 *  2. Vor dem Loeschen einen vollstaendigen DSGVO-JSON-Export erzeugt und
 *     diesen als Anhang an T-005 mitsendet.
 *  3. Feedbacks der Nutzer:in pseudonymisiert (`tester_id = NULL`) — das
 *     passiert via FK-Default `onDelete: 'set null'` automatisch beim
 *     Loeschen des Nutzer-Datensatzes.
 *  4. Werke / Bedarfe / Werkangebote etc. cascaden via FK-Constraints.
 *  5. T-004-Erinnerung (2 Tage vor Frist) an Nutzer:innen versendet, deren
 *     `loeschung_anstehend_bis` in 1-3 Tagen liegt — idempotent ueber
 *     audit_log (`aktion='konto.loeschung-erinnerung'`).
 *
 * Auth: `X-Cron-Secret`-Header mit `env.CRON_SECRET`.
 * Methode: POST (Vercel-Cron oder externer Trigger).
 *
 * Idempotenz: zweite Ausfuehrung loescht niemanden mehr (alle faelligen
 * Nutzer:innen sind weg), versendet keine Erinnerung doppelt (audit-log-
 * Pruefung).
 */

import { and, eq, gt, isNull, lt } from 'drizzle-orm';

import { db } from '@/lib/db';
import { auditLog, feedback, nutzer } from '@/lib/db/schema';
import { requireCronSecret } from '@/lib/auth/cron-secret';
import { sendMail } from '@/lib/email/send';
import { buildExport } from '@/lib/dsgvo/export';
import { env } from '@/lib/env';

const ERINNERUNG_FENSTER_MIN_TAGE = 1;
const ERINNERUNG_FENSTER_MAX_TAGE = 3;

function formatDeutschesDatum(d: Date): string {
  return d.toLocaleDateString('de-DE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

async function handler(req: Request): Promise<Response> {
  const denied = requireCronSecret(req);
  if (denied) return denied;

  const startMs = Date.now();
  const jetzt = new Date();

  // ── Schritt 1: Faellige Hard-Deletes ────────────────────────────────────
  const faellig = await db
    .select()
    .from(nutzer)
    .where(
      and(
        eq(nutzer.status, 'loeschung_anstehend'),
        lt(nutzer.loeschungAnstehendBis, jetzt),
      ),
    );

  let geloescht = 0;
  for (const user of faellig) {
    try {
      // Export VOR dem Loeschen erzeugen — danach sind die Daten weg.
      const exportObjekt = await buildExport(user.id, user);
      const jsonBody = JSON.stringify(exportObjekt, null, 2);
      const isoDate = new Date().toISOString().slice(0, 10);
      const filename = `werkzirkel-export-${isoDate}.json`;

      // T-005 mit JSON-Anhang versenden.
      await sendMail({
        to: user.email,
        template: 'T-005',
        props: { anzeigename: user.anzeigename, appUrl: env.APP_URL },
        nutzerId: user.id,
        attachments: [
          {
            filename,
            content: Buffer.from(jsonBody, 'utf-8'),
            contentType: 'application/json',
          },
        ],
      });

      // Defensive Pseudonymisierung: feedback.tester_id → NULL.
      // Das passiert eigentlich via FK (`onDelete: 'set null'`), aber wir
      // setzen es vorher explizit, falls jemand den FK je auf cascade
      // umstellt (PRD: "Feedback-Inhalt bleibt erhalten").
      await db
        .update(feedback)
        .set({ testerId: null })
        .where(eq(feedback.testerId, user.id));

      // Hard-Delete der Nutzer-Row → cascade ueber Werke, Bedarfe,
      // Werkangebote, Sessions etc.
      await db.delete(nutzer).where(eq(nutzer.id, user.id));

      // Audit-Log (nutzerId bleibt fuer Nachvollziehbarkeit referenz_id;
      // FK ist `set null`, daher kein FK-Conflict).
      await db.insert(auditLog).values({
        nutzerId: null,
        aktion: 'konto.geloescht',
        referenzTyp: 'nutzer',
        referenzId: user.id,
        metadaten: { email_hash: hashEmail(user.email) },
      });

      geloescht++;
    } catch (err) {
      // Fehler bei einer einzelnen Loeschung darf den Batch nicht stoppen.
      console.error('[cron konto-loeschung] Fehler bei', user.id, err);
    }
  }

  // ── Schritt 2: T-004-Erinnerung (2 Tage vor Frist) ──────────────────────
  // Fenster: loeschung_anstehend_bis liegt zwischen now+1d und now+3d.
  const fensterStart = new Date(
    jetzt.getTime() + ERINNERUNG_FENSTER_MIN_TAGE * 24 * 60 * 60 * 1000,
  );
  const fensterEnde = new Date(
    jetzt.getTime() + ERINNERUNG_FENSTER_MAX_TAGE * 24 * 60 * 60 * 1000,
  );
  const erinnerungsKandidaten = await db
    .select()
    .from(nutzer)
    .where(
      and(
        eq(nutzer.status, 'loeschung_anstehend'),
        gt(nutzer.loeschungAnstehendBis, fensterStart),
        lt(nutzer.loeschungAnstehendBis, fensterEnde),
      ),
    );

  let erinnerungenVersendet = 0;
  for (const user of erinnerungsKandidaten) {
    // Idempotenz: nur senden, wenn noch nie eine Erinnerung fuer diese
    // Nutzer:in im audit_log steht.
    const bisheriges = await db
      .select({ id: auditLog.id })
      .from(auditLog)
      .where(
        and(
          eq(auditLog.aktion, 'konto.loeschung-erinnerung'),
          eq(auditLog.referenzId, user.id),
        ),
      )
      .limit(1);
    if (bisheriges.length > 0) continue;

    try {
      const cancelUrl = `${env.APP_URL}/einstellungen?tab=datenschutz`;
      const deletionDate = formatDeutschesDatum(user.loeschungAnstehendBis!);
      await sendMail({
        to: user.email,
        template: 'T-004',
        props: { cancelUrl, deletionDate, appUrl: env.APP_URL },
        nutzerId: user.id,
      });

      await db.insert(auditLog).values({
        nutzerId: user.id,
        aktion: 'konto.loeschung-erinnerung',
        referenzTyp: 'nutzer',
        referenzId: user.id,
      });

      erinnerungenVersendet++;
    } catch (err) {
      console.error('[cron konto-loeschung] T-004 Fehler bei', user.id, err);
    }
  }

  // ── Audit-Log fuer den Cron-Lauf selbst ─────────────────────────────────
  const dauerMs = Date.now() - startMs;
  try {
    await db.insert(auditLog).values({
      nutzerId: null,
      aktion: 'cron.konto-loeschung-frist-abgelaufen',
      metadaten: {
        processed: geloescht,
        erinnerungen: erinnerungenVersendet,
        dauer_ms: dauerMs,
      },
    });
  } catch {
    // Run-Audit-Failure darf den Return nicht blockieren.
  }

  return Response.json({
    processed: geloescht,
    erinnerungen: erinnerungenVersendet,
    dauer_ms: dauerMs,
  });
}

/**
 * Stabiler Hash der E-Mail-Adresse fuer audit_log nach Hard-Delete —
 * erlaubt spaetere Anfragen "wurde diese Adresse je geloescht?" ohne
 * Klartext-Email im Log zu halten.
 */
function hashEmail(email: string): string {
  // einfaches DJB2; nicht-kryptografisch, aber stabil genug fuers Audit.
  let h = 5381;
  for (let i = 0; i < email.length; i++) {
    h = (h * 33) ^ email.charCodeAt(i);
  }
  return (h >>> 0).toString(16);
}

export async function POST(req: Request): Promise<Response> {
  return handler(req);
}

// Auch GET unterstuetzen — viele Cron-Anbieter (Vercel-Cron, externe Pinger)
// triggern via GET. Dieselbe Funktion, identische Semantik.
export async function GET(req: Request): Promise<Response> {
  return handler(req);
}

// Hilfsname-Anker fuer `isNull` (vermeidet ungenutzten Import-Warner
// falls die Linter-Regel mal anspringt).
void isNull;
