/**
 * Helper zum Laden von Bedarf- und Foerderprofil-Bezuegen eines
 * Bedarfsschau-Termins (PRD §8.8, §13.19, §13.20).
 *
 * Die Bezuege selbst (`termin_bedarf_bezug`, `termin_foerderprofil_bezug`)
 * sind reine Join-Tabellen mit `reihenfolge`. Diese Helper joinen die
 * Public-Daten der referenzierten Bedarfe / Foerderprofile mit hinein und
 * sortieren nach `reihenfolge`.
 *
 * Verwendet von:
 *  - GET /api/v1/termine/:id (Detail-Response bei typ='bedarfsschau')
 *  - /termine/[id] Page (Sektionen mit verknuepften Bedarfen/Foerderprofilen)
 *  - /kurator/termine/[id]/bearbeiten (Vorauswahl der gesetzten Bezuege)
 */

import { asc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  bedarf,
  foerderprofil,
  terminBedarfBezug,
  terminFoerderprofilBezug,
} from '@/lib/db/schema';
import { serializeBedarf } from '@/lib/bedarf/serialize';
import { serializeFoerderprofil } from '@/lib/foerderprofil/serialize';

export interface TerminBedarfBezugZeile {
  bezug_id: string;
  reihenfolge: number;
  notizen: string | null;
  bedarf: Record<string, unknown>;
}

export interface TerminFoerderprofilBezugZeile {
  bezug_id: string;
  reihenfolge: number;
  notizen: string | null;
  foerderprofil: Record<string, unknown>;
}

export async function ladeBedarfBezuege(
  terminId: string,
): Promise<TerminBedarfBezugZeile[]> {
  const rows = await db
    .select({
      bezugId: terminBedarfBezug.id,
      reihenfolge: terminBedarfBezug.reihenfolge,
      notizen: terminBedarfBezug.notizen,
      bedarf,
    })
    .from(terminBedarfBezug)
    .innerJoin(bedarf, eq(bedarf.id, terminBedarfBezug.bedarfId))
    .where(eq(terminBedarfBezug.terminId, terminId))
    .orderBy(asc(terminBedarfBezug.reihenfolge), asc(terminBedarfBezug.id));

  return rows.map((r) => ({
    bezug_id: r.bezugId,
    reihenfolge: r.reihenfolge,
    notizen: r.notizen,
    bedarf: serializeBedarf(r.bedarf),
  }));
}

export async function ladeFoerderprofilBezuege(
  terminId: string,
): Promise<TerminFoerderprofilBezugZeile[]> {
  const rows = await db
    .select({
      bezugId: terminFoerderprofilBezug.id,
      reihenfolge: terminFoerderprofilBezug.reihenfolge,
      notizen: terminFoerderprofilBezug.notizen,
      foerderprofil,
    })
    .from(terminFoerderprofilBezug)
    .innerJoin(
      foerderprofil,
      eq(foerderprofil.id, terminFoerderprofilBezug.foerderprofilId),
    )
    .where(eq(terminFoerderprofilBezug.terminId, terminId))
    .orderBy(
      asc(terminFoerderprofilBezug.reihenfolge),
      asc(terminFoerderprofilBezug.id),
    );

  return rows.map((r) => ({
    bezug_id: r.bezugId,
    reihenfolge: r.reihenfolge,
    notizen: r.notizen,
    foerderprofil: serializeFoerderprofil(r.foerderprofil),
  }));
}
