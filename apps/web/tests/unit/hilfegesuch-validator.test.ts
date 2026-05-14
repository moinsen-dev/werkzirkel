/**
 * Unit-Tests fuer den Hilfegesuch-Validator.
 *
 * Verifiziert die 14-Tage-Grenze, Pflichtfelder, Tag-Cap und Antwort-Mindestlaenge.
 */
import { describe, expect, it } from 'vitest';

import {
  hilfegesuchAnlegenSchema,
  hilfegesuchAntwortSchema,
  hilfegesucheListQuerySchema,
} from '@/lib/validators/hilfegesuch';

function inDays(n: number): string {
  return new Date(Date.now() + n * 24 * 60 * 60 * 1000).toISOString();
}

describe('hilfegesuchAnlegenSchema', () => {
  it('akzeptiert valides Hilfegesuch mit Standard-Gueltigkeit (14 Tage)', () => {
    const res = hilfegesuchAnlegenSchema.safeParse({
      titel: 'Brauche Feedback zu UX',
      beschreibung: 'Mein Onboarding ist holprig, bitte testen.',
      tags: ['ux', 'marketing'],
      gueltig_bis: inDays(13),
    });
    expect(res.success).toBe(true);
  });

  it('verwirft gueltig_bis > now + 14 Tage', () => {
    const res = hilfegesuchAnlegenSchema.safeParse({
      titel: 'Zu lang',
      beschreibung: 'Beschreibung mit genug Zeichen.',
      tags: [],
      gueltig_bis: inDays(30),
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      const msg = res.error.flatten().fieldErrors.gueltig_bis?.[0] ?? '';
      expect(msg.toLowerCase()).toContain('14 tage');
    }
  });

  it('verwirft gueltig_bis in der Vergangenheit', () => {
    const res = hilfegesuchAnlegenSchema.safeParse({
      titel: 'Vergangenheit',
      beschreibung: 'Beschreibung mit genug Zeichen.',
      tags: [],
      gueltig_bis: inDays(-1),
    });
    expect(res.success).toBe(false);
  });

  it('verwirft Titel < 3 Zeichen', () => {
    const res = hilfegesuchAnlegenSchema.safeParse({
      titel: 'ab',
      beschreibung: 'Beschreibung mit genug Zeichen.',
      tags: [],
      gueltig_bis: inDays(5),
    });
    expect(res.success).toBe(false);
  });

  it('verwirft Beschreibung < 10 Zeichen', () => {
    const res = hilfegesuchAnlegenSchema.safeParse({
      titel: 'Titel okay',
      beschreibung: 'zu kurz',
      tags: [],
      gueltig_bis: inDays(5),
    });
    expect(res.success).toBe(false);
  });

  it('verwirft mehr als 10 Tags', () => {
    const res = hilfegesuchAnlegenSchema.safeParse({
      titel: 'Titel okay',
      beschreibung: 'Beschreibung mit genug Zeichen.',
      tags: Array.from({ length: 11 }, (_, i) => `t${i}`),
      gueltig_bis: inDays(5),
    });
    expect(res.success).toBe(false);
  });
});

describe('hilfegesuchAntwortSchema', () => {
  it('akzeptiert Antwort mit >= 10 Zeichen', () => {
    expect(
      hilfegesuchAntwortSchema.safeParse({ text: 'Genug Zeichen hier' }).success,
    ).toBe(true);
  });
  it('verwirft Antwort < 10 Zeichen', () => {
    expect(
      hilfegesuchAntwortSchema.safeParse({ text: 'zu kurz' }).success,
    ).toBe(false);
  });
});

describe('hilfegesucheListQuerySchema', () => {
  it('akzeptiert leer / default limit 20', () => {
    const r = hilfegesucheListQuerySchema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.limit).toBe(20);
  });
  it('verwirft status ausserhalb Enum', () => {
    const r = hilfegesucheListQuerySchema.safeParse({ status: 'irgendwas' });
    expect(r.success).toBe(false);
  });
});
