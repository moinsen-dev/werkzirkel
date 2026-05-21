/**
 * /werke/neu — Neuen Build anlegen (Server Component + Server Action).
 *
 * PRD §F-101 Anlegen: max 5 Werke pro Builder:in (kostenlos), Pflichtfelder
 * gemaess §8.3. Auth + Rolle 'macher' Pflicht.
 *
 * Logik:
 * - Auth-Check via getSession; ohne Session → redirect /anmelden?next=/werke/neu.
 * - Rolle-Check: ohne 'macher'-Rolle wird ein 403-aehnliches Hinweis-Panel
 *   angezeigt (kein Redirect, damit der User die Erklaerung sieht).
 * - Limit-Check (max 5 ohne Foerdermitgliedschaft) sowohl beim Render (Button
 *   deaktivieren) als auch in der Server-Action (defense in depth).
 *
 * Fehlerfaelle laufen ueber `?fehler=`-Query, damit die Seite Server-rendert
 * bleibt — kein Client-Bundle fuer dieses Form noetig.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { de } from '@/i18n/de';
import { db } from '@/lib/db';
import { auditLog, werk } from '@/lib/db/schema';
import {
  hilfebedarf as hilfebedarfEnum,
  werkSichtbarkeit as werkSichtbarkeitEnum,
  werkstand as werkstandEnum,
} from '@/lib/db/schema/enums';
import { getSessionFromRequest } from '@/lib/auth/session';
import { werkAnlegenSchema } from '@/lib/validators/werk';
import { pruefeWerkAnlegenLimit } from '@/lib/werk/limit';

export const metadata: Metadata = {
  title: 'Neuen Build anlegen',
  robots: { index: false, follow: false },
};

const tf = de.werk_form;

interface PageProps {
  searchParams: Promise<{ fehler?: string; feld?: string }>;
}

async function buildRequestFromHeaders(): Promise<Request> {
  const h = await headers();
  const headerInit: Record<string, string> = {};
  for (const [name, value] of h.entries()) {
    headerInit[name] = value;
  }
  return new Request('http://internal.werkzirkel/werke/neu', {
    headers: headerInit,
  });
}

/**
 * Server-Action: legt das neue Werk an.
 *
 * Fehlerpfade landen via `redirect('/werke/neu?fehler=...')` zurueck auf der
 * Seite — der User sieht die Meldung im Banner. Bei Erfolg redirect zu
 * `/werke/<id>/bearbeiten?frisch=1`.
 */
export async function werkAnlegen(formData: FormData): Promise<void> {
  'use server';

  const req = await buildRequestFromHeaders();
  const sess = await getSessionFromRequest(req);
  if (!sess) {
    redirect('/anmelden?next=/werke/neu');
  }
  if (!sess.nutzer.rollen.includes('macher')) {
    redirect('/werke/neu?fehler=keine_rolle');
  }

  const hilfebedarfValues = formData
    .getAll('hilfebedarf')
    .map((v) => String(v))
    .filter(Boolean);

  const candidate = {
    name: String(formData.get('name') ?? '').trim(),
    kurzbeschreibung: String(formData.get('kurzbeschreibung') ?? '').trim(),
    problem: String(formData.get('problem') ?? '').trim(),
    zielgruppe: String(formData.get('zielgruppe') ?? '').trim(),
    werkstand: String(formData.get('werkstand') ?? '').trim(),
    hilfebedarf: hilfebedarfValues,
    link: String(formData.get('link') ?? ''),
    sichtbarkeit: String(formData.get('sichtbarkeit') ?? 'oeffentlich').trim(),
  };

  const parsed = werkAnlegenSchema.safeParse(candidate);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const firstFeld = Object.keys(fieldErrors)[0] ?? 'unbekannt';
    redirect(`/werke/neu?fehler=validierung&feld=${encodeURIComponent(firstFeld)}`);
  }
  const input = parsed.data;

  const limit = await pruefeWerkAnlegenLimit(sess.nutzerId);
  if (!limit.erlaubt) {
    redirect('/werke/neu?fehler=limit');
  }

  const inserted = await db
    .insert(werk)
    .values({
      nutzerId: sess.nutzerId,
      name: input.name,
      kurzbeschreibung: input.kurzbeschreibung,
      problem: input.problem,
      zielgruppe: input.zielgruppe,
      werkstand: input.werkstand,
      hilfebedarf: input.hilfebedarf,
      link: input.link ?? null,
      sichtbarkeit: input.sichtbarkeit,
    })
    .returning({ id: werk.id });

  const row = inserted[0];
  if (!row) {
    redirect('/werke/neu?fehler=unbekannt');
  }

  try {
    await db.insert(auditLog).values({
      nutzerId: sess.nutzerId,
      aktion: 'werk.angelegt',
      referenzTyp: 'werk',
      referenzId: row.id,
    });
  } catch {
    // Audit-Failure darf den Erfolg nicht blockieren.
  }

  redirect(`/werke/${row.id}/bearbeiten?frisch=1`);
}

function FehlerBanner({ fehler, feld }: { fehler?: string; feld?: string }) {
  if (!fehler) return null;
  let text = '';
  if (fehler === 'keine_rolle') text = tf.fehler_keine_rolle;
  else if (fehler === 'limit') text = tf.fehler_limit;
  else if (fehler === 'validierung') {
    text = feld ? `${tf.fehler_validierung} (Feld: ${feld})` : tf.fehler_validierung;
  } else text = de.fehler.unbekannt;
  return (
    <div
      role="alert"
      className="callout"
      style={{
        marginBottom: 16,
        borderColor: '#d04848',
        background: '#fbeaea',
        color: '#5a1a1a',
        padding: '12px 14px',
        borderRadius: 10,
        border: '1px solid #d04848',
      }}
    >
      {text}
    </div>
  );
}

export default async function WerkAnlegenPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const req = await buildRequestFromHeaders();
  const sess = await getSessionFromRequest(req);
  if (!sess) {
    redirect('/anmelden?next=/werke/neu');
  }

  // Rolle-Check: ohne 'macher' zeigen wir Hinweis-Panel statt Form.
  const hatMacherRolle = sess.nutzer.rollen.includes('macher');

  // Limit-Check: wenn schon 5 Werke + keine Foerdermitgliedschaft → Hinweis +
  // disabled-State. Wir rendern die Form trotzdem, damit der User sieht was
  // moeglich waere.
  const limit = hatMacherRolle
    ? await pruefeWerkAnlegenLimit(sess.nutzerId)
    : null;
  const limitErreicht = !!limit && !limit.erlaubt;

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
            <Link href="/uebersicht">{de.uebersicht.nav_uebersicht}</Link>
            <Link href="/uebersicht/werke" aria-current="page">
              {de.uebersicht.nav_werke}
            </Link>
          </div>
        </div>
      </nav>

      <header className="hero" id="top">
        <div className="wrap hero-grid single">
          <div>
            <p className="eyebrow">Werkzirkel · Werke</p>
            <h1>{tf.titel_neu}</h1>
            <p className="hero-copy">{tf.untertitel_neu}</p>
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
              data-rolle-fehlt
            >
              <strong>{tf.fehler_keine_rolle}</strong>
              <p style={{ margin: '8px 0 0' }}>
                <Link href="/einstellungen?tab=profil">
                  Rollen in den Einstellungen ändern
                </Link>
              </p>
            </div>
          ) : (
            <>
              {limitErreicht ? (
                <div
                  role="alert"
                  className="callout"
                  style={{ padding: 16, borderRadius: 12, marginBottom: 16 }}
                >
                  <strong>{tf.fehler_limit}</strong>
                </div>
              ) : null}

              <form action={werkAnlegen} style={{ display: 'grid', gap: 16 }}>
                <label
                  style={{ display: 'grid', gap: 6 }}
                  htmlFor="name"
                >
                  <span style={{ fontWeight: 600 }}>{tf.label_name}</span>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    maxLength={200}
                    style={inputStyle}
                  />
                </label>

                <label
                  style={{ display: 'grid', gap: 6 }}
                  htmlFor="kurzbeschreibung"
                >
                  <span style={{ fontWeight: 600 }}>
                    {tf.label_kurzbeschreibung}
                  </span>
                  <textarea
                    id="kurzbeschreibung"
                    name="kurzbeschreibung"
                    required
                    maxLength={280}
                    rows={3}
                    style={textareaStyle}
                  />
                </label>

                <label
                  style={{ display: 'grid', gap: 6 }}
                  htmlFor="problem"
                >
                  <span style={{ fontWeight: 600 }}>{tf.label_problem}</span>
                  <textarea
                    id="problem"
                    name="problem"
                    required
                    maxLength={2000}
                    rows={5}
                    style={textareaStyle}
                  />
                </label>

                <label
                  style={{ display: 'grid', gap: 6 }}
                  htmlFor="zielgruppe"
                >
                  <span style={{ fontWeight: 600 }}>{tf.label_zielgruppe}</span>
                  <textarea
                    id="zielgruppe"
                    name="zielgruppe"
                    required
                    maxLength={500}
                    rows={2}
                    style={textareaStyle}
                  />
                </label>

                <label
                  style={{ display: 'grid', gap: 6 }}
                  htmlFor="werkstand"
                >
                  <span style={{ fontWeight: 600 }}>{tf.label_werkstand}</span>
                  <select
                    id="werkstand"
                    name="werkstand"
                    required
                    defaultValue="idee"
                    style={inputStyle}
                  >
                    {werkstandEnum.map((w) => (
                      <option key={w} value={w}>
                        {(de.werkstand as Record<string, string>)[w] ?? w}
                      </option>
                    ))}
                  </select>
                </label>

                <fieldset
                  style={{
                    border: 'var(--hairline)',
                    borderRadius: 12,
                    padding: 14,
                  }}
                >
                  <legend style={{ fontWeight: 600, padding: '0 6px' }}>
                    {tf.label_hilfebedarf}
                  </legend>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns:
                        'repeat(auto-fit, minmax(220px, 1fr))',
                      gap: 8,
                    }}
                  >
                    {hilfebedarfEnum.map((h) => (
                      <label
                        key={h}
                        style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}
                      >
                        <input type="checkbox" name="hilfebedarf" value={h} />
                        <span>
                          {(de.hilfebedarf as Record<string, string>)[h] ?? h}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <label
                  style={{ display: 'grid', gap: 6 }}
                  htmlFor="link"
                >
                  <span style={{ fontWeight: 600 }}>{tf.label_link}</span>
                  <input
                    id="link"
                    name="link"
                    type="url"
                    placeholder="https://"
                    maxLength={500}
                    style={inputStyle}
                  />
                </label>

                <fieldset
                  style={{
                    border: 'var(--hairline)',
                    borderRadius: 12,
                    padding: 14,
                  }}
                >
                  <legend style={{ fontWeight: 600, padding: '0 6px' }}>
                    {tf.label_sichtbarkeit}
                  </legend>
                  <div style={{ display: 'grid', gap: 6 }}>
                    {werkSichtbarkeitEnum.map((s, i) => (
                      <label
                        key={s}
                        style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}
                      >
                        <input
                          type="radio"
                          name="sichtbarkeit"
                          value={s}
                          defaultChecked={i === 0}
                        />
                        <span>
                          {(de.werk_sichtbarkeit as Record<string, string>)[s] ?? s}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <button
                    type="submit"
                    className="button primary"
                    disabled={limitErreicht}
                  >
                    {tf.button_anlegen}
                  </button>
                  <Link
                    href="/uebersicht/werke"
                    className="button secondary"
                  >
                    Abbrechen
                  </Link>
                </div>
              </form>
            </>
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
