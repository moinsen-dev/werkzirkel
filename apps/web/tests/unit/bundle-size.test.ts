/**
 * Tests fuer das Bundle-Size-Check-Script (PRD §32, scripts/bundle-size.ts).
 *
 * Wir testen die pure Parser-/Check-Logik ueber synthetische Next-Build-
 * Outputs — kein echter Build noetig.
 */

import { describe, expect, it } from 'vitest';

import {
  parseSizeKb,
  parseNextBuildOutput,
  formatReport,
  DEFAULT_BUDGET_KB,
} from '../../scripts/bundle-size';

describe('parseSizeKb', () => {
  it('parst Bytes', () => {
    expect(parseSizeKb('512 B')).toBeCloseTo(0.5);
  });
  it('parst kB', () => {
    expect(parseSizeKb('87.4 kB')).toBeCloseTo(87.4);
  });
  it('parst MB', () => {
    expect(parseSizeKb('1.5 MB')).toBeCloseTo(1.5 * 1024);
  });
  it('parst ohne Leerzeichen', () => {
    expect(parseSizeKb('200kB')).toBeCloseTo(200);
  });
  it('liefert null fuer unbekannte Einheit', () => {
    expect(parseSizeKb('5 foo')).toBeNull();
    expect(parseSizeKb('keine zahl')).toBeNull();
    expect(parseSizeKb('')).toBeNull();
  });
});

describe('parseNextBuildOutput — gruener Pfad', () => {
  // Synthetischer Next-Build-Output unter Budget (alle Routes < 200kB).
  const sampleOk = [
    'Route (app)                              Size     First Load JS',
    '┌ ○ /                                    1.2 kB         105 kB',
    '├ ○ /anmelden                            2 kB           120 kB',
    '├ ○ /werke                               3 kB           115 kB',
    '└ ○ /termine                             1.5 kB         110 kB',
    '+ First Load JS shared by all            85 kB',
    '',
  ].join('\n');

  it('parst alle Routen und Shared-Bundle', () => {
    const r = parseNextBuildOutput(sampleOk);
    expect(r.sharedKb).toBeCloseTo(85);
    expect(r.routes.length).toBe(4);
    expect(r.largestRoute?.route).toBe('/anmelden');
    expect(r.largestRoute?.firstLoadKb).toBeCloseTo(120);
  });

  it('meldet ok=true wenn alles unter Budget', () => {
    const r = parseNextBuildOutput(sampleOk, 200);
    expect(r.ok).toBe(true);
    expect(r.overBudget.length).toBe(0);
  });

  it('Default-Budget ist 200 kB', () => {
    expect(DEFAULT_BUDGET_KB).toBe(200);
  });
});

describe('parseNextBuildOutput — Budget-Bruch', () => {
  const sampleFail = [
    'Route (app)                              Size     First Load JS',
    '┌ ○ /                                    1.2 kB         105 kB',
    '├ ○ /werke                               50 kB          250 kB',
    '└ ○ /termine                             1.5 kB         110 kB',
    '+ First Load JS shared by all            85 kB',
  ].join('\n');

  it('markiert Routes ueber Budget', () => {
    const r = parseNextBuildOutput(sampleFail, 200);
    expect(r.ok).toBe(false);
    expect(r.overBudget.length).toBe(1);
    expect(r.overBudget[0]?.route).toBe('/werke');
  });

  it('formatReport zeigt FAIL-Liste', () => {
    const r = parseNextBuildOutput(sampleFail, 200);
    const out = formatReport(r);
    expect(out).toContain('FAIL');
    expect(out).toContain('/werke');
    expect(out).toContain('250');
  });

  it('Shared-Bundle ueber Budget = Bruch', () => {
    const heavyShared = [
      'Route (app)                              Size     First Load JS',
      '┌ ○ /                                    1.2 kB         150 kB',
      '+ First Load JS shared by all            220 kB',
    ].join('\n');
    const r = parseNextBuildOutput(heavyShared, 200);
    expect(r.ok).toBe(false);
    expect(r.sharedKb).toBeCloseTo(220);
  });
});

describe('parseNextBuildOutput — Robustheit', () => {
  it('toleriert leeren Input', () => {
    const r = parseNextBuildOutput('', 200);
    expect(r.routes.length).toBe(0);
    expect(r.sharedKb).toBeNull();
    expect(r.ok).toBe(true);
  });

  it('toleriert Output ohne Tabelle', () => {
    const r = parseNextBuildOutput('Compiled successfully\n', 200);
    expect(r.routes.length).toBe(0);
  });
});

describe('formatReport — gruener Pfad', () => {
  const r = parseNextBuildOutput(
    [
      'Route (app)                              Size     First Load JS',
      '┌ ○ /                                    1.2 kB         105 kB',
      '+ First Load JS shared by all            85 kB',
    ].join('\n'),
    200,
  );

  it('zeigt OK-Zeile mit Route-Anzahl', () => {
    const out = formatReport(r);
    expect(out).toContain('OK');
    expect(out).toContain('Budget 200');
  });
});
