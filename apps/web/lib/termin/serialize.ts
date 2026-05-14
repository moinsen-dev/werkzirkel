/**
 * Termin-Serialisierung fuer API-Antworten — snake_case-Keys gemaess PRD §15.8.
 */

import type { Termin } from '@/lib/db/schema';

export function serializeTermin(t: Termin): Record<string, unknown> {
  return {
    id: t.id,
    stadt_id: t.stadtId,
    typ: t.typ,
    titel: t.titel,
    beschreibung: t.beschreibung,
    ort_text: t.ortText,
    online_link: t.onlineLink,
    datum_uhrzeit: t.datumUhrzeit,
    max_teilnehmer: t.maxTeilnehmer,
    erstellt_von: t.erstelltVon,
    status: t.status,
    notizen_nach_termin: t.notizenNachTermin,
    erstellt_am: t.erstelltAm,
    aktualisiert_am: t.aktualisiertAm,
  };
}
