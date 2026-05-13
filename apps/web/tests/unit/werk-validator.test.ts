/**
 * Unit-Tests fuer die Zod-Schemas in `lib/validators/werk.ts`.
 *
 * Fokus: deutsche Fehlermeldungen + 280-Zeichen-Grenze fuer kurzbeschreibung
 * (App-validiert, nicht DB-Constraint).
 */

import { describe, it, expect } from 'vitest';
import {
  werkAnlegenSchema,
  werkPatchSchema,
  werkeListQuerySchema,
} from '@/lib/validators/werk';

const validBase = {
  name: 'Mein Werk',
  kurzbeschreibung: 'Eine knackige Beschreibung.',
  problem: 'Wir loesen XYZ.',
  zielgruppe: 'Indie-Macher:innen',
  werkstand: 'idee',
  hilfebedarf: ['ux_test'],
};

describe('werkAnlegenSchema', () => {
  it('akzeptiert ein vollstaendiges, gueltiges Werk', () => {
    const r = werkAnlegenSchema.safeParse(validBase);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.sichtbarkeit).toBe('oeffentlich'); // Default
    }
  });

  it('lehnt leeren Werknamen ab mit deutscher Fehlermeldung', () => {
    const r = werkAnlegenSchema.safeParse({ ...validBase, name: '' });
    expect(r.success).toBe(false);
    if (!r.success) {
      const msgs = r.error.flatten().fieldErrors.name ?? [];
      expect(msgs.some((m) => /erforderlich/i.test(m))).toBe(true);
    }
  });

  it('lehnt kurzbeschreibung mit 281 Zeichen ab', () => {
    const lang = 'x'.repeat(281);
    const r = werkAnlegenSchema.safeParse({
      ...validBase,
      kurzbeschreibung: lang,
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const msgs = r.error.flatten().fieldErrors.kurzbeschreibung ?? [];
      expect(msgs.some((m) => /280 Zeichen/i.test(m))).toBe(true);
    }
  });

  it('akzeptiert kurzbeschreibung mit exakt 280 Zeichen', () => {
    const grenze = 'x'.repeat(280);
    const r = werkAnlegenSchema.safeParse({
      ...validBase,
      kurzbeschreibung: grenze,
    });
    expect(r.success).toBe(true);
  });

  it('lehnt ungueltigen werkstand ab', () => {
    const r = werkAnlegenSchema.safeParse({
      ...validBase,
      werkstand: 'nicht_existent',
    });
    expect(r.success).toBe(false);
  });

  it('lehnt ungueltigen hilfebedarf-Wert ab', () => {
    const r = werkAnlegenSchema.safeParse({
      ...validBase,
      hilfebedarf: ['ux_test', 'erfundener_typ'],
    });
    expect(r.success).toBe(false);
  });

  it('normalisiert leeren link zu null', () => {
    const r = werkAnlegenSchema.safeParse({ ...validBase, link: '' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.link).toBeNull();
    }
  });

  it('lehnt link ohne http(s)-Schema ab', () => {
    const r = werkAnlegenSchema.safeParse({
      ...validBase,
      link: 'irgendwas',
    });
    expect(r.success).toBe(false);
  });
});

describe('werkPatchSchema', () => {
  it('akzeptiert leeres Patch-Objekt', () => {
    const r = werkPatchSchema.safeParse({});
    expect(r.success).toBe(true);
  });

  it('akzeptiert nur werkstand', () => {
    const r = werkPatchSchema.safeParse({ werkstand: 'prototyp' });
    expect(r.success).toBe(true);
  });

  it('lehnt leeren Namen explizit ab', () => {
    const r = werkPatchSchema.safeParse({ name: '' });
    expect(r.success).toBe(false);
  });

  it('lehnt kurzbeschreibung > 280 ab', () => {
    const r = werkPatchSchema.safeParse({
      kurzbeschreibung: 'x'.repeat(281),
    });
    expect(r.success).toBe(false);
  });
});

describe('werkeListQuerySchema', () => {
  it('hat Default-Limit 20', () => {
    const r = werkeListQuerySchema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.limit).toBe(20);
    }
  });

  it('akzeptiert Array-Filter werkstand', () => {
    const r = werkeListQuerySchema.safeParse({
      werkstand: ['idee', 'prototyp'],
    });
    expect(r.success).toBe(true);
  });

  it('lehnt limit > 50 ab', () => {
    const r = werkeListQuerySchema.safeParse({ limit: 100 });
    expect(r.success).toBe(false);
  });

  it('coerced limit aus String', () => {
    const r = werkeListQuerySchema.safeParse({ limit: '15' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.limit).toBe(15);
  });
});
