/**
 * Unit-Tests fuer die Meldung-Validatoren.
 */

import { describe, expect, it } from 'vitest';

import {
  meldungAnlegenSchema,
  meldungResolutionSchema,
  meldungenListQuerySchema,
} from '@/lib/validators/meldung';

describe('meldungAnlegenSchema', () => {
  it('akzeptiert vollstaendige Eingabe', () => {
    const r = meldungAnlegenSchema.safeParse({
      referenz_typ: 'werk',
      referenz_id: 'abc123',
      kategorie: 'spam',
      beschreibung: 'kurz und knackig',
    });
    expect(r.success).toBe(true);
  });

  it('akzeptiert ohne Beschreibung', () => {
    const r = meldungAnlegenSchema.safeParse({
      referenz_typ: 'nutzer',
      referenz_id: 'abc123',
      kategorie: 'cold_outreach',
    });
    expect(r.success).toBe(true);
  });

  it('lehnt ungueltigen referenz_typ ab', () => {
    const r = meldungAnlegenSchema.safeParse({
      referenz_typ: 'kein_enum',
      referenz_id: 'abc123',
      kategorie: 'spam',
    });
    expect(r.success).toBe(false);
  });

  it('lehnt ungueltige kategorie ab', () => {
    const r = meldungAnlegenSchema.safeParse({
      referenz_typ: 'werk',
      referenz_id: 'abc123',
      kategorie: 'unbekannt',
    });
    expect(r.success).toBe(false);
  });

  it('lehnt Beschreibung > 2000 Zeichen ab', () => {
    const r = meldungAnlegenSchema.safeParse({
      referenz_typ: 'werk',
      referenz_id: 'abc123',
      kategorie: 'spam',
      beschreibung: 'x'.repeat(2001),
    });
    expect(r.success).toBe(false);
  });
});

describe('meldungResolutionSchema', () => {
  it('aktion default = "keine"', () => {
    const r = meldungResolutionSchema.safeParse({ status: 'erledigt' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.aktion).toBe('keine');
    }
  });

  it('lehnt ungueltigen status ab', () => {
    const r = meldungResolutionSchema.safeParse({ status: 'unknown' });
    expect(r.success).toBe(false);
  });

  it('akzeptiert alle drei Aktionen', () => {
    for (const a of ['keine', 'inhalt_ausgeblendet', 'nutzer_gesperrt']) {
      const r = meldungResolutionSchema.safeParse({
        status: 'erledigt',
        aktion: a,
      });
      expect(r.success).toBe(true);
    }
  });
});

describe('meldungenListQuerySchema', () => {
  it('default-limit = 50', () => {
    const r = meldungenListQuerySchema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.limit).toBe(50);
  });

  it('limit > 100 → 422', () => {
    const r = meldungenListQuerySchema.safeParse({ limit: 200 });
    expect(r.success).toBe(false);
  });
});
