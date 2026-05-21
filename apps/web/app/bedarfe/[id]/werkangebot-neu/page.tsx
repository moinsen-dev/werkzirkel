/**
 * /bedarfe/[id]/werkangebot-neu — Match-Angebot-Form (Builder:in).
 *
 * Quelle: PRD §F-621, §11A Schutz S2 (Werkangebote nicht oeffentlich).
 *
 * - Auth + Builder:innen-Rolle.
 * - Form: Werk-Dropdown (eigene Builds), konkretes_vorgehen, ausschluss,
 *   erster_liefer_meilenstein.
 * - Server-Action POST → INSERT werkangebot (mit ON CONFLICT) → redirect zu
 *   /uebersicht/werkangebote.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { createId } from '@paralleldrive/cuid2';
import { eq, sql } from 'drizzle-orm';

import { de } from '@/i18n/de';
import { db } from '@/lib/db';
import {
  auditLog,
  bedarf,
  nutzer,
  werk,
} from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';
import { hasRolle } from '@/lib/auth/permissions';
import { werkangebotAnlegenSchema } from '@/lib/validators/werkangebot';
import { sendMail } from '@/lib/email/send';
import { env } from '@/lib/env';

const tn = de.bedarfsseite.werkangebot_neu;
const tnav = de.uebersicht;

const APP_URL = env.APP_URL.replace(/\/+$/, '');

export const metadata: Metadata = {
  title: 'Match-Angebot abgeben — Werkzirkel',
  robots: { index: false, follow: false },
};

interface PageParams {
  params: Promise<{ id: string }>;
}

interface PageProps extends PageParams {
  searchParams: Promise<{ fehler?: string; feld?: string }>;
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

export async function werkangebotAbgebenAction(
  bedarfId: string,
  formData: FormData,
): Promise<void> {
  'use server';

  const req = await buildRequestFromHeaders(
    `/bedarfe/${bedarfId}/werkangebot-neu`,
  );
  const sess = await getSessionFromRequest(req);
  if (!sess) {
    redirect(`/anmelden?next=/bedarfe/${bedarfId}/werkangebot-neu`);
  }
  if (!hasRolle(sess.nutzer, 'macher')) {
    redirect(`/bedarfe/${bedarfId}/werkangebot-neu?fehler=keine_rolle`);
  }

  const candidate = {
    werk_id: String(formData.get('werk_id') ?? '').trim(),
    konkretes_vorgehen: String(formData.get('konkretes_vorgehen') ?? '').trim(),
    ausdruecklicher_ausschluss: String(
      formData.get('ausdruecklicher_ausschluss') ?? '',
    ).trim(),
    erster_liefer_meilenstein: String(
      formData.get('erster_liefer_meilenstein') ?? '',
    ).trim(),
  };

  const parsed = werkangebotAnlegenSchema.safeParse(candidate);
  if (!parsed.success) {
    const fields = parsed.error.flatten().fieldErrors;
    const feld = Object.keys(fields)[0] ?? 'unbekannt';
    redirect(
      `/bedarfe/${bedarfId}/werkangebot-neu?fehler=validierung&feld=${encodeURIComponent(feld)}`,
    );
  }
  const input = parsed.data;

  // Bedarf-Status pruefen.
  const bedarfRows = await db
    .select()
    .from(bedarf)
    .where(eq(bedarf.id, bedarfId))
    .limit(1);
  const bedarfRow = bedarfRows[0];
  if (!bedarfRow) notFound();
  if (
    bedarfRow.status !== 'oeffentlich' &&
    bedarfRow.status !== 'in_gespraechen'
  ) {
    redirect(
      `/bedarfe/${bedarfId}/werkangebot-neu?fehler=bedarf_nicht_offen`,
    );
  }

  // Builderschaft pruefen.
  const werkRows = await db
    .select()
    .from(werk)
    .where(eq(werk.id, input.werk_id))
    .limit(1);
  const werkRow = werkRows[0];
  if (!werkRow || werkRow.nutzerId !== sess.nutzerId) {
    redirect(
      `/bedarfe/${bedarfId}/werkangebot-neu?fehler=validierung&feld=werk_id`,
    );
  }

  // INSERT mit ON CONFLICT DO NOTHING.
  const newId = createId();
  const inserted = await db.execute<{ id: string }>(sql`
    INSERT INTO werkangebot (
      id,
      bedarf_id,
      werk_id,
      macher_id,
      konkretes_vorgehen,
      ausdruecklicher_ausschluss,
      erster_liefer_meilenstein,
      status
    )
    VALUES (
      ${newId},
      ${bedarfId},
      ${input.werk_id},
      ${sess.nutzerId},
      ${input.konkretes_vorgehen},
      ${input.ausdruecklicher_ausschluss},
      ${input.erster_liefer_meilenstein},
      'eingereicht'
    )
    ON CONFLICT (bedarf_id, werk_id) DO NOTHING
    RETURNING id
  `);
  if (!inserted[0]) {
    redirect(
      `/bedarfe/${bedarfId}/werkangebot-neu?fehler=bereits_eingereicht`,
    );
  }

  // T-201 an Bedarfstraeger:in.
  const inhaberRows = await db
    .select({ email: nutzer.email })
    .from(nutzer)
    .where(eq(nutzer.id, bedarfRow.nutzerId))
    .limit(1);
  const inhaberEmail = inhaberRows[0]?.email;
  if (inhaberEmail) {
    try {
      await sendMail({
        to: inhaberEmail,
        nutzerId: bedarfRow.nutzerId,
        template: 'T-201',
        props: {
          bedarfTitel: bedarfRow.titel,
          werkName: werkRow.name,
          macherAnzeigename: sess.nutzer.anzeigename,
          werkangebotUrl: `${APP_URL}/uebersicht/bedarfe`,
        },
      });
    } catch (err) {
      console.error('[werkangebot-neu-page] sendMail T-201 failed:', err);
    }
  }

  try {
    await db.insert(auditLog).values({
      nutzerId: sess.nutzerId,
      aktion: 'werkangebot.eingereicht',
      referenzTyp: 'werkangebot',
      referenzId: inserted[0].id,
      metadaten: { bedarf_id: bedarfId, werk_id: input.werk_id },
    });
  } catch {
    /* ignore */
  }

  redirect('/uebersicht/werkangebote?erfolg=eingereicht');
}

export default async function WerkangebotWerkangebotNeuPage({
  params,
  searchParams,
}: PageProps) {
  const { id: bedarfId } = await params;
  const sp = await searchParams;

  const req = await buildRequestFromHeaders(
    `/bedarfe/${bedarfId}/werkangebot-neu`,
  );
  const sess = await getSessionFromRequest(req);
  if (!sess) {
    redirect(`/anmelden?next=/bedarfe/${bedarfId}/werkangebot-neu`);
  }

  const istMacher = hasRolle(sess.nutzer, 'macher');

  const meineWerke = istMacher
    ? await db
        .select({ id: werk.id, name: werk.name })
        .from(werk)
        .where(eq(werk.nutzerId, sess.nutzerId))
    : [];

  const bedarfRows = await db
    .select({ titel: bedarf.titel, status: bedarf.status })
    .from(bedarf)
    .where(eq(bedarf.id, bedarfId))
    .limit(1);
  const bedarfRow = bedarfRows[0];
  if (!bedarfRow) notFound();

  const aktion = werkangebotAbgebenAction.bind(null, bedarfId);

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
            <p style={{ marginTop: 8, color: 'var(--muted)' }}>
              Zum Bedarf: <strong>{bedarfRow.titel}</strong>
            </p>
          </div>
        </div>
      </header>

      <section className="section compact">
        <div className="wrap" style={{ maxWidth: 760 }}>
          {sp.fehler ? <FehlerBanner code={sp.fehler} feld={sp.feld} /> : null}

          {!istMacher ? (
            <Hinweis>{tn.fehler_keine_rolle}</Hinweis>
          ) : meineWerke.length === 0 ? (
            <Hinweis>
              <strong>{tn.fehler_kein_werk}</strong>
              <p style={{ margin: '8px 0 0' }}>
                <Link href="/werke/neu">Neuen Build anlegen</Link>
              </p>
            </Hinweis>
          ) : (
            <form
              action={aktion}
              style={{ display: 'grid', gap: 16 }}
            >
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>{tn.label_werk}</span>
                <select
                  name="werk_id"
                  required
                  defaultValue={meineWerke[0]?.id}
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

              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>
                  {tn.label_konkretes_vorgehen}
                </span>
                <textarea
                  name="konkretes_vorgehen"
                  required
                  minLength={50}
                  maxLength={3000}
                  rows={6}
                  style={textareaStyle}
                />
              </label>

              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>{tn.label_ausschluss}</span>
                <textarea
                  name="ausdruecklicher_ausschluss"
                  required
                  minLength={20}
                  maxLength={2000}
                  rows={4}
                  style={textareaStyle}
                />
              </label>

              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>{tn.label_meilenstein}</span>
                <textarea
                  name="erster_liefer_meilenstein"
                  required
                  minLength={20}
                  maxLength={1000}
                  rows={3}
                  style={textareaStyle}
                />
              </label>

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <button type="submit" className="button primary">
                  {tn.button_abgeben}
                </button>
                <Link
                  href={`/bedarfe/${bedarfId}`}
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

function FehlerBanner({ code, feld }: { code: string; feld?: string }) {
  let text: string;
  if (code === 'keine_rolle') text = tn.fehler_keine_rolle;
  else if (code === 'bereits_eingereicht') text = tn.fehler_bereits_eingereicht;
  else if (code === 'bedarf_nicht_offen') text = tn.fehler_bedarf_nicht_offen;
  else if (code === 'validierung')
    text = feld
      ? `${tn.fehler_validierung} (Feld: ${feld})`
      : tn.fehler_validierung;
  else text = de.fehler.unbekannt;
  return <Hinweis>{text}</Hinweis>;
}

function Hinweis({ children }: { children: React.ReactNode }) {
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
