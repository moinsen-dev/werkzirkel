/**
 * /werke/[id] — Oeffentliche Werk-Detailseite (Server Component).
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
 * Werkstand-Verlauf:
 * - Letzte 10 werk_historie-Eintraege absteigend chronologisch (PRD §13.6).
 * - Inhaber:in der Aenderung nur via anzeigename, NIE klarname/email.
 *
 * JSON-LD:
 * - schema.org CreativeWork — siehe `werk-detail-view.tsx` (buildJsonLd).
 */

import type { Metadata } from 'next';
import { desc, eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import { db } from '@/lib/db';
import {
  nutzer,
  stadt,
  werk,
  werkHistorie,
} from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';
import WerkDetailView, {
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

  const [stadtName, historie] = await Promise.all([
    ladeStadtName(raw.inhaberStadtId),
    ladeHistorie(raw.werk.id),
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
      istInhaber={istInhaber}
      istEingeloggt={!!sess}
    />
  );
}
