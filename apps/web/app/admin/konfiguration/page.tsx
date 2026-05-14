/**
 * /admin/konfiguration — Stub fuer globale Plattform-Konfiguration.
 *
 * Geplant fuer spaetere Sprints:
 *   - Werkstattbeitrag-Skala (Stufen + Pflicht-Mindestbeitrag).
 *   - Foerdermitgliedschaft-Preise (monatlich/jaehrlich/privat/organisation).
 *   - Verbotene Woerter (Spam-Filter).
 *
 * Aktuell read-only Hinweis; die Werte werden noch in Code/Env gepflegt.
 *
 * Permission via /admin/layout.tsx.
 *
 * PRD-Referenz: §15.14 (Stub).
 */

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Konfiguration — Admin',
};

export default function AdminKonfigurationPage() {
  return (
    <>
      <header className="hero" id="top">
        <div className="wrap hero-grid single">
          <div>
            <p className="eyebrow">Werkzirkel · Admin · Konfiguration</p>
            <h1>Globale Konfiguration</h1>
            <p className="hero-copy">
              Plattformweite Einstellungen — derzeit nur Lese-Stub.
            </p>
          </div>
        </div>
      </header>

      <section className="section compact">
        <div className="wrap">
          <p
            data-testid="admin-konfiguration-stub"
            style={{ color: 'var(--muted)' }}
          >
            Die folgenden Bereiche werden in einem spaeteren Sprint editierbar.
            Aktuell sind sie als Code- oder Env-Variablen gepflegt.
          </p>

          <h2>Werkstattbeitrag-Skala</h2>
          <p>
            Stufen, Pflicht-Mindestbeitrag und Wahlbeitrag werden in
            <code> lib/werkstattbeitrag/skala.ts </code> definiert.
          </p>

          <h2 style={{ marginTop: 24 }}>Foerdermitgliedschaft-Preise</h2>
          <p>
            Monats- / Jahres-Beitraege fuer Privat- / Organisations-Foerderer
            werden in <code>lib/foerdermitgliedschaft/preise.ts</code> gepflegt,
            Stripe-Price-IDs ueber Env (<code>STRIPE_PRICE_*</code>).
          </p>

          <h2 style={{ marginTop: 24 }}>Verbotene Woerter</h2>
          <p>
            Spam-Filter-Liste fuer Sales-Sprech und Cold-Outreach. Aktuell in
            <code> lib/moderation/verbotene-woerter.ts </code> gepflegt.
          </p>
        </div>
      </section>
    </>
  );
}
