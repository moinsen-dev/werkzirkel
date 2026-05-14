/**
 * iCalendar-Export (RFC-5545) fuer Termine.
 *
 * Werkzirkel-Konventionen:
 *  - Zeitzone: Europe/Berlin als VTIMEZONE im .ics.
 *  - Zeilenumbruch: CRLF (\r\n) zwischen Properties — RFC-Pflicht.
 *  - Default-Termin-Dauer: 2 Stunden ab `datum_uhrzeit`.
 *  - Sonderzeichen werden gemaess RFC-5545 §3.3.11 escaped:
 *      `\\` → `\\\\`,  `;` → `\\;`,  `,` → `\\,`,  Zeilenumbruch → `\\n`.
 *  - UID-Schema: `termin-<id>@werkzirkel.de`.
 *  - STATUS-Mapping: veroeffentlicht/durchgefuehrt → CONFIRMED,
 *                    abgesagt → CANCELLED,
 *                    geplant → TENTATIVE.
 *
 * Kein NPM-Paket — String-Template ist ausreichend. Wird vom GET-iCal-Endpoint
 * und der T-401-Bestaetigungs-Mail verlinkt.
 */

import type { TerminStatus } from '@/lib/db/schema/enums';

/** Minimal-Termin-Shape, der vom Helper benoetigt wird. */
export interface TerminFuerIcs {
  id: string;
  titel: string;
  beschreibung: string;
  ort_text: string | null;
  online_link: string | null;
  datum_uhrzeit: Date;
  status: TerminStatus;
  typ: string;
}

/**
 * Escapt RFC-5545-Sonderzeichen in einem TEXT-Property-Wert.
 * Reihenfolge wichtig: Backslash zuerst, sonst werden eingefuegte
 * Backslashes der anderen Escapes ein zweites Mal escaped.
 */
function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r\n/g, '\\n')
    .replace(/\r/g, '\\n')
    .replace(/\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

/**
 * Pad-Helper fuer 2-stellige Zahlen.
 */
function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/**
 * Formatiert ein Date als YYYYMMDDTHHMMSS in Europe/Berlin (lokale Zeit,
 * KEIN Z-Suffix — die Zeitzone wird per TZID separat angegeben).
 *
 * Trick mit Intl.DateTimeFormat in `sv-SE`-Locale: liefert
 * "YYYY-MM-DD HH:MM:SS" zuverlaessig in der Ziel-Zeitzone, ohne dass wir
 * DST-Logik selbst rechnen muessen.
 */
export function formatBerlinTime(d: Date): string {
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(d);

  const get = (type: string): string =>
    parts.find((p) => p.type === type)?.value ?? '00';

  // Edge case: Intl liefert "24" als Stunde fuer Mitternacht in einigen
  // Engines — auf "00" normalisieren.
  const hour = get('hour') === '24' ? '00' : get('hour');

  return `${get('year')}${get('month')}${get('day')}T${hour}${get('minute')}${get('second')}`;
}

/**
 * Formatiert ein Date als YYYYMMDDTHHMMSSZ in UTC — fuer DTSTAMP.
 */
function formatUtcStamp(d: Date): string {
  return (
    `${d.getUTCFullYear()}` +
    `${pad2(d.getUTCMonth() + 1)}` +
    `${pad2(d.getUTCDate())}T` +
    `${pad2(d.getUTCHours())}` +
    `${pad2(d.getUTCMinutes())}` +
    `${pad2(d.getUTCSeconds())}Z`
  );
}

/**
 * Mappt den Termin-Status auf den iCal-STATUS-Wert.
 */
function mapStatus(status: TerminStatus): 'CONFIRMED' | 'CANCELLED' | 'TENTATIVE' {
  if (status === 'abgesagt') return 'CANCELLED';
  if (status === 'veroeffentlicht' || status === 'durchgefuehrt') return 'CONFIRMED';
  return 'TENTATIVE';
}

/** Standard-Default-Dauer eines Termins, falls keine Endzeit gespeichert ist. */
const DEFAULT_DAUER_MS = 2 * 60 * 60 * 1000;

/**
 * Baut den .ics-Body fuer einen einzelnen Termin.
 *
 * RFC-5545-konform: CRLF-Linebreaks, VTIMEZONE fuer Europe/Berlin, alle
 * Sonderzeichen in TEXT-Properties (SUMMARY/DESCRIPTION/LOCATION) escaped.
 */
export function buildIcsForTermin(termin: TerminFuerIcs, appUrl: string): string {
  const dtStart = formatBerlinTime(termin.datum_uhrzeit);
  const dtEnd = formatBerlinTime(
    new Date(termin.datum_uhrzeit.getTime() + DEFAULT_DAUER_MS),
  );
  const dtStamp = formatUtcStamp(new Date());
  const uid = `termin-${termin.id}@werkzirkel.de`;
  const url = `${appUrl}/termine/${termin.id}`;
  const status = mapStatus(termin.status);

  // LOCATION: ort_text bevorzugt, sonst online_link, sonst leer.
  const ortRaw = termin.ort_text ?? '';
  const linkRaw = termin.online_link ?? '';
  const locationRaw = ortRaw.trim() ? ortRaw : linkRaw;

  // DESCRIPTION: beschreibung + Link auf Detail-Seite.
  const descriptionRaw = `${termin.beschreibung}\n\nMehr Infos: ${url}`;

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Werkzirkel//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VTIMEZONE',
    'TZID:Europe/Berlin',
    'BEGIN:STANDARD',
    'DTSTART:19701025T030000',
    'RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=10',
    'TZOFFSETFROM:+0200',
    'TZOFFSETTO:+0100',
    'TZNAME:CET',
    'END:STANDARD',
    'BEGIN:DAYLIGHT',
    'DTSTART:19700329T020000',
    'RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=3',
    'TZOFFSETFROM:+0100',
    'TZOFFSETTO:+0200',
    'TZNAME:CEST',
    'END:DAYLIGHT',
    'END:VTIMEZONE',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART;TZID=Europe/Berlin:${dtStart}`,
    `DTEND;TZID=Europe/Berlin:${dtEnd}`,
    `SUMMARY:${escapeIcsText(termin.titel)}`,
    `DESCRIPTION:${escapeIcsText(descriptionRaw)}`,
    `LOCATION:${escapeIcsText(locationRaw)}`,
    `URL:${url}`,
    `STATUS:${status}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  // CRLF zwischen Properties, plus abschliessendes CRLF.
  return lines.join('\r\n') + '\r\n';
}
