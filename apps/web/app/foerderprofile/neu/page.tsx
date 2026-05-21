/**
 * /foerderprofile/neu — Foerderprofil anlegen (Server Component + Server Action).
 *
 * Quelle: PRD §F-701, §19 (Verifikations-Workflow).
 *
 * - Auth + Foerder:innen-Rolle.
 * - Form mit allen Pflichtfeldern.
 * - Submit: INSERT mit verifikation_status='entwurf', dann sofort einreichen
 *   (auf 'in_verifikation'). T-501 wird vom API-Endpunkt ausgeloest, hier
 *   schicken wir die Mail selbst.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';

import { de } from '@/i18n/de';
import { db } from '@/lib/db';
import { auditLog, foerderprofil } from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';
import { hasRolle } from '@/lib/auth/permissions';
import { foerderprofilAnlegenSchema } from '@/lib/validators/foerderprofil';
import { sendMail } from '@/lib/email/send';
import { env } from '@/lib/env';
import {
  foerderart as foerderartEnum,
  gegenleistungTyp as gegenleistungTypEnum,
} from '@/lib/db/schema/enums';

const tn = de.bedarfsseite.foerderprofil_neu;
const tnav = de.uebersicht;
const APP_URL = env.APP_URL.replace(/\/+$/, '');

export const metadata: Metadata = {
  title: 'Sponsor-Profil anlegen — Werkzirkel',
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
  return new Request('http://internal.werkzirkel/foerderprofile/neu', {
    headers: headerInit,
  });
}

function foerderartLabel(f: string): string {
  return (
    (de.bedarfsseite.foerderart_label as Record<string, string>)[f] ?? f
  );
}
function gegenleistungLabel(g: string): string {
  return (
    (de.bedarfsseite.gegenleistung_typ_label as Record<string, string>)[g] ?? g
  );
}

export async function foerderprofilAnlegenAction(
  formData: FormData,
): Promise<void> {
  'use server';

  const req = await buildRequestFromHeaders();
  const sess = await getSessionFromRequest(req);
  if (!sess) {
    redirect('/anmelden?next=/foerderprofile/neu');
  }
  if (!hasRolle(sess.nutzer, 'foerderer')) {
    redirect('/foerderprofile/neu?fehler=keine_rolle');
  }

  const minS = String(formData.get('foerderrahmen_jahr_min_euro') ?? '').trim();
  const maxS = String(formData.get('foerderrahmen_jahr_max_euro') ?? '').trim();
  const einzS = String(formData.get('foerderrahmen_einzel_max_euro') ?? '').trim();
  const bevWerke = String(formData.get('bevorzugte_werke') ?? '').trim();
  const gtText = String(formData.get('gegenleistung_text') ?? '').trim();

  const candidate: Record<string, unknown> = {
    organisation: String(formData.get('organisation') ?? '').trim(),
    foerderart: String(formData.get('foerderart') ?? '').trim(),
    gegenleistung_typ: String(formData.get('gegenleistung_typ') ?? '').trim(),
  };
  if (minS) candidate.foerderrahmen_jahr_min_euro_cent = Number(minS) * 100;
  if (maxS) candidate.foerderrahmen_jahr_max_euro_cent = Number(maxS) * 100;
  if (einzS) candidate.foerderrahmen_einzel_max_euro_cent = Number(einzS) * 100;
  if (bevWerke) candidate.bevorzugte_werke = bevWerke;
  if (gtText) candidate.gegenleistung_text = gtText;

  const parsed = foerderprofilAnlegenSchema.safeParse(candidate);
  if (!parsed.success) {
    const fields = parsed.error.flatten().fieldErrors;
    const feld = Object.keys(fields)[0] ?? 'unbekannt';
    redirect(
      `/foerderprofile/neu?fehler=validierung&feld=${encodeURIComponent(feld)}`,
    );
  }
  const input = parsed.data;

  // UNIQUE(nutzer_id) — pruefen.
  const existing = await db
    .select({ id: foerderprofil.id })
    .from(foerderprofil)
    .where(eq(foerderprofil.nutzerId, sess.nutzerId))
    .limit(1);
  if (existing[0]) {
    redirect('/foerderprofile/neu?fehler=bereits_vorhanden');
  }

  const inserted = await db
    .insert(foerderprofil)
    .values({
      nutzerId: sess.nutzerId,
      organisation: input.organisation,
      foerderart: input.foerderart,
      foerderrahmenJahrMinEuroCent: input.foerderrahmen_jahr_min_euro_cent ?? null,
      foerderrahmenJahrMaxEuroCent: input.foerderrahmen_jahr_max_euro_cent ?? null,
      foerderrahmenEinzelMaxEuroCent: input.foerderrahmen_einzel_max_euro_cent ?? null,
      bevorzugteWerke: input.bevorzugte_werke ?? null,
      gegenleistungTyp: input.gegenleistung_typ,
      gegenleistungText: input.gegenleistung_text ?? null,
      verifikationStatus: 'in_verifikation',
    })
    .returning({ id: foerderprofil.id });
  const row = inserted[0];
  if (!row) {
    redirect('/foerderprofile/neu?fehler=unbekannt');
  }

  // T-501 Bestaetigung
  try {
    await sendMail({
      to: sess.nutzer.email,
      nutzerId: sess.nutzerId,
      template: 'T-501',
      props: {
        organisation: input.organisation,
        profilUrl: `${APP_URL}/uebersicht/foerderprofil`,
      },
    });
  } catch (err) {
    console.error('[foerderprofile-neu] sendMail T-501 failed:', err);
  }

  try {
    await db.insert(auditLog).values({
      nutzerId: sess.nutzerId,
      aktion: 'foerderprofil.eingereicht',
      referenzTyp: 'foerderprofil',
      referenzId: row.id,
    });
  } catch {
    /* ignore */
  }

  redirect('/uebersicht/foerderprofil?erfolg=eingereicht');
}

export default async function FoerderprofilNeuPage({
  searchParams,
}: PageProps) {
  const sp = await searchParams;

  const req = await buildRequestFromHeaders();
  const sess = await getSessionFromRequest(req);
  if (!sess) {
    redirect('/anmelden?next=/foerderprofile/neu');
  }

  const istFoerd = hasRolle(sess.nutzer, 'foerderer');

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
            <Link href="/foerderprofile">
              {de.bedarfsseite.nav_foerderprofile}
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
          {sp.fehler === 'keine_rolle' ? (
            <Fehler>
              <strong>{tn.fehler_keine_rolle}</strong>
              <p style={{ margin: '8px 0 0' }}>
                <Link href="/einstellungen?tab=profil">
                  Rolle in den Einstellungen hinzufügen
                </Link>
              </p>
            </Fehler>
          ) : sp.fehler === 'bereits_vorhanden' ? (
            <Fehler>{tn.fehler_bereits_vorhanden}</Fehler>
          ) : sp.fehler === 'validierung' ? (
            <Fehler>
              {tn.fehler_validierung}
              {sp.feld ? ` (Feld: ${sp.feld})` : null}
            </Fehler>
          ) : sp.fehler ? (
            <Fehler>{de.fehler.unbekannt}</Fehler>
          ) : null}

          {!istFoerd ? null : (
            <form
              action={foerderprofilAnlegenAction}
              style={{ display: 'grid', gap: 16 }}
            >
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>{tn.label_organisation}</span>
                <input
                  type="text"
                  name="organisation"
                  required
                  maxLength={200}
                  style={inputStyle}
                />
              </label>

              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>{tn.label_foerderart}</span>
                <select name="foerderart" required style={inputStyle}>
                  {foerderartEnum.map((f) => (
                    <option key={f} value={f}>
                      {foerderartLabel(f)}
                    </option>
                  ))}
                </select>
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
                    {tn.label_foerderrahmen_jahr_min}
                  </span>
                  <input
                    type="number"
                    name="foerderrahmen_jahr_min_euro"
                    min={0}
                    style={inputStyle}
                  />
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontWeight: 600 }}>
                    {tn.label_foerderrahmen_jahr_max}
                  </span>
                  <input
                    type="number"
                    name="foerderrahmen_jahr_max_euro"
                    min={0}
                    style={inputStyle}
                  />
                </label>
              </div>

              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>
                  {tn.label_foerderrahmen_einzel}
                </span>
                <input
                  type="number"
                  name="foerderrahmen_einzel_max_euro"
                  min={0}
                  style={inputStyle}
                />
              </label>

              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>
                  {tn.label_bevorzugte_werke}
                </span>
                <textarea
                  name="bevorzugte_werke"
                  rows={3}
                  maxLength={2000}
                  style={textareaStyle}
                />
              </label>

              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>{tn.label_gegenleistung_typ}</span>
                <select name="gegenleistung_typ" required style={inputStyle}>
                  {gegenleistungTypEnum.map((g) => (
                    <option key={g} value={g}>
                      {gegenleistungLabel(g)}
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                  {tn.equity_hinweis}
                </span>
              </label>

              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>
                  {tn.label_gegenleistung_text}
                </span>
                <textarea
                  name="gegenleistung_text"
                  rows={3}
                  maxLength={2000}
                  style={textareaStyle}
                />
              </label>

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <button type="submit" className="button primary">
                  {tn.button_anlegen}
                </button>
                <Link href="/foerderprofile" className="button secondary">
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

function Fehler({ children }: { children: React.ReactNode }) {
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
