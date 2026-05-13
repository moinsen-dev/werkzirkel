/**
 * Regression: sendMail darf NIEMALS gegen die echte Resend-API laufen, wenn
 * die Test-Runtime aktiv ist oder der Empfaenger in einer reservierten
 * Test-Domain liegt. Diese Tests sind die Versicherung dafuer — sie blieben
 * stumm, bis am 2026-05-13 ein autobuild-Lauf die echte Tagesquote von
 * Resend ausgeschoepft hat.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Resend-Modul komplett mocken, damit ein Aufruf hier hart auffaellt.
const sendSpy = vi.fn();
vi.mock('resend', () => ({
  Resend: vi.fn(() => ({ emails: { send: sendSpy } })),
}));

// DB-Persist-Helper ebenfalls neutralisieren — der ist in dem Pfad irrelevant.
vi.mock('@/lib/db', () => ({
  db: { insert: () => ({ values: async () => undefined }) },
}));

import { sendMail } from '@/lib/email/send';

describe('sendMail mock-guard', () => {
  beforeEach(() => {
    sendSpy.mockReset();
  });

  it('mockt unter Vitest-Runtime (process.env.VITEST=true) auch bei gesetztem RESEND_API_KEY', async () => {
    // Vitest setzt process.env.VITEST automatisch auf "true" beim Run.
    expect(process.env.VITEST).toBe('true');
    const result = await sendMail({
      to: 'real-user@werkzirkel.de',
      template: 'T-001',
      props: { magicLinkUrl: 'https://werkzirkel.de/x', expiresInMinutes: 15 },
    });
    expect(result.ok).toBe(true);
    expect(result.mocked).toBe(true);
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it('mockt RFC-2606-Test-Domains auch ausserhalb der Test-Runtime', async () => {
    // Simuliere Production: VITEST temporaer entfernen, dann zurueckschalten.
    const oldVitest = process.env.VITEST;
    const oldNodeEnv = process.env.NODE_ENV;
    delete process.env.VITEST;
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    try {
      for (const to of [
        'foo@example.com',
        'bar@example.de',
        'baz@example.org',
        'qux@test.local',
        'admin@localhost',
      ]) {
        const result = await sendMail({
          to,
          template: 'T-001',
          props: { magicLinkUrl: 'https://werkzirkel.de/x', expiresInMinutes: 15 },
        });
        expect(result.mocked, `should mock ${to}`).toBe(true);
      }
      expect(sendSpy).not.toHaveBeenCalled();
    } finally {
      if (oldVitest) process.env.VITEST = oldVitest;
      if (oldNodeEnv)
        (process.env as Record<string, string | undefined>).NODE_ENV = oldNodeEnv;
    }
  });
});
