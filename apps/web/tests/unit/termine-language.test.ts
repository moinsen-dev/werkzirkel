/**
 * Sprach-Check: kein englischer UI-String in den `de.termine.*`-Strings
 * der i18n-Tabelle.
 *
 * Liegt im `unit/`-Ordner, weil wir nur das Konstanten-Objekt pruefen —
 * keine echte DB, kein Page-Render.
 */

import { describe, it, expect } from 'vitest';

import { de } from '@/i18n/de';

const VERBOTENE_BEGRIFFE = [
  'Sign in',
  'Sign out',
  'Sign-in',
  'Sign-up',
  'Logout',
  'Log out',
  'Log in',
  'Login',
  'Welcome',
  'Submit',
  'Click here',
  'Page not found',
  'Reminder',
  'Cancel',
  'Save',
  'Edit',
  'Delete',
  'Coming soon',
  'In preparation',
];

function* values(node: unknown): IterableIterator<string> {
  if (typeof node === 'string') {
    yield node;
    return;
  }
  if (typeof node === 'function') {
    // Aufrufer mit synthetischen Werten — erfasst die Template-Strings.
    try {
      const fn = node as (...a: unknown[]) => unknown;
      yield String(fn('Hamburg'));
      yield String(fn(1, 2));
      yield String(fn(1, '01.01.2026'));
    } catch {
      /* ignore */
    }
    return;
  }
  if (Array.isArray(node)) {
    for (const v of node) yield* values(v);
    return;
  }
  if (node && typeof node === 'object') {
    for (const v of Object.values(node as Record<string, unknown>)) yield* values(v);
  }
}

describe('de.termine Sprach-Check', () => {
  it('enthaelt keine englischen UI-Begriffe', () => {
    for (const s of values(de.termine)) {
      for (const begriff of VERBOTENE_BEGRIFFE) {
        expect(s, `verbotener Begriff "${begriff}" in: ${s}`).not.toContain(
          begriff,
        );
      }
    }
  });

  it('exportiert alle erwarteten Sektionen', () => {
    expect(de.termine.status).toBeDefined();
    expect(de.termine.liste).toBeDefined();
    expect(de.termine.detail).toBeDefined();
    expect(de.termine.neu).toBeDefined();
    expect(de.termine.bearbeiten).toBeDefined();
    expect(de.termine.anwesenheit).toBeDefined();
    expect(de.termine.meine).toBeDefined();
  });
});
