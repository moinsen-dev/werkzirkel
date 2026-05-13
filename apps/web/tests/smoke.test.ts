import { describe, it, expect } from 'vitest';
import { de } from '@/i18n/de';
import { tokens } from '@/design/tokens';

describe('Smoke', () => {
  it('lädt die deutschen UI-Strings', () => {
    expect(de.app.name).toBe('Werkzirkel');
    expect(de.app.leitsatz).toContain('Erst zeigen');
  });

  it('lädt die Design-Tokens', () => {
    expect(tokens.color.accent).toBeTruthy();
    expect(tokens.size.wrap).toBe('1180px');
  });
});
