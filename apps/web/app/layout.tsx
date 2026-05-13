import type { Metadata } from 'next';
import './globals.css';
import './landingpages.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? 'http://localhost:3210'),
  title: {
    default: 'Werkzirkel — Gemeinsam digitale Produkte bauen',
    template: '%s — Werkzirkel',
  },
  description:
    'Werkzirkel verbindet unabhängige digitale Macher:innen in Hamburg — mit Bedarfsträger:innen und Förder:innen aus derselben Stadt. Werkstatt-Kultur, kein Marktplatz.',
  openGraph: {
    type: 'website',
    locale: 'de_DE',
    siteName: 'Werkzirkel',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
