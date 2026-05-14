/**
 * Werkangebot-Serialisierung fuer API-Antworten.
 *
 * snake_case-Keys. Allowlist verhindert versehentliche Exporte zukuenftiger
 * privater Felder. Werkangebote werden NIE oeffentlich ausgespielt — alle
 * Lese-Endpunkte erzwingen Bedarfstraeger:in- ODER Macher:in-Permission im
 * API-Layer (PRD §11A Schutz S2).
 */

import type { Werkangebot } from '@/lib/db/schema';

export const WERKANGEBOT_PUBLIC_FIELDS = [
  'id',
  'bedarf_id',
  'werk_id',
  'macher_id',
  'konkretes_vorgehen',
  'ausdruecklicher_ausschluss',
  'erster_liefer_meilenstein',
  'status',
  'erstellt_am',
  'aktualisiert_am',
] as const;

export function serializeWerkangebot(w: Werkangebot): Record<string, unknown> {
  return {
    id: w.id,
    bedarf_id: w.bedarfId,
    werk_id: w.werkId,
    macher_id: w.macherId,
    konkretes_vorgehen: w.konkretesVorgehen,
    ausdruecklicher_ausschluss: w.ausdruecklicherAusschluss,
    erster_liefer_meilenstein: w.ersterLieferMeilenstein,
    status: w.status,
    erstellt_am: w.erstelltAm,
    aktualisiert_am: w.aktualisiertAm,
  };
}
