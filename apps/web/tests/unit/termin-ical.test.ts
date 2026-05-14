/**
 * Unit-Tests fuer `buildIcsForTermin` (RFC-5545 iCal-Export).
 *
 * Deckt PRD §8.8 / §15.8:
 *  - VCALENDAR-Rahmen + VTIMEZONE Europe/Berlin.
 *  - CRLF-Linebreaks zwischen Properties.
 *  - DTSTART;TZID=Europe/Berlin mit YYYYMMDDTHHMMSS-Format.
 *  - DTEND = DTSTART + 2h Default-Dauer.
 *  - Sonderzeichen-Escape (Komma, Semikolon, Backslash, Zeilenumbruch).
 *  - STATUS-Mapping veroeffentlicht/durchgefuehrt/abgesagt.
 *  - LOCATION-Fallback auf online_link wenn ort_text fehlt.
 */

import { describe, expect, it } from 'vitest';

import { buildIcsForTermin, formatBerlinTime } from '@/lib/termin/ical';
import type { TerminFuerIcs } from '@/lib/termin/ical';

const APP_URL = 'https://werkzirkel.example';

function mockTermin(overrides: Partial<TerminFuerIcs> = {}): TerminFuerIcs {
  return {
    id: 'tid-123',
    titel: 'Schauabend Mai',
    beschreibung: 'Drei Werke stellen sich vor.',
    ort_text: 'Werkstatt St. Pauli, Hamburg',
    online_link: null,
    // 2026-05-13T17:00:00Z (UTC) → Berlin: 19:00 CEST (DST aktiv im Mai).
    datum_uhrzeit: new Date('2026-05-13T17:00:00Z'),
    status: 'veroeffentlicht',
    typ: 'schauabend',
    ...overrides,
  };
}

describe('buildIcsForTermin — Grundstruktur', () => {
  it('liefert einen String mit BEGIN:VCALENDAR und END:VCALENDAR', () => {
    const ics = buildIcsForTermin(mockTermin(), APP_URL);
    expect(typeof ics).toBe('string');
    expect(ics).toMatch(/^BEGIN:VCALENDAR\r\n/);
    expect(ics).toMatch(/END:VCALENDAR\r\n$/);
  });

  it('enthaelt VTIMEZONE-Block fuer Europe/Berlin mit STANDARD- und DAYLIGHT-Subkomponenten', () => {
    const ics = buildIcsForTermin(mockTermin(), APP_URL);
    expect(ics).toContain('BEGIN:VTIMEZONE');
    expect(ics).toContain('TZID:Europe/Berlin');
    expect(ics).toContain('BEGIN:STANDARD');
    expect(ics).toContain('TZNAME:CET');
    expect(ics).toContain('BEGIN:DAYLIGHT');
    expect(ics).toContain('TZNAME:CEST');
    expect(ics).toContain('END:VTIMEZONE');
  });

  it('hat genau einen VEVENT-Block', () => {
    const ics = buildIcsForTermin(mockTermin(), APP_URL);
    expect(ics.split('BEGIN:VEVENT').length - 1).toBe(1);
    expect(ics.split('END:VEVENT').length - 1).toBe(1);
  });

  it('UID hat das Schema termin-<id>@werkzirkel.de', () => {
    const ics = buildIcsForTermin(mockTermin({ id: 'abc-99' }), APP_URL);
    expect(ics).toContain('UID:termin-abc-99@werkzirkel.de');
  });

  it('URL zeigt auf APP_URL/termine/<id>', () => {
    const ics = buildIcsForTermin(mockTermin({ id: 'abc-99' }), APP_URL);
    expect(ics).toContain(`URL:${APP_URL}/termine/abc-99`);
  });

  it('PRODID identifiziert Werkzirkel', () => {
    const ics = buildIcsForTermin(mockTermin(), APP_URL);
    expect(ics).toContain('PRODID:-//Werkzirkel//DE');
  });
});

describe('buildIcsForTermin — CRLF-Linebreaks', () => {
  it('trennt Properties mit \\r\\n (RFC-5545-Pflicht)', () => {
    const ics = buildIcsForTermin(mockTermin(), APP_URL);
    // Sucht jede Property-Zeile auf "\r\n"-Ende, KEIN reines "\n".
    const lines = ics.split('\r\n');
    expect(lines.length).toBeGreaterThan(15);
    // Keine Property-Linie sollte ein einsames \n enthalten (vor dem nicht-escaped Text).
    // In CRLF-getrennten Strings duerften innerhalb einer "Zeile" keine LFs vorkommen.
    for (const line of lines) {
      expect(line.includes('\n')).toBe(false);
    }
  });
});

describe('buildIcsForTermin — Zeit-Formatierung', () => {
  it('DTSTART hat TZID=Europe/Berlin und 14-stelliges YYYYMMDDTHHMMSS-Format', () => {
    const ics = buildIcsForTermin(mockTermin(), APP_URL);
    const match = ics.match(/DTSTART;TZID=Europe\/Berlin:(\d{8}T\d{6})\r\n/);
    expect(match).not.toBeNull();
    expect(match![1]!.length).toBe(15); // 8 Datum + 'T' + 6 Zeit
  });

  it('DTEND ist DTSTART + 2 Stunden', () => {
    const ics = buildIcsForTermin(mockTermin(), APP_URL);
    const startMatch = ics.match(/DTSTART;TZID=Europe\/Berlin:(\d{8}T\d{6})\r\n/);
    const endMatch = ics.match(/DTEND;TZID=Europe\/Berlin:(\d{8}T\d{6})\r\n/);
    expect(startMatch).not.toBeNull();
    expect(endMatch).not.toBeNull();
    // Mock-Termin: 17:00 UTC = 19:00 Berlin (CEST). +2h = 21:00 Berlin.
    expect(startMatch![1]!.slice(9, 15)).toBe('190000');
    expect(endMatch![1]!.slice(9, 15)).toBe('210000');
    // Beide am gleichen Tag.
    expect(startMatch![1]!.slice(0, 8)).toBe('20260513');
    expect(endMatch![1]!.slice(0, 8)).toBe('20260513');
  });

  it('formatBerlinTime liefert CET-Zeit im Winter (DST inaktiv)', () => {
    // 2026-01-15T13:00:00Z = 14:00 Berlin (CET, UTC+1).
    const out = formatBerlinTime(new Date('2026-01-15T13:00:00Z'));
    expect(out).toBe('20260115T140000');
  });

  it('formatBerlinTime liefert CEST-Zeit im Sommer (DST aktiv)', () => {
    // 2026-07-15T13:00:00Z = 15:00 Berlin (CEST, UTC+2).
    const out = formatBerlinTime(new Date('2026-07-15T13:00:00Z'));
    expect(out).toBe('20260715T150000');
  });

  it('DTSTAMP ist UTC mit Z-Suffix', () => {
    const ics = buildIcsForTermin(mockTermin(), APP_URL);
    expect(ics).toMatch(/DTSTAMP:\d{8}T\d{6}Z\r\n/);
  });
});

describe('buildIcsForTermin — Sonderzeichen-Escape (RFC-5545 §3.3.11)', () => {
  it('Komma im Titel wird zu \\,', () => {
    const ics = buildIcsForTermin(
      mockTermin({ titel: 'Drei, vier, fuenf Werke' }),
      APP_URL,
    );
    expect(ics).toContain('SUMMARY:Drei\\, vier\\, fuenf Werke');
  });

  it('Semikolon im Titel wird zu \\;', () => {
    const ics = buildIcsForTermin(
      mockTermin({ titel: 'Schauabend; alle willkommen' }),
      APP_URL,
    );
    expect(ics).toContain('SUMMARY:Schauabend\\; alle willkommen');
  });

  it('Backslash im Titel wird zu \\\\', () => {
    const ics = buildIcsForTermin(
      mockTermin({ titel: 'Pfad C:\\Werkzirkel' }),
      APP_URL,
    );
    expect(ics).toContain('SUMMARY:Pfad C:\\\\Werkzirkel');
  });

  it('Zeilenumbruch in Beschreibung wird zu \\n', () => {
    const ics = buildIcsForTermin(
      mockTermin({ beschreibung: 'Zeile 1\nZeile 2\nZeile 3' }),
      APP_URL,
    );
    // Beschreibung enthaelt \n im Output (literal "\n" als zwei Zeichen), aber
    // KEIN echtes Newline mehr innerhalb der DESCRIPTION-Property.
    const descLineMatch = ics.match(/DESCRIPTION:([^\r]*)\r\n/);
    expect(descLineMatch).not.toBeNull();
    expect(descLineMatch![1]!).toContain('Zeile 1\\nZeile 2\\nZeile 3');
    expect(descLineMatch![1]!).not.toMatch(/[\n\r]/);
  });

  it('alle vier Sonderzeichen kombiniert im Titel', () => {
    const ics = buildIcsForTermin(
      mockTermin({ titel: 'a,b;c\\d\ne' }),
      APP_URL,
    );
    expect(ics).toContain('SUMMARY:a\\,b\\;c\\\\d\\ne');
  });
});

describe('buildIcsForTermin — STATUS-Mapping', () => {
  it("status='veroeffentlicht' → STATUS:CONFIRMED", () => {
    const ics = buildIcsForTermin(mockTermin({ status: 'veroeffentlicht' }), APP_URL);
    expect(ics).toContain('STATUS:CONFIRMED');
  });

  it("status='durchgefuehrt' → STATUS:CONFIRMED", () => {
    const ics = buildIcsForTermin(mockTermin({ status: 'durchgefuehrt' }), APP_URL);
    expect(ics).toContain('STATUS:CONFIRMED');
  });

  it("status='abgesagt' → STATUS:CANCELLED", () => {
    const ics = buildIcsForTermin(mockTermin({ status: 'abgesagt' }), APP_URL);
    expect(ics).toContain('STATUS:CANCELLED');
  });

  it("status='geplant' → STATUS:TENTATIVE", () => {
    const ics = buildIcsForTermin(mockTermin({ status: 'geplant' }), APP_URL);
    expect(ics).toContain('STATUS:TENTATIVE');
  });
});

describe('buildIcsForTermin — LOCATION-Fallback', () => {
  it('LOCATION = ort_text wenn gesetzt', () => {
    const ics = buildIcsForTermin(
      mockTermin({ ort_text: 'Werkstatt St. Pauli', online_link: 'https://meet.example' }),
      APP_URL,
    );
    expect(ics).toContain('LOCATION:Werkstatt St. Pauli');
  });

  it('LOCATION faellt auf online_link zurueck, wenn ort_text fehlt', () => {
    const ics = buildIcsForTermin(
      mockTermin({ ort_text: null, online_link: 'https://meet.example/room/42' }),
      APP_URL,
    );
    expect(ics).toContain('LOCATION:https://meet.example/room/42');
  });

  it('LOCATION ist leer, wenn weder ort_text noch online_link gesetzt sind', () => {
    const ics = buildIcsForTermin(
      mockTermin({ ort_text: null, online_link: null }),
      APP_URL,
    );
    expect(ics).toMatch(/LOCATION:\r\n/);
  });

  it('LOCATION faellt auf online_link zurueck, wenn ort_text ein leerer String ist', () => {
    const ics = buildIcsForTermin(
      mockTermin({ ort_text: '   ', online_link: 'https://meet.example/room/42' }),
      APP_URL,
    );
    expect(ics).toContain('LOCATION:https://meet.example/room/42');
  });
});

describe('buildIcsForTermin — DESCRIPTION enthaelt Detail-Link', () => {
  it('DESCRIPTION enthaelt Beschreibung + Termin-Detail-URL', () => {
    const ics = buildIcsForTermin(
      mockTermin({ id: 'xyz', beschreibung: 'Mein Text' }),
      APP_URL,
    );
    const descLineMatch = ics.match(/DESCRIPTION:([^\r]*)\r\n/);
    expect(descLineMatch).not.toBeNull();
    expect(descLineMatch![1]!).toContain('Mein Text');
    expect(descLineMatch![1]!).toContain(`${APP_URL}/termine/xyz`);
  });
});
