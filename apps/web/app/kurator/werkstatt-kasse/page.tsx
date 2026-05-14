/**
 * /kurator/werkstatt-kasse — Kurator-Übersicht der Werkstatt-Kasse eigener Stadt.
 *
 * Liefert alle Einträge (auch unfreigegebene), nach Datum absteigend. Enthält
 * ein einfaches Formular zum Anlegen neuer manueller Einträge (Server Action),
 * das die POST /api/v1/kurator/werkstatt-kasse-Endpoint-Logik direkt
 * spiegelt — sodass Kurator:innen ohne JS / über HTML-Form arbeiten können.
 *
 * Permission-Gate: Nur Kurator:innen der eigenen Stadt (siehe `istKuratorVon`).
 *
 * PRD-Referenz: §8.11 (Werkstatt-Kasse pro Stadt, Kurator-Eingabe).
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { desc, eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { auditLog, werkstattKasseEintrag } from '@/lib/db/schema';
import {
  kasseKategorieEingang,
  kasseKategorieAusgang,
} from '@/lib/db/schema/enums';
import { getSessionFromRequest } from '@/lib/auth/session';
import { istKuratorVon } from '@/lib/auth/permissions';
import { kasseEintragSchema } from '@/lib/validators/kasse';
import { aktuellesQuartal, quartalOf } from '@/lib/kasse/quartal';
import { kategorieLabel, euroFormat } from '@/lib/kasse/labels';

export const metadata: Metadata = {
  title: 'Werkstatt-Kasse — Kurator-Übersicht',
  robots: { index: false, follow: false },
};

interface PageProps {
  searchParams: Promise<{ fehler?: string; feld?: string; ok?: string }>;
}

async function buildRequestFromHeaders(): Promise<Request> {
  const h = await headers();
  const headerInit: Record<string, string> = {};
  for (const [name, value] of h.entries()) {
    headerInit[name] = value;
  }
  return new Request('http://internal.werkzirkel/kurator/werkstatt-kasse', {
    headers: headerInit,
  });
}

export async function eintragAnlegenAction(formData: FormData): Promise<void> {
  'use server';

  const req = await buildRequestFromHeaders();
  const sess = await getSessionFromRequest(req);
  if (!sess) {
    redirect('/anmelden?next=/kurator/werkstatt-kasse');
  }

  const stadtId = sess.nutzer.stadtId;
  const erlaubt = await istKuratorVon(sess.nutzerId, stadtId);
  if (!erlaubt) {
    redirect('/kurator/werkstatt-kasse?fehler=keine_rolle');
  }

  const hoeheCentStr = String(formData.get('hoehe_euro_cent') ?? '').trim();
  const candidate = {
    typ: String(formData.get('typ') ?? '').trim(),
    kategorie: String(formData.get('kategorie') ?? '').trim(),
    hoehe_euro_cent: hoeheCentStr ? Number(hoeheCentStr) : NaN,
    beschreibung: String(formData.get('beschreibung') ?? '').trim(),
    datum: String(formData.get('datum') ?? '').trim(),
    beleg_url: String(formData.get('beleg_url') ?? '').trim() || undefined,
  };

  const parsed = kasseEintragSchema.safeParse(candidate);
  if (!parsed.success) {
    const firstFeld = Object.keys(parsed.error.flatten().fieldErrors)[0] ?? 'unbekannt';
    redirect(
      `/kurator/werkstatt-kasse?fehler=validierung&feld=${encodeURIComponent(firstFeld)}`,
    );
  }
  const input = parsed.data;
  const datumDate = new Date(`${input.datum}T00:00:00Z`);
  const quartal = quartalOf(datumDate);

  const inserted = await db
    .insert(werkstattKasseEintrag)
    .values({
      stadtId,
      typ: input.typ,
      kategorie: input.kategorie,
      hoeheEuroCent: input.hoehe_euro_cent,
      beschreibung: input.beschreibung,
      belegUrl: input.beleg_url ?? null,
      datum: input.datum,
      quartal,
      erfasstDurch: sess.nutzerId,
    })
    .returning({ id: werkstattKasseEintrag.id });
  const row = inserted[0];

  try {
    await db.insert(auditLog).values({
      nutzerId: sess.nutzerId,
      aktion: 'werkstatt_kasse.angelegt',
      referenzTyp: 'werkstatt_kasse_eintrag',
      referenzId: row?.id ?? '',
      metadaten: {
        stadt_id: stadtId,
        typ: input.typ,
        kategorie: input.kategorie,
        hoehe_euro_cent: input.hoehe_euro_cent,
        quartal,
      },
    });
  } catch {
    /* audit best-effort */
  }

  redirect('/kurator/werkstatt-kasse?ok=1');
}

export default async function KuratorKassePage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const req = await buildRequestFromHeaders();
  const sess = await getSessionFromRequest(req);
  if (!sess) {
    redirect('/anmelden?next=/kurator/werkstatt-kasse');
  }

  const stadtId = sess.nutzer.stadtId;
  const istKurator = await istKuratorVon(sess.nutzerId, stadtId);

  const rows = istKurator
    ? await db
        .select()
        .from(werkstattKasseEintrag)
        .where(eq(werkstattKasseEintrag.stadtId, stadtId))
        .orderBy(
          desc(werkstattKasseEintrag.datum),
          desc(werkstattKasseEintrag.id),
        )
    : [];

  const heute = new Date().toISOString().slice(0, 10);
  const aktQ = aktuellesQuartal();
  const rowsAktuell = rows.filter((r) => r.quartal === aktQ);
  const summeEingang = rowsAktuell
    .filter((r) => r.typ === 'eingang')
    .reduce((s, r) => s + r.hoeheEuroCent, 0);
  const summeAusgang = rowsAktuell
    .filter((r) => r.typ === 'ausgang')
    .reduce((s, r) => s + r.hoeheEuroCent, 0);

  return (
    <div className="page-shell">
      <nav className="site-nav" aria-label="Hauptnavigation">
        <div className="wrap nav-inner">
          <Link href="/uebersicht" className="brand" aria-label="Werkzirkel Start">
            <span className="brand-mark" aria-hidden="true">
              <span></span>
              <span></span>
              <span></span>
              <span></span>
            </span>
            <span>Werkzirkel</span>
          </Link>
          <div className="nav-links" aria-label="Bereiche">
            <Link href="/uebersicht">Übersicht</Link>
            <Link href="/kurator/werkstatt-kasse" aria-current="page">
              Werkstatt-Kasse
            </Link>
          </div>
        </div>
      </nav>

      <header className="hero" id="top">
        <div className="wrap hero-grid single">
          <div>
            <p className="eyebrow">Werkzirkel · Kurator-Werkstatt-Kasse</p>
            <h1>Werkstatt-Kasse — {stadtId.toUpperCase()}</h1>
            <p className="hero-copy">
              Hier erfasst du Eingänge und Ausgänge der Werkstatt-Kasse. Stripe-
              Zahlungen werden automatisch eingetragen; manuelle Einträge (z.B.
              Raum-Miete) müssen vom Admin freigegeben werden, bevor sie öffentlich
              sichtbar sind.
            </p>
          </div>
        </div>
      </header>

      <section className="section compact">
        <div className="wrap">
          {!istKurator ? (
            <div
              role="alert"
              className="callout"
              style={{ padding: 16, borderRadius: 12 }}
            >
              <strong>Nur Kurator:innen ihrer Stadt können diese Seite nutzen.</strong>
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
                  Eintrag gespeichert. Er erscheint nach Admin-Freigabe öffentlich.
                </div>
              ) : null}
              {sp.fehler ? (
                <div
                  role="alert"
                  className="callout"
                  style={{
                    marginBottom: 12,
                    padding: 12,
                    borderRadius: 10,
                    border: '1px solid #d04848',
                    background: '#fbeaea',
                    color: '#5a1a1a',
                  }}
                >
                  {sp.fehler === 'keine_rolle'
                    ? 'Keine Berechtigung.'
                    : `Validierungsfehler${sp.feld ? ` im Feld ${sp.feld}` : ''}.`}
                </div>
              ) : null}

              <h2>Neuer Eintrag</h2>
              <form
                action={eintragAnlegenAction}
                style={{ display: 'grid', gap: 12, maxWidth: 640 }}
              >
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontWeight: 600 }}>Typ</span>
                  <select name="typ" required style={inputStyle} defaultValue="ausgang">
                    <option value="eingang">Eingang</option>
                    <option value="ausgang">Ausgang</option>
                  </select>
                </label>

                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontWeight: 600 }}>Kategorie</span>
                  <select name="kategorie" required style={inputStyle}>
                    <optgroup label="Eingang">
                      {kasseKategorieEingang.map((k) => (
                        <option key={`e-${k}`} value={k}>
                          {kategorieLabel(k)}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Ausgang">
                      {kasseKategorieAusgang.map((k) => (
                        <option key={`a-${k}`} value={k}>
                          {kategorieLabel(k)}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </label>

                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontWeight: 600 }}>Höhe (Cent)</span>
                  <input
                    type="number"
                    name="hoehe_euro_cent"
                    min={1}
                    required
                    style={inputStyle}
                  />
                </label>

                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontWeight: 600 }}>Beschreibung</span>
                  <input
                    type="text"
                    name="beschreibung"
                    minLength={3}
                    maxLength={500}
                    required
                    style={inputStyle}
                  />
                </label>

                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontWeight: 600 }}>Datum</span>
                  <input
                    type="date"
                    name="datum"
                    defaultValue={heute}
                    required
                    style={inputStyle}
                  />
                </label>

                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontWeight: 600 }}>Beleg-URL (optional)</span>
                  <input type="url" name="beleg_url" style={inputStyle} />
                </label>

                <div>
                  <button type="submit" className="button primary">
                    Eintrag anlegen
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </section>

      {istKurator ? (
        <section className="section">
          <div className="wrap">
            <h2>Quartal {aktQ}</h2>
            <p style={{ color: 'var(--muted)' }}>
              Eingang {euroFormat(summeEingang)} · Ausgang {euroFormat(summeAusgang)} ·
              Saldo {euroFormat(summeEingang - summeAusgang)}
            </p>

            <h2 style={{ marginTop: 24 }}>Alle Einträge</h2>
            {rows.length === 0 ? (
              <p>Noch keine Einträge.</p>
            ) : (
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Datum</th>
                    <th style={thStyle}>Typ</th>
                    <th style={thStyle}>Kategorie</th>
                    <th style={thStyle}>Beschreibung</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Betrag</th>
                    <th style={thStyle}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td style={tdStyle}>{r.datum}</td>
                      <td style={tdStyle}>{r.typ}</td>
                      <td style={tdStyle}>{kategorieLabel(r.kategorie)}</td>
                      <td style={tdStyle}>{r.beschreibung}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        {euroFormat(r.hoeheEuroCent)}
                      </td>
                      <td style={tdStyle}>
                        {r.freigegebenAm ? 'freigegeben' : 'unfreigegeben'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 10,
  border: 'var(--hairline)',
  background: 'var(--surface)',
  color: 'var(--fg)',
  fontSize: 15,
};

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
