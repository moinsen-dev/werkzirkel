/**
 * /kurator/termine/neu — Termin anlegen (Server Component + Server Action).
 *
 * Quelle: PRD §F-401, §8.8.
 *
 * Auth + Kurator:in. Form-Felder gemaess `terminAnlegenSchema`; Status='geplant'.
 * Erfolgs-Redirect zu /kurator/termine/[id]/bearbeiten?frisch=1.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { and, desc, eq, inArray } from 'drizzle-orm';
import { de } from '@/i18n/de';
import { db } from '@/lib/db';
import { auditLog, termin, terminWerkBezug, werk } from '@/lib/db/schema';
import { terminTyp } from '@/lib/db/schema/enums';
import { getSessionFromRequest } from '@/lib/auth/session';
import { istKuratorVon } from '@/lib/auth/permissions';
import { terminAnlegenSchema } from '@/lib/validators/termin';

const tn = de.termine.neu;
const tnav = de.uebersicht;

export const metadata: Metadata = {
  title: 'Termin anlegen',
  robots: { index: false, follow: false },
};

interface PageProps {
  searchParams: Promise<{ fehler?: string; feld?: string }>;
}

async function buildRequestFromHeaders(): Promise<Request> {
  const h = await headers();
  const headerInit: Record<string, string> = {};
  for (const [name, value] of h.entries()) {
    headerInit[name] = value;
  }
  return new Request('http://internal.werkzirkel/kurator/termine/neu', {
    headers: headerInit,
  });
}

export async function terminAnlegenAction(formData: FormData): Promise<void> {
  'use server';

  const req = await buildRequestFromHeaders();
  const sess = await getSessionFromRequest(req);
  if (!sess) {
    redirect('/anmelden?next=/kurator/termine/neu');
  }

  const stadtId = sess.nutzer.stadtId;
  const erlaubt = await istKuratorVon(sess.nutzerId, stadtId);
  if (!erlaubt) {
    redirect('/kurator/termine/neu?fehler=keine_rolle');
  }

  const maxStr = String(formData.get('max_teilnehmer') ?? '').trim();
  const datumStr = String(formData.get('datum_uhrzeit') ?? '').trim();
  // Mehrfach-Werte aus dem Multi-Select für Werk-Bezüge.
  const werkIds = formData.getAll('werk_ids').map((v) => String(v));

  const candidate = {
    stadt_id: stadtId,
    typ: String(formData.get('typ') ?? '').trim(),
    titel: String(formData.get('titel') ?? '').trim(),
    beschreibung: String(formData.get('beschreibung') ?? '').trim(),
    ort_text: String(formData.get('ort_text') ?? '').trim() || null,
    online_link: String(formData.get('online_link') ?? '').trim() || null,
    datum_uhrzeit: datumStr,
    max_teilnehmer: maxStr ? Number(maxStr) : NaN,
    werk_ids: werkIds.length > 0 ? werkIds : undefined,
  };

  const parsed = terminAnlegenSchema.safeParse(candidate);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const firstFeld = Object.keys(fieldErrors)[0] ?? 'unbekannt';
    redirect(
      `/kurator/termine/neu?fehler=validierung&feld=${encodeURIComponent(firstFeld)}`,
    );
  }
  const input = parsed.data;

  const inserted = await db
    .insert(termin)
    .values({
      stadtId: input.stadt_id,
      typ: input.typ,
      titel: input.titel,
      beschreibung: input.beschreibung,
      ortText: input.ort_text ?? null,
      onlineLink: input.online_link ?? null,
      datumUhrzeit: input.datum_uhrzeit,
      maxTeilnehmer: input.max_teilnehmer,
      erstelltVon: sess.nutzerId,
      status: 'geplant',
    })
    .returning({ id: termin.id });
  const row = inserted[0];
  if (!row) {
    redirect('/kurator/termine/neu?fehler=unbekannt');
  }

  // Werk-Bezüge persistieren (PRD §F-403). Nur Werke akzeptieren, die in
  // derselben Stadt sind UND sichtbar — keine pausierten oder fremden Stadt-
  // Werke aus dem Schauabend bewerben lassen.
  const inputWerkIds = input.werk_ids ?? [];
  if (inputWerkIds.length > 0) {
    const validRows = await db
      .select({ id: werk.id })
      .from(werk)
      .where(
        and(
          inArray(werk.id, inputWerkIds),
          eq(werk.stadtId, input.stadt_id),
          eq(werk.status, 'aktiv'),
          inArray(werk.sichtbarkeit, ['oeffentlich', 'nur_zirkel']),
        ),
      );
    const validIds = new Set(validRows.map((r) => r.id));
    const akzeptierteIds = inputWerkIds.filter((id) => validIds.has(id));
    if (akzeptierteIds.length > 0) {
      await db.insert(terminWerkBezug).values(
        akzeptierteIds.map((werkId, idx) => ({
          terminId: row.id,
          werkId,
          reihenfolge: 100 + idx,
        })),
      );
    }
  }

  try {
    await db.insert(auditLog).values({
      nutzerId: sess.nutzerId,
      aktion: 'termin.angelegt',
      referenzTyp: 'termin',
      referenzId: row.id,
      metadaten: {
        stadt_id: input.stadt_id,
        typ: input.typ,
        werk_anzahl: inputWerkIds.length,
      },
    });
  } catch {
    /* ignore */
  }

  redirect(`/kurator/termine/${row.id}/bearbeiten?frisch=1`);
}

function terminTypLabel(t: string): string {
  return (de.termin_typ as Record<string, string>)[t] ?? t;
}

function FehlerBanner({ fehler, feld }: { fehler?: string; feld?: string }) {
  if (!fehler) return null;
  let text = '';
  if (fehler === 'keine_rolle') text = tn.fehler_keine_rolle;
  else if (fehler === 'validierung') {
    text = feld
      ? `${tn.fehler_validierung} (Feld: ${feld})`
      : tn.fehler_validierung;
  } else text = de.fehler.unbekannt;
  return (
    <div
      role="alert"
      className="callout"
      style={{
        marginBottom: 16,
        padding: '12px 14px',
        borderRadius: 10,
        border: '1px solid #d04848',
        background: '#fbeaea',
        color: '#5a1a1a',
      }}
    >
      {text}
    </div>
  );
}

function formatDatumInput(d: Date): string {
  // yyyy-mm-ddThh:mm fuer <input type="datetime-local">
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

export default async function TerminNeuPage({ searchParams }: PageProps) {
  const sp = await searchParams;

  const req = await buildRequestFromHeaders();
  const sess = await getSessionFromRequest(req);
  if (!sess) {
    redirect('/anmelden?next=/kurator/termine/neu');
  }

  const istKurator = await istKuratorVon(sess.nutzerId, sess.nutzer.stadtId);

  // Werke der Stadt für den Multi-Select-Bezug. Nur sichtbare aktive Werke.
  const werkeDerStadt = istKurator
    ? await db
        .select({ id: werk.id, name: werk.name })
        .from(werk)
        .where(
          and(
            eq(werk.stadtId, sess.nutzer.stadtId),
            eq(werk.status, 'aktiv'),
            inArray(werk.sichtbarkeit, ['oeffentlich', 'nur_zirkel']),
          ),
        )
        .orderBy(desc(werk.aktualisiertAm))
        .limit(50)
    : [];

  const defaultDatum = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const minDatum = new Date(Date.now() + 2 * 60 * 60 * 1000);

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
            <Link href="/uebersicht">{tnav.nav_uebersicht}</Link>
            <Link href="/uebersicht/termine" aria-current="page">
              {tnav.nav_termine}
            </Link>
          </div>
        </div>
      </nav>

      <header className="hero" id="top">
        <div className="wrap hero-grid single">
          <div>
            <p className="eyebrow">{tn.eyebrow}</p>
            <h1>{tn.titel}</h1>
            <p className="hero-copy">{tn.untertitel}</p>
          </div>
        </div>
      </header>

      <section className="section compact">
        <div className="wrap" style={{ maxWidth: 760 }}>
          <FehlerBanner fehler={sp.fehler} feld={sp.feld} />

          {!istKurator ? (
            <div
              role="alert"
              className="callout"
              style={{ padding: 16, borderRadius: 12 }}
            >
              <strong>{tn.fehler_keine_rolle}</strong>
            </div>
          ) : (
            <form
              action={terminAnlegenAction}
              style={{ display: 'grid', gap: 16 }}
            >
              <label style={{ display: 'grid', gap: 6 }} htmlFor="typ">
                <span style={{ fontWeight: 600 }}>{tn.label_typ}</span>
                <select id="typ" name="typ" required style={inputStyle}>
                  {terminTyp.map((t) => (
                    <option key={t} value={t}>
                      {terminTypLabel(t)}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: 'grid', gap: 6 }} htmlFor="titel">
                <span style={{ fontWeight: 600 }}>{tn.label_titel}</span>
                <input
                  id="titel"
                  name="titel"
                  type="text"
                  required
                  maxLength={200}
                  style={inputStyle}
                />
              </label>

              <label style={{ display: 'grid', gap: 6 }} htmlFor="beschreibung">
                <span style={{ fontWeight: 600 }}>{tn.label_beschreibung}</span>
                <textarea
                  id="beschreibung"
                  name="beschreibung"
                  required
                  maxLength={5000}
                  rows={6}
                  style={textareaStyle}
                />
              </label>

              <label style={{ display: 'grid', gap: 6 }} htmlFor="datum_uhrzeit">
                <span style={{ fontWeight: 600 }}>{tn.label_datum}</span>
                <input
                  id="datum_uhrzeit"
                  name="datum_uhrzeit"
                  type="datetime-local"
                  required
                  min={formatDatumInput(minDatum)}
                  defaultValue={formatDatumInput(defaultDatum)}
                  style={inputStyle}
                />
              </label>

              <label style={{ display: 'grid', gap: 6 }} htmlFor="ort_text">
                <span style={{ fontWeight: 600 }}>{tn.label_ort}</span>
                <input
                  id="ort_text"
                  name="ort_text"
                  type="text"
                  maxLength={500}
                  style={inputStyle}
                />
              </label>

              <label style={{ display: 'grid', gap: 6 }} htmlFor="online_link">
                <span style={{ fontWeight: 600 }}>{tn.label_online_link}</span>
                <input
                  id="online_link"
                  name="online_link"
                  type="url"
                  maxLength={500}
                  style={inputStyle}
                />
              </label>

              <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13 }}>
                {tn.hinweis_ort_oder_link}
              </p>

              <label
                style={{ display: 'grid', gap: 6 }}
                htmlFor="max_teilnehmer"
              >
                <span style={{ fontWeight: 600 }}>{tn.label_max_teilnehmer}</span>
                <input
                  id="max_teilnehmer"
                  name="max_teilnehmer"
                  type="number"
                  min={2}
                  max={100}
                  defaultValue={20}
                  required
                  style={inputStyle}
                />
              </label>

              {werkeDerStadt.length > 0 ? (
                <fieldset
                  style={{
                    border: 'var(--hairline)',
                    borderRadius: 12,
                    padding: 14,
                  }}
                >
                  <legend style={{ fontWeight: 600, padding: '0 6px' }}>
                    Werke verknüpfen (für Schauabende)
                  </legend>
                  <p
                    style={{
                      margin: '0 0 10px',
                      color: 'var(--muted)',
                      fontSize: 13,
                    }}
                  >
                    Welche Werke werden bei diesem Termin gezeigt? Mehrfach-
                    auswahl. Optional — Bedarfsschau-Termine setzen ihre
                    Bezüge auf der Bearbeiten-Seite.
                  </p>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns:
                        'repeat(auto-fit, minmax(220px, 1fr))',
                      gap: 8,
                      maxHeight: 240,
                      overflowY: 'auto',
                    }}
                  >
                    {werkeDerStadt.map((w) => (
                      <label
                        key={w.id}
                        style={{
                          display: 'inline-flex',
                          gap: 8,
                          alignItems: 'center',
                          fontSize: 14,
                        }}
                      >
                        <input
                          type="checkbox"
                          name="werk_ids"
                          value={w.id}
                        />
                        <span>{w.name}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              ) : null}

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <button type="submit" className="button primary">
                  {tn.button_anlegen}
                </button>
                <Link
                  href="/uebersicht/termine"
                  className="button secondary"
                >
                  {tn.button_abbrechen}
                </Link>
              </div>
            </form>
          )}
        </div>
      </section>
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

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  fontFamily: 'inherit',
  resize: 'vertical',
  minHeight: 80,
};
