/**
 * sitemap.ts — Next-natives Routing fuer /sitemap.xml.
 *
 * Listet alle public-Routen plus dynamische Inhalte:
 *  - Statische Pages: /, /bedarf, /foerdern, /anmelden, /werke, /termine,
 *    /pruefrunden, /impressum, /datenschutz, /agb, /regeln, /streitschlichtung,
 *    /cookies
 *  - Dynamische Werke (sichtbarkeit='oeffentlich', status='aktiv')
 *  - Dynamische Werkpaesse (Macher:innen mit status='aktiv', rolle macher,
 *    Werkpass nicht-gesperrt)
 *  - Dynamische Termine (status='veroeffentlicht')
 *  - Zirkel-Staedte (status='aktiv'|'vorbereitung')
 *
 * Hard rules:
 *  - Niemals private/auth-only Routen in sitemap aufnehmen
 *  - Niemals Werke mit sichtbarkeit='pausiert' oder status='ausgeblendet'
 *  - Niemals Nutzer:innen mit status='gesperrt' oder 'loeschung_anstehend'
 *  - Robust gegen DB-Ausfall: bei Fehler nur statische Routen liefern,
 *    sitemap soll niemals 500en
 *
 * PRD-Referenz: §31 (SEO + dynamische sitemap.xml).
 */

import type { MetadataRoute } from 'next';
import { and, desc, eq, gt, inArray, sql } from 'drizzle-orm';

import { db } from '@/lib/db';
import { nutzer, stadt, termin, werk } from '@/lib/db/schema';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';
export const revalidate = 3600;

const APP_URL = env.APP_URL.replace(/\/+$/, '');

const STATISCHE_ROUTEN: Array<{
  pfad: string;
  prio: number;
  freq: MetadataRoute.Sitemap[number]['changeFrequency'];
}> = [
  { pfad: '/', prio: 1.0, freq: 'weekly' },
  { pfad: '/bedarf', prio: 0.9, freq: 'monthly' },
  { pfad: '/foerdern', prio: 0.9, freq: 'monthly' },
  { pfad: '/werke', prio: 0.9, freq: 'daily' },
  { pfad: '/termine', prio: 0.9, freq: 'daily' },
  { pfad: '/pruefrunden', prio: 0.7, freq: 'daily' },
  { pfad: '/anmelden', prio: 0.5, freq: 'monthly' },
  { pfad: '/registrieren', prio: 0.5, freq: 'monthly' },
  { pfad: '/impressum', prio: 0.3, freq: 'yearly' },
  { pfad: '/datenschutz', prio: 0.3, freq: 'yearly' },
  { pfad: '/agb', prio: 0.3, freq: 'yearly' },
  { pfad: '/regeln', prio: 0.3, freq: 'yearly' },
  { pfad: '/streitschlichtung', prio: 0.2, freq: 'yearly' },
  { pfad: '/cookies', prio: 0.2, freq: 'yearly' },
];

const ZIRKEL_SLUGS = ['hamburg', 'berlin', 'muenchen'] as const;

/**
 * Schreibwerk-Limit pro Eintragstyp. Sitemap-XML spez. erlaubt 50k URLs, aber
 * Suchmaschinen indexieren in der Praxis nur die ersten Tausend gut — und wir
 * wollen die DB nicht jede Stunde mit 50k-Selects schlagen.
 */
const SITEMAP_LIMIT = 5000;

async function ladeWerkeUrls(): Promise<MetadataRoute.Sitemap> {
  try {
    const rows = await db
      .select({
        id: werk.id,
        aktualisiertAm: werk.aktualisiertAm,
      })
      .from(werk)
      .where(and(eq(werk.sichtbarkeit, 'oeffentlich'), eq(werk.status, 'aktiv')))
      .orderBy(desc(werk.aktualisiertAm))
      .limit(SITEMAP_LIMIT);
    return rows.map((r) => ({
      url: `${APP_URL}/werke/${r.id}`,
      lastModified: r.aktualisiertAm,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    }));
  } catch (err) {
    console.error('[sitemap] werke-load fehlgeschlagen:', err);
    return [];
  }
}

async function ladeWerkpassUrls(): Promise<MetadataRoute.Sitemap> {
  try {
    const rows = await db
      .select({
        id: nutzer.id,
        aktualisiertAm: nutzer.aktualisiertAm,
      })
      .from(nutzer)
      .where(
        and(
          eq(nutzer.status, 'aktiv'),
          sql`${nutzer.rollen} @> ARRAY['macher']::text[]`,
        ),
      )
      .orderBy(desc(nutzer.aktualisiertAm))
      .limit(SITEMAP_LIMIT);
    return rows.map((r) => ({
      url: `${APP_URL}/werkpass/${r.id}`,
      lastModified: r.aktualisiertAm,
      changeFrequency: 'weekly' as const,
      priority: 0.5,
    }));
  } catch (err) {
    console.error('[sitemap] werkpaesse-load fehlgeschlagen:', err);
    return [];
  }
}

async function ladeTermineUrls(): Promise<MetadataRoute.Sitemap> {
  try {
    const rows = await db
      .select({
        id: termin.id,
        aktualisiertAm: termin.aktualisiertAm,
      })
      .from(termin)
      .where(
        and(
          eq(termin.status, 'veroeffentlicht'),
          // Vergangene Termine bleiben drin (Archivwert), aber nicht weiter
          // zurueck als ein Jahr, damit die sitemap nicht endlos waechst.
          gt(termin.datumUhrzeit, new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)),
        ),
      )
      .orderBy(desc(termin.datumUhrzeit))
      .limit(SITEMAP_LIMIT);
    return rows.map((r) => ({
      url: `${APP_URL}/termine/${r.id}`,
      lastModified: r.aktualisiertAm,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    }));
  } catch (err) {
    console.error('[sitemap] termine-load fehlgeschlagen:', err);
    return [];
  }
}

async function ladeZirkelUrls(): Promise<MetadataRoute.Sitemap> {
  try {
    const rows = await db
      .select({
        id: stadt.id,
        aktualisiertAm: stadt.aktualisiertAm,
        status: stadt.status,
      })
      .from(stadt)
      .where(inArray(stadt.status, ['aktiv', 'vorbereitung']));
    // Slug-Mapping wie in /zirkel/[stadt]/page.tsx
    const SLUG: Record<string, string> = { hh: 'hamburg', b: 'berlin', m: 'muenchen' };
    return rows.map((r) => ({
      url: `${APP_URL}/zirkel/${SLUG[r.id] ?? r.id}`,
      lastModified: r.aktualisiertAm,
      changeFrequency: 'weekly' as const,
      priority: r.status === 'aktiv' ? 0.8 : 0.4,
    }));
  } catch (err) {
    console.error('[sitemap] zirkel-load fehlgeschlagen:', err);
    // Fallback: statische Slugs ohne lastModified.
    return ZIRKEL_SLUGS.map((slug) => ({
      url: `${APP_URL}/zirkel/${slug}`,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    }));
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const statisch: MetadataRoute.Sitemap = STATISCHE_ROUTEN.map((r) => ({
    url: `${APP_URL}${r.pfad}`,
    lastModified: now,
    changeFrequency: r.freq,
    priority: r.prio,
  }));

  const [werkeUrls, werkpaesseUrls, termineUrls, zirkelUrls] = await Promise.all([
    ladeWerkeUrls(),
    ladeWerkpassUrls(),
    ladeTermineUrls(),
    ladeZirkelUrls(),
  ]);

  return [...statisch, ...zirkelUrls, ...werkeUrls, ...termineUrls, ...werkpaesseUrls];
}
