/**
 * /werkpass/[id] — Oeffentliche Werkpass-Seite (Server Component).
 *
 * Quelle: PRD §8 (Werke statt Werkpaesse — Werkpass zeigt eigene Werke
 * prominent, Bio bleibt klein), Reziprozitaets-Saldo aus §F-301 ff.
 *
 * Zugriffs-Logik:
 * - Nutzer:in nicht vorhanden → notFound().
 * - status IN ('gesperrt', 'loeschung_anstehend') → notFound().
 * - `'macher'` nicht in `rollen` → notFound() (Werkpass ist Macher:innen-Konzept).
 *
 * Hard rules:
 * - NUR public Felder werden geselectet. KEIN email, KEIN klarname,
 *   KEINE stripe-IDs, KEINE benachrichtigungs_einstellungen.
 * - Werke-Vorschau zeigt nur sichtbarkeit IN ('oeffentlich','nur_zirkel') AND
 *   status='aktiv', sortiert nach aktualisiert_am DESC, limit 12.
 * - test_saldo: left join, fehlende Row → 0/0/0.
 * - Foerdermitgliedschaft: nur `status='aktiv'` ist ein Badge — Stripe-IDs
 *   werden in der Query gar nicht erst geselectet.
 */

import type { Metadata } from 'next';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { notFound } from 'next/navigation';

import { db } from '@/lib/db';
import {
  foerdermitgliedschaft,
  nutzer,
  stadt,
  testSaldo,
  werk,
} from '@/lib/db/schema';

import WerkpassView, {
  type WerkpassNutzer,
  type WerkpassTestSaldo,
  type WerkpassWerk,
} from './werkpass-view';

interface PageParams {
  params: Promise<{ id: string }>;
}

const WERKE_VORSCHAU = 12;

interface NutzerPublicRow {
  id: string;
  anzeigename: string;
  avatarUrl: string | null;
  stadtId: string;
  kurzbeschreibung: string | null;
  faehigkeiten: string[];
  interessen: string[];
  website: string | null;
  github: string | null;
  linkedin: string | null;
  mastodon: string | null;
  teilnahmeart: string | null;
  rollen: string[];
  status: string;
}

async function ladeNutzerPublic(
  id: string,
): Promise<NutzerPublicRow | null> {
  const rows = await db
    .select({
      id: nutzer.id,
      anzeigename: nutzer.anzeigename,
      avatarUrl: nutzer.avatarUrl,
      stadtId: nutzer.stadtId,
      kurzbeschreibung: nutzer.kurzbeschreibung,
      faehigkeiten: nutzer.faehigkeiten,
      interessen: nutzer.interessen,
      website: nutzer.website,
      github: nutzer.github,
      linkedin: nutzer.linkedin,
      mastodon: nutzer.mastodon,
      teilnahmeart: nutzer.teilnahmeart,
      rollen: nutzer.rollen,
      status: nutzer.status,
    })
    .from(nutzer)
    .where(eq(nutzer.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    anzeigename: row.anzeigename,
    avatarUrl: row.avatarUrl,
    stadtId: row.stadtId,
    kurzbeschreibung: row.kurzbeschreibung,
    faehigkeiten: row.faehigkeiten ?? [],
    interessen: row.interessen ?? [],
    website: row.website,
    github: row.github,
    linkedin: row.linkedin,
    mastodon: row.mastodon,
    teilnahmeart: row.teilnahmeart,
    rollen: (row.rollen ?? []) as string[],
    status: row.status,
  };
}

/**
 * Sichtbarkeits-Check: 404 wenn Nutzer:in nicht oeffentlich darstellbar ist.
 *
 * Bewusst symmetrisch zu Werk-Detail: gesperrte oder zur Loeschung
 * vorgemerkte Konten sind nicht oeffentlich. `pausiert` bleibt sichtbar,
 * weil die Nutzer:in nur Anmeldungen pausiert — bisherige Werke bleiben.
 */
function istOeffentlichDarstellbar(row: NutzerPublicRow): boolean {
  if (row.status === 'gesperrt' || row.status === 'loeschung_anstehend') {
    return false;
  }
  if (!row.rollen.includes('macher')) return false;
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

async function ladeTestSaldo(
  nutzerId: string,
): Promise<WerkpassTestSaldo> {
  const rows = await db
    .select({
      testsGegeben: testSaldo.testsGegeben,
      testsErhalten: testSaldo.testsErhalten,
      offeneVerpflichtungAnzahl: testSaldo.offeneVerpflichtungAnzahl,
      naechsteVerpflichtungFrist: testSaldo.naechsteVerpflichtungFrist,
    })
    .from(testSaldo)
    .where(eq(testSaldo.nutzerId, nutzerId))
    .limit(1);
  const r = rows[0];
  if (!r) {
    return {
      testsGegeben: 0,
      testsErhalten: 0,
      offeneVerpflichtungAnzahl: 0,
      naechsteVerpflichtungFrist: null,
    };
  }
  return {
    testsGegeben: r.testsGegeben,
    testsErhalten: r.testsErhalten,
    offeneVerpflichtungAnzahl: r.offeneVerpflichtungAnzahl,
    naechsteVerpflichtungFrist: r.naechsteVerpflichtungFrist,
  };
}

async function ladeFoerderAktiv(nutzerId: string): Promise<boolean> {
  // NUR `status` und `id` selecten — Stripe-IDs bleiben unsichtbar fuer
  // die View-Schicht.
  const rows = await db
    .select({ id: foerdermitgliedschaft.id })
    .from(foerdermitgliedschaft)
    .where(
      and(
        eq(foerdermitgliedschaft.nutzerId, nutzerId),
        eq(foerdermitgliedschaft.status, 'aktiv'),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

interface WerkeResult {
  vorschau: WerkpassWerk[];
  gesamt: number;
}

async function ladeWerke(nutzerId: string): Promise<WerkeResult> {
  const rows = await db
    .select({
      id: werk.id,
      name: werk.name,
      kurzbeschreibung: werk.kurzbeschreibung,
      werkstand: werk.werkstand,
      hilfebedarf: werk.hilfebedarf,
      screenshots: werk.screenshots,
    })
    .from(werk)
    .where(
      and(
        eq(werk.nutzerId, nutzerId),
        eq(werk.status, 'aktiv'),
        inArray(werk.sichtbarkeit, ['oeffentlich', 'nur_zirkel']),
      ),
    )
    .orderBy(desc(werk.aktualisiertAm), desc(werk.id))
    .limit(WERKE_VORSCHAU + 1);
  // Gesamt-Anzahl ueber alle sichtbaren Werke — wir wollen anzeigen,
  // wie viele es insgesamt sind, auch jenseits der Vorschau.
  const allRows = await db
    .select({ id: werk.id })
    .from(werk)
    .where(
      and(
        eq(werk.nutzerId, nutzerId),
        eq(werk.status, 'aktiv'),
        inArray(werk.sichtbarkeit, ['oeffentlich', 'nur_zirkel']),
      ),
    );
  return {
    vorschau: rows.slice(0, WERKE_VORSCHAU).map((r) => ({
      id: r.id,
      name: r.name,
      kurzbeschreibung: r.kurzbeschreibung,
      werkstand: r.werkstand,
      hilfebedarf: r.hilfebedarf ?? [],
      screenshots: r.screenshots ?? [],
    })),
    gesamt: allRows.length,
  };
}

export async function generateMetadata({
  params,
}: PageParams): Promise<Metadata> {
  const { id } = await params;
  const row = await ladeNutzerPublic(id);
  if (!row || !istOeffentlichDarstellbar(row)) {
    return { title: 'Nicht gefunden', robots: { index: false, follow: false } };
  }
  const stadtName = await ladeStadtName(row.stadtId);
  const beschreibung =
    row.kurzbeschreibung ||
    `Werkpass von ${row.anzeigename}${stadtName ? ` im ${stadtName}` : ''}`;
  return {
    title: `Werkpass: ${row.anzeigename}`,
    description: beschreibung,
  };
}

export default async function WerkpassPage({ params }: PageParams) {
  const { id } = await params;

  const nutzerRow = await ladeNutzerPublic(id);
  if (!nutzerRow) notFound();
  if (!istOeffentlichDarstellbar(nutzerRow)) notFound();

  const [stadtName, saldo, werkeRes, foerderAktiv] = await Promise.all([
    ladeStadtName(nutzerRow.stadtId),
    ladeTestSaldo(nutzerRow.id),
    ladeWerke(nutzerRow.id),
    ladeFoerderAktiv(nutzerRow.id),
  ]);

  const viewNutzer: WerkpassNutzer = {
    id: nutzerRow.id,
    anzeigename: nutzerRow.anzeigename,
    avatarUrl: nutzerRow.avatarUrl,
    kurzbeschreibung: nutzerRow.kurzbeschreibung,
    faehigkeiten: nutzerRow.faehigkeiten,
    interessen: nutzerRow.interessen,
    website: nutzerRow.website,
    github: nutzerRow.github,
    linkedin: nutzerRow.linkedin,
    mastodon: nutzerRow.mastodon,
    teilnahmeart: nutzerRow.teilnahmeart as WerkpassNutzer['teilnahmeart'],
    stadtName,
    istFoerdermitglied: foerderAktiv,
  };

  return (
    <WerkpassView
      nutzer={viewNutzer}
      testSaldo={saldo}
      werke={werkeRes.vorschau}
      werkeGesamt={werkeRes.gesamt}
    />
  );
}
