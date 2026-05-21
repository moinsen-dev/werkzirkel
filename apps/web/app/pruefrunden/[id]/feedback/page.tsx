/**
 * /pruefrunden/[id]/feedback — Feedback-Form (Server Component + Server Action).
 *
 * Quelle: PRD §F-204, §13.9.
 *
 * - Auth Pflicht.
 * - Tester:in muss als 'angemeldet' fuer die Pruefrunde gelistet sein, sonst 404.
 * - Wenn bereits feedback_gegeben → 404 (Feedback ist endgueltig).
 * - Form mit Pflicht-Gesamteindruck + den in `pruefrunde.feedback_kategorien`
 *   gewaehlten Kategorien als Textareas.
 * - Server Action: INSERT feedback in Transaktion + Reziprozitaets-Engine ruft
 *   feedbackGegeben/feedbackErhalten. Bei Erfolg redirect zu
 *   /uebersicht/pruefrunden?erfolg=feedback-abgegeben.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { and, eq, sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';

import { de } from '@/i18n/de';
import { db } from '@/lib/db';
import {
  auditLog,
  nutzer,
  pruefrunde,
  pruefrundenAnmeldung,
  werk,
} from '@/lib/db/schema';
import { type FeedbackKategorie } from '@/lib/db/schema/enums';
import { getSessionFromRequest } from '@/lib/auth/session';
import { feedbackAbgebenSchema } from '@/lib/validators/feedback';
import {
  feedbackErhalten,
  feedbackGegeben,
} from '@/lib/reziprozitaet/engine';
import { sendMail } from '@/lib/email/send';
import { env } from '@/lib/env';

const tf = de.pruefrunden.feedback_form;
const tnav = de.uebersicht;

const APP_URL = env.APP_URL.replace(/\/+$/, '');

export const metadata: Metadata = {
  title: 'Feedback abgeben',
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ id: string }>;
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

async function ladePruefrundeMitWerk(id: string) {
  const rows = await db
    .select({
      pruefrundeId: pruefrunde.id,
      pruefrundeStatus: pruefrunde.status,
      pruefrundeTitel: pruefrunde.titel,
      feedbackKategorien: pruefrunde.feedbackKategorien,
      werkId: werk.id,
      werkName: werk.name,
      werkNutzerId: werk.nutzerId,
    })
    .from(pruefrunde)
    .innerJoin(werk, eq(werk.id, pruefrunde.werkId))
    .where(eq(pruefrunde.id, id))
    .limit(1);
  return rows[0] ?? null;
}

function kategorieLabel(k: string): string {
  return (
    (de.pruefrunden.feedback_kategorie as Record<string, string>)[k] ?? k
  );
}

/* ───────────────────── Server Action ───────────────────── */

export async function feedbackAbgebenAction(
  pruefrundeId: string,
  formData: FormData,
): Promise<void> {
  'use server';

  const req = await buildRequestFromHeaders(
    `/pruefrunden/${pruefrundeId}/feedback`,
  );
  const sess = await getSessionFromRequest(req);
  if (!sess) {
    redirect(`/anmelden?next=/pruefrunden/${pruefrundeId}/feedback`);
  }

  const pr = await ladePruefrundeMitWerk(pruefrundeId);
  if (!pr) notFound();
  if (pr.pruefrundeStatus !== 'oeffentlich') {
    redirect(
      `/pruefrunden/${pruefrundeId}/feedback?fehler=falscher_status`,
    );
  }
  if (pr.werkNutzerId === sess.nutzerId) {
    redirect(`/pruefrunden/${pruefrundeId}/feedback?fehler=eigenes_werk`);
  }

  // Anmeldung-Pflicht-Check
  const anmeldungRows = await db
    .select()
    .from(pruefrundenAnmeldung)
    .where(
      and(
        eq(pruefrundenAnmeldung.pruefrundeId, pruefrundeId),
        eq(pruefrundenAnmeldung.testerId, sess.nutzerId),
      ),
    )
    .limit(1);
  const anmeldung = anmeldungRows[0];
  if (!anmeldung || anmeldung.status !== 'angemeldet') {
    notFound();
  }

  const candidate = {
    erster_eindruck: String(formData.get('erster_eindruck') ?? '').trim() || undefined,
    verstaendlichkeit: String(formData.get('verstaendlichkeit') ?? '').trim() || undefined,
    nutzen: String(formData.get('nutzen') ?? '').trim() || undefined,
    bedienbarkeit: String(formData.get('bedienbarkeit') ?? '').trim() || undefined,
    fehler: String(formData.get('fehler') ?? '').trim() || undefined,
    positionierung: String(formData.get('positionierung') ?? '').trim() || undefined,
    zahlungsbereitschaft:
      String(formData.get('zahlungsbereitschaft') ?? '').trim() || undefined,
    verbesserungen: String(formData.get('verbesserungen') ?? '').trim() || undefined,
    gesamteindruck: String(formData.get('gesamteindruck') ?? '').trim(),
  };

  const parsed = feedbackAbgebenSchema.safeParse(candidate);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const firstFeld = Object.keys(fieldErrors)[0] ?? 'unbekannt';
    redirect(
      `/pruefrunden/${pruefrundeId}/feedback?fehler=validierung&feld=${encodeURIComponent(firstFeld)}`,
    );
  }
  const input = parsed.data;

  // Transaktion: INSERT feedback + UPDATE anmeldung + Reziprozitaet.
  type TxOutcome =
    | { kind: 'ok'; feedbackId: string; anzahl: number }
    | { kind: 'duplicate' };

  let outcome: TxOutcome;
  try {
    outcome = await db.transaction(async (tx): Promise<TxOutcome> => {
      const feedbackId = createId();
      const inserted = await tx.execute<{ id: string }>(sql`
        INSERT INTO feedback (
          id, pruefrunde_id, tester_id,
          erster_eindruck, verstaendlichkeit, nutzen, bedienbarkeit,
          fehler, positionierung, zahlungsbereitschaft, verbesserungen,
          gesamteindruck
        )
        VALUES (
          ${feedbackId}, ${pruefrundeId}, ${sess.nutzerId},
          ${input.erster_eindruck ?? null}, ${input.verstaendlichkeit ?? null},
          ${input.nutzen ?? null}, ${input.bedienbarkeit ?? null},
          ${input.fehler ?? null}, ${input.positionierung ?? null},
          ${input.zahlungsbereitschaft ?? null}, ${input.verbesserungen ?? null},
          ${input.gesamteindruck}
        )
        ON CONFLICT (pruefrunde_id, tester_id) DO NOTHING
        RETURNING id
      `);
      const newRow = inserted[0];
      if (!newRow) return { kind: 'duplicate' };

      await tx
        .update(pruefrundenAnmeldung)
        .set({ status: 'feedback_gegeben' })
        .where(
          and(
            eq(pruefrundenAnmeldung.pruefrundeId, pruefrundeId),
            eq(pruefrundenAnmeldung.testerId, sess.nutzerId),
          ),
        );

      await feedbackGegeben(sess.nutzerId, newRow.id, tx);
      await feedbackErhalten(pr.werkNutzerId, 1, tx);

      const cnt = await tx.execute<{ anzahl: number }>(sql`
        SELECT COUNT(*)::int AS anzahl FROM feedback WHERE pruefrunde_id = ${pruefrundeId}
      `);
      return {
        kind: 'ok',
        feedbackId: newRow.id,
        anzahl: cnt[0]?.anzahl ?? 1,
      };
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('feedback_uniq')) {
      redirect(`/pruefrunden/${pruefrundeId}/feedback?fehler=bereits_gegeben`);
    }
    throw err;
  }

  if (outcome.kind === 'duplicate') {
    redirect(`/pruefrunden/${pruefrundeId}/feedback?fehler=bereits_gegeben`);
  }

  // T-102 versenden
  try {
    const inhaberRows = await db
      .select({ email: nutzer.email })
      .from(nutzer)
      .where(eq(nutzer.id, pr.werkNutzerId))
      .limit(1);
    const inhaberEmail = inhaberRows[0]?.email;
    if (inhaberEmail) {
      await sendMail({
        to: inhaberEmail,
        nutzerId: pr.werkNutzerId,
        template: 'T-102',
        props: {
          werkName: pr.werkName,
          pruefrundeTitel: pr.pruefrundeTitel,
          pruefrundeUrl: `${APP_URL}/pruefrunden/${pruefrundeId}`,
          anzahlFeedbacks: outcome.anzahl,
        },
      });
    }
  } catch (err) {
    console.error('[feedback-action] sendMail T-102:', err);
  }

  try {
    await db.insert(auditLog).values({
      nutzerId: sess.nutzerId,
      aktion: 'pruefrunde.feedback_gegeben',
      referenzTyp: 'feedback',
      referenzId: outcome.feedbackId,
      metadaten: { pruefrunde_id: pruefrundeId },
    });
  } catch {
    /* ignore */
  }

  redirect('/uebersicht/pruefrunden?erfolg=feedback-abgegeben');
}

/* ───────────────────── Page ───────────────────── */

export default async function PruefrundeFeedbackPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const sp = await searchParams;

  const req = await buildRequestFromHeaders(`/pruefrunden/${id}/feedback`);
  const sess = await getSessionFromRequest(req);
  if (!sess) {
    redirect(`/anmelden?next=/pruefrunden/${id}/feedback`);
  }

  const pr = await ladePruefrundeMitWerk(id);
  if (!pr) notFound();
  if (pr.pruefrundeStatus === 'entwurf') notFound();

  // Eigene Anmeldung Pflicht
  const anmeldungRows = await db
    .select()
    .from(pruefrundenAnmeldung)
    .where(
      and(
        eq(pruefrundenAnmeldung.pruefrundeId, id),
        eq(pruefrundenAnmeldung.testerId, sess.nutzerId),
      ),
    )
    .limit(1);
  const anmeldung = anmeldungRows[0];
  if (!anmeldung || anmeldung.status !== 'angemeldet') {
    notFound();
  }

  const action = feedbackAbgebenAction.bind(null, id);
  const kategorien = pr.feedbackKategorien as FeedbackKategorie[];

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
            <Link href="/uebersicht/pruefrunden" aria-current="page">
              {tnav.nav_pruefrunden}
            </Link>
          </div>
        </div>
      </nav>

      <header className="hero" id="top">
        <div className="wrap hero-grid single">
          <div>
            <p className="eyebrow">{tf.eyebrow}</p>
            <h1>{tf.titel(pr.werkName)}</h1>
            <p className="hero-copy">{tf.untertitel}</p>
          </div>
        </div>
      </header>

      <section className="section compact">
        <div className="wrap" style={{ maxWidth: 760 }}>
          {sp.fehler === 'validierung' ? (
            <FehlerBanner
              text={
                sp.feld
                  ? `${tf.fehler_validierung} (Feld: ${sp.feld})`
                  : tf.fehler_validierung
              }
            />
          ) : null}
          {sp.fehler === 'bereits_gegeben' ? (
            <FehlerBanner text={tf.fehler_bereits_gegeben} />
          ) : null}
          {sp.fehler === 'falscher_status' ? (
            <FehlerBanner text="Diese Feedback-Loop nimmt kein Feedback mehr an." />
          ) : null}
          {sp.fehler === 'eigenes_werk' ? (
            <FehlerBanner text="Du kannst zu deiner eigenen Feedback-Loop kein Feedback abgeben." />
          ) : null}

          <form action={action} style={{ display: 'grid', gap: 16 }}>
            <label
              style={{ display: 'grid', gap: 6 }}
              htmlFor="gesamteindruck"
            >
              <span style={{ fontWeight: 600 }}>
                {tf.gesamteindruck_label}
              </span>
              <textarea
                id="gesamteindruck"
                name="gesamteindruck"
                required
                maxLength={2000}
                rows={4}
                style={textareaStyle}
              />
            </label>

            {kategorien.map((k) => (
              <label
                key={k}
                style={{ display: 'grid', gap: 6 }}
                htmlFor={`kat_${k}`}
              >
                <span style={{ fontWeight: 600 }}>
                  {tf.kategorie_label(kategorieLabel(k))}
                </span>
                <textarea
                  id={`kat_${k}`}
                  name={k}
                  maxLength={2000}
                  rows={3}
                  style={textareaStyle}
                />
              </label>
            ))}

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button type="submit" className="button primary">
                {tf.button_abgeben}
              </button>
              <Link
                href={`/pruefrunden/${id}`}
                className="button secondary"
              >
                {tf.button_abbrechen}
              </Link>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}

function FehlerBanner({ text }: { text: string }) {
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

const textareaStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 10,
  border: 'var(--hairline)',
  background: 'var(--surface)',
  color: 'var(--fg)',
  fontSize: 15,
  fontFamily: 'inherit',
  resize: 'vertical',
  minHeight: 60,
};
