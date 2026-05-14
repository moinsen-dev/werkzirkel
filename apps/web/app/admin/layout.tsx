/**
 * Layout fuer /admin/*.
 *
 * - Pruefen, ob eingeloggt → sonst /anmelden mit next-Redirect.
 * - Pruefen, ob Admin-Rolle → sonst 403-Callout. Wir verzichten bewusst auf
 *   `notFound()` (damit Admins beim Tippfehler einer Unter-Route eine klare
 *   Meldung sehen), sondern rendern eine 403-Seite.
 * - Gemeinsame Admin-Navigation am oberen Rand.
 *
 * PRD-Referenz: §15.14, §26.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { getSessionFromRequest } from '@/lib/auth/session';
import { istAdmin } from '@/lib/auth/permissions';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

async function buildRequestFromHeaders(): Promise<Request> {
  const h = await headers();
  const headerInit: Record<string, string> = {};
  for (const [name, value] of h.entries()) {
    headerInit[name] = value;
  }
  return new Request('http://internal.werkzirkel/admin', {
    headers: headerInit,
  });
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const req = await buildRequestFromHeaders();
  const sess = await getSessionFromRequest(req);
  if (!sess) {
    redirect('/anmelden?next=/admin');
  }

  // 403-Seite fuer Nicht-Admins. Statt redirect, damit Tests den Status sehen
  // und User klar erkennt, dass die Berechtigung fehlt.
  if (!istAdmin(sess.nutzer)) {
    return (
      <div className="page-shell">
        <main className="section compact">
          <div className="wrap">
            <div
              role="alert"
              className="callout"
              style={{ padding: 16, borderRadius: 12 }}
              data-testid="admin-403"
            >
              <strong>403 — Kein Zugriff.</strong>
              <p style={{ marginTop: 8 }}>
                Dieser Bereich ist nur Admins vorbehalten.
              </p>
              <p style={{ marginTop: 8 }}>
                <Link href="/uebersicht">Zur Uebersicht</Link>
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <nav className="site-nav" aria-label="Admin-Navigation">
        <div className="wrap nav-inner">
          <Link href="/uebersicht" className="brand">
            <span>Werkzirkel · Admin</span>
          </Link>
          <div className="nav-links">
            <Link href="/admin">Dashboard</Link>
            <Link href="/admin/nutzer">Nutzer:innen</Link>
            <Link href="/admin/staedte">Staedte</Link>
            <Link href="/admin/audit-log">Audit-Log</Link>
            <Link href="/admin/email-log">E-Mail-Log</Link>
            <Link href="/admin/werkstatt-kasse">Kasse</Link>
            <Link href="/admin/konfiguration">Konfiguration</Link>
          </div>
        </div>
      </nav>
      {children}
    </div>
  );
}
