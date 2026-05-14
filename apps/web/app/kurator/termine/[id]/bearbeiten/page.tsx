/**
 * /kurator/termine/[id]/bearbeiten — Termin bearbeiten (Server Component).
 *
 * Quelle: PRD §F-401, §14.6.
 *
 * Auth + Kurator:in der Stadt des Termins. 404 wenn fremde Stadt oder
 * unbekannte ID. Form vorgefuellt; PATCH-Logik via Server Action direkt
 * auf Drizzle.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';

import { de } from '@/i18n/de';
import { db } from '@/lib/db';
import { auditLog, termin } from '@/lib/db/schema';
import { terminTyp } from '@/lib/db/schema/enums';
import { getSessionFromRequest } from '@/lib/auth/session';
import { istKuratorVon } from '@/lib/auth/permissions';
import { terminPatchSchema } from '@/lib/validators/termin';

const tb = de.termine.bearbeiten;
const td = de.termine.detail;
const tnav = de.uebersicht;

export const metadata: Metadata = {
  title: 'Termin bearbeiten',
  robots: { index: false, follow: false },
};

interface PageParams {
  params: Promise<{ id: string }>;
}

interface PageProps extends PageParams {
  searchParams: Promise<{ frisch?: string; fehler?: string; erfolg?: string }>;
}

async function buildRequestFromHeaders(path: string): Promise<Request> {
  const h = await headers();
  const headerInit: Record<string, string> = {};
  for (const [name, value] of h.entries()) {
    headerInit[name] = value;
  }
  return new Request(`http://internal.werkzirkel${path}`, {
    headers: headerInit,
  });
}

async function ladeTermin(id: string) {
  const rows = await db.select().from(termin).where(eq(termin.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function terminAktualisierenAction(
  terminId: string,
  formData: FormData,
): Promise<void> {
  'use server';

  const path = `/kurator/termine/${terminId}/bearbeiten`;
  const req = await buildRequestFromHeaders(path);
  const sess = await getSessionFromRequest(req);
  if (!sess) {
    redirect(`/anmelden?next=${path}`);
  }

  const row = await ladeTermin(terminId);
  if (!row) notFound();
  const erlaubt = await istKuratorVon(sess.nutzerId, row.stadtId);
  if (!erlaubt) notFound();

  if (row.status !== 'geplant' && row.status !== 'veroeffentlicht') {
    redirect(`${path}?fehler=nicht_editierbar`);
  }

  const maxStr = String(formData.get('max_teilnehmer') ?? '').trim();
  const datumStr = String(formData.get('datum_uhrzeit') ?? '').trim();
  const ortText = String(formData.get('ort_text') ?? '').trim();
  const onlineLink = String(formData.get('online_link') ?? '').trim();

  const candidate: Record<string, unknown> = {
    typ: String(formData.get('typ') ?? '').trim(),
    titel: String(formData.get('titel') ?? '').trim(),
    beschreibung: String(formData.get('beschreibung') ?? '').trim(),
    ort_text: ortText.length > 0 ? ortText : null,
    online_link: onlineLink.length > 0 ? onlineLink : null,
    datum_uhrzeit: datumStr,
    max_teilnehmer: maxStr ? Number(maxStr) : NaN,
  };

  const parsed = terminPatchSchema.safeParse(candidate);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const firstFeld = Object.keys(fieldErrors)[0] ?? 'unbekannt';
    redirect(
      `${path}?fehler=validierung&feld=${encodeURIComponent(firstFeld)}`,
    );
  }
  const patch = parsed.data;

  const finalOrt =
    patch.ort_text !== undefined ? patch.ort_text : row.ortText;
  const finalLink =
    patch.online_link !== undefined ? patch.online_link : row.onlineLink;
  if (!(finalOrt && finalOrt.trim()) && !(finalLink && finalLink.trim())) {
    redirect(`${path}?fehler=ort_oder_link`);
  }

  const update: Partial<typeof termin.$inferInsert> = {};
  if (patch.typ !== undefined) update.typ = patch.typ;
  if (patch.titel !== undefined) update.titel = patch.titel;
  if (patch.beschreibung !== undefined) update.beschreibung = patch.beschreibung;
  if (patch.ort_text !== undefined) update.ortText = patch.ort_text;
  if (patch.online_link !== undefined) update.onlineLink = patch.online_link;
  if (patch.datum_uhrzeit !== undefined)
    update.datumUhrzeit = patch.datum_uhrzeit;
  if (patch.max_teilnehmer !== undefined)
    update.maxTeilnehmer = patch.max_teilnehmer;

  if (Object.keys(update).length > 0) {
    update.aktualisiertAm = new Date();
    await db
      .update(termin)
      .set(update)
      .where(eq(termin.id, terminId));

    try {
      await db.insert(auditLog).values({
        nutzerId: sess.nutzerId,
        aktion: 'termin.aktualisiert',
        referenzTyp: 'termin',
        referenzId: terminId,
      });
    } catch {
      /* ignore */
    }
  }

  redirect(`${path}?erfolg=gespeichert`);
}

function terminTypLabel(t: string): string {
  return (de.termin_typ as Record<string, string>)[t] ?? t;
}

function formatDatumInput(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

function FehlerBanner({ fehler, feld }: { fehler?: string; feld?: string }) {
  if (!fehler) return null;
  let text = '';
  if (fehler === 'nicht_editierbar') text = tb.nicht_editierbar;
  else if (fehler === 'ort_oder_link')
    text = 'Termin braucht entweder einen Ort oder einen Online-Link.';
  else if (fehler === 'validierung') {
    text = feld
      ? `Bitte prüfe die markierten Felder. (Feld: ${feld})`
      : 'Bitte prüfe die markierten Felder.';
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

function ErfolgBanner({
  frisch,
  erfolg,
}: {
  frisch?: string;
  erfolg?: string;
}) {
  let text: string | null = null;
  if (frisch === '1') text = tb.erfolg_frisch_angelegt;
  else if (erfolg === 'gespeichert') text = tb.erfolg_gespeichert;
  if (!text) return null;
  return (
    <div
      role="status"
      className="callout"
      style={{
        marginBottom: 16,
        padding: '12px 14px',
        borderRadius: 10,
        border: '1px solid #2a7a2a',
        background: '#eaf6ea',
        color: '#15431a',
      }}
    >
      <strong>{text}</strong>
    </div>
  );
}

export default async function TerminBearbeitenPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const sp = await searchParams;

  const path = `/kurator/termine/${id}/bearbeiten`;
  const req = await buildRequestFromHeaders(path);
  const sess = await getSessionFromRequest(req);
  if (!sess) {
    redirect(`/anmelden?next=${path}`);
  }

  const row = await ladeTermin(id);
  if (!row) notFound();

  const erlaubt = await istKuratorVon(sess.nutzerId, row.stadtId);
  if (!erlaubt) notFound();

  const aktualisierenBound = terminAktualisierenAction.bind(null, id);

  const istEditierbar =
    row.status === 'geplant' || row.status === 'veroeffentlicht';

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
            <p className="eyebrow">{tb.eyebrow}</p>
            <h1>{tb.titel}</h1>
            <p className="hero-copy">{tb.untertitel}</p>
            <div style={{ marginTop: 12 }}>
              <Link href={`/termine/${id}`} className="button secondary">
                {td.eyebrow}
              </Link>
            </div>
          </div>
        </div>
      </header>

      <section className="section compact">
        <div className="wrap" style={{ maxWidth: 760 }}>
          <ErfolgBanner frisch={sp.frisch} erfolg={sp.erfolg} />
          <FehlerBanner fehler={sp.fehler} feld={undefined} />

          {!istEditierbar ? (
            <div
              role="alert"
              className="callout"
              style={{ padding: 16, borderRadius: 12 }}
            >
              <strong>{tb.nicht_editierbar}</strong>
              <p style={{ margin: '8px 0 0' }}>
                <Link href={`/termine/${id}`}>Zur Termin-Detailseite</Link>
              </p>
            </div>
          ) : (
            <form
              action={aktualisierenBound}
              style={{ display: 'grid', gap: 16 }}
            >
              <label style={{ display: 'grid', gap: 6 }} htmlFor="typ">
                <span style={{ fontWeight: 600 }}>{de.termine.neu.label_typ}</span>
                <select
                  id="typ"
                  name="typ"
                  required
                  defaultValue={row.typ}
                  style={inputStyle}
                >
                  {terminTyp.map((t) => (
                    <option key={t} value={t}>
                      {terminTypLabel(t)}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: 'grid', gap: 6 }} htmlFor="titel">
                <span style={{ fontWeight: 600 }}>{de.termine.neu.label_titel}</span>
                <input
                  id="titel"
                  name="titel"
                  type="text"
                  required
                  maxLength={200}
                  defaultValue={row.titel}
                  style={inputStyle}
                />
              </label>

              <label style={{ display: 'grid', gap: 6 }} htmlFor="beschreibung">
                <span style={{ fontWeight: 600 }}>
                  {de.termine.neu.label_beschreibung}
                </span>
                <textarea
                  id="beschreibung"
                  name="beschreibung"
                  required
                  maxLength={5000}
                  rows={6}
                  defaultValue={row.beschreibung}
                  style={textareaStyle}
                />
              </label>

              <label style={{ display: 'grid', gap: 6 }} htmlFor="datum_uhrzeit">
                <span style={{ fontWeight: 600 }}>{de.termine.neu.label_datum}</span>
                <input
                  id="datum_uhrzeit"
                  name="datum_uhrzeit"
                  type="datetime-local"
                  required
                  defaultValue={formatDatumInput(row.datumUhrzeit)}
                  style={inputStyle}
                />
              </label>

              <label style={{ display: 'grid', gap: 6 }} htmlFor="ort_text">
                <span style={{ fontWeight: 600 }}>{de.termine.neu.label_ort}</span>
                <input
                  id="ort_text"
                  name="ort_text"
                  type="text"
                  maxLength={500}
                  defaultValue={row.ortText ?? ''}
                  style={inputStyle}
                />
              </label>

              <label style={{ display: 'grid', gap: 6 }} htmlFor="online_link">
                <span style={{ fontWeight: 600 }}>
                  {de.termine.neu.label_online_link}
                </span>
                <input
                  id="online_link"
                  name="online_link"
                  type="url"
                  maxLength={500}
                  defaultValue={row.onlineLink ?? ''}
                  style={inputStyle}
                />
              </label>

              <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13 }}>
                {de.termine.neu.hinweis_ort_oder_link}
              </p>

              <label
                style={{ display: 'grid', gap: 6 }}
                htmlFor="max_teilnehmer"
              >
                <span style={{ fontWeight: 600 }}>
                  {de.termine.neu.label_max_teilnehmer}
                </span>
                <input
                  id="max_teilnehmer"
                  name="max_teilnehmer"
                  type="number"
                  min={2}
                  max={100}
                  defaultValue={row.maxTeilnehmer}
                  required
                  style={inputStyle}
                />
              </label>

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <button type="submit" className="button primary">
                  {tb.button_speichern}
                </button>
                <Link
                  href={`/termine/${id}`}
                  className="button secondary"
                >
                  Abbrechen
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
