/**
 * /bedarfe/neu — 3-Schritt-Bedarf-Anlegen-Flow (Server Component + Server Actions).
 *
 * Quelle: PRD §F-602, §11A Schutz S1, §18 (Werkstattbeitrag-Pfade).
 *
 * Schritte (via Query-Param `schritt`):
 *  - Schritt 1 (Default): Werkstattbeitrag-Auswahl. Wenn gueltiger Beitrag
 *    existiert: direkt 'Weiter' nach Schritt 2. Sonst drei Optionen
 *    (Schauabend-Termine, Geldbeitrag via Stripe, Sachleistung-Form).
 *  - Schritt 2: Bedarf-Form mit Validator-Feldern.
 *  - Schritt 3: Bestaetigung nach erfolgreichem Einreichen.
 *
 * Server-Actions:
 *  - sachleistungAction: legt werkstattbeitrag mit art='sachleistung' an.
 *  - bedarfAnlegenAction: INSERT bedarf + sofort einreichen (status='in_pruefung').
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { and, eq, gt, isNull, lt, or } from 'drizzle-orm';

import { de } from '@/i18n/de';
import { db } from '@/lib/db';
import {
  auditLog,
  bedarf,
  werkstattbeitrag,
} from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';
import { hasRolle } from '@/lib/auth/permissions';
import {
  bedarfAnlegenSchema,
} from '@/lib/validators/bedarf';
import { checkSprache } from '@/lib/moderation/verbotene-woerter';
import { sendMail } from '@/lib/email/send';
import { env } from '@/lib/env';

const tn = de.bedarfsseite.bedarf_neu;
const tnav = de.uebersicht;

const APP_URL = env.APP_URL.replace(/\/+$/, '');
const VERWENDET_LIMIT = 4;

export const metadata: Metadata = {
  title: 'Bedarf einbringen — Werkzirkel',
  robots: { index: false, follow: false },
};

interface PageProps {
  searchParams: Promise<{
    schritt?: string;
    fehler?: string;
    feld?: string;
  }>;
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

async function ladeGueltigenBeitrag(nutzerId: string) {
  const jetzt = new Date();
  const rows = await db
    .select()
    .from(werkstattbeitrag)
    .where(
      and(
        eq(werkstattbeitrag.nutzerId, nutzerId),
        eq(werkstattbeitrag.status, 'verifiziert'),
        or(
          isNull(werkstattbeitrag.gueltigBis),
          gt(werkstattbeitrag.gueltigBis, jetzt),
        ),
        lt(werkstattbeitrag.verwendetFuerBedarfe, VERWENDET_LIMIT),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

/* ─────────── Server Actions ─────────── */

export async function sachleistungAction(formData: FormData): Promise<void> {
  'use server';

  const req = await buildRequestFromHeaders('/bedarfe/neu');
  const sess = await getSessionFromRequest(req);
  if (!sess) {
    redirect('/anmelden?next=/bedarfe/neu');
  }
  if (!hasRolle(sess.nutzer, 'bedarfstraeger')) {
    redirect('/bedarfe/neu?fehler=keine_rolle');
  }

  const text = String(formData.get('nachweis_text') ?? '').trim();
  if (text.length < 30) {
    redirect(
      '/bedarfe/neu?schritt=sachleistung&fehler=validierung&feld=nachweis_text',
    );
  }

  await db
    .insert(werkstattbeitrag)
    .values({
      nutzerId: sess.nutzerId,
      art: 'sachleistung',
      nachweisText: text,
      status: 'erfasst',
    });

  try {
    await db.insert(auditLog).values({
      nutzerId: sess.nutzerId,
      aktion: 'werkstattbeitrag.sachleistung.erfasst',
      referenzTyp: 'werkstattbeitrag',
    });
  } catch {
    /* ignore */
  }

  redirect('/bedarfe/neu?schritt=sachleistung_eingereicht');
}

export async function bedarfAnlegenAction(formData: FormData): Promise<void> {
  'use server';

  const req = await buildRequestFromHeaders('/bedarfe/neu');
  const sess = await getSessionFromRequest(req);
  if (!sess) {
    redirect('/anmelden?next=/bedarfe/neu');
  }
  if (!hasRolle(sess.nutzer, 'bedarfstraeger')) {
    redirect('/bedarfe/neu?fehler=keine_rolle');
  }

  const klarname = sess.nutzer.klarname?.trim();
  if (!klarname) {
    redirect('/bedarfe/neu?fehler=klarname_fehlt');
  }

  // Werkstattbeitrag-Gate vor INSERT.
  const beitrag = await ladeGueltigenBeitrag(sess.nutzerId);
  if (!beitrag) {
    redirect('/bedarfe/neu?fehler=werkstattbeitrag_fehlt');
  }

  const fristStr = String(formData.get('frist') ?? '').trim();
  const zeitWStr = String(
    formData.get('groessenordnung_zeit_wochen') ?? '',
  ).trim();
  const aufwTStr = String(
    formData.get('groessenordnung_aufwand_tage') ?? '',
  ).trim();
  const minEStr = String(formData.get('geldrahmen_min_euro') ?? '').trim();
  const maxEStr = String(formData.get('geldrahmen_max_euro') ?? '').trim();

  const candidate: Record<string, unknown> = {
    organisation: String(formData.get('organisation') ?? '').trim(),
    titel: String(formData.get('titel') ?? '').trim(),
    problem: String(formData.get('problem') ?? '').trim(),
    nutzen: String(formData.get('nutzen') ?? '').trim(),
    stadt_id: sess.nutzer.stadtId || 'hh',
    frist: fristStr,
  };
  if (zeitWStr) candidate.groessenordnung_zeit_wochen = Number(zeitWStr);
  if (aufwTStr) candidate.groessenordnung_aufwand_tage = Number(aufwTStr);
  if (minEStr) candidate.geldrahmen_min_euro_cent = Number(minEStr) * 100;
  if (maxEStr) candidate.geldrahmen_max_euro_cent = Number(maxEStr) * 100;
  const branche = String(formData.get('branche') ?? '').trim();
  if (branche) candidate.branche = branche;
  const werkstand = String(formData.get('bevorzugter_werkstand') ?? '').trim();
  if (werkstand) candidate.bevorzugter_werkstand = werkstand;

  const parsed = bedarfAnlegenSchema.safeParse(candidate);
  if (!parsed.success) {
    const fields = parsed.error.flatten().fieldErrors;
    const feld = Object.keys(fields)[0] ?? 'unbekannt';
    redirect(
      `/bedarfe/neu?schritt=2&fehler=validierung&feld=${encodeURIComponent(feld)}`,
    );
  }
  const input = parsed.data;

  const inserted = await db
    .insert(bedarf)
    .values({
      nutzerId: sess.nutzerId,
      organisation: input.organisation,
      titel: input.titel,
      problem: input.problem,
      nutzen: input.nutzen,
      stadtId: input.stadt_id,
      groessenordnungZeitWochen: input.groessenordnung_zeit_wochen ?? null,
      groessenordnungAufwandTage: input.groessenordnung_aufwand_tage ?? null,
      geldrahmenMinEuroCent: input.geldrahmen_min_euro_cent ?? null,
      geldrahmenMaxEuroCent: input.geldrahmen_max_euro_cent ?? null,
      frist: input.frist,
      branche: input.branche ?? null,
      bevorzugterWerkstand: input.bevorzugter_werkstand ?? null,
      werkstattbeitragId: beitrag.id,
      status: 'in_pruefung',
    })
    .returning({ id: bedarf.id });
  const row = inserted[0];
  if (!row) {
    redirect('/bedarfe/neu?schritt=2&fehler=unbekannt');
  }

  const sprache = checkSprache(
    [input.titel, input.problem, input.nutzen, input.organisation].join('\n'),
  );

  // T-301 Bestaetigung
  try {
    await sendMail({
      to: sess.nutzer.email,
      nutzerId: sess.nutzerId,
      template: 'T-301',
      props: {
        titel: input.titel,
        organisation: input.organisation,
        bedarfUrl: `${APP_URL}/uebersicht/bedarfe`,
      },
    });
  } catch (err) {
    console.error('[bedarfe-neu] sendMail T-301 failed:', err);
  }

  try {
    await db.insert(auditLog).values({
      nutzerId: sess.nutzerId,
      aktion: 'bedarf.eingereicht',
      referenzTyp: 'bedarf',
      referenzId: row.id,
      metadaten: {
        werkstattbeitrag_id: beitrag.id,
        sprach_check_ok: sprache.ok,
        sprach_check_treffer: sprache.treffer,
        flow: '3-schritt',
      },
    });
  } catch {
    /* ignore */
  }

  redirect('/bedarfe/neu?schritt=3');
}

/* ─────────── Page ─────────── */

function formatDatumInput(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${yyyy}-${mm}-${dd}`;
}

export default async function BedarfNeuPage({ searchParams }: PageProps) {
  const sp = await searchParams;

  const req = await buildRequestFromHeaders('/bedarfe/neu');
  const sess = await getSessionFromRequest(req);
  if (!sess) {
    redirect('/anmelden?next=/bedarfe/neu');
  }

  const istBedarf = hasRolle(sess.nutzer, 'bedarfstraeger');
  const klarname = sess.nutzer.klarname?.trim() ?? '';
  const hatKlarname = klarname.length > 0;

  const beitrag = istBedarf ? await ladeGueltigenBeitrag(sess.nutzerId) : null;

  const schritt = sp.schritt ?? '1';

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
            <Link href="/bedarfe">{de.bedarfsseite.nav_bedarfe}</Link>
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
          {!istBedarf ? (
            <Hinweis kind="fehler">
              <strong>{tn.fehler_keine_rolle}</strong>
              <p style={{ margin: '8px 0 0' }}>
                <Link href="/einstellungen?tab=profil">
                  {tn.fehler_keine_rolle_link}
                </Link>
              </p>
            </Hinweis>
          ) : !hatKlarname ? (
            <Hinweis kind="fehler">
              <strong>{tn.fehler_klarname_fehlt}</strong>
              <p style={{ margin: '8px 0 0' }}>
                <Link href="/einstellungen?tab=profil">
                  Klarname in den Einstellungen ergänzen
                </Link>
              </p>
            </Hinweis>
          ) : sp.fehler === 'werkstattbeitrag_fehlt' ? (
            <Hinweis kind="fehler">{tn.fehler_werkstattbeitrag_fehlt}</Hinweis>
          ) : sp.fehler === 'validierung' ? (
            <Hinweis kind="fehler">
              {tn.fehler_validierung}
              {sp.feld ? ` (Feld: ${sp.feld})` : null}
            </Hinweis>
          ) : sp.fehler === 'unbekannt' ? (
            <Hinweis kind="fehler">{tn.fehler_unbekannt}</Hinweis>
          ) : null}

          {istBedarf && hatKlarname ? (
            schritt === '3' ? (
              <Schritt3 />
            ) : schritt === 'sachleistung_eingereicht' ? (
              <SachleistungEingereicht />
            ) : schritt === 'sachleistung' ? (
              <SchrittSachleistung />
            ) : schritt === '2' || beitrag ? (
              <Schritt2 organisationDefault={sess.nutzer.anzeigename} />
            ) : (
              <Schritt1 />
            )
          ) : null}
        </div>
      </section>
    </div>
  );
}

/* ─────────── Schritt-Komponenten ─────────── */

function Schritt1() {
  const t = tn;
  return (
    <div>
      <h2 style={{ fontSize: 24, margin: 0 }}>{t.schritt_1_titel}</h2>
      <p style={{ color: 'var(--muted)' }}>{t.schritt_1_hinweis}</p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 12,
          marginTop: 12,
        }}
      >
        <article
          className="work-card"
          style={{ padding: 0 }}
          aria-label={t.schritt_1_pfad_a_titel}
        >
          <div className="work-body">
            <span className="status-pill">Pfad A</span>
            <h3 style={{ margin: '8px 0 0', fontSize: 18 }}>
              {t.schritt_1_pfad_a_titel}
            </h3>
            <p style={{ color: 'var(--muted)', fontSize: 13 }}>
              {t.schritt_1_pfad_a_text}
            </p>
            <Link
              className="button secondary"
              href="/termine?stadt=hh&typ=schauabend"
            >
              {t.schritt_1_pfad_a_button}
            </Link>
          </div>
        </article>
        <article
          className="work-card"
          style={{ padding: 0 }}
          aria-label={t.schritt_1_pfad_b_titel}
        >
          <div className="work-body">
            <span className="status-pill">Pfad B</span>
            <h3 style={{ margin: '8px 0 0', fontSize: 18 }}>
              {t.schritt_1_pfad_b_titel}
            </h3>
            <p style={{ color: 'var(--muted)', fontSize: 13 }}>
              {t.schritt_1_pfad_b_text}
            </p>
            <Link
              className="button secondary"
              href="/uebersicht/werkstattbeitrag"
            >
              {t.schritt_1_pfad_b_button}
            </Link>
          </div>
        </article>
        <article
          className="work-card"
          style={{ padding: 0 }}
          aria-label={t.schritt_1_pfad_c_titel}
        >
          <div className="work-body">
            <span className="status-pill">Pfad C</span>
            <h3 style={{ margin: '8px 0 0', fontSize: 18 }}>
              {t.schritt_1_pfad_c_titel}
            </h3>
            <p style={{ color: 'var(--muted)', fontSize: 13 }}>
              {t.schritt_1_pfad_c_text}
            </p>
            <Link
              className="button secondary"
              href="/bedarfe/neu?schritt=sachleistung"
            >
              {t.schritt_1_pfad_c_button}
            </Link>
          </div>
        </article>
      </div>
    </div>
  );
}

function SchrittSachleistung() {
  return (
    <div>
      <h2 style={{ fontSize: 24, margin: 0 }}>{tn.schritt_1_pfad_c_label}</h2>
      <form
        action={sachleistungAction}
        style={{ display: 'grid', gap: 12, marginTop: 16 }}
      >
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontWeight: 600 }}>
            {tn.schritt_1_pfad_c_textarea_label}
          </span>
          <textarea
            name="nachweis_text"
            required
            minLength={30}
            rows={5}
            style={{
              padding: '10px 12px',
              borderRadius: 10,
              border: 'var(--hairline)',
              background: 'var(--surface)',
              color: 'var(--fg)',
              fontFamily: 'inherit',
            }}
          />
        </label>
        <button type="submit" className="button primary">
          {tn.schritt_1_pfad_c_submit}
        </button>
      </form>
    </div>
  );
}

function SachleistungEingereicht() {
  return (
    <div>
      <h2 style={{ fontSize: 24, margin: 0 }}>Sachleistung erfasst</h2>
      <p style={{ color: 'var(--muted)' }}>
        Deine Sachleistung wurde erfasst. Eine Kurator:in prüft und verifiziert
        sie — du erhältst eine E-Mail. Nach Verifikation kannst du deinen
        Bedarf einbringen.
      </p>
      <Link className="button primary" href="/uebersicht/werkstattbeitrag">
        Zur Werkstattbeitrag-Übersicht
      </Link>
    </div>
  );
}

function Schritt2({ organisationDefault }: { organisationDefault: string }) {
  const minFrist = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
  const defaultFrist = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  return (
    <div>
      <h2 style={{ fontSize: 24, margin: 0 }}>{tn.schritt_2_titel}</h2>
      <form
        action={bedarfAnlegenAction}
        style={{ display: 'grid', gap: 16, marginTop: 16 }}
      >
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontWeight: 600 }}>{tn.schritt_2_label_organisation}</span>
          <input
            type="text"
            name="organisation"
            required
            maxLength={200}
            defaultValue={organisationDefault}
            style={inputStyle}
          />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontWeight: 600 }}>{tn.schritt_2_label_titel}</span>
          <input
            type="text"
            name="titel"
            required
            maxLength={200}
            style={inputStyle}
          />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontWeight: 600 }}>{tn.schritt_2_label_problem}</span>
          <textarea
            name="problem"
            required
            rows={6}
            maxLength={5000}
            style={textareaStyle}
          />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontWeight: 600 }}>{tn.schritt_2_label_nutzen}</span>
          <textarea
            name="nutzen"
            required
            rows={3}
            maxLength={2000}
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
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontWeight: 600 }}>
              {tn.schritt_2_label_groesse_zeit}
            </span>
            <input
              type="number"
              name="groessenordnung_zeit_wochen"
              min={1}
              max={52}
              style={inputStyle}
            />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontWeight: 600 }}>
              {tn.schritt_2_label_groesse_aufwand}
            </span>
            <input
              type="number"
              name="groessenordnung_aufwand_tage"
              min={1}
              max={200}
              style={inputStyle}
            />
          </label>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 12,
          }}
        >
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontWeight: 600 }}>
              {tn.schritt_2_label_geldrahmen_min}
            </span>
            <input
              type="number"
              name="geldrahmen_min_euro"
              min={0}
              style={inputStyle}
            />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontWeight: 600 }}>
              {tn.schritt_2_label_geldrahmen_max}
            </span>
            <input
              type="number"
              name="geldrahmen_max_euro"
              min={0}
              style={inputStyle}
            />
          </label>
        </div>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontWeight: 600 }}>{tn.schritt_2_label_frist}</span>
          <input
            type="date"
            name="frist"
            required
            min={formatDatumInput(minFrist)}
            defaultValue={formatDatumInput(defaultFrist)}
            style={inputStyle}
          />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontWeight: 600 }}>{tn.schritt_2_label_branche}</span>
          <input type="text" name="branche" maxLength={100} style={inputStyle} />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontWeight: 600 }}>{tn.schritt_2_label_werkstand}</span>
          <input
            type="text"
            name="bevorzugter_werkstand"
            maxLength={100}
            style={inputStyle}
          />
        </label>
        <button type="submit" className="button primary">
          {tn.schritt_2_button}
        </button>
      </form>
    </div>
  );
}

function Schritt3() {
  return (
    <div>
      <h2 style={{ fontSize: 24, margin: 0 }}>{tn.schritt_3_titel}</h2>
      <p style={{ color: 'var(--fg)' }}>{tn.schritt_3_text}</p>
      <Link className="button primary" href="/uebersicht/bedarfe">
        Zur Übersicht meiner Bedarfe
      </Link>
    </div>
  );
}

function Hinweis({
  kind,
  children,
}: {
  kind: 'ok' | 'fehler';
  children: React.ReactNode;
}) {
  const styles =
    kind === 'ok'
      ? {
          border: '1px solid #2a7a2a',
          background: '#eaf6ea',
          color: '#15431a',
        }
      : {
          border: '1px solid #d04848',
          background: '#fbeaea',
          color: '#5a1a1a',
        };
  return (
    <div
      role={kind === 'ok' ? 'status' : 'alert'}
      className="callout"
      style={{
        marginBottom: 16,
        padding: '12px 14px',
        borderRadius: 10,
        ...styles,
      }}
    >
      {children}
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
