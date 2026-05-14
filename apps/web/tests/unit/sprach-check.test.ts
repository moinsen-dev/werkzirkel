/**
 * Unit-Tests fuer checkSprache aus lib/moderation/verbotene-woerter.ts.
 *
 * Treffer-Beispiele aus PRD §F-603:
 *  - 'Hier ist mein Pitch' → trifft 'pitch'
 *  - 'Pitcher in baseball' → kein Treffer (Wort-Grenze schuetzt)
 *  - 'Ich brauche Hilfe' → kein Treffer
 *
 * Reine In-Memory-Funktion — kein DB-Hit, kein Setup noetig.
 */

import { describe, expect, it } from 'vitest';
import {
  VERBOTENE_BEGRIFFE,
  checkSprache,
} from '@/lib/moderation/verbotene-woerter';

describe('checkSprache', () => {
  it('Treffer auf "pitch" im Satz', () => {
    const r = checkSprache('Hier ist mein Pitch');
    expect(r.ok).toBe(false);
    expect(r.treffer).toContain('pitch');
  });

  it('KEIN Treffer auf "Pitcher" (Wort-Grenze)', () => {
    const r = checkSprache('Pitcher in baseball');
    expect(r.ok).toBe(true);
    expect(r.treffer).toEqual([]);
  });

  it('KEIN Treffer auf normalen deutschen Hilfesatz', () => {
    const r = checkSprache('Ich brauche Hilfe bei meinem Werk');
    expect(r.ok).toBe(true);
    expect(r.treffer).toEqual([]);
  });

  it('"pitch deck" wird als Mehrwort-Begriff erkannt', () => {
    const r = checkSprache('Ich brauche ein gutes pitch deck');
    expect(r.ok).toBe(false);
    expect(r.treffer).toContain('pitch deck');
    // pitch sollte NICHT zusaetzlich nochmal auftauchen.
    expect(r.treffer.filter((t) => t === 'pitch').length).toBe(0);
  });

  it('Mehrere Treffer werden alle gemeldet', () => {
    const r = checkSprache('Suche leads fuer mein unicorn mit ROI 10x.');
    expect(r.ok).toBe(false);
    expect(r.treffer).toContain('leads');
    expect(r.treffer).toContain('unicorn');
    expect(r.treffer).toContain('roi');
    expect(r.treffer).toContain('10x');
  });

  it('Case-insensitive', () => {
    const r = checkSprache('Wir machen ein PITCH DECK fuer Investoren.');
    expect(r.ok).toBe(false);
    expect(r.treffer).toContain('pitch deck');
  });

  it('Leerer String → ok=true, keine Treffer', () => {
    const r = checkSprache('');
    expect(r.ok).toBe(true);
    expect(r.treffer).toEqual([]);
  });

  it('VERBOTENE_BEGRIFFE-Liste ist nicht leer', () => {
    expect(VERBOTENE_BEGRIFFE.length).toBeGreaterThan(5);
  });
});
