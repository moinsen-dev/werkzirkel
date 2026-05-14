/**
 * robots.ts — Next-natives Routing fuer /robots.txt.
 *
 * Erlaubt alle public-Routen, verbietet alles unter:
 *   /api/        (REST-Endpunkte)
 *   /admin/      (Admin-Backoffice)
 *   /kurator/    (Kurator:innen-Bereich)
 *   /uebersicht/ (eingeloggter Bereich)
 *   /einstellungen/ (Konto-Einstellungen)
 *   /bedarfe/    (Detail-Seiten — Bedarf-Liste ist auth-protected)
 *   /werkangebote/ (Vermittlungsseite — auth-protected)
 *
 * PRD-Referenz: §31 (SEO + robots.txt).
 */

import type { MetadataRoute } from 'next';

import { env } from '@/lib/env';

const APP_URL = env.APP_URL.replace(/\/+$/, '');

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/admin/',
          '/kurator/',
          '/uebersicht/',
          '/einstellungen/',
          '/bedarfe/',
          '/werkangebote/',
        ],
      },
    ],
    sitemap: `${APP_URL}/sitemap.xml`,
    host: APP_URL,
  };
}
