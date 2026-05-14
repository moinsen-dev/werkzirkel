/**
 * PATCH /api/v1/kurator/meldungen/:id
 *
 * Kurator:in setzt Status einer Meldung + optionaler Folge-Aktion.
 *
 * Aktionen (PRD §F-502, §F-504):
 *  - 'keine'                 → nur Status + Notiz aktualisieren.
 *  - 'inhalt_ausgeblendet'   → referenzierten Inhalt unsichtbar machen.
 *                              - werk:          status='ausgeblendet'
 *                              - bedarf:        status='eingestellt'
 *                              - foerderprofil: verifikationStatus='pausiert'
 *                              - werkangebot:   status='zurueckgezogen'
 *                              - hilfegesuch_antwort: HARD-DELETE der Antwort
 *                              - feedback / nutzer: nicht unterstuetzt → 422.
 *  - 'nutzer_gesperrt'       → Inhaber:in des Inhalts sperren
 *                              (nutzer.status='gesperrt').
 *
 * Bei 'erledigt' wird `geschlossen_am=now` gesetzt. Bei 'verworfen' auch.
 * 'in_pruefung' laesst geschlossen_am unberuehrt.
 *
 * Permission: Rolle 'kurator' oder 'admin'.
 *
 * PRD-Referenz: §27, §F-501..§F-504.
 */

import { eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import {
  auditLog,
  bedarf,
  foerderprofil,
  hilfegesuchAntwort,
  meldung,
  nutzer,
  werk,
  werkangebot,
} from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';
import { rejectIfBadOrigin } from '@/lib/auth/csrf';
import { hasRolle } from '@/lib/auth/permissions';
import { meldungResolutionSchema, type MeldungAktion } from '@/lib/validators/meldung';
import type { MeldungReferenzTyp } from '@/lib/db/schema/enums';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * Ergebnis der Folge-Aktion: ob sie ausgefuehrt wurde + welcher Inhaber
 * (fuer 'nutzer_gesperrt' aus dem referenzierten Inhalt abgeleitet).
 */
interface AktionsResult {
  ok: boolean;
  /** Falls 'nutzer_gesperrt': die Person, die gesperrt werden soll. */
  inhaberId: string | null;
  /** Falls Inhalt-Ausblenden nicht unterstuetzt fuer diesen Typ. */
  fehler?: { code: string; message: string };
}

async function inhaltAusblenden(
  referenzTyp: MeldungReferenzTyp,
  referenzId: string,
): Promise<AktionsResult> {
  switch (referenzTyp) {
    case 'werk': {
      const updated = await db
        .update(werk)
        .set({ status: 'ausgeblendet', aktualisiertAm: new Date() })
        .where(eq(werk.id, referenzId))
        .returning({ nutzerId: werk.nutzerId });
      return { ok: updated.length > 0, inhaberId: updated[0]?.nutzerId ?? null };
    }
    case 'bedarf': {
      const updated = await db
        .update(bedarf)
        .set({ status: 'eingestellt', aktualisiertAm: new Date() })
        .where(eq(bedarf.id, referenzId))
        .returning({ nutzerId: bedarf.nutzerId });
      return { ok: updated.length > 0, inhaberId: updated[0]?.nutzerId ?? null };
    }
    case 'foerderprofil': {
      const updated = await db
        .update(foerderprofil)
        .set({ verifikationStatus: 'pausiert', aktualisiertAm: new Date() })
        .where(eq(foerderprofil.id, referenzId))
        .returning({ nutzerId: foerderprofil.nutzerId });
      return { ok: updated.length > 0, inhaberId: updated[0]?.nutzerId ?? null };
    }
    case 'werkangebot': {
      const updated = await db
        .update(werkangebot)
        .set({ status: 'zurueckgezogen', aktualisiertAm: new Date() })
        .where(eq(werkangebot.id, referenzId))
        .returning({ nutzerId: werkangebot.macherId });
      return { ok: updated.length > 0, inhaberId: updated[0]?.nutzerId ?? null };
    }
    case 'hilfegesuch_antwort': {
      const deleted = await db
        .delete(hilfegesuchAntwort)
        .where(eq(hilfegesuchAntwort.id, referenzId))
        .returning({ nutzerId: hilfegesuchAntwort.nutzerId });
      return { ok: deleted.length > 0, inhaberId: deleted[0]?.nutzerId ?? null };
    }
    case 'nutzer':
    case 'feedback':
      return {
        ok: false,
        inhaberId: null,
        fehler: {
          code: 'aktion_nicht_unterstuetzt',
          message:
            'Inhalt-Ausblenden ist fuer diesen Referenz-Typ nicht moeglich. Fuer Nutzer:innen bitte "nutzer_gesperrt" verwenden.',
        },
      };
    default:
      return {
        ok: false,
        inhaberId: null,
        fehler: {
          code: 'aktion_nicht_unterstuetzt',
          message: 'Referenz-Typ unbekannt.',
        },
      };
  }
}

/**
 * Ermittelt Inhaber:in des referenzierten Inhalts fuer 'nutzer_gesperrt'.
 * Bei `referenz_typ='nutzer'` ist der Inhalt selbst die Person.
 */
async function ermittleInhaber(
  referenzTyp: MeldungReferenzTyp,
  referenzId: string,
): Promise<string | null> {
  switch (referenzTyp) {
    case 'nutzer':
      return referenzId;
    case 'werk': {
      const rows = await db
        .select({ nutzerId: werk.nutzerId })
        .from(werk)
        .where(eq(werk.id, referenzId))
        .limit(1);
      return rows[0]?.nutzerId ?? null;
    }
    case 'bedarf': {
      const rows = await db
        .select({ nutzerId: bedarf.nutzerId })
        .from(bedarf)
        .where(eq(bedarf.id, referenzId))
        .limit(1);
      return rows[0]?.nutzerId ?? null;
    }
    case 'foerderprofil': {
      const rows = await db
        .select({ nutzerId: foerderprofil.nutzerId })
        .from(foerderprofil)
        .where(eq(foerderprofil.id, referenzId))
        .limit(1);
      return rows[0]?.nutzerId ?? null;
    }
    case 'werkangebot': {
      const rows = await db
        .select({ macherId: werkangebot.macherId })
        .from(werkangebot)
        .where(eq(werkangebot.id, referenzId))
        .limit(1);
      return rows[0]?.macherId ?? null;
    }
    case 'hilfegesuch_antwort': {
      const rows = await db
        .select({ nutzerId: hilfegesuchAntwort.nutzerId })
        .from(hilfegesuchAntwort)
        .where(eq(hilfegesuchAntwort.id, referenzId))
        .limit(1);
      return rows[0]?.nutzerId ?? null;
    }
    case 'feedback':
      // feedback hat keinen direkten "Inhaber" fuer Sperrung — wir lassen das
      // Nicht-Unterstuetzt-Verhalten der Kurator:in mit klarer Notiz.
      return null;
    default:
      return null;
  }
}

export async function PATCH(req: Request, ctx: RouteContext): Promise<Response> {
  const originResp = rejectIfBadOrigin(req);
  if (originResp) return originResp;

  const sess = await getSessionFromRequest(req);
  if (!sess) {
    return Response.json({ fehler: 'unauthenticated' }, { status: 401 });
  }

  if (!hasRolle(sess.nutzer, 'kurator') && !hasRolle(sess.nutzer, 'admin')) {
    return Response.json(
      {
        error: {
          code: 'kein_zugriff',
          message:
            'Nur Kurator:innen und Admins koennen Meldungen bearbeiten.',
        },
      },
      { status: 403 },
    );
  }

  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ fehler: 'ungueltiger_body' }, { status: 400 });
  }
  const parsed = meldungResolutionSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { fehler: 'validierung', details: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }
  const input = parsed.data;

  // Meldung laden
  const rows = await db
    .select()
    .from(meldung)
    .where(eq(meldung.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) {
    return Response.json({ fehler: 'nicht_gefunden' }, { status: 404 });
  }

  // Aktion ausfuehren BEVOR der Meldungs-Status committed wird, damit wir
  // bei Fehlschlag den Status nicht "erledigt" markieren.
  const aktion: MeldungAktion = input.aktion;
  let aktionsInfo: { typ: MeldungAktion; ziel: string | null } = {
    typ: aktion,
    ziel: null,
  };

  if (aktion === 'inhalt_ausgeblendet') {
    const erg = await inhaltAusblenden(row.referenzTyp, row.referenzId);
    if (!erg.ok) {
      if (erg.fehler) {
        return Response.json({ error: erg.fehler }, { status: 422 });
      }
      return Response.json(
        {
          error: {
            code: 'inhalt_nicht_gefunden',
            message: 'Der referenzierte Inhalt existiert nicht mehr.',
          },
        },
        { status: 404 },
      );
    }
    aktionsInfo = { typ: aktion, ziel: row.referenzId };
  } else if (aktion === 'nutzer_gesperrt') {
    const inhaberId = await ermittleInhaber(row.referenzTyp, row.referenzId);
    if (!inhaberId) {
      return Response.json(
        {
          error: {
            code: 'inhaber_nicht_ermittelbar',
            message:
              'Inhaber:in des Inhalts konnte nicht ermittelt werden. Sperre bitte manuell ueber Admin.',
          },
        },
        { status: 422 },
      );
    }
    await db
      .update(nutzer)
      .set({ status: 'gesperrt', aktualisiertAm: new Date() })
      .where(eq(nutzer.id, inhaberId));
    aktionsInfo = { typ: aktion, ziel: inhaberId };
  }

  // Meldungs-Status aktualisieren
  const jetzt = new Date();
  const istGeschlossen =
    input.status === 'erledigt' || input.status === 'verworfen';
  const updated = await db
    .update(meldung)
    .set({
      status: input.status,
      ergebnisNotiz: input.ergebnis_notiz ?? null,
      bearbeiterId: sess.nutzerId,
      geschlossenAm: istGeschlossen ? jetzt : null,
    })
    .where(eq(meldung.id, row.id))
    .returning();
  const updatedRow = updated[0]!;

  try {
    await db.insert(auditLog).values({
      nutzerId: sess.nutzerId,
      aktion: 'meldung.resolviert',
      referenzTyp: 'meldung',
      referenzId: row.id,
      metadaten: {
        neuer_status: input.status,
        aktion: aktionsInfo.typ,
        aktion_ziel: aktionsInfo.ziel,
        referenz_typ: row.referenzTyp,
        referenz_id: row.referenzId,
      },
    });
  } catch {
    // Audit-Failure darf den Erfolg nicht blockieren.
  }

  return Response.json({ meldung: updatedRow });
}
