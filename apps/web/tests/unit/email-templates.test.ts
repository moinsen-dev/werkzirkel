/**
 * Snapshot- und Sprach-Tests fuer alle E-Mail-Templates T-001..T-005.
 *
 * Jeder Snapshot stellt sicher, dass das HTML nicht ungewollt mutiert.
 * Pro Template gibt es zusaetzlich:
 * - eine harte Assertion auf den deutschen Betreff (genau wie an den
 *   Empfaenger ausgeliefert),
 * - eine Phrase-Assertion auf eine erwartete deutsche Body-Stelle (verhindert
 *   leere Layouts ohne Inhalt).
 *
 * Plus ein Global-Test: NIEMALS englische Fingerabdrucke in einem
 * gerenderten HTML — Werkzirkel-Mails sind durchgaengig deutsch.
 */

import { describe, it, expect } from 'vitest';
import { renderMail, type MailTemplate } from '@/lib/email/send';

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
] as const;

/** Eine Tabelle der zu testenden Templates mit erwarteten deutschen Phrasen. */
const TEMPLATES: Array<{
  name: string;
  opts: MailTemplate;
  betreff: string;
  bodyPhrase: string;
}> = [
  {
    name: 'T-001 magic-link-login',
    opts: {
      template: 'T-001',
      props: {
        magicLinkUrl: 'https://werkzirkel.de/api/v1/auth/magic-link/verify?token=demo',
        expiresInMinutes: 15,
        appUrl: APP_URL,
      },
    },
    betreff: 'Dein Anmelde-Link für den Werkzirkel',
    bodyPhrase: 'Anmelde-Link',
  },
  {
    name: 'T-002 magic-link-registrierung',
    opts: {
      template: 'T-002',
      props: {
        magicLinkUrl: 'https://werkzirkel.de/api/v1/auth/magic-link/verify?token=demo',
        anzeigename: 'Jana',
        appUrl: APP_URL,
      },
    },
    betreff: 'Willkommen im Werkzirkel — bestätige deine E-Mail',
    bodyPhrase: 'bestätige deine E-Mail',
  },
  {
    name: 'T-003 konto-loeschung-bestaetigung',
    opts: {
      template: 'T-003',
      props: {
        confirmUrl: 'https://werkzirkel.de/api/v1/me/confirm-deletion?token=demo',
        appUrl: APP_URL,
      },
    },
    betreff: 'Bitte bestätige die Löschung deines Werkzirkel-Kontos',
    bodyPhrase: 'Löschung deines Werkzirkel-Kontos',
  },
  {
    name: 'T-004 konto-loeschung-erinnerung',
    opts: {
      template: 'T-004',
      props: {
        cancelUrl: 'https://werkzirkel.de/api/v1/me/cancel-deletion',
        deletionDate: '15. Mai 2026',
        appUrl: APP_URL,
      },
    },
    betreff: 'Dein Konto wird in 2 Tagen gelöscht',
    bodyPhrase: 'in 2 Tagen gelöscht',
  },
  {
    name: 'T-005 konto-geloescht',
    opts: {
      template: 'T-005',
      props: {
        anzeigename: 'Jana',
        appUrl: APP_URL,
      },
    },
    betreff: 'Dein Werkzirkel-Konto wurde gelöscht',
    bodyPhrase: 'endgültig gelöscht',
  },
];

describe('E-Mail-Templates: Snapshots + deutsche Strings', () => {
  for (const t of TEMPLATES) {
    describe(t.name, () => {
      it('liefert genau den erwarteten deutschen Betreff', async () => {
        const { betreff } = await renderMail(t.opts);
        expect(betreff).toBe(t.betreff);
      });

      it('rendert die erwartete deutsche Body-Phrase', async () => {
        const { html, text } = await renderMail(t.opts);
        // Phrasen muessen entweder im HTML oder im Plain-Text auftauchen —
        // beides ist gleichwertig fuer den Empfaenger.
        const haystack = `${html}\n${text}`;
        expect(haystack).toContain(t.bodyPhrase);
      });

      it('matcht den HTML-Snapshot', async () => {
        const { html } = await renderMail(t.opts);
        expect(html).toMatchSnapshot();
      });
    });
  }

  it('keinerlei englische Verraeter in irgendeinem Template', async () => {
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
      // freundliche Fehlermeldung mit allen Fundstellen
      const msg = treffer
        .map((tr) => `  - ${tr.template}: enthaelt '${tr.begriff}'`)
        .join('\n');
      throw new Error(`Englische Begriffe in deutschen Templates gefunden:\n${msg}`);
    }

    expect(treffer).toEqual([]);
  });
});
