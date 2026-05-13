/**
 * Werkzirkel Design Tokens
 *
 * Quelle der Wahrheit für Farben, Typografie, Abstände, Radien.
 * Tokens werden in `app/globals.css` zu CSS-Variablen exportiert
 * und stehen über `@theme` in Tailwind 4 zur Verfügung.
 */

export const tokens = {
  color: {
    bg: 'oklch(99% 0.002 240)',
    surface: 'oklch(100% 0 0)',
    fg: 'oklch(18% 0.012 250)',
    muted: 'oklch(54% 0.012 250)',
    border: 'oklch(92% 0.005 250)',
    accent: 'oklch(58% 0.18 255)',
    warn: 'oklch(75% 0.16 70)',
    fehler: 'oklch(55% 0.20 25)',
    erfolg: 'oklch(58% 0.13 145)',
  },
  font: {
    display: `-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif`,
    body: `-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif`,
    mono: `'SF Mono', Menlo, Consolas, monospace`,
  },
  size: {
    wrap: '1180px',
    radius: '8px',
    radiusLg: '14px',
    radiusXl: '18px',
  },
  spacing: {
    hairline: '1px',
    s1: '0.25rem',
    s2: '0.5rem',
    s3: '0.75rem',
    s4: '1rem',
    s6: '1.5rem',
    s8: '2rem',
    s12: '3rem',
    s16: '4rem',
    s24: '6rem',
  },
} as const;

export type Tokens = typeof tokens;
