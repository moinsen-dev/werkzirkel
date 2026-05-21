/**
 * Snapshot- und Sprach-Tests fuer die Pruefrunden-Lifecycle-Templates
 * T-101..T-104.
 *
 * Parallel zu `email-templates.test.ts` fuer T-001..T-005 — getrennt
 * gehalten, damit die Snapshots der schon stabilen Templates beim
 * Pruefrunden-Build nicht touched werden muessen.
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
] as const;

/** Tabelle der Templates plus erwartete deutsche Phrasen. */
const TEMPLATES: Array<{
  name: string;
  opts: MailTemplate;
  betreff: string;
  bodyPhrasen: string[];
}> = [
  {
    name: 'T-101 pruefrunde-neue-anmeldung',
    opts: {
      template: 'T-101',
      props: {
        werkName: 'Werkzirkel-Onboarding-App',
        pruefrundeTitel: 'Erster Test der Onboarding-Strecke',
        testerAnzeigename: 'Jana',
        pruefrundeUrl: 'https://werkzirkel.de/pruefrunden/p-1',
        anzahlAngemeldet: 2,
        gesuchteTester: 5,
        appUrl: APP_URL,
      },
    },
    betreff: 'Neue Anmeldung zu deiner Feedback-Loop',
    bodyPhrasen: ['Jana', 'Onboarding-Strecke', 'Werkzirkel-Onboarding-App'],
  },
  {
    name: 'T-102 pruefrunde-neues-feedback',
    opts: {
      template: 'T-102',
      props: {
        werkName: 'Werkzirkel-Onboarding-App',
        pruefrundeTitel: 'Erster Test der Onboarding-Strecke',
        pruefrundeUrl: 'https://werkzirkel.de/pruefrunden/p-1',
        anzahlFeedbacks: 3,
        appUrl: APP_URL,
      },
    },
    betreff: 'Neues Feedback zu deinem Werk',
    bodyPhrasen: ['neues Feedback', 'Rückmeldungen erhalten'],
  },
  {
    name: 'T-103 reziprozitaet-frist-3d',
    opts: {
      template: 'T-103',
      props: {
        fristFormatted: '16. Mai 2026',
        offeneAnzahl: 2,
        pruefrundenSucheUrl: 'https://werkzirkel.de/pruefrunden?stadt=hh',
        appUrl: APP_URL,
      },
    },
    betreff: 'Deine Gegenseitigkeits-Frist endet in 3 Tagen',
    bodyPhrasen: ['Gegenseitigkeits-Frist', '16. Mai 2026', '3 Tage'],
  },
  {
    name: 'T-104 reziprozitaet-frist-1d',
    opts: {
      template: 'T-104',
      props: {
        fristFormatted: '14. Mai 2026',
        offeneAnzahl: 1,
        pruefrundenSucheUrl: 'https://werkzirkel.de/pruefrunden?stadt=hh',
        appUrl: APP_URL,
      },
    },
    betreff: 'Deine Gegenseitigkeits-Frist endet morgen',
    bodyPhrasen: ['morgen', '14. Mai 2026', 'keine neuen'],
  },
];

describe('E-Mail-Templates Pruefrunden: Snapshots + deutsche Strings', () => {
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
        // Plain-Text muss substantiell sein (>50 Zeichen) und mindestens
        // eine erwartete Phrase enthalten — leere Plain-Text-Varianten
        // sind ein klassischer react-email-Fallstrick.
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

  it('keinerlei englische Verraeter in irgendeinem Pruefrunden-Template', async () => {
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

  it('sendMail mit T-101 an Test-Domain liefert mocked=true', async () => {
    const result = await sendMail({
      template: 'T-101',
      to: 'test@example.com',
      props: {
        werkName: 'Demo-Werk',
        pruefrundeTitel: 'Demo-Pruefrunde',
        testerAnzeigename: 'Demo-Tester',
        pruefrundeUrl: 'https://werkzirkel.de/pruefrunden/demo',
        anzahlAngemeldet: 1,
        gesuchteTester: 3,
        appUrl: APP_URL,
      },
    });
    expect(result.ok).toBe(true);
    expect(result.mocked).toBe(true);
  });
});
