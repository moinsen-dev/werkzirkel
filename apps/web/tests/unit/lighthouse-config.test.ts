/**
 * Validiert .lighthouserc.json: enthaelt die Performance-Budgets aus
 * PRD §32 (LCP, CLS, total-byte-weight, unused-javascript).
 *
 * Damit faellt jeder versehentlich gelockerte Budget-Wert sofort im
 * Unit-Lauf auf — nicht erst, wenn CI Lighthouse anrollt.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

type Assertion = [level: string, opts?: Record<string, unknown>];
type Config = {
  ci?: {
    collect?: { url?: string[] };
    assert?: { assertions?: Record<string, Assertion | string> };
  };
};

function loadConfig(): Config {
  const file = path.join(ROOT, '.lighthouserc.json');
  return JSON.parse(readFileSync(file, 'utf8')) as Config;
}

describe('.lighthouserc.json — Performance-Budgets (PRD §32)', () => {
  const cfg = loadConfig();
  const assertions = cfg.ci?.assert?.assertions ?? {};

  it('LCP <= 2500ms als error', () => {
    const lcp = assertions['largest-contentful-paint'];
    expect(Array.isArray(lcp)).toBe(true);
    if (Array.isArray(lcp)) {
      expect(lcp[0]).toBe('error');
      expect((lcp[1] as { maxNumericValue: number }).maxNumericValue).toBe(2500);
    }
  });

  it('CLS <= 0.1 als error', () => {
    const cls = assertions['cumulative-layout-shift'];
    expect(Array.isArray(cls)).toBe(true);
    if (Array.isArray(cls)) {
      expect(cls[0]).toBe('error');
      expect((cls[1] as { maxNumericValue: number }).maxNumericValue).toBe(0.1);
    }
  });

  it('total-byte-weight <= 1MB als error', () => {
    const bw = assertions['total-byte-weight'];
    expect(Array.isArray(bw)).toBe(true);
    if (Array.isArray(bw)) {
      expect(bw[0]).toBe('error');
      expect((bw[1] as { maxNumericValue: number }).maxNumericValue).toBe(1_000_000);
    }
  });

  it('unused-javascript <= 50kb als warn', () => {
    const uj = assertions['unused-javascript'];
    expect(Array.isArray(uj)).toBe(true);
    if (Array.isArray(uj)) {
      expect(uj[0]).toBe('warn');
      expect((uj[1] as { maxNumericValue: number }).maxNumericValue).toBe(50_000);
    }
  });

  it('Accessibility-Score >= 0.95 bleibt error (Regression-Schutz)', () => {
    const a = assertions['categories:accessibility'];
    expect(Array.isArray(a)).toBe(true);
    if (Array.isArray(a)) {
      expect(a[0]).toBe('error');
      expect((a[1] as { minScore: number }).minScore).toBe(0.95);
    }
  });

  it('Mindestens vier Public-Routen werden gemessen', () => {
    const urls = cfg.ci?.collect?.url ?? [];
    expect(urls.length).toBeGreaterThanOrEqual(4);
    expect(urls.some((u) => u === 'http://localhost:3210/')).toBe(true);
  });
});
