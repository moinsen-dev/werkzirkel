/**
 * /pruefrunden/neu — Pruefrunde anlegen (Server Component + Server Action).
 *
 * Quelle: PRD §F-201, §8.4 (Pflichtfelder), §13.7.
 *
 * - Auth Pflicht, Rolle 'macher'.
 * - Optional Query-Param `?werk=<id>` aus dem Werk-Detail-CTA.
 * - Form-Felder gemaess pruefrundeAnlegenSchema; Status='entwurf'.
 * - Bei Erfolg: redirect zu /pruefrunden/[id]/bearbeiten.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';

import { de } from '@/i18n/de';
import { db } from '@/lib/db';
import { auditLog, pruefrunde, werk } from '@/lib/db/schema';
import {
  feedbackKategorie as feedbackKategorieEnum,
} from '@/lib/db/schema/enums';
import { getSessionFromRequest } from '@/lib/auth/session';
import { pruefrundeAnlegenSchema } from '@/lib/validators/pruefrunde';

const tn = de.pruefrunden.neu;
const tnav = de.uebersicht;

export const metadata: Metadata = {
  title: 'Neue Prüfrunde anlegen',
  robots: { index: false, follow: false },
};

interface PageProps {
  searchParams: Promise<{ werk?: string; fehler?: string; feld?: string }>;
}

async function buildRequestFromHeaders(): Promise<Request> {
  const h = await headers();
  const headerInit: Record<string, string> = {};
  for (const [name, value] of h.entries()) {
    headerInit[name] = value;
  }
  return new Request('http://internal.werkzirkel/pruefrunden/neu', {
    headers: headerInit,
  });
}

export async function pruefrundeAnlegenAction(
  formData: FormData,
): Promise<void> {
  'use server';

  const req = await buildRequestFromHeaders();
  const sess = await getSessionFromRequest(req);
  if (!sess) {
    redirect('/anmelden?next=/pruefrunden/neu');
  }
  if (!sess.nutzer.rollen.includes('macher')) {
    redirect('/pruefrunden/neu?fehler=keine_rolle');
  }

  const kategorienWerte = formData
    .getAll('feedback_kategorien')
    .map((v) => String(v))
    .filter(Boolean);

  const fristStr = String(formData.get('frist') ?? '').trim();
  const zeitbedarfStr = String(formData.get('zeitbedarf_minuten') ?? '').trim();
  const gesuchteStr = String(formData.get('gesuchte_tester') ?? '').trim();

  const candidate = {
    werk_id: String(formData.get('werk_id') ?? '').trim(),
    titel: String(formData.get('titel') ?? '').trim(),
    testziel: String(formData.get('testziel') ?? '').trim(),
    testaufgabe: String(formData.get('testaufgabe') ?? '').trim(),
    zielgruppe: String(formData.get('zielgruppe') ?? '').trim(),
    zeitbedarf_minuten: zeitbedarfStr ? Number(zeitbedarfStr) : NaN,
    gesuchte_tester: gesuchteStr ? Number(gesuchteStr) : NaN,
    feedback_kategorien: kategorienWerte,
    frist: fristStr,
  };

  const parsed = pruefrundeAnlegenSchema.safeParse(candidate);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const firstFeld = Object.keys(fieldErrors)[0] ?? 'unbekannt';
    redirect(
      `/pruefrunden/neu?fehler=validierung&feld=${encodeURIComponent(firstFeld)}${
        candidate.werk_id ? `&werk=${encodeURIComponent(candidate.werk_id)}` : ''
      }`,
    );
  }
  const input = parsed.data;

  // Werk-Ownership pruefen
  const werkRows = await db
    .select({ id: werk.id, nutzerId: werk.nutzerId })
    .from(werk)
    .where(eq(werk.id, input.werk_id))
    .limit(1);
  const werkRow = werkRows[0];
  if (!werkRow || werkRow.nutzerId !== sess.nutzerId) {
    redirect('/pruefrunden/neu?fehler=werk_nicht_eigen');
  }

  const inserted = await db
    .insert(pruefrunde)
    .values({
      werkId: input.werk_id,
      titel: input.titel,
      testziel: input.testziel,
      testaufgabe: input.testaufgabe,
      zielgruppe: input.zielgruppe,
      zeitbedarfMinuten: input.zeitbedarf_minuten,
      gesuchteTester: input.gesuchte_tester,
      feedbackKategorien: input.feedback_kategorien,
      frist: input.frist,
      status: 'entwurf',
    })
    .returning({ id: pruefrunde.id });
  const row = inserted[0];
  if (!row) {
    redirect('/pruefrunden/neu?fehler=unbekannt');
  }

  try {
    await db.insert(auditLog).values({
      nutzerId: sess.nutzerId,
      aktion: 'pruefrunde.angelegt',
      referenzTyp: 'pruefrunde',
      referenzId: row.id,
    });
  } catch {
    /* ignore */
  }

  redirect(`/pruefrunden/${row.id}/bearbeiten?frisch=1`);
}

function kategorieLabel(k: string): string {
  return (
    (de.pruefrunden.feedback_kategorie as Record<string, string>)[k] ?? k
  );
}

function FehlerBanner({ fehler, feld }: { fehler?: string; feld?: string }) {
  if (!fehler) return null;
  let text = '';
  if (fehler === 'keine_rolle') text = tn.fehler_keine_rolle;
  else if (fehler === 'kein_werk') text = tn.fehler_kein_werk;
  else if (fehler === 'werk_nicht_eigen') text = tn.fehler_werk_nicht_eigen;
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
  // yyyy-mm-dd fuer <input type="date">
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${yyyy}-${mm}-${dd}`;
}

export default async function PruefrundeNeuPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const req = await buildRequestFromHeaders();
  const sess = await getSessionFromRequest(req);
  if (!sess) {
    redirect('/anmelden?next=/pruefrunden/neu');
  }

  const hatMacherRolle = sess.nutzer.rollen.includes('macher');

  // Eigene Werke laden — fuer Werk-Dropdown.
  const meineWerke = hatMacherRolle
    ? await db
        .select({ id: werk.id, name: werk.name })
        .from(werk)
        .where(eq(werk.nutzerId, sess.nutzerId))
    : [];

  const minFrist = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000); // morgen+
  const maxFrist = new Date(Date.now() + 59 * 24 * 60 * 60 * 1000);
  const defaultFrist = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

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
            <Link href="/uebersicht/werke">{tnav.nav_werke}</Link>
            <Link href="/uebersicht/pruefrunden" aria-current="page">
              {tnav.nav_pruefrunden}
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

          {!hatMacherRolle ? (
            <div
              role="alert"
              className="callout"
              style={{ padding: 16, borderRadius: 12 }}
            >
              <strong>{tn.fehler_keine_rolle}</strong>
              <p style={{ margin: '8px 0 0' }}>
                <Link href="/einstellungen?tab=profil">
                  Rollen in den Einstellungen ändern
                </Link>
              </p>
            </div>
          ) : meineWerke.length === 0 ? (
            <div
              role="alert"
              className="callout"
              style={{ padding: 16, borderRadius: 12 }}
            >
              <strong>{tn.fehler_kein_werk}</strong>
              <p style={{ margin: '8px 0 0' }}>
                <Link href="/werke/neu">Neues Werk anlegen</Link>
              </p>
            </div>
          ) : (
            <form
              action={pruefrundeAnlegenAction}
              style={{ display: 'grid', gap: 16 }}
            >
              <label style={{ display: 'grid', gap: 6 }} htmlFor="werk_id">
                <span style={{ fontWeight: 600 }}>{tn.label_werk}</span>
                <select
                  id="werk_id"
                  name="werk_id"
                  required
                  defaultValue={sp.werk ?? meineWerke[0]?.id}
                  style={inputStyle}
                >
                  {meineWerke.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                  {tn.label_werk_hilfe}
                </span>
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

              <label style={{ display: 'grid', gap: 6 }} htmlFor="testziel">
                <span style={{ fontWeight: 600 }}>{tn.label_testziel}</span>
                <textarea
                  id="testziel"
                  name="testziel"
                  required
                  maxLength={2000}
                  rows={3}
                  style={textareaStyle}
                />
              </label>

              <label style={{ display: 'grid', gap: 6 }} htmlFor="testaufgabe">
                <span style={{ fontWeight: 600 }}>{tn.label_testaufgabe}</span>
                <textarea
                  id="testaufgabe"
                  name="testaufgabe"
                  required
                  maxLength={5000}
                  rows={6}
                  style={textareaStyle}
                />
              </label>

              <label style={{ display: 'grid', gap: 6 }} htmlFor="zielgruppe">
                <span style={{ fontWeight: 600 }}>{tn.label_zielgruppe}</span>
                <textarea
                  id="zielgruppe"
                  name="zielgruppe"
                  required
                  maxLength={500}
                  rows={2}
                  style={textareaStyle}
                />
              </label>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 12,
                }}
              >
                <label style={{ display: 'grid', gap: 6 }} htmlFor="zeitbedarf_minuten">
                  <span style={{ fontWeight: 600 }}>
                    {tn.label_zeitbedarf}
                  </span>
                  <input
                    id="zeitbedarf_minuten"
                    name="zeitbedarf_minuten"
                    type="number"
                    min={5}
                    max={120}
                    step={5}
                    defaultValue={30}
                    required
                    style={inputStyle}
                  />
                </label>
                <label style={{ display: 'grid', gap: 6 }} htmlFor="gesuchte_tester">
                  <span style={{ fontWeight: 600 }}>
                    {tn.label_gesuchte_tester}
                  </span>
                  <input
                    id="gesuchte_tester"
                    name="gesuchte_tester"
                    type="number"
                    min={1}
                    max={10}
                    defaultValue={3}
                    required
                    style={inputStyle}
                  />
                </label>
              </div>

              <fieldset
                style={{
                  border: 'var(--hairline)',
                  borderRadius: 12,
                  padding: 14,
                }}
              >
                <legend style={{ fontWeight: 600, padding: '0 6px' }}>
                  {tn.label_feedback_kategorien}
                </legend>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: 8,
                  }}
                >
                  {feedbackKategorieEnum.map((k, i) => (
                    <label
                      key={k}
                      style={{
                        display: 'inline-flex',
                        gap: 8,
                        alignItems: 'center',
                      }}
                    >
                      <input
                        type="checkbox"
                        name="feedback_kategorien"
                        value={k}
                        defaultChecked={i < 3}
                      />
                      <span>{kategorieLabel(k)}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <label style={{ display: 'grid', gap: 6 }} htmlFor="frist">
                <span style={{ fontWeight: 600 }}>{tn.label_frist}</span>
                <input
                  id="frist"
                  name="frist"
                  type="date"
                  min={formatDatumInput(minFrist)}
                  max={formatDatumInput(maxFrist)}
                  defaultValue={formatDatumInput(defaultFrist)}
                  required
                  style={inputStyle}
                />
              </label>

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <button type="submit" className="button primary">
                  {tn.button_anlegen}
                </button>
                <Link
                  href="/uebersicht/pruefrunden"
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
  minHeight: 60,
};
