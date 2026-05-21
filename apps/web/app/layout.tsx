import type { Metadata } from 'next';
import { headers } from 'next/headers';
import './globals.css';
import './landingpages.css';
import BottomTabBar from '@/components/ui/bottom-tab-bar';
import { getSessionIdFromRequest } from '@/lib/auth/session';

const DEFAULT_TITLE = 'Werkzirkel — Gemeinsam digitale Produkte bauen';
const DEFAULT_DESCRIPTION =
  'Werkzirkel verbindet unabhängige digitale Builder:innen in Hamburg — mit Auftraggeber:innen und Sponsor:innen aus derselben Stadt. Build-Kultur, kein Marktplatz.';
const DEFAULT_OG_IMAGE = '/og-default.png';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? 'http://localhost:3210'),
  title: {
    default: DEFAULT_TITLE,
    template: '%s — Werkzirkel',
  },
  description: DEFAULT_DESCRIPTION,
  openGraph: {
    type: 'website',
    locale: 'de_DE',
    siteName: 'Werkzirkel',
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: [
      {
        url: DEFAULT_OG_IMAGE,
        width: 1200,
        height: 630,
        alt: 'Werkzirkel — Build-Kultur fuer digitale Builder:innen',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: [DEFAULT_OG_IMAGE],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Session-Check fuer Bottom-Tab-Bar (PRD §30): nur eingeloggt anzeigen.
  // Wir checken hier nur das Cookie-Vorhandensein (kein DB-Lookup im Layout —
  // jede einzelne Page macht ihren eigenen Auth-Check). Das reicht, um anonyme
  // Besucher:innen NICHT die App-Navigation zu zeigen. Bei abgelaufener
  // Session sieht man die Bar kurz; der Klick auf einen Tab fuehrt dann zu
  // /anmelden — akzeptabel, kein Sicherheitsrisiko.
  const h = await headers();
  const headerInit: Record<string, string> = {};
  for (const [name, value] of h.entries()) headerInit[name] = value;
  const req = new Request('http://internal.werkzirkel/', {
    headers: headerInit,
  });
  const aktiv = getSessionIdFromRequest(req) !== null;

  return (
    <html lang="de">
      <body>
        <a href="#hauptinhalt" className="skip-link">
          Zum Hauptinhalt
        </a>
        <div id="hauptinhalt">{children}</div>
        <BottomTabBar aktiv={aktiv} />
      </body>
    </html>
  );
}
