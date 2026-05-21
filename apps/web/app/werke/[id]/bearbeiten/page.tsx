/**
 * /werke/[id]/bearbeiten — Werk bearbeiten (Server Component + Server Actions).
 *
 * PRD §F-102/F-103/F-104: Inhaber:in-only, Werkstand-Wechsel triggert
 * werk_historie, Sichtbarkeit-Wechsel ohne Historie. PRD §F-101 fuer Loeschen.
 *
 * Logik:
 * - 404 wenn Werk nicht existiert ODER session.user.id !== werk.nutzer_id.
 * - Form mit vorgefuellten Werten.
 * - Server Actions:
 *   - werkAktualisierenAction: PATCH-Logik direkt via Drizzle. Build-Stand-
 *     Wechsel atomar mit werk_historie-Insert.
 *   - werkLoeschenAction: DELETE + redirect zu /uebersicht/werke.
 *
 * Screenshots werden ueber die separate Client-Component <ScreenshotUploader>
 * hochgeladen — Server-Actions koennen kein Multipart sauber streamen.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';

import { de } from '@/i18n/de';
import { db } from '@/lib/db';
import { auditLog, werk, werkHistorie } from '@/lib/db/schema';
import {
  hilfebedarf as hilfebedarfEnum,
  werkSichtbarkeit as werkSichtbarkeitEnum,
  werkstand as werkstandEnum,
} from '@/lib/db/schema/enums';
import { getSessionFromRequest } from '@/lib/auth/session';
import { werkPatchSchema } from '@/lib/validators/werk';
import ScreenshotUploader from './screenshot-uploader';

export const metadata: Metadata = {
  title: 'Build bearbeiten',
  robots: { index: false, follow: false },
};

const tf = de.werk_form;

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    frisch?: string;
    gespeichert?: string;
    fehler?: string;
    feld?: string;
  }>;
}

async function buildRequestFromHeaders(): Promise<Request> {
  const h = await headers();
  const headerInit: Record<string, string> = {};
  for (const [name, value] of h.entries()) {
    headerInit[name] = value;
  }
  return new Request('http://internal.werkzirkel/werke', {
    headers: headerInit,
  });
}

async function ladeWerk(id: string) {
  const rows = await db
    .select()
    .from(werk)
    .where(eq(werk.id, id))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Server-Action: Werk aktualisieren.
 *
 * Werkstand-Wechsel erzeugt atomar einen `werk_historie`-Eintrag.
 */
export async function werkAktualisierenAction(
  werkId: string,
  formData: FormData,
): Promise<void> {
  'use server';

  const req = await buildRequestFromHeaders();
  const sess = await getSessionFromRequest(req);
  if (!sess) {
    redirect(`/anmelden?next=/werke/${werkId}/bearbeiten`);
  }

  const current = await ladeWerk(werkId);
  if (!current) notFound();
  if (current.nutzerId !== sess.nutzerId) notFound();

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
    sichtbarkeit: String(formData.get('sichtbarkeit') ?? '').trim(),
  };

  const parsed = werkPatchSchema.safeParse(candidate);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const firstFeld = Object.keys(fieldErrors)[0] ?? 'unbekannt';
    redirect(
      `/werke/${werkId}/bearbeiten?fehler=validierung&feld=${encodeURIComponent(firstFeld)}`,
    );
  }
  const patch = parsed.data;

  const werkstandWechselt =
    patch.werkstand !== undefined && patch.werkstand !== current.werkstand;

  await db.transaction(async (tx) => {
    if (werkstandWechselt && patch.werkstand) {
      await tx.insert(werkHistorie).values({
        werkId: current.id,
        werkstandAlt: current.werkstand,
        werkstandNeu: patch.werkstand,
        geaendertVon: sess.nutzerId,
      });
    }
    await tx
      .update(werk)
      .set({
        name: patch.name ?? current.name,
        kurzbeschreibung: patch.kurzbeschreibung ?? current.kurzbeschreibung,
        problem: patch.problem ?? current.problem,
        zielgruppe: patch.zielgruppe ?? current.zielgruppe,
        werkstand: patch.werkstand ?? current.werkstand,
        hilfebedarf: patch.hilfebedarf ?? current.hilfebedarf,
        link: patch.link !== undefined ? patch.link : current.link,
        sichtbarkeit: patch.sichtbarkeit ?? current.sichtbarkeit,
        aktualisiertAm: new Date(),
      })
      .where(eq(werk.id, current.id));
  });

  try {
    await db.insert(auditLog).values({
      nutzerId: sess.nutzerId,
      aktion: 'werk.aktualisiert',
      referenzTyp: 'werk',
      referenzId: current.id,
    });
  } catch {
    /* Audit-Failure darf den Erfolg nicht blockieren. */
  }

  redirect(`/werke/${werkId}/bearbeiten?gespeichert=1`);
}

/**
 * Server-Action: Werk loeschen. CASCADE raeumt werk_historie.
 */
export async function werkLoeschenAction(werkId: string): Promise<void> {
  'use server';

  const req = await buildRequestFromHeaders();
  const sess = await getSessionFromRequest(req);
  if (!sess) {
    redirect(`/anmelden?next=/werke/${werkId}/bearbeiten`);
  }

  const current = await ladeWerk(werkId);
  if (!current) notFound();
  if (current.nutzerId !== sess.nutzerId) notFound();

  await db.delete(werk).where(eq(werk.id, current.id));

  try {
    await db.insert(auditLog).values({
      nutzerId: sess.nutzerId,
      aktion: 'werk.geloescht',
      referenzTyp: 'werk',
      referenzId: current.id,
    });
  } catch {
    /* ignore */
  }

  redirect('/uebersicht/werke');
}

function ErfolgsBanner({
  frisch,
  gespeichert,
}: {
  frisch: boolean;
  gespeichert: boolean;
}) {
  if (!frisch && !gespeichert) return null;
  const text = frisch ? tf.erfolg_frisch_angelegt : tf.erfolg_gespeichert;
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

function FehlerBanner({ fehler, feld }: { fehler?: string; feld?: string }) {
  if (!fehler) return null;
  let text = '';
  if (fehler === 'validierung') {
    text = feld ? `${tf.fehler_validierung} (Feld: ${feld})` : tf.fehler_validierung;
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

export default async function WerkBearbeitenPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const sp = await searchParams;

  const req = await buildRequestFromHeaders();
  const sess = await getSessionFromRequest(req);
  if (!sess) {
    redirect(`/anmelden?next=/werke/${id}/bearbeiten`);
  }

  const current = await ladeWerk(id);
  if (!current) notFound();
  if (current.nutzerId !== sess.nutzerId) notFound();

  // Server-Actions als wrapper, damit wir die werkId per closure mitgeben.
  const aktualisierenAction = werkAktualisierenAction.bind(null, id);
  const loeschenAction = werkLoeschenAction.bind(null, id);

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
            <h1>{tf.titel_bearbeiten}</h1>
            <p className="hero-copy">{tf.untertitel_bearbeiten}</p>
          </div>
        </div>
      </header>

      <section className="section compact">
        <div className="wrap" style={{ maxWidth: 760 }}>
          <ErfolgsBanner
            frisch={sp.frisch === '1'}
            gespeichert={sp.gespeichert === '1'}
          />
          <FehlerBanner fehler={sp.fehler} feld={sp.feld} />

          <form action={aktualisierenAction} style={{ display: 'grid', gap: 16 }}>
            <label style={{ display: 'grid', gap: 6 }} htmlFor="name">
              <span style={{ fontWeight: 600 }}>{tf.label_name}</span>
              <input
                id="name"
                name="name"
                type="text"
                required
                maxLength={200}
                defaultValue={current.name}
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
                defaultValue={current.kurzbeschreibung}
                style={textareaStyle}
              />
            </label>

            <label style={{ display: 'grid', gap: 6 }} htmlFor="problem">
              <span style={{ fontWeight: 600 }}>{tf.label_problem}</span>
              <textarea
                id="problem"
                name="problem"
                required
                maxLength={2000}
                rows={5}
                defaultValue={current.problem}
                style={textareaStyle}
              />
            </label>

            <label style={{ display: 'grid', gap: 6 }} htmlFor="zielgruppe">
              <span style={{ fontWeight: 600 }}>{tf.label_zielgruppe}</span>
              <textarea
                id="zielgruppe"
                name="zielgruppe"
                required
                maxLength={500}
                rows={2}
                defaultValue={current.zielgruppe}
                style={textareaStyle}
              />
            </label>

            <label style={{ display: 'grid', gap: 6 }} htmlFor="werkstand">
              <span style={{ fontWeight: 600 }}>{tf.label_werkstand}</span>
              <select
                id="werkstand"
                name="werkstand"
                required
                defaultValue={current.werkstand}
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
                    <input
                      type="checkbox"
                      name="hilfebedarf"
                      value={h}
                      defaultChecked={current.hilfebedarf.includes(h)}
                    />
                    <span>
                      {(de.hilfebedarf as Record<string, string>)[h] ?? h}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <label style={{ display: 'grid', gap: 6 }} htmlFor="link">
              <span style={{ fontWeight: 600 }}>{tf.label_link}</span>
              <input
                id="link"
                name="link"
                type="url"
                placeholder="https://"
                maxLength={500}
                defaultValue={current.link ?? ''}
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
                {werkSichtbarkeitEnum.map((s) => (
                  <label
                    key={s}
                    style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}
                  >
                    <input
                      type="radio"
                      name="sichtbarkeit"
                      value={s}
                      defaultChecked={current.sichtbarkeit === s}
                    />
                    <span>
                      {(de.werk_sichtbarkeit as Record<string, string>)[s] ?? s}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button type="submit" className="button primary">
                {tf.button_speichern}
              </button>
              <Link
                href={`/werke/${id}`}
                className="button secondary"
              >
                Öffentliche Detailseite ansehen
              </Link>
            </div>
          </form>

          <hr style={{ margin: '32px 0', border: 'var(--hairline)' }} />

          <ScreenshotUploader
            werkId={id}
            initialScreenshots={current.screenshots}
            texte={{
              label: tf.label_screenshots,
              keine: tf.screenshots_keine,
              maxErreicht: tf.screenshots_max_erreicht,
              hochladen: tf.screenshots_hochladen,
              laeuft: tf.screenshots_laeuft,
              loeschen: tf.screenshots_loeschen,
            }}
          />

          <hr style={{ margin: '32px 0', border: 'var(--hairline)' }} />

          <form
            action={loeschenAction}
            onSubmit={undefined}
            style={{ display: 'grid', gap: 12 }}
          >
            <h2 style={{ margin: 0, fontSize: 22 }}>Build löschen</h2>
            <p style={{ margin: 0, color: 'var(--muted)' }}>
              Das Werk wird endgültig entfernt, inklusive Build-Stand-Verlauf und
              Screenshots. Dieser Schritt kann nicht rückgängig gemacht werden.
            </p>
            <button
              type="submit"
              className="button secondary"
              style={{
                color: '#5a1a1a',
                borderColor: '#d04848',
                alignSelf: 'flex-start',
              }}
            >
              {tf.button_loeschen}
            </button>
          </form>
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
