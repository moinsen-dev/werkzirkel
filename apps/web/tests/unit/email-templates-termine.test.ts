/**
 * Snapshot- und Sprach-Tests fuer die Termin-Lifecycle-Templates
 * T-401..T-404.
 *
 * Parallel zu `email-templates-pruefrunden.test.ts` (T-101..T-104)
 * gehalten — gleiche Struktur, gleiche Sprach-Checks, eigene
 * Snapshot-Datei.
 */

import { describe, it, expect } from 'vitest';
import { renderMail, sendMail, type MailTemplate } from '@/lib/email/send';

const APP_URL = 'https://werkzirkel.de';

/** Verbotene Englisch-Fragmente (case-insensitive geprueft). */
const VERBOTENE_ENGLISCH_BEGRIFFE = [
  'Hello',
  'Welcome',
  'Click here',
  'Login',
  'Sign in',
  'Sign up',
  'Best regards',
  'Reminder',
  'Deadline',
  'Thanks',
  'Confirmed',
  'Cancelled',
  'Save the date',
  'RSVP',
] as const;

/** Tabelle der Templates plus erwartete deutsche Phrasen. */
const TEMPLATES: Array<{
  name: string;
  opts: MailTemplate;
  betreff: string;
  bodyPhrasen: string[];
}> = [
  {
    name: 'T-401 termin-anmeldung-bestaetigt (regulaer)',
    opts: {
      template: 'T-401',
      props: {
        terminTitel: 'Open Co-Working Hamburg',
        terminTyp: 'Praesenz-Treffen',
        terminDatum: '16. Mai 2026',
        terminUhrzeit: '18:30',
        ortText: 'Werkraum Altona, Hamburg',
        terminUrl: 'https://werkzirkel.de/termine/t-1',
        icalUrl: 'https://werkzirkel.de/api/v1/termine/t-1/ical',
        slotPosition: 'angemeldet',
        appUrl: APP_URL,
      },
    },
    betreff: 'Deine Termin-Anmeldung im Werkzirkel',
    bodyPhrasen: [
      'Anmeldung ist bestätigt',
      'Open Co-Working Hamburg',
      'Werkraum Altona',
      '16. Mai 2026',
    ],
  },
  {
    name: 'T-401 termin-anmeldung-bestaetigt (warteliste)',
    opts: {
      template: 'T-401',
      props: {
        terminTitel: 'Online-Co-Working',
        terminTyp: 'Online-Co-Working',
        terminDatum: '20. Mai 2026',
        terminUhrzeit: '19:00',
        onlineLink: 'https://meet.werkzirkel.de/cw-20',
        terminUrl: 'https://werkzirkel.de/termine/t-2',
        icalUrl: 'https://werkzirkel.de/api/v1/termine/t-2/ical',
        slotPosition: 'warteliste',
        appUrl: APP_URL,
      },
    },
    betreff: 'Deine Termin-Anmeldung im Werkzirkel',
    bodyPhrasen: ['Warteliste', 'Online-Co-Working', '20. Mai 2026'],
  },
  {
    name: 'T-402 termin-erinnerung-7d',
    opts: {
      template: 'T-402',
      props: {
        terminTitel: 'Werkstatt-Tag Bremen',
        terminTyp: 'Praesenz-Treffen',
        terminDatum: '23. Mai 2026',
        terminUhrzeit: '10:00',
        ortText: 'Maker-Space Neustadt, Bremen',
        terminUrl: 'https://werkzirkel.de/termine/t-3',
        icalUrl: 'https://werkzirkel.de/api/v1/termine/t-3/ical',
        appUrl: APP_URL,
      },
    },
    betreff: 'Erinnerung: dein Werkzirkel-Termin in einer Woche',
    bodyPhrasen: [
      'In einer Woche',
      'Werkstatt-Tag Bremen',
      'Maker-Space Neustadt',
    ],
  },
  {
    name: 'T-403 termin-erinnerung-1d',
    opts: {
      template: 'T-403',
      props: {
        terminTitel: 'Online-Co-Working',
        terminTyp: 'Online-Co-Working',
        terminDatum: '14. Mai 2026',
        terminUhrzeit: '19:00',
        onlineLink: 'https://meet.werkzirkel.de/cw-14',
        terminUrl: 'https://werkzirkel.de/termine/t-4',
        icalUrl: 'https://werkzirkel.de/api/v1/termine/t-4/ical',
        appUrl: APP_URL,
      },
    },
    betreff: 'Erinnerung: dein Werkzirkel-Termin morgen',
    bodyPhrasen: ['Morgen', 'Online-Co-Working', '19:00'],
  },
  {
    name: 'T-404 termin-abgesagt (mit Grund)',
    opts: {
      template: 'T-404',
      props: {
        terminTitel: 'Werkstatt-Tag Bremen',
        terminTyp: 'Praesenz-Treffen',
        terminDatum: '23. Mai 2026',
        absageGrund: 'Krankheit der Veranstalter:in',
        appUrl: APP_URL,
      },
    },
    betreff: 'Werkzirkel-Termin abgesagt',
    bodyPhrasen: [
      'abgesagt',
      'Werkstatt-Tag Bremen',
      'Krankheit der Veranstalter:in',
    ],
  },
  {
    name: 'T-404 termin-abgesagt (ohne Grund)',
    opts: {
      template: 'T-404',
      props: {
        terminTitel: 'Online-Co-Working',
        terminTyp: 'Online-Co-Working',
        terminDatum: '20. Mai 2026',
        appUrl: APP_URL,
      },
    },
    betreff: 'Werkzirkel-Termin abgesagt',
    bodyPhrasen: ['abgesagt', 'Online-Co-Working', 'Ersatztermin'],
  },
];

describe('E-Mail-Templates Termine: Snapshots + deutsche Strings', () => {
  for (const t of TEMPLATES) {
    describe(t.name, () => {
      it('liefert genau den erwarteten deutschen Betreff', async () => {
        const { betreff } = await renderMail(t.opts);
        expect(betreff).toBe(t.betreff);
      });

      it('rendert die erwarteten deutschen Body-Phrasen', async () => {
        const { html, text } = await renderMail(t.opts);
        const haystack = `${html}\n${text}`;
        for (const phrase of t.bodyPhrasen) {
          expect(haystack).toContain(phrase);
        }
      });

      it('plain-text-Fallback enthaelt nicht-leeren Kern-Inhalt', async () => {
        const { text } = await renderMail(t.opts);
        expect(text.length).toBeGreaterThan(50);
        const hasPhrase = t.bodyPhrasen.some((p) => text.includes(p));
        expect(hasPhrase).toBe(true);
      });

      it('matcht den HTML-Snapshot', async () => {
        const { html } = await renderMail(t.opts);
        expect(html).toMatchSnapshot();
      });
    });
  }

  it('keinerlei englische Verraeter in irgendeinem Termin-Template', async () => {
    const treffer: Array<{ template: string; begriff: string }> = [];

    for (const t of TEMPLATES) {
      const { html, text } = await renderMail(t.opts);
      const haystack = `${html}\n${text}`.toLowerCase();
      for (const begriff of VERBOTENE_ENGLISCH_BEGRIFFE) {
        if (haystack.includes(begriff.toLowerCase())) {
          treffer.push({ template: t.name, begriff });
        }
      }
    }

    if (treffer.length > 0) {
      const msg = treffer
        .map((tr) => `  - ${tr.template}: enthaelt '${tr.begriff}'`)
        .join('\n');
      throw new Error(`Englische Begriffe in deutschen Templates gefunden:\n${msg}`);
    }

    expect(treffer).toEqual([]);
  });

  it('sendMail mit T-401 an Test-Domain liefert mocked=true', async () => {
    const result = await sendMail({
      template: 'T-401',
      to: 'test@example.com',
      props: {
        terminTitel: 'Demo-Termin',
        terminTyp: 'Online-Co-Working',
        terminDatum: '16. Mai 2026',
        terminUhrzeit: '18:30',
        onlineLink: 'https://meet.werkzirkel.de/demo',
        terminUrl: 'https://werkzirkel.de/termine/demo',
        icalUrl: 'https://werkzirkel.de/api/v1/termine/demo/ical',
        slotPosition: 'angemeldet',
        appUrl: APP_URL,
      },
    });
    expect(result.ok).toBe(true);
    expect(result.mocked).toBe(true);
  });

  it('sendMail mit T-402 an Test-Domain liefert mocked=true', async () => {
    const result = await sendMail({
      template: 'T-402',
      to: 'test@example.com',
      props: {
        terminTitel: 'Demo-Termin',
        terminTyp: 'Online-Co-Working',
        terminDatum: '23. Mai 2026',
        terminUhrzeit: '19:00',
        onlineLink: 'https://meet.werkzirkel.de/demo',
        terminUrl: 'https://werkzirkel.de/termine/demo',
        icalUrl: 'https://werkzirkel.de/api/v1/termine/demo/ical',
        appUrl: APP_URL,
      },
    });
    expect(result.ok).toBe(true);
    expect(result.mocked).toBe(true);
  });

  it('sendMail mit T-403 an Test-Domain liefert mocked=true', async () => {
    const result = await sendMail({
      template: 'T-403',
      to: 'test@example.com',
      props: {
        terminTitel: 'Demo-Termin',
        terminTyp: 'Online-Co-Working',
        terminDatum: '14. Mai 2026',
        terminUhrzeit: '19:00',
        onlineLink: 'https://meet.werkzirkel.de/demo',
        terminUrl: 'https://werkzirkel.de/termine/demo',
        icalUrl: 'https://werkzirkel.de/api/v1/termine/demo/ical',
        appUrl: APP_URL,
      },
    });
    expect(result.ok).toBe(true);
    expect(result.mocked).toBe(true);
  });

  it('sendMail mit T-404 an Test-Domain liefert mocked=true', async () => {
    const result = await sendMail({
      template: 'T-404',
      to: 'test@example.com',
      props: {
        terminTitel: 'Demo-Termin',
        terminTyp: 'Online-Co-Working',
        terminDatum: '14. Mai 2026',
        absageGrund: 'Demo-Grund',
        appUrl: APP_URL,
      },
    });
    expect(result.ok).toBe(true);
    expect(result.mocked).toBe(true);
  });
});
