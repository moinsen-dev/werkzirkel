/**
 * /admin/werkstatt-kasse — Admin-Übersicht aller Städte mit Freigabe-Buttons.
 *
 * Listet alle Community-Pool-Einträge, gruppiert pro Stadt. Unfreigegebene
 * Einträge bekommen einen "Freigeben"-Button (Server Action, ruft die gleiche
 * Logik wie POST /api/v1/admin/werkstatt-kasse/:id/freigeben).
 *
 * Permission-Gate: nur Admins.
 *
 * PRD-Referenz: §8.11 (Admin-Freigabe).
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { desc, eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { auditLog, werkstattKasseEintrag } from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';
import { hasRolle } from '@/lib/auth/permissions';
import { kategorieLabel, euroFormat } from '@/lib/kasse/labels';

export const metadata: Metadata = {
  title: 'Community-Pool — Admin',
  robots: { index: false, follow: false },
};

interface PageProps {
  searchParams: Promise<{ ok?: string; fehler?: string }>;
}

async function buildRequestFromHeaders(): Promise<Request> {
  const h = await headers();
  const headerInit: Record<string, string> = {};
  for (const [name, value] of h.entries()) {
    headerInit[name] = value;
  }
  return new Request('http://internal.werkzirkel/admin/werkstatt-kasse', {
    headers: headerInit,
  });
}

export async function freigebenAction(formData: FormData): Promise<void> {
  'use server';
  const req = await buildRequestFromHeaders();
  const sess = await getSessionFromRequest(req);
  if (!sess) {
    redirect('/anmelden?next=/admin/werkstatt-kasse');
  }
  if (!hasRolle(sess.nutzer, 'admin')) {
    redirect('/admin/werkstatt-kasse?fehler=keine_rolle');
  }
  const id = String(formData.get('id') ?? '').trim();
  if (!id) {
    redirect('/admin/werkstatt-kasse?fehler=id_fehlt');
  }
  const rows = await db
    .select()
    .from(werkstattKasseEintrag)
    .where(eq(werkstattKasseEintrag.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) {
    redirect('/admin/werkstatt-kasse?fehler=nicht_gefunden');
  }
  if (!row.freigegebenAm) {
    const jetzt = new Date();
    await db
      .update(werkstattKasseEintrag)
      .set({ freigegebenDurch: sess.nutzerId, freigegebenAm: jetzt })
      .where(eq(werkstattKasseEintrag.id, id));
    try {
      await db.insert(auditLog).values({
        nutzerId: sess.nutzerId,
        aktion: 'werkstatt_kasse.freigegeben',
        referenzTyp: 'werkstatt_kasse_eintrag',
        referenzId: id,
        metadaten: {
          stadt_id: row.stadtId,
          typ: row.typ,
          kategorie: row.kategorie,
          hoehe_euro_cent: row.hoeheEuroCent,
        },
      });
    } catch {
      /* audit best-effort */
    }
  }
  redirect('/admin/werkstatt-kasse?ok=1');
}

export default async function AdminKassePage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const req = await buildRequestFromHeaders();
  const sess = await getSessionFromRequest(req);
  if (!sess) {
    redirect('/anmelden?next=/admin/werkstatt-kasse');
  }
  const istAdmin = hasRolle(sess.nutzer, 'admin');

  const rows = istAdmin
    ? await db
        .select()
        .from(werkstattKasseEintrag)
        .orderBy(
          desc(werkstattKasseEintrag.erstelltAm),
          desc(werkstattKasseEintrag.id),
        )
    : [];

  const offen = rows.filter((r) => !r.freigegebenAm);
  const freigegeben = rows.filter((r) => r.freigegebenAm);

  return (
    <div className="page-shell">
      <nav className="site-nav" aria-label="Hauptnavigation">
        <div className="wrap nav-inner">
          <Link href="/uebersicht" className="brand">
            <span>Werkzirkel</span>
          </Link>
          <div className="nav-links">
            <Link href="/admin/werkstatt-kasse" aria-current="page">
              Community-Pool (Admin)
            </Link>
          </div>
        </div>
      </nav>

      <header className="hero" id="top">
        <div className="wrap hero-grid single">
          <div>
            <p className="eyebrow">Werkzirkel · Admin · Community-Pool</p>
            <h1>Freigaben — Community-Pool</h1>
            <p className="hero-copy">
              Manuelle Kurator-Einträge erscheinen hier zur Freigabe. Stripe-
              Webhook-Einträge sind automatisch freigegeben und brauchen
              keine Aktion.
            </p>
          </div>
        </div>
      </header>

      <section className="section compact">
        <div className="wrap">
          {!istAdmin ? (
            <div role="alert" className="callout" style={{ padding: 16 }}>
              <strong>Nur Admins können diese Seite sehen.</strong>
            </div>
          ) : (
            <>
              {sp.ok ? (
                <div
                  role="status"
                  style={{
                    marginBottom: 12,
                    padding: 12,
                    borderRadius: 10,
                    background: '#e7f5ec',
                    border: '1px solid #2a8c4a',
                    color: '#1a4a26',
                  }}
                >
                  Freigabe erfolgreich.
                </div>
              ) : null}

              <h2>Offen ({offen.length})</h2>
              {offen.length === 0 ? (
                <p>Aktuell keine offenen Einträge.</p>
              ) : (
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Stadt</th>
                      <th style={thStyle}>Datum</th>
                      <th style={thStyle}>Typ</th>
                      <th style={thStyle}>Kategorie</th>
                      <th style={thStyle}>Beschreibung</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Betrag</th>
                      <th style={thStyle}>Aktion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {offen.map((r) => (
                      <tr key={r.id}>
                        <td style={tdStyle}>{r.stadtId}</td>
                        <td style={tdStyle}>{r.datum}</td>
                        <td style={tdStyle}>{r.typ}</td>
                        <td style={tdStyle}>{kategorieLabel(r.kategorie)}</td>
                        <td style={tdStyle}>{r.beschreibung}</td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>
                          {euroFormat(r.hoeheEuroCent)}
                        </td>
                        <td style={tdStyle}>
                          <form action={freigebenAction} style={{ display: 'inline' }}>
                            <input type="hidden" name="id" value={r.id} />
                            <button type="submit" className="button primary">
                              Freigeben
                            </button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              <h2 style={{ marginTop: 32 }}>Freigegeben ({freigegeben.length})</h2>
              {freigegeben.length === 0 ? (
                <p>Noch keine freigegebenen Einträge.</p>
              ) : (
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Stadt</th>
                      <th style={thStyle}>Datum</th>
                      <th style={thStyle}>Typ</th>
                      <th style={thStyle}>Kategorie</th>
                      <th style={thStyle}>Beschreibung</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Betrag</th>
                    </tr>
                  </thead>
                  <tbody>
                    {freigegeben.map((r) => (
                      <tr key={r.id}>
                        <td style={tdStyle}>{r.stadtId}</td>
                        <td style={tdStyle}>{r.datum}</td>
                        <td style={tdStyle}>{r.typ}</td>
                        <td style={tdStyle}>{kategorieLabel(r.kategorie)}</td>
                        <td style={tdStyle}>{r.beschreibung}</td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>
                          {euroFormat(r.hoeheEuroCent)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  marginTop: 12,
};

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 10px',
  borderBottom: '2px solid var(--hairline-color, #ddd)',
  fontWeight: 600,
};

const tdStyle: React.CSSProperties = {
  padding: '8px 10px',
  borderBottom: '1px solid var(--hairline-color, #eee)',
  verticalAlign: 'top',
};
