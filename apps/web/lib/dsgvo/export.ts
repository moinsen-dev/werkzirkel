/**
 * DSGVO-Export-Aggregation (PRD §34, §15.2).
 *
 * Zentrale Aufbereitung aller personenbezogenen Daten einer Nutzer:in zu
 * einem serialisierbaren JSON-Objekt. Wird sowohl von
 *   GET /api/v1/me/export                (interaktiv durch Nutzer:in)
 * als auch vom Cron-Job
 *   /api/v1/cron/konto-loeschung-frist-abgelaufen
 * (Anhang an T-005) verwendet — daher als wiederverwendbarer Helper.
 *
 * Privacy-Cross-Cut (DSGVO §15 Auskunftsrecht vs §13 Datenminimierung):
 * Feedbacks, die der/die Nutzer:in als Tester:in zu fremden Werken gegeben hat,
 * leaken NICHT die Identitaet der Werk-Inhaber:innen. Wir liefern nur den
 * Werk-Titel, niemals den/die Werk-Inhaber:in (E-Mail, Klarname, Anzeigename).
 *
 * Audit-Log auf die letzten 12 Monate begrenzt (sonst sprengt es den Dump).
 */

import { and, desc, eq, gt, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  auditLog,
  bedarf,
  erfolgsbeitrag,
  feedback,
  foerdermitgliedschaft,
  foerderprofil,
  nutzer as nutzerTable,
  pruefrunde,
  terminAnmeldung,
  werk,
  werkangebot,
  werkHistorie,
  werkstattbeitrag,
} from '@/lib/db/schema';

export interface ExportObjekt {
  exportiert_am: string;
  exportiert_fuer: { id: string; email: string };
  profil: Record<string, unknown>;
  werke: unknown[];
  pruefrunden_eigene: unknown[];
  pruefrunden_gegebene: unknown[];
  bedarfe: unknown[];
  werkangebote: unknown[];
  foerderprofil: unknown;
  termin_anmeldungen: unknown[];
  werkstattbeitraege: unknown[];
  erfolgsbeitraege: unknown[];
  foerdermitgliedschaft: unknown;
  audit: unknown[];
}

/**
 * Aggregiert alle personenbezogenen Daten der Nutzer:in zu einem
 * serialisierbaren Objekt. Laedt die Nutzer-Row selbst falls noetig.
 *
 * Reihenfolge der Felder bewusst stabil — der Dump dient auch als
 * menschenlesbares Auskunfts-Dokument.
 */
export async function buildExport(
  nutzerId: string,
  nutzerRow?: typeof nutzerTable.$inferSelect,
): Promise<ExportObjekt> {
  const profil = nutzerRow
    ? nutzerRow
    : (
        await db.select().from(nutzerTable).where(eq(nutzerTable.id, nutzerId)).limit(1)
      )[0];
  if (!profil) {
    throw new Error(`buildExport: Nutzer ${nutzerId} nicht gefunden.`);
  }

  // ── Werke + Werk-Historie ────────────────────────────────────────────────
  const werkeRows = await db.select().from(werk).where(eq(werk.nutzerId, nutzerId));
  const werkIds = werkeRows.map((w) => w.id);
  const historieRows = werkIds.length
    ? await db.select().from(werkHistorie).where(inArray(werkHistorie.werkId, werkIds))
    : [];
  const historieByWerk = new Map<string, typeof historieRows>();
  for (const h of historieRows) {
    const list = historieByWerk.get(h.werkId) ?? [];
    list.push(h);
    historieByWerk.set(h.werkId, list);
  }
  const werkeMitHistorie = werkeRows.map((w) => ({
    ...w,
    werk_historie: historieByWerk.get(w.id) ?? [],
  }));

  // ── Pruefrunden auf eigene Werke (mit anonymisierten Feedbacks) ──────────
  const pruefrundenEigene = werkIds.length
    ? await db.select().from(pruefrunde).where(inArray(pruefrunde.werkId, werkIds))
    : [];
  const pruefrundenEigeneIds = pruefrundenEigene.map((p) => p.id);
  const feedbacksErhalten = pruefrundenEigeneIds.length
    ? await db
        .select()
        .from(feedback)
        .where(inArray(feedback.pruefrundeId, pruefrundenEigeneIds))
    : [];
  const feedbacksByPruefrunde = new Map<string, typeof feedbacksErhalten>();
  for (const f of feedbacksErhalten) {
    const list = feedbacksByPruefrunde.get(f.pruefrundeId) ?? [];
    list.push({ ...f, testerId: null });
    feedbacksByPruefrunde.set(f.pruefrundeId, list);
  }
  const pruefrundenEigeneOut = pruefrundenEigene.map((p) => ({
    ...p,
    feedbacks_erhalten: feedbacksByPruefrunde.get(p.id) ?? [],
  }));

  // ── Eigene Feedbacks als Tester:in (Privacy-Cross-Cut!) ──────────────────
  const eigeneFeedbacks = await db
    .select({
      id: feedback.id,
      pruefrundeId: feedback.pruefrundeId,
      gesamteindruck: feedback.gesamteindruck,
      ersterEindruck: feedback.ersterEindruck,
      verstaendlichkeit: feedback.verstaendlichkeit,
      nutzen: feedback.nutzen,
      bedienbarkeit: feedback.bedienbarkeit,
      fehler: feedback.fehler,
      positionierung: feedback.positionierung,
      zahlungsbereitschaft: feedback.zahlungsbereitschaft,
      verbesserungen: feedback.verbesserungen,
      hilfreichMarkiert: feedback.hilfreichMarkiert,
      hilfreichMarkiertAm: feedback.hilfreichMarkiertAm,
      erstelltAm: feedback.erstelltAm,
      werk_titel: werk.name,
    })
    .from(feedback)
    .innerJoin(pruefrunde, eq(pruefrunde.id, feedback.pruefrundeId))
    .innerJoin(werk, eq(werk.id, pruefrunde.werkId))
    .where(eq(feedback.testerId, nutzerId));

  // ── Bedarfe / Werkangebote / Foerderprofil / Termine / Beitraege ────────
  const bedarfeRows = await db.select().from(bedarf).where(eq(bedarf.nutzerId, nutzerId));
  const werkangeboteRows = await db
    .select()
    .from(werkangebot)
    .where(eq(werkangebot.macherId, nutzerId));
  const foerderprofilRows = await db
    .select()
    .from(foerderprofil)
    .where(eq(foerderprofil.nutzerId, nutzerId))
    .limit(1);
  const terminAnmeldungenRows = await db
    .select()
    .from(terminAnmeldung)
    .where(eq(terminAnmeldung.nutzerId, nutzerId));
  const werkstattbeitraegeRows = await db
    .select()
    .from(werkstattbeitrag)
    .where(eq(werkstattbeitrag.nutzerId, nutzerId));
  const erfolgsbeitraegeRows = await db
    .select()
    .from(erfolgsbeitrag)
    .where(eq(erfolgsbeitrag.zahlerNutzerId, nutzerId));
  const foerdermitgliedschaftRows = await db
    .select()
    .from(foerdermitgliedschaft)
    .where(eq(foerdermitgliedschaft.nutzerId, nutzerId))
    .limit(1);

  // ── Audit (12 Monate) ────────────────────────────────────────────────────
  const twelveMonthsAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
  const auditRows = await db
    .select()
    .from(auditLog)
    .where(and(eq(auditLog.nutzerId, nutzerId), gt(auditLog.erstelltAm, twelveMonthsAgo)))
    .orderBy(desc(auditLog.erstelltAm));

  return {
    exportiert_am: new Date().toISOString(),
    exportiert_fuer: { id: profil.id, email: profil.email },
    profil: {
      id: profil.id,
      email: profil.email,
      klarname: profil.klarname,
      anzeigename: profil.anzeigename,
      stadt_id: profil.stadtId,
      kurzbeschreibung: profil.kurzbeschreibung,
      faehigkeiten: profil.faehigkeiten,
      interessen: profil.interessen,
      rollen: profil.rollen,
      website: profil.website,
      github: profil.github,
      linkedin: profil.linkedin,
      mastodon: profil.mastodon,
      avatar_url: profil.avatarUrl,
      teilnahmeart: profil.teilnahmeart,
      foerdermitglied_seit: profil.foerdermitgliedSeit,
      foerdermitglied_bis: profil.foerdermitgliedBis,
      benachrichtigungs_einstellungen: profil.benachrichtigungsEinstellungen,
      erstellt_am: profil.erstelltAm,
      aktualisiert_am: profil.aktualisiertAm,
    },
    werke: werkeMitHistorie,
    pruefrunden_eigene: pruefrundenEigeneOut,
    pruefrunden_gegebene: eigeneFeedbacks,
    bedarfe: bedarfeRows,
    werkangebote: werkangeboteRows,
    foerderprofil: foerderprofilRows[0] ?? null,
    termin_anmeldungen: terminAnmeldungenRows,
    werkstattbeitraege: werkstattbeitraegeRows,
    erfolgsbeitraege: erfolgsbeitraegeRows,
    foerdermitgliedschaft: foerdermitgliedschaftRows[0] ?? null,
    audit: auditRows,
  };
}
