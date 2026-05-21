/**
 * /werke/[id] — Oeffentliche Build-Detailseite (Server Component).
 *
 * Quelle: PRD §F-101 bis §F-106 (Werk-CRUD, Sichtbarkeit) + §8.3 (Pflichtfelder).
 *
 * Zugriffs-Logik:
 * - Werk nicht vorhanden → notFound() (deutsche 404-Seite via app/not-found.tsx).
 * - Werk mit sichtbarkeit='pausiert' ODER status='ausgeblendet' → notFound(),
 *   ausser der Aufrufer ist die Inhaber:in.
 *
 * Inhaber:innen-Daten:
 * - NUR public Felder werden geselectet (id, anzeigename, avatarUrl, stadtId,
 *   foerdermitgliedSeit/bis). KEIN email, KEIN klarname.
 * - Foerdermitgliedschaft-Status wird aus den Datums-Feldern abgeleitet, damit
 *   wir keine Stripe-Felder leaken.
 *
 * Build-Stand-Verlauf:
 * - Letzte 10 werk_historie-Eintraege absteigend chronologisch (PRD §13.6).
 * - Inhaber:in der Aenderung nur via anzeigename, NIE klarname/email.
 *
 * JSON-LD:
 * - schema.org CreativeWork — siehe `werk-detail-view.tsx` (buildJsonLd).
 */

import type { Metadata } from 'next';
import { and, asc, desc, eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import { db } from '@/lib/db';
import {
  feedback,
  nutzer,
  pruefrunde,
  stadt,
  werk,
  werkHistorie,
} from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';
import WerkDetailView, {
  type WerkDetailHilfreichFeedback,
  type WerkDetailHistorieEintrag,
  type WerkDetailInhaber,
} from './werk-detail-view';

interface PageParams {
  params: Promise<{ id: string }>;
}

async function buildRequestFromHeaders(): Promise<Request> {
  const h = await headers();
  const headerInit: Record<string, string> = {};
  for (const [name, value] of h.entries()) {
    headerInit[name] = value;
  }
  return new Request('http://internal.werkzirkel/werke', {
    headers: headerInit,
  });
}

async function ladeWerk(id: string) {
  const rows = await db
    .select({
      werk,
      inhaberId: nutzer.id,
      inhaberAnzeigename: nutzer.anzeigename,
      inhaberAvatarUrl: nutzer.avatarUrl,
      inhaberStadtId: nutzer.stadtId,
      inhaberFoerdermitgliedSeit: nutzer.foerdermitgliedSeit,
      inhaberFoerdermitgliedBis: nutzer.foerdermitgliedBis,
    })
    .from(werk)
    .innerJoin(nutzer, eq(nutzer.id, werk.nutzerId))
    .where(eq(werk.id, id))
    .limit(1);
  return rows[0] ?? null;
}

function istFoerdermitgliedAktiv(opts: {
  seit: Date | null;
  bis: Date | null;
}): boolean {
  if (!opts.seit) return false;
  const now = Date.now();
  if (opts.seit.getTime() > now) return false;
  if (opts.bis && opts.bis.getTime() < now) return false;
  return true;
}

async function ladeStadtName(stadtId: string): Promise<string> {
  const rows = await db
    .select({ name: stadt.name })
    .from(stadt)
    .where(eq(stadt.id, stadtId))
    .limit(1);
  return rows[0]?.name ?? '';
}

async function ladeHistorie(werkId: string): Promise<WerkDetailHistorieEintrag[]> {
  const rows = await db
    .select({
      werkstandAlt: werkHistorie.werkstandAlt,
      werkstandNeu: werkHistorie.werkstandNeu,
      geaendertAm: werkHistorie.geaendertAm,
      geaendertVonAnzeigename: nutzer.anzeigename,
    })
    .from(werkHistorie)
    .leftJoin(nutzer, eq(nutzer.id, werkHistorie.geaendertVon))
    .where(eq(werkHistorie.werkId, werkId))
    .orderBy(desc(werkHistorie.geaendertAm))
    .limit(10);
  return rows.map((r) => ({
    werkstandAlt: r.werkstandAlt,
    werkstandNeu: r.werkstandNeu,
    geaendertAm: r.geaendertAm,
    geaendertVonAnzeigename: r.geaendertVonAnzeigename,
  }));
}

/**
 * Lädt anonymisierte Hilfreich-Feedback-Summary für ein Werk (PRD §8.4).
 * Tester-Identität wird komplett gestrippt — sequentielle Labels statt
 * Namen. Reihenfolge: hilfreich_markiert_am ASC für stabile Labels.
 */
async function ladeHilfreichFeedbacks(
  werkId: string,
): Promise<WerkDetailHilfreichFeedback[]> {
  const rows = await db
    .select({
      gesamteindruck: feedback.gesamteindruck,
      ersterEindruck: feedback.ersterEindruck,
      verstaendlichkeit: feedback.verstaendlichkeit,
      nutzen: feedback.nutzen,
      bedienbarkeit: feedback.bedienbarkeit,
      verbesserungen: feedback.verbesserungen,
      hilfreichMarkiertAm: feedback.hilfreichMarkiertAm,
    })
    .from(feedback)
    .innerJoin(pruefrunde, eq(pruefrunde.id, feedback.pruefrundeId))
    .where(
      and(eq(pruefrunde.werkId, werkId), eq(feedback.hilfreichMarkiert, true)),
    )
    .orderBy(asc(feedback.hilfreichMarkiertAm));
  return rows.map((r, index) => ({
    testerLabel: `Tester:in ${index + 1}`,
    gesamteindruck: r.gesamteindruck,
    ersterEindruck: r.ersterEindruck,
    verstaendlichkeit: r.verstaendlichkeit,
    nutzen: r.nutzen,
    bedienbarkeit: r.bedienbarkeit,
    verbesserungen: r.verbesserungen,
    hilfreichMarkiertAm: r.hilfreichMarkiertAm,
  }));
}

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { id } = await params;
  const row = await ladeWerk(id);
  if (!row) {
    return { title: 'Nicht gefunden', robots: { index: false, follow: false } };
  }
  const versteckt =
    row.werk.status === 'ausgeblendet' || row.werk.sichtbarkeit === 'pausiert';
  if (versteckt) {
    return { title: 'Nicht gefunden', robots: { index: false, follow: false } };
  }
  const screenshots = row.werk.screenshots ?? [];
  const ogImage = screenshots[0];
  return {
    title: row.werk.name,
    description: row.werk.kurzbeschreibung,
    openGraph: {
      title: row.werk.name,
      description: row.werk.kurzbeschreibung,
      type: 'article',
      ...(ogImage ? { images: [{ url: ogImage }] } : {}),
    },
  };
}

export default async function WerkPage({ params }: PageParams) {
  const { id } = await params;

  // Session-Check NUR um zu wissen, ob "eigene Sicht" greift — die Page bleibt
  // public, kein redirect.
  const req = await buildRequestFromHeaders();
  const sess = await getSessionFromRequest(req).catch(() => null);

  // Zwei-Phasen-Load: erst ohne istInhaber pruefen, dann mit (sonst muessten wir
  // zweimal laden). Wir laden einmal und entscheiden danach.
  const raw = await ladeWerk(id);
  if (!raw) notFound();
  // `status='ausgeblendet'` ist eine Moderations-Massnahme — IMMER 404, auch
  // fuer die Inhaber:in (sie sieht ihr Werk im Bearbeiten-Pfad, nicht hier).
  if (raw.werk.status === 'ausgeblendet') {
    notFound();
  }
  // `sichtbarkeit='pausiert'` ist gewollt-versteckt — die Inhaber:in darf das
  // eigene pausierte Werk sehen, alle anderen bekommen 404.
  const istInhaber = !!sess && sess.nutzerId === raw.werk.nutzerId;
  if (raw.werk.sichtbarkeit === 'pausiert' && !istInhaber) {
    notFound();
  }

  const [stadtName, historie, hilfreichFeedbacks] = await Promise.all([
    ladeStadtName(raw.inhaberStadtId),
    ladeHistorie(raw.werk.id),
    ladeHilfreichFeedbacks(raw.werk.id),
  ]);

  const inhaber: WerkDetailInhaber = {
    id: raw.inhaberId,
    anzeigename: raw.inhaberAnzeigename,
    avatarUrl: raw.inhaberAvatarUrl,
    stadtId: raw.inhaberStadtId,
    istFoerdermitglied: istFoerdermitgliedAktiv({
      seit: raw.inhaberFoerdermitgliedSeit,
      bis: raw.inhaberFoerdermitgliedBis,
    }),
  };

  return (
    <WerkDetailView
      werk={raw.werk}
      inhaber={inhaber}
      stadtName={stadtName}
      historie={historie}
      hilfreichFeedbacks={hilfreichFeedbacks}
      istInhaber={istInhaber}
      istEingeloggt={!!sess}
    />
  );
}
