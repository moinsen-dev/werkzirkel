/**
 * POST/GET /api/v1/cron/termin-erinnerung-versenden
 *
 * Stuendlicher Cron-Job (PRD §11, §F-405). Versendet T-402 (7 Tage vor Termin)
 * und T-403 (1 Tag vor Termin) an alle als 'angemeldet' eingetragenen
 * Teilnehmer:innen veroeffentlichter Termine. Wartelisten-Personen bekommen
 * KEINE Erinnerung (sie sind noch nicht fest dabei).
 *
 * Idempotenz pro `termin_anmeldung`-Row via `audit_log`-Eintrag:
 *   aktion='termin.erinnerung-7d' bzw. 'termin.erinnerung-1d',
 *   referenz_typ='termin_anmeldung', referenz_id=<anmeldung-id>.
 *
 * Auth: `X-Cron-Secret`-Header (401 ohne).
 *
 * PRD-Referenz: §F-405 (E-Mail-Erinnerungen vor Termin), §11 (Cron-Liste),
 * §15.15 (Cron-Endpoint-Pattern).
 */

import { and, between, eq, gt, sql } from 'drizzle-orm';

import { db } from '@/lib/db';
import {
  auditLog,
  nutzer,
  termin,
  terminAnmeldung,
} from '@/lib/db/schema';
import { requireCronSecret } from '@/lib/auth/cron-secret';
import { sendMail } from '@/lib/email/send';
import { env } from '@/lib/env';

// ── Konstanten ──────────────────────────────────────────────────────────────
const STUNDE_MS = 60 * 60 * 1000;
const TAG_MS = 24 * STUNDE_MS;

// Stuendlicher Cron → wir nehmen +/- 1h um den Soll-Zeitpunkt als Fenster.
// 7d-Fenster: [now+6d23h, now+7d1h]
// 1d-Fenster: [now+23h, now+25h]
const ERINNERUNGS_FENSTER_MS = STUNDE_MS;

// Dedup-Fenster: ein Eintrag pro Anmeldung pro Aktion. Wir schauen 8 Tage
// zurueck (etwas mehr als das 7d-Fenster), damit auch bei Drift garantiert
// keine zweite 7d-Mail rausgeht.
const AUDIT_DEDUP_FENSTER_MS = 8 * TAG_MS;

// Audit-Aktion-Konstanten — exportiert fuer direkten Test-Zugriff.
export const AUDIT_AKTION_ERINNERUNG_7D = 'termin.erinnerung-7d';
export const AUDIT_AKTION_ERINNERUNG_1D = 'termin.erinnerung-1d';
export const AUDIT_AKTION_CRON_LAUF = 'cron.termin-erinnerung-versenden';

// Konsistent mit dem Anmeldungs-Endpoint.
const TERMIN_TYP_LABEL: Record<string, string> = {
  pruefabend: 'Pruefabend',
  schauabend: 'Demo Night',
  bedarfsschau: 'Briefing Night',
  baurunde: 'Build-Runde',
  werkgespraech: 'Werkgespraech',
  kennenlernrunde: 'Kennenlernrunde',
};

const APP_URL = env.APP_URL.replace(/\/+$/, '');

// ── Helpers ─────────────────────────────────────────────────────────────────

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

interface ErinnerungsKandidat {
  anmeldungId: string;
  nutzerId: string;
  email: string;
  terminId: string;
  terminTitel: string;
  terminTyp: string;
  datumUhrzeit: Date;
  ortText: string | null;
  onlineLink: string | null;
}

/**
 * Holt alle Anmeldungen (status='angemeldet') zu veroeffentlichten Terminen,
 * deren `datum_uhrzeit` im angegebenen Fenster um `now + offsetMs` liegt.
 * Wartelisten- und stornierte Anmeldungen werden NICHT zurueckgegeben — die
 * sollen keine Erinnerung bekommen.
 */
async function findeKandidaten(offsetMs: number): Promise<ErinnerungsKandidat[]> {
  const jetzt = Date.now();
  const fensterStart = new Date(jetzt + offsetMs - ERINNERUNGS_FENSTER_MS);
  const fensterEnde = new Date(jetzt + offsetMs + ERINNERUNGS_FENSTER_MS);

  const rows = await db
    .select({
      anmeldungId: terminAnmeldung.id,
      nutzerId: terminAnmeldung.nutzerId,
      email: nutzer.email,
      terminId: termin.id,
      terminTitel: termin.titel,
      terminTyp: termin.typ,
      datumUhrzeit: termin.datumUhrzeit,
      ortText: termin.ortText,
      onlineLink: termin.onlineLink,
    })
    .from(terminAnmeldung)
    .innerJoin(termin, eq(terminAnmeldung.terminId, termin.id))
    .innerJoin(nutzer, eq(terminAnmeldung.nutzerId, nutzer.id))
    .where(
      and(
        eq(terminAnmeldung.status, 'angemeldet'),
        eq(termin.status, 'veroeffentlicht'),
        between(termin.datumUhrzeit, fensterStart, fensterEnde),
      ),
    );

  // datum_uhrzeit defensiv in Date wrappen — postgres-js liefert manchmal
  // String/Date-Mix bei timestamp-Spalten.
  return rows.map((r) => ({
    anmeldungId: r.anmeldungId,
    nutzerId: r.nutzerId,
    email: r.email,
    terminId: r.terminId,
    terminTitel: r.terminTitel,
    terminTyp: r.terminTyp,
    datumUhrzeit:
      r.datumUhrzeit instanceof Date
        ? r.datumUhrzeit
        : new Date(r.datumUhrzeit as unknown as string),
    ortText: r.ortText,
    onlineLink: r.onlineLink,
  }));
}

/**
 * Prueft via audit_log, ob fuer die Anmeldung bereits eine Erinnerung dieser
 * Aktion innerhalb von AUDIT_DEDUP_FENSTER_MS versendet wurde.
 */
async function bereitsBenachrichtigt(
  anmeldungId: string,
  aktion: string,
): Promise<boolean> {
  const schwelle = new Date(Date.now() - AUDIT_DEDUP_FENSTER_MS);
  const rows = await db
    .select({ id: auditLog.id })
    .from(auditLog)
    .where(
      and(
        eq(auditLog.aktion, aktion),
        eq(auditLog.referenzId, anmeldungId),
        gt(auditLog.erstelltAm, schwelle),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/**
 * Versendet die Erinnerungs-Mail und schreibt den Dedup-Audit-Eintrag.
 * Bei Send-Failure wird KEIN audit_log-Eintrag geschrieben — der naechste
 * Cron-Lauf darf es erneut versuchen.
 */
async function versendeErinnerung(opts: {
  template: 'T-402' | 'T-403';
  aktion: string;
  kandidat: ErinnerungsKandidat;
}): Promise<boolean> {
  const { template, aktion, kandidat } = opts;

  const result = await sendMail({
    to: kandidat.email,
    nutzerId: kandidat.nutzerId,
    template,
    props: {
      terminTitel: kandidat.terminTitel,
      terminTyp: TERMIN_TYP_LABEL[kandidat.terminTyp] ?? kandidat.terminTyp,
      terminDatum: formatDatum(kandidat.datumUhrzeit),
      terminUhrzeit: formatUhrzeit(kandidat.datumUhrzeit),
      ...(kandidat.ortText ? { ortText: kandidat.ortText } : {}),
      ...(kandidat.onlineLink ? { onlineLink: kandidat.onlineLink } : {}),
      terminUrl: `${APP_URL}/termine/${kandidat.terminId}`,
      icalUrl: `${APP_URL}/api/v1/termine/${kandidat.terminId}/ical`,
    },
  });

  if (!result.ok) {
    console.error(
      '[cron termin-erinnerung] sendMail failed:',
      template,
      kandidat.anmeldungId,
      result.fehler,
    );
    return false;
  }

  try {
    await db.insert(auditLog).values({
      nutzerId: null,
      aktion,
      referenzTyp: 'termin_anmeldung',
      referenzId: kandidat.anmeldungId,
      metadaten: {
        template,
        termin_id: kandidat.terminId,
        nutzer_id: kandidat.nutzerId,
        datum_iso: kandidat.datumUhrzeit.toISOString(),
      },
    });
  } catch (err) {
    // Audit-Insert-Failure → moegliche Doppel-Mail beim naechsten Lauf,
    // tolerierbar (besser als versendete Mail ohne Spur).
    console.error('[cron termin-erinnerung] audit-insert failed:', err);
  }
  return true;
}

async function verarbeite(opts: {
  template: 'T-402' | 'T-403';
  aktion: string;
  offsetMs: number;
}): Promise<number> {
  const kandidaten = await findeKandidaten(opts.offsetMs);
  let versendet = 0;
  for (const k of kandidaten) {
    if (await bereitsBenachrichtigt(k.anmeldungId, opts.aktion)) continue;
    const ok = await versendeErinnerung({
      template: opts.template,
      aktion: opts.aktion,
      kandidat: k,
    });
    if (ok) versendet++;
  }
  return versendet;
}

// ── Handler ─────────────────────────────────────────────────────────────────

async function handler(req: Request): Promise<Response> {
  const denied = requireCronSecret(req);
  if (denied) return denied;

  const startMs = Date.now();

  const t402Versendet = await verarbeite({
    template: 'T-402',
    aktion: AUDIT_AKTION_ERINNERUNG_7D,
    offsetMs: 7 * TAG_MS,
  });

  const t403Versendet = await verarbeite({
    template: 'T-403',
    aktion: AUDIT_AKTION_ERINNERUNG_1D,
    offsetMs: 1 * TAG_MS,
  });

  const dauerMs = Date.now() - startMs;
  const result = {
    t402_versendet: t402Versendet,
    t403_versendet: t403Versendet,
  };

  try {
    await db.insert(auditLog).values({
      nutzerId: null,
      aktion: AUDIT_AKTION_CRON_LAUF,
      metadaten: { ...result, dauer_ms: dauerMs },
    });
  } catch {
    // Cron-Run-Audit-Failure darf den Return nicht blockieren.
  }

  return Response.json(result);
}

export async function POST(req: Request): Promise<Response> {
  return handler(req);
}

export async function GET(req: Request): Promise<Response> {
  return handler(req);
}

// Anker fuer aktuell unbenutzten Import (kann spaeter bei Erweiterungen
// wegfallen).
void sql;
