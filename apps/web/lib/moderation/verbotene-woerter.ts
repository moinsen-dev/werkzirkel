/**
 * Sprach-Check: serverseitige Liste verbotener Begriffe.
 *
 * PRD §11A Schutz S4 (Kulturverlust 1+2): Werkzirkel ist Werkstatt, kein
 * Pitch-Marktplatz. Akquise-/Sales-Vokabular kennzeichnet Bedarfe als
 * "in_pruefung" — Kurator:innen entscheiden vor Veroeffentlichung.
 *
 * Die Treffer werden im audit_log dokumentiert. Auf Bedarfs-Ebene fuehrt
 * ein Treffer NICHT zur automatischen Ablehnung, sondern zur Markierung
 * fuer manuelle Pruefung (PRD §F-603).
 *
 * Anwendungs-Pattern:
 *
 *     const { ok, treffer } = checkSprache([titel, problem, nutzen, organisation].join('\n'));
 *     if (!treffer.length) { ... }
 */

/**
 * Liste verbotener Begriffe. Bewusst klein gehalten — false positives
 * sind besser als zu durchsichtiger Filter, weil Kurator:in immer prueft.
 *
 * Mehrzeichen-Begriffe (z.B. "pitch deck", "sales pipeline") werden vor
 * Einzelwort-Begriffen geprueft, damit der laengere Treffer Vorrang hat.
 *
 * Single Source of Truth — auch fuer Unit-Tests.
 */
export const VERBOTENE_BEGRIFFE: readonly string[] = [
  // Pitch-/Marktplatz-Vokabular
  'pitch deck',
  'pitch',
  'ausschreibung',
  'bewerbung',
  'matching',
  'marktplatz',
  // Sales-/Investment-Sprech
  'investment opportunity',
  'sales pipeline',
  'roi',
  'leads',
  'scale',
  // Hustle-Sprech
  'unicorn',
  'disruptor',
  '10x',
  'hustle',
] as const;

/**
 * Escape ein Wort fuer den Einsatz in einer Regex.
 */
function escapeForRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Pruet einen Text gegen die VERBOTENE_BEGRIFFE-Liste.
 *
 * Verhalten:
 *  - Case-insensitive.
 *  - Wort-Grenzen werden via `\b` simuliert; bei Begriffen mit Leerzeichen
 *    nutzen wir Wort-Grenzen an Anfang und Ende.
 *  - Treffer werden dedupliziert (Set), Reihenfolge der Liste bleibt
 *    erhalten — laengere Begriffe zuerst, damit "pitch deck" nicht doppelt
 *    als "pitch" und "pitch deck" auftaucht (wir entfernen den Substring
 *    nach Treffer).
 *
 * Beispiele:
 *  - 'Hier ist mein Pitch' → trifft ['pitch']
 *  - 'Pitcher in baseball' → kein Treffer (Wort-Grenze schuetzt)
 *  - 'Ich brauche Hilfe' → kein Treffer
 */
export function checkSprache(text: string): { ok: boolean; treffer: string[] } {
  if (!text) return { ok: true, treffer: [] };

  let restText = text;
  const treffer: string[] = [];
  const gesehen = new Set<string>();

  for (const begriff of VERBOTENE_BEGRIFFE) {
    const lower = begriff.toLowerCase();
    const escaped = escapeForRegex(begriff);
    // \b-Wortgrenze klappt bei lateinischen Buchstaben.
    const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
    if (regex.test(restText)) {
      if (!gesehen.has(lower)) {
        gesehen.add(lower);
        treffer.push(lower);
      }
      // Treffer aus restText entfernen, damit kuerzere Begriffe nicht
      // im selben Match-Bereich nochmal greifen ('pitch deck' → 'pitch').
      restText = restText.replace(regex, ' ');
    }
  }

  return { ok: treffer.length === 0, treffer };
}
