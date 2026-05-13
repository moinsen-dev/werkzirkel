/**
 * GET + PATCH /api/v1/me
 *
 * Eigenes Profil lesen und aktualisieren. Quelle: PRD §F-001..§F-005, §13.2.
 *
 * - GET: liefert das vollstaendige eigene Profil inkl. Foerdermitgliedschaft.
 *   Reichhaltiger als `/api/v1/auth/me` (das nur das Auth-relevante Subset
 *   exposed — Sessions + Identitaet).
 * - PATCH: validiert per Zod (`nutzerProfilUpdateSchema`) und schreibt nur die
 *   uebermittelten Felder. CSRF-Schutz via Origin-Check.
 *
 * Klarname-Pflicht (§13.2 letzter Block) wird hier final geprueft: wenn der
 * PATCH die `rollen` so aendert, dass `bedarfstraeger` oder `foerderer` drin
 * sind, muss der RESULTIERENDE Klarname nicht-leer sein (eigener oder der
 * bisherige).
 */

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { foerdermitgliedschaft, nutzer } from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';
import { rejectIfBadOrigin } from '@/lib/auth/csrf';
import { mergeBenachrichtigungsEinstellungen } from '@/lib/notifications/defaults';
import {
  nutzerProfilUpdateSchema,
  rollenErforderlichKlarname,
} from '@/lib/validators/nutzer';

type NutzerRow = typeof nutzer.$inferSelect;

function serializeNutzer(n: NutzerRow): Record<string, unknown> {
  return {
    id: n.id,
    email: n.email,
    klarname: n.klarname,
    anzeigename: n.anzeigename,
    stadt_id: n.stadtId,
    kurzbeschreibung: n.kurzbeschreibung,
    faehigkeiten: n.faehigkeiten,
    interessen: n.interessen,
    rollen: n.rollen,
    website: n.website,
    github: n.github,
    linkedin: n.linkedin,
    mastodon: n.mastodon,
    avatar_url: n.avatarUrl,
    teilnahmeart: n.teilnahmeart,
    status: n.status,
    foerdermitglied_seit: n.foerdermitgliedSeit,
    foerdermitglied_bis: n.foerdermitgliedBis,
    benachrichtigungs_einstellungen: mergeBenachrichtigungsEinstellungen(
      n.benachrichtigungsEinstellungen,
    ),
    email_verifiziert_am: n.emailVerifiziertAm,
    erstellt_am: n.erstelltAm,
    aktualisiert_am: n.aktualisiertAm,
  };
}

export async function GET(req: Request): Promise<Response> {
  const sess = await getSessionFromRequest(req);
  if (!sess) {
    return Response.json({ fehler: 'unauthenticated' }, { status: 401 });
  }

  // Foerdermitgliedschaft (optional) mitliefern.
  const mitgliedschaftRows = await db
    .select()
    .from(foerdermitgliedschaft)
    .where(eq(foerdermitgliedschaft.nutzerId, sess.nutzerId))
    .limit(1);

  return Response.json({
    nutzer: serializeNutzer(sess.nutzer),
    foerdermitgliedschaft: mitgliedschaftRows[0] ?? null,
  });
}

export async function PATCH(req: Request): Promise<Response> {
  const originResp = rejectIfBadOrigin(req);
  if (originResp) return originResp;

  const sess = await getSessionFromRequest(req);
  if (!sess) {
    return Response.json({ fehler: 'unauthenticated' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ fehler: 'ungueltiger_body' }, { status: 400 });
  }

  const parsed = nutzerProfilUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { fehler: 'validierung', details: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }
  const patch = parsed.data;

  // ── Klarname-Pflicht-Cross-Check gegen den Endzustand ───────────────────
  const endRollen = patch.rollen ?? sess.nutzer.rollen;
  const endKlarname =
    patch.klarname !== undefined ? patch.klarname : sess.nutzer.klarname;
  if (rollenErforderlichKlarname(endRollen) && endKlarname.trim().length === 0) {
    return Response.json(
      {
        fehler: 'validierung',
        details: {
          klarname: [
            'Fuer Rollen Bedarfstraeger:in / Foerder:in ist ein Klarname Pflicht.',
          ],
        },
      },
      { status: 422 },
    );
  }

  // ── Build Update-Set (camelCase fuer Drizzle) ───────────────────────────
  const update: Partial<typeof nutzer.$inferInsert> = {};
  if (patch.klarname !== undefined) update.klarname = patch.klarname;
  if (patch.anzeigename !== undefined) update.anzeigename = patch.anzeigename;
  if (patch.stadtId !== undefined) update.stadtId = patch.stadtId;
  if (patch.kurzbeschreibung !== undefined) {
    update.kurzbeschreibung =
      patch.kurzbeschreibung === '' ? null : patch.kurzbeschreibung;
  }
  if (patch.faehigkeiten !== undefined) update.faehigkeiten = patch.faehigkeiten;
  if (patch.interessen !== undefined) update.interessen = patch.interessen;
  if (patch.rollen !== undefined) update.rollen = patch.rollen;
  if (patch.teilnahmeart !== undefined) update.teilnahmeart = patch.teilnahmeart;
  if (patch.website !== undefined) update.website = patch.website;
  if (patch.github !== undefined) update.github = patch.github;
  if (patch.linkedin !== undefined) update.linkedin = patch.linkedin;
  if (patch.mastodon !== undefined) update.mastodon = patch.mastodon;

  if (Object.keys(update).length === 0) {
    // Leerer Patch — einfach das aktuelle Profil zurueckgeben.
    return Response.json({ nutzer: serializeNutzer(sess.nutzer) });
  }

  update.aktualisiertAm = new Date();

  const updated = await db
    .update(nutzer)
    .set(update)
    .where(eq(nutzer.id, sess.nutzerId))
    .returning();

  const row = updated[0];
  if (!row) {
    return Response.json({ fehler: 'unbekannt' }, { status: 500 });
  }

  return Response.json({ nutzer: serializeNutzer(row) });
}
