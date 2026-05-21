/**
 * POST/GET /api/v1/cron/digest-newsletter
 *
 * Woechentlicher Cron-Job (PRD §8.14, §31, §F-307, T-801).
 * Soll-Lauf: Mittwoch 09:00 Europe/Berlin.
 *
 * Pro aktive Stadt:
 *  - sammelt die 3 neuesten oeffentlichen Werke der letzten Woche
 *    (fallback: top-3 ohne Zeitfilter, damit auch ruhigere Wochen Inhalt haben)
 *  - die 2 naechsten veroeffentlichten Termine
 *  - die 2 zuletzt eingestellten, noch offenen Hilfegesuche
 *
 * Empfaengerkreis pro Stadt:
 *  - status='aktiv'
 *  - benachrichtigungs_einstellungen.stadt_digest !== false (Default true)
 *  - email_verifiziert_am IS NOT NULL
 *
 * Idempotenz:
 *  - dedup per audit_log: pro Nutzer:in und ISO-Woche genau eine Mail.
 *    Schutz gegen Doppellaufe innerhalb derselben Woche.
 *
 * Auth: X-Cron-Secret-Header (401 ohne).
 *
 * PRD-Referenz: §8.14 (Benachrichtigungs-Strategie), §31 (Stadt-Digest-Newsletter,
 * Cron Mittwoch 09:00), §F-307 (Newsletter pro Stadt), §11 (Cron-Liste),
 * §15.15 (Cron-Endpoint-Pattern).
 */

import { and, asc, desc, eq, gt, isNotNull, isNull, or, sql } from 'drizzle-orm';

import { db } from '@/lib/db';
import {
  auditLog,
  hilfegesuch,
  nutzer,
  stadt,
  termin,
  werk,
} from '@/lib/db/schema';
import { requireCronSecret } from '@/lib/auth/cron-secret';
import { sendMail } from '@/lib/email/send';
import { env } from '@/lib/env';
import { de } from '@/i18n/de';

const APP_URL = env.APP_URL.replace(/\/+$/, '');

export const AUDIT_AKTION_DIGEST = 'stadt.digest_versendet';
export const AUDIT_AKTION_CRON_LAUF = 'cron.digest-newsletter';

const SIEBEN_TAGE_MS = 7 * 24 * 60 * 60 * 1000;

interface StadtDigestInhalte {
  werke: Array<{
    id: string;
    name: string;
    kurzbeschreibung: string;
    inhaberAnzeigename: string;
    url: string;
  }>;
  termine: Array<{
    id: string;
    titel: string;
    datumZeitFormatiert: string;
    typLabel: string;
    url: string;
  }>;
  hilfegesuche: Array<{
    id: string;
    titel: string;
    kurzbeschreibung: string;
    url: string;
  }>;
}

function formatDatumZeit(d: Date): string {
  return new Intl.DateTimeFormat('de-DE', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Europe/Berlin',
  }).format(d);
}

function terminTypLabel(t: string): string {
  return (de.termin_typ as Record<string, string>)[t] ?? t;
}

/**
 * Ermittelt die ISO-Wochennummer (Mittwoch-zentriert reicht hier,
 * wir wollen nur einen stabilen Bucket pro Lauf).
 * Format: YYYY-W-XX.
 */
function isoWeekKey(d: Date = new Date()): string {
  // ISO-Woche nach https://en.wikipedia.org/wiki/ISO_8601 — Donnerstag der Woche
  // bestimmt das Jahr. Reicht hier fuer Dedup-Zwecke.
  const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${utc.getUTCFullYear()}-W-${String(weekNo).padStart(2, '0')}`;
}

async function ladeInhalteFuerStadt(
  stadtId: string,
): Promise<StadtDigestInhalte> {
  const sieben = new Date(Date.now() - SIEBEN_TAGE_MS);

  // ── 3 neueste oeffentliche Werke ───────────────────────────────────────
  // Erst Werke der letzten 7 Tage. Wenn keine: fallback ohne Zeitfilter.
  let werkRows = await db
    .select({
      id: werk.id,
      name: werk.name,
      kurzbeschreibung: werk.kurzbeschreibung,
      inhaberAnzeigename: nutzer.anzeigename,
    })
    .from(werk)
    .innerJoin(nutzer, eq(nutzer.id, werk.nutzerId))
    .where(
      and(
        eq(werk.sichtbarkeit, 'oeffentlich'),
        eq(werk.status, 'aktiv'),
        eq(nutzer.stadtId, stadtId),
        eq(nutzer.status, 'aktiv'),
        gt(werk.erstelltAm, sieben),
      ),
    )
    .orderBy(desc(werk.erstelltAm), desc(werk.id))
    .limit(3);

  if (werkRows.length === 0) {
    werkRows = await db
      .select({
        id: werk.id,
        name: werk.name,
        kurzbeschreibung: werk.kurzbeschreibung,
        inhaberAnzeigename: nutzer.anzeigename,
      })
      .from(werk)
      .innerJoin(nutzer, eq(nutzer.id, werk.nutzerId))
      .where(
        and(
          eq(werk.sichtbarkeit, 'oeffentlich'),
          eq(werk.status, 'aktiv'),
          eq(nutzer.stadtId, stadtId),
          eq(nutzer.status, 'aktiv'),
        ),
      )
      .orderBy(desc(werk.aktualisiertAm), desc(werk.id))
      .limit(3);
  }

  const werkeOut = werkRows.map((r) => ({
    id: r.id,
    name: r.name,
    kurzbeschreibung: r.kurzbeschreibung,
    inhaberAnzeigename: r.inhaberAnzeigename,
    url: `${APP_URL}/werke/${r.id}`,
  }));

  // ── 2 naechste veroeffentlichte Termine ────────────────────────────────
  const terminRows = await db
    .select({
      id: termin.id,
      titel: termin.titel,
      typ: termin.typ,
      datumUhrzeit: termin.datumUhrzeit,
    })
    .from(termin)
    .where(
      and(
        eq(termin.stadtId, stadtId),
        eq(termin.status, 'veroeffentlicht'),
        gt(termin.datumUhrzeit, new Date()),
      ),
    )
    .orderBy(asc(termin.datumUhrzeit))
    .limit(2);

  const termineOut = terminRows.map((r) => {
    const d =
      r.datumUhrzeit instanceof Date
        ? r.datumUhrzeit
        : new Date(r.datumUhrzeit as unknown as string);
    return {
      id: r.id,
      titel: r.titel,
      datumZeitFormatiert: formatDatumZeit(d),
      typLabel: terminTypLabel(r.typ),
      url: `${APP_URL}/termine/${r.id}`,
    };
  });

  // ── 2 offene Hilfegesuche ──────────────────────────────────────────────
  const hilfeRows = await db
    .select({
      id: hilfegesuch.id,
      titel: hilfegesuch.titel,
      beschreibung: hilfegesuch.beschreibung,
    })
    .from(hilfegesuch)
    .where(
      and(
        eq(hilfegesuch.stadtId, stadtId),
        eq(hilfegesuch.status, 'offen'),
        gt(hilfegesuch.gueltigBis, new Date()),
      ),
    )
    .orderBy(desc(hilfegesuch.erstelltAm), desc(hilfegesuch.id))
    .limit(2);

  const hilfegesucheOut = hilfeRows.map((r) => ({
    id: r.id,
    titel: r.titel,
    kurzbeschreibung:
      r.beschreibung.length > 200 ? r.beschreibung.slice(0, 200) + '…' : r.beschreibung,
    url: `${APP_URL}/hilfegesuche/${r.id}`,
  }));

  return {
    werke: werkeOut,
    termine: termineOut,
    hilfegesuche: hilfegesucheOut,
  };
}

interface EmpfaengerRow {
  nutzerId: string;
  email: string;
  anzeigename: string;
}

async function ladeEmpfaenger(stadtId: string): Promise<EmpfaengerRow[]> {
  // benachrichtigungs_einstellungen.stadt_digest darf entweder
  // gar nicht gesetzt sein (default true) oder !== false sein.
  const rows = await db
    .select({
      nutzerId: nutzer.id,
      email: nutzer.email,
      anzeigename: nutzer.anzeigename,
    })
    .from(nutzer)
    .where(
      and(
        eq(nutzer.stadtId, stadtId),
        eq(nutzer.status, 'aktiv'),
        isNotNull(nutzer.emailVerifiziertAm),
        or(
          sql`${nutzer.benachrichtigungsEinstellungen} ->> 'stadt_digest' IS NULL`,
          sql`${nutzer.benachrichtigungsEinstellungen} ->> 'stadt_digest' <> 'false'`,
        ),
      ),
    );
  return rows;
}

async function istBereitsVersendet(
  nutzerId: string,
  wocheKey: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: auditLog.id })
    .from(auditLog)
    .where(
      and(
        eq(auditLog.aktion, AUDIT_AKTION_DIGEST),
        eq(auditLog.referenzTyp, 'nutzer'),
        eq(auditLog.referenzId, nutzerId),
        sql`${auditLog.metadaten} ->> 'woche' = ${wocheKey}`,
      ),
    )
    .limit(1);
  return rows.length > 0;
}

async function handler(req: Request): Promise<Response> {
  const denied = requireCronSecret(req);
  if (denied) return denied;

  const startMs = Date.now();
  const wocheKey = isoWeekKey();

  // Alle aktiven Staedte
  const staedte = await db
    .select({ id: stadt.id, name: stadt.name })
    .from(stadt)
    .where(eq(stadt.status, 'aktiv'));

  let versendet = 0;
  let uebersprungen = 0;
  let fehler = 0;

  for (const s of staedte) {
    const inhalte = await ladeInhalteFuerStadt(s.id);
    // Wenn die Stadt diese Woche absolut nichts zu bieten hat (kein Werk,
    // kein Termin, kein Quick-Help) ueberspringen wir den ganzen Lauf —
    // ein leerer Digest waere Spam.
    if (
      inhalte.werke.length === 0 &&
      inhalte.termine.length === 0 &&
      inhalte.hilfegesuche.length === 0
    ) {
      continue;
    }

    const empfaenger = await ladeEmpfaenger(s.id);
    for (const e of empfaenger) {
      if (await istBereitsVersendet(e.nutzerId, wocheKey)) {
        uebersprungen++;
        continue;
      }

      const result = await sendMail({
        to: e.email,
        nutzerId: e.nutzerId,
        template: 'T-801',
        props: {
          stadtName: s.name,
          anzeigename: e.anzeigename,
          werke: inhalte.werke,
          termine: inhalte.termine,
          hilfegesuche: inhalte.hilfegesuche,
          appUrl: APP_URL,
        },
      });

      if (!result.ok) {
        fehler++;
        console.error(
          '[cron digest-newsletter] sendMail T-801 fehlgeschlagen:',
          e.email,
          result.fehler,
        );
        continue;
      }

      try {
        await db.insert(auditLog).values({
          nutzerId: null,
          aktion: AUDIT_AKTION_DIGEST,
          referenzTyp: 'nutzer',
          referenzId: e.nutzerId,
          metadaten: {
            woche: wocheKey,
            stadt_id: s.id,
            werke: inhalte.werke.length,
            termine: inhalte.termine.length,
            hilfegesuche: inhalte.hilfegesuche.length,
          },
        });
      } catch (err) {
        console.error('[cron digest-newsletter] audit-insert fehlgeschlagen:', err);
      }
      versendet++;
    }
  }

  const result = { versendet, uebersprungen, fehler, woche: wocheKey };
  const dauerMs = Date.now() - startMs;
  try {
    await db.insert(auditLog).values({
      nutzerId: null,
      aktion: AUDIT_AKTION_CRON_LAUF,
      metadaten: { ...result, dauer_ms: dauerMs },
    });
  } catch {
    // Audit-Failure tolerabel — der Versand-Return-Wert ist wichtiger.
  }

  return Response.json(result);
}

export async function POST(req: Request): Promise<Response> {
  return handler(req);
}

export async function GET(req: Request): Promise<Response> {
  return handler(req);
}

// Anker fuer aktuell unbenutzten Import (verhindert Tree-Shaker-Probleme
// in seltenen Build-Konstellationen).
void isNull;
