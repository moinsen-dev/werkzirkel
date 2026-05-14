/**
 * Bundle-Size-Check fuer den Next-Build (PRD §32).
 *
 * Bricht den CI ab, wenn das "First Load JS shared by all" oder ein
 * einzelner Route-Eintrag der Next-Build-Tabelle das Budget reisst.
 *
 * Strategie:
 * - Wir parsen das Stdout der Next-Build-Ausgabe (Tabelle mit Route, Size,
 *   First Load JS). Das ist die simpelste robuste Quelle, weil Next selbst
 *   keinen JSON-Bundle-Report rausschreibt.
 * - Aufruf:
 *     pnpm exec tsx scripts/bundle-size.ts            # parsed `next build`
 *     pnpm exec tsx scripts/bundle-size.ts <buildLog> # parsed Datei
 * - Test-Mode: pure Funktion `checkBundleSize(output, budgetKb)` → Report.
 *
 * Budget (PRD §32): Initial-Load-JS < 200kb.
 *
 * Wir parsen Groessen wie `87.4 kB`, `1.2 MB`, `123 B` — Next-CLI formatiert
 * mit Leerzeichen vor der Einheit und einem oder zwei Dezimalstellen.
 */

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const DEFAULT_BUDGET_KB = 200;

export type BundleReport = {
  sharedKb: number | null;
  largestRoute: { route: string; firstLoadKb: number } | null;
  routes: { route: string; firstLoadKb: number }[];
  overBudget: { route: string; firstLoadKb: number }[];
  budgetKb: number;
  ok: boolean;
};

/**
 * Parst eine Groessen-Angabe wie `87.4 kB` / `1.2 MB` / `512 B` in
 * Kilobytes (kB). 1 kB = 1024 B, 1 MB = 1024 kB.
 *
 * Akzeptiert auch ohne Leerzeichen (`87.4kB`) und tolerant gegenueber
 * ANSI-Codes (`[...m`) aus farbigem Next-Output.
 */
export function parseSizeKb(raw: string): number | null {
  if (!raw) return null;
  // ANSI-Escapes wegmachen.
  // eslint-disable-next-line no-control-regex
  const cleaned = raw.replace(/\[[0-9;]*m/g, '').trim();
  const match = cleaned.match(/([\d.]+)\s*(B|kB|KB|MB|GB)$/i);
  if (!match || !match[1] || !match[2]) return null;
  const n = parseFloat(match[1]);
  if (!Number.isFinite(n)) return null;
  const unit = match[2].toLowerCase();
  switch (unit) {
    case 'b':
      return n / 1024;
    case 'kb':
      return n;
    case 'mb':
      return n * 1024;
    case 'gb':
      return n * 1024 * 1024;
    default:
      return null;
  }
}

/**
 * Parst die Next-Build-Tabelle aus dem stdout.
 *
 * Die Tabelle sieht (in einer Variante) so aus:
 *
 *   Route (app)                            Size     First Load JS
 *   ┌ ○ /                                  1.2 kB         95 kB
 *   ├ ○ /werke                             3 kB           110 kB
 *   ...
 *   + First Load JS shared by all          85 kB
 *
 * Wir matchen Zeilen, die mit einem der Baum-Glyphen (┌ ├ └ +) oder einem
 * "○ ƒ λ"-Marker beginnen und eine kB/MB-Endung haben. Die letzte Spalte
 * ist die First-Load-JS-Groesse.
 */
export function parseNextBuildOutput(
  output: string,
  budgetKb: number = DEFAULT_BUDGET_KB,
): BundleReport {
  const lines = output.split('\n');
  const routes: { route: string; firstLoadKb: number }[] = [];
  let sharedKb: number | null = null;

  for (const rawLine of lines) {
    // Whitespace + ANSI bereinigen.
    // eslint-disable-next-line no-control-regex
    const line = rawLine.replace(/\[[0-9;]*m/g, '');

    // "First Load JS shared by all"-Zeile separat behandeln.
    const sharedMatch = line.match(/First Load JS shared by all\s+([\d.]+\s*(?:B|kB|KB|MB|GB))/i);
    if (sharedMatch && sharedMatch[1]) {
      const sz = parseSizeKb(sharedMatch[1]);
      if (sz !== null) sharedKb = sz;
      continue;
    }

    // Route-Zeile: muss einen Baum-Glyph oder Route-Marker enthalten und mind.
    // zwei Groessen-Angaben am Ende (Size, First Load JS).
    // Wir suchen nach einem Pfad-Token (beginnt mit /) gefolgt von Groessen.
    const routeMatch = line.match(
      /(?:┌|├|└|\+)\s*(?:[○ƒλ●◐]\s+)?(\/[^\s]*|\S+)\s+([\d.]+\s*(?:B|kB|KB|MB|GB))\s+([\d.]+\s*(?:B|kB|KB|MB|GB))\s*$/i,
    );
    if (routeMatch && routeMatch[1] && routeMatch[3]) {
      const route = routeMatch[1];
      const firstLoad = parseSizeKb(routeMatch[3]);
      if (firstLoad !== null && route.startsWith('/')) {
        routes.push({ route, firstLoadKb: firstLoad });
      }
    }
  }

  routes.sort((a, b) => b.firstLoadKb - a.firstLoadKb);
  const largestRoute = routes[0] ?? null;
  const overBudget = routes.filter((r) => r.firstLoadKb > budgetKb);
  // Shared-Bundle ist Bestandteil jeder First-Load-Zeile; wir bewerten
  // primaer die First-Load-Werte pro Route. Shared-Only-Bruch (z.B.
  // shared = 250kB) ist allerdings auch ein Bruch.
  const sharedOver = sharedKb !== null && sharedKb > budgetKb;
  const ok = overBudget.length === 0 && !sharedOver;
  return { sharedKb, largestRoute, routes, overBudget, budgetKb, ok };
}

export type CheckOptions = {
  budgetKb?: number;
  /** Fuer Tests: stattdessen `next build` aufrufen, einfach diesen Output nehmen. */
  output?: string;
  /** Fuer Tests: Pfad zu einer Datei mit dem Build-Output. */
  outputFile?: string;
};

export function checkBundleSize(opts: CheckOptions = {}): BundleReport {
  const budgetKb = opts.budgetKb ?? DEFAULT_BUDGET_KB;
  let output = opts.output;
  if (!output && opts.outputFile) {
    output = readFileSync(opts.outputFile, 'utf8');
  }
  if (!output) {
    // Default: `next build` aus dem apps/web-Verzeichnis aufrufen.
    output = execSync('next build', {
      cwd: path.resolve(__dirname, '..'),
      stdio: ['ignore', 'pipe', 'inherit'],
      encoding: 'utf8',
      env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
      maxBuffer: 32 * 1024 * 1024,
    });
  }
  return parseNextBuildOutput(output, budgetKb);
}

export function formatReport(r: BundleReport): string {
  const lines: string[] = [];
  lines.push(`Bundle-Size-Check — Budget ${r.budgetKb} kB First-Load-JS`);
  if (r.sharedKb !== null) {
    lines.push(`  Shared:  ${r.sharedKb.toFixed(1)} kB`);
  }
  if (r.largestRoute) {
    lines.push(`  Largest: ${r.largestRoute.firstLoadKb.toFixed(1)} kB  (${r.largestRoute.route})`);
  }
  if (r.overBudget.length === 0) {
    lines.push(`  OK — ${r.routes.length} Route(s) gepruest, keine ueber Budget.`);
  } else {
    lines.push(`  FAIL — ${r.overBudget.length} Route(s) ueber Budget:`);
    for (const o of r.overBudget) {
      lines.push(`    ${o.firstLoadKb.toFixed(1)} kB  ${o.route}`);
    }
  }
  return lines.join('\n');
}

// CLI-Entry.
async function main() {
  const args = process.argv.slice(2);
  const budgetArgIdx = args.indexOf('--budget');
  const budgetRaw = budgetArgIdx >= 0 ? args[budgetArgIdx + 1] : undefined;
  const budgetKb = budgetRaw ? parseInt(budgetRaw, 10) : DEFAULT_BUDGET_KB;
  const fileArg = args.find((a) => !a.startsWith('--') && a !== String(budgetKb));

  const report = checkBundleSize({ budgetKb, outputFile: fileArg });
  console.log(formatReport(report));
  if (!report.ok) {
    process.exit(1);
  }
}

// Nur ausfuehren, wenn als Script aufgerufen (nicht beim Import in Tests).
// Wir vergleichen normalisierte Pfade, weil import.meta.url file:// liefert
// und process.argv[1] absolute path.
const isMain = (() => {
  try {
    const argv1 = process.argv[1] ? path.resolve(process.argv[1]) : '';
    const here = path.resolve(__filename);
    return argv1 === here;
  } catch {
    return false;
  }
})();

if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
