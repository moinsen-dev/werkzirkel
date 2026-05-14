/**
 * Quartals-Helper für die Werkstatt-Kasse.
 *
 * `quartalOf(date)` liefert das Quartals-Label '<YYYY>-Q<1-4>' für ein Datum
 * in UTC. Wir bleiben bei UTC, damit Webhook-Events (Stripe-Server-Zeit) und
 * UI-Server-Komponenten denselben Bucket berechnen — alternativ Europe/Berlin,
 * aber das Risiko von Quartal-Grenzfällen am 31. März 23:00 UTC ist niedrig
 * genug, dass UTC die einfachere/stabilere Wahl ist.
 *
 * `aktuellesQuartal()` ist sugar für `quartalOf(new Date())`.
 *
 * `parseQuartal('2026-Q1')` validiert + zerlegt; gibt `null` bei Fehlern.
 *
 * PRD-Referenz: §8.11 (Werkstatt-Kasse, quartalsweise öffentlich).
 */

export function quartalOf(d: Date): string {
  const q = Math.floor(d.getUTCMonth() / 3) + 1;
  return `${d.getUTCFullYear()}-Q${q}`;
}

export function aktuellesQuartal(): string {
  return quartalOf(new Date());
}

export interface QuartalParts {
  jahr: number;
  q: 1 | 2 | 3 | 4;
}

export function parseQuartal(label: string): QuartalParts | null {
  const m = /^(\d{4})-Q([1-4])$/.exec(label);
  if (!m) return null;
  return { jahr: Number(m[1]), q: Number(m[2]) as 1 | 2 | 3 | 4 };
}

/**
 * Liefert die vorherige Quartals-Spalte vor `label`. Praktisch für UI-Pager.
 */
export function vorigesQuartal(label: string): string | null {
  const p = parseQuartal(label);
  if (!p) return null;
  if (p.q === 1) return `${p.jahr - 1}-Q4`;
  return `${p.jahr}-Q${p.q - 1}`;
}

/**
 * Liefert das nächste Quartals-Label nach `label`.
 */
export function naechstesQuartal(label: string): string | null {
  const p = parseQuartal(label);
  if (!p) return null;
  if (p.q === 4) return `${p.jahr + 1}-Q1`;
  return `${p.jahr}-Q${p.q + 1}`;
}
