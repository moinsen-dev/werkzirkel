/**
 * Pruefrunde-Serialisierung fuer API-Antworten.
 *
 * - `serializePruefrunde` gibt die vollstaendige Pruefrunde mit snake_case-Keys
 *   im JSON aus. Keine privaten Felder vorhanden — Pruefrunde ist von Natur aus
 *   oeffentlich (ausser im Status 'entwurf', siehe Route-Handler).
 */

import type { Pruefrunde } from '@/lib/db/schema';

export function serializePruefrunde(p: Pruefrunde): Record<string, unknown> {
  return {
    id: p.id,
    werk_id: p.werkId,
    titel: p.titel,
    testziel: p.testziel,
    testaufgabe: p.testaufgabe,
    zielgruppe: p.zielgruppe,
    zeitbedarf_minuten: p.zeitbedarfMinuten,
    gesuchte_tester: p.gesuchteTester,
    feedback_kategorien: p.feedbackKategorien,
    frist: p.frist,
    status: p.status,
    erstellt_am: p.erstelltAm,
    aktualisiert_am: p.aktualisiertAm,
  };
}
