/**
 * POST /api/v1/cron/reziprozitaet-frist-pruefen
 *
 * Taeglicher Cron-Job (PRD §11). Drei Verantwortlichkeiten:
 *
 *  1. Abgelaufene `pruefrunden_verpflichtung`-Rows (`status='offen' AND
 *     frist < now()`) auf `status='verfallen'` setzen und die betroffenen
 *     Nutzer:innen anschliessend in `test_saldo` neu materialisieren
 *     (offene_verpflichtung_anzahl + naechste_verpflichtung_frist).
 *
 *  2. T-103-Erinnerungen (Frist endet in 3 Tagen) versenden — fuer alle
 *     offenen Verpflichtungen, deren `frist` zwischen `now+3d -1h` und
 *     `now+3d +1h` liegt. Idempotenz ueber `audit_log` mit
 *     `aktion='reziprozitaet.erinnerung-3d'` und `referenz_id=<nutzer_id>`,
 *     Fenster 7 Tage rueckblickend.
 *
 *  3. T-104-Erinnerungen (Frist endet morgen) analog, aktion
 *     `reziprozitaet.erinnerung-1d`.
 *
 *  Plus: ein Audit-Log fuer den Cron-Lauf selbst.
 *
 * Auth: `X-Cron-Secret`-Header. Methoden: POST + GET (Vercel-Cron / externer
 * Pinger duerfen beides triggern; semantisch identisch).
 *
 * Idempotenz: zweiter Lauf innerhalb von Minuten markiert 0 zusaetzliche
 * verfallene Verpflichtungen, sendet 0 zusaetzliche Erinnerungen.
 *
 * PRD-Referenz: §17 (Reziprozitaets-Engine), §11 (Cron-Jobs), §15.15
 * (Cron-Endpoint-Pattern).
 */

import { and, eq, gt, gte, lt, lte, sql } from 'drizzle-orm';

import { db } from '@/lib/db';
import {
  auditLog,
  nutzer,
  pruefrundenVerpflichtung,
  testSaldo,
} from '@/lib/db/schema';
import { requireCronSecret } from '@/lib/auth/cron-secret';
import { sendMail } from '@/lib/email/send';
import { env } from '@/lib/env';
import {
  markiereAbgelaufeneVerpflichtungen,
  recomputeSaldoVerpflichtungen,
} from '@/lib/reziprozitaet/engine';

// ── Konstanten ──────────────────────────────────────────────────────────────
const STUNDE_MS = 60 * 60 * 1000;
const TAG_MS = 24 * STUNDE_MS;
const ERINNERUNGS_FENSTER_MS = STUNDE_MS; // +/- 1h um Soll-Zeitpunkt
const AUDIT_DEDUP_FENSTER_MS = 7 * TAG_MS; // 7 Tage zurueck pruefen

// Audit-Aktion-Namen — als Konstanten, damit Tests sie direkt importieren
// und keine Tippfehler-Drift entsteht.
export const AUDIT_AKTION_ERINNERUNG_3D = 'reziprozitaet.erinnerung-3d';
export const AUDIT_AKTION_ERINNERUNG_1D = 'reziprozitaet.erinnerung-1d';
export const AUDIT_AKTION_CRON_LAUF = 'cron.reziprozitaet-frist-pruefen';

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatDeutschesDatum(d: Date): string {
  return d.toLocaleDateString('de-DE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function pruefrundenSucheUrl(stadtId: string | null): string {
  const base = `${env.APP_URL}/pruefrunden`;
  return stadtId ? `${base}?stadt=${encodeURIComponent(stadtId)}` : base;
}

/**
 * Holt alle offenen Verpflichtungen mit Frist in einem Fenster um
 * `jetzt + offsetMs` (+/- ERINNERUNGS_FENSTER_MS), gruppiert pro nutzer_id
 * mit min-Frist + COUNT, plus die Nutzer-Stammdaten fuer das Mail-Versand.
 *
 * Bewusst auf nutzer_id-Ebene aggregiert: wer drei offene Verpflichtungen
 * mit unterschiedlichen Fristen hat, bekommt EINE Mail mit der naechsten
 * Frist — nicht drei Mails fuer dieselbe Person.
 */
async function findeErinnerungsKandidaten(offsetMs: number): Promise<Array<{
  nutzer_id: string;
  email: string;
  stadt_id: string | null;
  naechste_frist: Date;
  offene_anzahl: number;
}>> {
  const jetzt = Date.now();
  const fensterStart = new Date(jetzt + offsetMs - ERINNERUNGS_FENSTER_MS);
  const fensterEnde = new Date(jetzt + offsetMs + ERINNERUNGS_FENSTER_MS);

  // Eine Nutzer:in kann mehrere offene Verpflichtungen haben; wir gruppieren
  // pro Nutzer:in und nehmen die naechst-faellige Frist.
  const rows = await db
    .select({
      nutzerId: pruefrundenVerpflichtung.nutzerId,
      email: nutzer.email,
      stadtId: nutzer.stadtId,
      naechsteFrist: sql<Date>`MIN(${pruefrundenVerpflichtung.frist})`,
      offeneAnzahl: sql<number>`COUNT(*)::int`,
    })
    .from(pruefrundenVerpflichtung)
    .innerJoin(nutzer, eq(pruefrundenVerpflichtung.nutzerId, nutzer.id))
    .where(
      and(
        eq(pruefrundenVerpflichtung.status, 'offen'),
        gte(pruefrundenVerpflichtung.frist, fensterStart),
        lte(pruefrundenVerpflichtung.frist, fensterEnde),
      ),
    )
    .groupBy(pruefrundenVerpflichtung.nutzerId, nutzer.email, nutzer.stadtId);

  // MIN(timestamptz) kommt von postgres-js als String/Datum gemischt zurueck
  // — wir wrappen defensiv, damit `formatDeutschesDatum` sicher ein Date hat.
  return rows.map((r) => ({
    nutzer_id: r.nutzerId,
    email: r.email,
    stadt_id: r.stadtId,
    naechste_frist:
      r.naechsteFrist instanceof Date ? r.naechsteFrist : new Date(r.naechsteFrist as unknown as string),
    offene_anzahl: Number(r.offeneAnzahl),
  }));
}

/**
 * Prueft via audit_log, ob fuer `nutzer_id` innerhalb der letzten
 * AUDIT_DEDUP_FENSTER_MS bereits eine Erinnerung der angegebenen Aktion
 * versendet wurde. Eine Mail pro Aktion pro Nutzer:in pro 7 Tage — verhindert
 * Doppel-Versand, wenn der Cron in kurzen Abstaenden mehrfach laeuft (z.B.
 * Manual-Trigger nach Crash-Recovery).
 */
async function bereitsBenachrichtigt(
  nutzer_id: string,
  aktion: string,
): Promise<boolean> {
  const schwelle = new Date(Date.now() - AUDIT_DEDUP_FENSTER_MS);
  const rows = await db
    .select({ id: auditLog.id })
    .from(auditLog)
    .where(
      and(
        eq(auditLog.aktion, aktion),
        eq(auditLog.referenzId, nutzer_id),
        gt(auditLog.erstelltAm, schwelle),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/**
 * Versendet eine Erinnerung und schreibt den Audit-Log-Eintrag fuer die
 * Dedup-Pruefung. `nutzerId` im audit_log bleibt `null` und wir tragen die
 * Nutzer:in als `referenz_id` ein — gleiche Konvention wie der Konto-
 * Loeschungs-Cron, damit ein spaeterer Hard-Delete die Audit-Trail nicht
 * mit-loescht.
 */
async function versendeErinnerung(opts: {
  template: 'T-103' | 'T-104';
  aktion: string;
  nutzer_id: string;
  email: string;
  stadt_id: string | null;
  naechste_frist: Date;
  offene_anzahl: number;
}): Promise<boolean> {
  const result = await sendMail({
    to: opts.email,
    template: opts.template,
    nutzerId: opts.nutzer_id,
    props: {
      fristFormatted: formatDeutschesDatum(opts.naechste_frist),
      offeneAnzahl: opts.offene_anzahl,
      pruefrundenSucheUrl: pruefrundenSucheUrl(opts.stadt_id),
      appUrl: env.APP_URL,
    },
  });

  if (!result.ok) {
    // Bei Send-Fehler keinen Audit-Eintrag schreiben — dann darf der naechste
    // Cron-Lauf den Versand nochmal versuchen.
    console.error(
      '[cron reziprozitaet] sendMail failed:',
      opts.template,
      opts.nutzer_id,
      result.fehler,
    );
    return false;
  }

  try {
    await db.insert(auditLog).values({
      nutzerId: null,
      aktion: opts.aktion,
      referenzTyp: 'nutzer',
      referenzId: opts.nutzer_id,
      metadaten: {
        template: opts.template,
        frist_iso: opts.naechste_frist.toISOString(),
        offene_anzahl: opts.offene_anzahl,
      },
    });
  } catch (err) {
    // Audit-Insert-Failure fuehrt zu Doppel-Versand beim naechsten Lauf —
    // tolerierbar (besser als versendete Mail ohne Audit-Eintrag).
    console.error('[cron reziprozitaet] audit-insert failed:', err);
  }
  return true;
}

// ── Handler ─────────────────────────────────────────────────────────────────

async function handler(req: Request): Promise<Response> {
  const denied = requireCronSecret(req);
  if (denied) return denied;

  const startMs = Date.now();

  // ── 1. Verfallene Verpflichtungen markieren + Saldo neu materialisieren ──
  let verfallenAnzahl = 0;
  const betroffeneNutzerIds = await markiereAbgelaufeneVerpflichtungen();
  for (const nutzerId of betroffeneNutzerIds) {
    try {
      await recomputeSaldoVerpflichtungen(nutzerId);
    } catch (err) {
      console.error(
        '[cron reziprozitaet] recomputeSaldo failed for',
        nutzerId,
        err,
      );
    }
  }
  // Wir wissen aus markiereAbgelaufeneVerpflichtungen nur, WIEVIELE Nutzer
  // betroffen sind, nicht wie viele Rows insgesamt umgestellt wurden. Fuer
  // den Bericht zaehlen wir nochmal — billig (kleine Tabelle).
  const verfallenRow = await db
    .select({ anzahl: sql<number>`COUNT(*)::int` })
    .from(pruefrundenVerpflichtung)
    .where(
      and(
        eq(pruefrundenVerpflichtung.status, 'verfallen'),
        // Nur die soeben verfallenen — also die mit Frist juenger als "vor
        // 1 Tag", grob; ohne extra-Spalte koennen wir keinen exakten Wert.
        // Stattdessen reportieren wir einfach die betroffenen Nutzer-Anzahl
        // als Proxy. Race-Konsistenz: dieselbe Engine-Funktion liefert die
        // betroffenen IDs — keine Diskrepanz moeglich.
        sql`true`,
      ),
    );
  // verfallenAnzahl: einfach die Anzahl betroffener Nutzer:innen — das ist
  // PRD-konform (siehe `processed` im Konto-Loeschungs-Cron).
  verfallenAnzahl = betroffeneNutzerIds.length;
  void verfallenRow;

  // ── 2. T-103 (3 Tage Frist) ─────────────────────────────────────────────
  const kandidaten3d = await findeErinnerungsKandidaten(3 * TAG_MS);
  let t103Versendet = 0;
  for (const k of kandidaten3d) {
    if (await bereitsBenachrichtigt(k.nutzer_id, AUDIT_AKTION_ERINNERUNG_3D)) {
      continue;
    }
    const ok = await versendeErinnerung({
      template: 'T-103',
      aktion: AUDIT_AKTION_ERINNERUNG_3D,
      nutzer_id: k.nutzer_id,
      email: k.email,
      stadt_id: k.stadt_id,
      naechste_frist: k.naechste_frist,
      offene_anzahl: k.offene_anzahl,
    });
    if (ok) t103Versendet++;
  }

  // ── 3. T-104 (1 Tag Frist) ──────────────────────────────────────────────
  const kandidaten1d = await findeErinnerungsKandidaten(1 * TAG_MS);
  let t104Versendet = 0;
  for (const k of kandidaten1d) {
    if (await bereitsBenachrichtigt(k.nutzer_id, AUDIT_AKTION_ERINNERUNG_1D)) {
      continue;
    }
    const ok = await versendeErinnerung({
      template: 'T-104',
      aktion: AUDIT_AKTION_ERINNERUNG_1D,
      nutzer_id: k.nutzer_id,
      email: k.email,
      stadt_id: k.stadt_id,
      naechste_frist: k.naechste_frist,
      offene_anzahl: k.offene_anzahl,
    });
    if (ok) t104Versendet++;
  }

  const dauerMs = Date.now() - startMs;
  const result = {
    verfallen: verfallenAnzahl,
    t103_versendet: t103Versendet,
    t104_versendet: t104Versendet,
    dauer_ms: dauerMs,
  };

  try {
    await db.insert(auditLog).values({
      nutzerId: null,
      aktion: AUDIT_AKTION_CRON_LAUF,
      metadaten: result,
    });
  } catch {
    // Run-Audit-Failure darf den Return nicht blockieren.
  }

  return Response.json(result);
}

export async function POST(req: Request): Promise<Response> {
  return handler(req);
}

export async function GET(req: Request): Promise<Response> {
  return handler(req);
}

// Anker gegen ungenutzten Import-Warner.
void testSaldo;
void lt;
