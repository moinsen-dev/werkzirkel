/**
 * /pruefrunden/[id] — Oeffentliche Pruefrunden-Detailseite (Server Component).
 *
 * Quelle: PRD §F-201 ff., §8.4 (Pruefrunden-Felder), §15.4.
 *
 * Zugriffs-Logik:
 * - Pruefrunde nicht vorhanden → notFound().
 * - status='entwurf' und nicht Inhaber → notFound().
 * - Sonst public lesbar (Anonyme sehen alle Felder, koennen sich nicht
 *   anmelden).
 *
 * Action-Box rechts je nach Session-Status:
 * - Anonym: Anmelden-CTA mit `?next=/pruefrunden/[id]`.
 * - Eingeloggt, eigenes Werk (Inhaber): Verwaltungs-Sektion mit Tester:innen-
 *   Liste + Status-Wechsel-Buttons (Schliessen/Abschliessen).
 * - Eingeloggt, schon Feedback: Hinweis 'Du hast Feedback abgegeben.'
 * - Eingeloggt, schon als Tester angemeldet: Hinweis + Link zum Feedback-Form.
 * - Eingeloggt, Slots voll: Hinweis 'Plaetze voll'.
 * - Eingeloggt, Slots frei: 'Als Tester:in anmelden' Server-Action.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';

import { de } from '@/i18n/de';
import MeldenButton from '@/components/ui/melden-button';
import { db } from '@/lib/db';
import {
  auditLog,
  feedback,
  nutzer,
  pruefrunde,
  pruefrundenAnmeldung,
  werk,
} from '@/lib/db/schema';
import {
  type PruefrundeStatus,
  type PruefrundeAnmeldungStatus,
  type FeedbackKategorie,
} from '@/lib/db/schema/enums';
import { getSessionFromRequest } from '@/lib/auth/session';
import { renderPruefrundeMarkdown } from '@/lib/pruefrunde/markdown';
import { sendMail } from '@/lib/email/send';
import { env } from '@/lib/env';

const td = de.pruefrunden.detail;
const tn = de.uebersicht;

const APP_URL = env.APP_URL.replace(/\/+$/, '');

interface PageParams {
  params: Promise<{ id: string }>;
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

function formatFrist(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

function werkstandLabel(w: string): string {
  return (de.werkstand as Record<string, string>)[w] ?? w;
}

function statusLabel(s: PruefrundeStatus): string {
  return (de.pruefrunden.status as Record<string, string>)[s] ?? s;
}

function kategorieLabel(k: FeedbackKategorie): string {
  return (
    (de.pruefrunden.feedback_kategorie as Record<string, string>)[k] ?? k
  );
}

function anmeldungsStatusLabel(s: PruefrundeAnmeldungStatus): string {
  if (s === 'angemeldet') return td.verwalten_status_angemeldet;
  if (s === 'feedback_gegeben') return td.verwalten_status_feedback;
  return td.verwalten_status_zurueckgezogen;
}

async function ladePruefrunde(id: string) {
  const rows = await db
    .select({
      pruefrunde,
      werkId: werk.id,
      werkName: werk.name,
      werkstand: werk.werkstand,
      werkNutzerId: werk.nutzerId,
      inhaberId: nutzer.id,
      inhaberAnzeigename: nutzer.anzeigename,
      inhaberAvatarUrl: nutzer.avatarUrl,
      inhaberEmail: nutzer.email,
    })
    .from(pruefrunde)
    .innerJoin(werk, eq(werk.id, pruefrunde.werkId))
    .innerJoin(nutzer, eq(nutzer.id, werk.nutzerId))
    .where(eq(pruefrunde.id, id))
    .limit(1);
  return rows[0] ?? null;
}

async function zaehleAnmeldungen(pruefrundeId: string): Promise<number> {
  const rows = await db
    .select({ anzahl: sql<number>`count(*)::int` })
    .from(pruefrundenAnmeldung)
    .where(
      and(
        eq(pruefrundenAnmeldung.pruefrundeId, pruefrundeId),
        inArray(pruefrundenAnmeldung.status, [
          'angemeldet',
          'feedback_gegeben',
        ]),
      ),
    );
  return rows[0]?.anzahl ?? 0;
}

async function ladeEigeneAnmeldung(pruefrundeId: string, nutzerId: string) {
  const rows = await db
    .select()
    .from(pruefrundenAnmeldung)
    .where(
      and(
        eq(pruefrundenAnmeldung.pruefrundeId, pruefrundeId),
        eq(pruefrundenAnmeldung.testerId, nutzerId),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

async function ladeAnmeldungen(pruefrundeId: string) {
  return db
    .select({
      id: pruefrundenAnmeldung.id,
      status: pruefrundenAnmeldung.status,
      anzeigename: nutzer.anzeigename,
    })
    .from(pruefrundenAnmeldung)
    .innerJoin(nutzer, eq(nutzer.id, pruefrundenAnmeldung.testerId))
    .where(eq(pruefrundenAnmeldung.pruefrundeId, pruefrundeId))
    .orderBy(asc(pruefrundenAnmeldung.erstelltAm));
}

async function zaehleFeedbacks(pruefrundeId: string): Promise<number> {
  const rows = await db
    .select({ anzahl: sql<number>`count(*)::int` })
    .from(feedback)
    .where(eq(feedback.pruefrundeId, pruefrundeId));
  return rows[0]?.anzahl ?? 0;
}

async function zaehleHilfreich(pruefrundeId: string): Promise<number> {
  const rows = await db
    .select({ anzahl: sql<number>`count(*)::int` })
    .from(feedback)
    .where(
      and(
        eq(feedback.pruefrundeId, pruefrundeId),
        eq(feedback.hilfreichMarkiert, true),
      ),
    );
  return rows[0]?.anzahl ?? 0;
}

/* ───────────────────── Server Actions ───────────────────── */

export async function pruefrundeAnmeldenAction(
  pruefrundeId: string,
): Promise<void> {
  'use server';

  const req = await buildRequestFromHeaders(`/pruefrunden/${pruefrundeId}`);
  const sess = await getSessionFromRequest(req);
  if (!sess) {
    redirect(`/anmelden?next=/pruefrunden/${pruefrundeId}`);
  }
  if (!sess.nutzer.rollen.includes('macher')) {
    redirect(`/pruefrunden/${pruefrundeId}?fehler=keine_rolle`);
  }

  // Race-safer Slot-Check inline (analog zur API-Route).
  const outcome = await db.transaction(async (tx) => {
    const rows = await tx.execute<{
      pruefrunde_status: string;
      gesuchte_tester: number;
      pruefrunde_titel: string;
      werk_id: string;
      werk_name: string;
      werk_nutzer_id: string;
      inhaber_email: string;
    }>(sql`
      SELECT pr.status      AS pruefrunde_status,
             pr.gesuchte_tester,
             pr.titel       AS pruefrunde_titel,
             w.id           AS werk_id,
             w.name         AS werk_name,
             w.nutzer_id    AS werk_nutzer_id,
             n.email        AS inhaber_email
        FROM pruefrunde pr
        JOIN werk w   ON w.id   = pr.werk_id
        JOIN nutzer n ON n.id   = w.nutzer_id
       WHERE pr.id = ${pruefrundeId}
       FOR UPDATE OF pr
    `);
    const row = rows[0];
    if (!row) return { kind: 'not_found' as const };
    if (row.pruefrunde_status !== 'oeffentlich')
      return { kind: 'falscher_status' as const };
    if (row.werk_nutzer_id === sess.nutzerId)
      return { kind: 'eigenes_werk' as const };

    const cnt = await tx.execute<{ anzahl: number }>(sql`
      SELECT COUNT(*)::int AS anzahl
        FROM pruefrunden_anmeldung
       WHERE pruefrunde_id = ${pruefrundeId}
         AND status IN ('angemeldet', 'feedback_gegeben')
    `);
    const aktive = cnt[0]?.anzahl ?? 0;
    if (aktive >= row.gesuchte_tester)
      return { kind: 'voll' as const };

    const newId = createId();
    const inserted = await tx.execute<{ id: string }>(sql`
      INSERT INTO pruefrunden_anmeldung (id, pruefrunde_id, tester_id, status)
      VALUES (${newId}, ${pruefrundeId}, ${sess.nutzerId}, 'angemeldet')
      ON CONFLICT (pruefrunde_id, tester_id) DO NOTHING
      RETURNING id
    `);
    if (!inserted[0]) return { kind: 'bereits' as const };

    return {
      kind: 'ok' as const,
      anmeldungsId: inserted[0].id,
      angemeldet: aktive + 1,
      gesuchte: row.gesuchte_tester,
      werkInhaberId: row.werk_nutzer_id,
      werkInhaberEmail: row.inhaber_email,
      werkName: row.werk_name,
      pruefrundeTitel: row.pruefrunde_titel,
    };
  });

  if (outcome.kind === 'ok') {
    try {
      await sendMail({
        to: outcome.werkInhaberEmail,
        nutzerId: outcome.werkInhaberId,
        template: 'T-101',
        props: {
          werkName: outcome.werkName,
          pruefrundeTitel: outcome.pruefrundeTitel,
          testerAnzeigename: sess.nutzer.anzeigename,
          pruefrundeUrl: `${APP_URL}/pruefrunden/${pruefrundeId}`,
          anzahlAngemeldet: outcome.angemeldet,
          gesuchteTester: outcome.gesuchte,
        },
      });
    } catch (err) {
      console.error('[pruefrunde-anmelden-action] sendMail T-101:', err);
    }
    try {
      await db.insert(auditLog).values({
        nutzerId: sess.nutzerId,
        aktion: 'pruefrunde.angemeldet',
        referenzTyp: 'pruefrunde',
        referenzId: pruefrundeId,
        metadaten: { anmeldungs_id: outcome.anmeldungsId },
      });
    } catch {
      /* ignore */
    }
    revalidatePath(`/pruefrunden/${pruefrundeId}`);
    redirect(`/pruefrunden/${pruefrundeId}?erfolg=angemeldet`);
  }

  if (outcome.kind === 'not_found') notFound();
  const fehlerCode: Record<string, string> = {
    falscher_status: 'falscher_status',
    eigenes_werk: 'eigenes_werk',
    voll: 'voll',
    bereits: 'bereits_angemeldet',
  };
  redirect(
    `/pruefrunden/${pruefrundeId}?fehler=${fehlerCode[outcome.kind] ?? 'unbekannt'}`,
  );
}

export async function pruefrundeSchliessenAction(
  pruefrundeId: string,
): Promise<void> {
  'use server';

  const req = await buildRequestFromHeaders(`/pruefrunden/${pruefrundeId}`);
  const sess = await getSessionFromRequest(req);
  if (!sess) {
    redirect(`/anmelden?next=/pruefrunden/${pruefrundeId}`);
  }

  const pr = await ladePruefrunde(pruefrundeId);
  if (!pr) notFound();
  if (pr.werkNutzerId !== sess.nutzerId) notFound();
  if (pr.pruefrunde.status !== 'oeffentlich') {
    redirect(`/pruefrunden/${pruefrundeId}?fehler=falscher_status`);
  }

  await db
    .update(pruefrunde)
    .set({ status: 'geschlossen', aktualisiertAm: new Date() })
    .where(eq(pruefrunde.id, pruefrundeId));

  try {
    await db.insert(auditLog).values({
      nutzerId: sess.nutzerId,
      aktion: 'pruefrunde.geschlossen',
      referenzTyp: 'pruefrunde',
      referenzId: pruefrundeId,
    });
  } catch {
    /* ignore */
  }

  revalidatePath(`/pruefrunden/${pruefrundeId}`);
  redirect(`/pruefrunden/${pruefrundeId}?erfolg=geschlossen`);
}

export async function pruefrundeAbschliessenAction(
  pruefrundeId: string,
): Promise<void> {
  'use server';

  const req = await buildRequestFromHeaders(`/pruefrunden/${pruefrundeId}`);
  const sess = await getSessionFromRequest(req);
  if (!sess) {
    redirect(`/anmelden?next=/pruefrunden/${pruefrundeId}`);
  }

  const pr = await ladePruefrunde(pruefrundeId);
  if (!pr) notFound();
  if (pr.werkNutzerId !== sess.nutzerId) notFound();
  if (pr.pruefrunde.status !== 'geschlossen') {
    redirect(`/pruefrunden/${pruefrundeId}?fehler=falscher_status`);
  }

  const hilfreich = await zaehleHilfreich(pruefrundeId);
  if (hilfreich < 1) {
    redirect(`/pruefrunden/${pruefrundeId}?fehler=kein_hilfreiches_feedback`);
  }

  await db
    .update(pruefrunde)
    .set({ status: 'abgeschlossen', aktualisiertAm: new Date() })
    .where(eq(pruefrunde.id, pruefrundeId));

  try {
    await db.insert(auditLog).values({
      nutzerId: sess.nutzerId,
      aktion: 'pruefrunde.abgeschlossen',
      referenzTyp: 'pruefrunde',
      referenzId: pruefrundeId,
    });
  } catch {
    /* ignore */
  }

  revalidatePath(`/pruefrunden/${pruefrundeId}`);
  redirect(`/pruefrunden/${pruefrundeId}?erfolg=abgeschlossen`);
}

/* ───────────────────── Page ───────────────────── */

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { id } = await params;
  const row = await ladePruefrunde(id);
  if (!row || row.pruefrunde.status === 'entwurf') {
    return { title: 'Nicht gefunden', robots: { index: false, follow: false } };
  }
  return {
    title: `${row.pruefrunde.titel} — Feedback-Loop`,
    description: row.pruefrunde.testziel.slice(0, 200),
  };
}

interface DetailPageProps extends PageParams {
  searchParams: Promise<{ fehler?: string; erfolg?: string }>;
}

export default async function PruefrundeDetailPage({
  params,
  searchParams,
}: DetailPageProps) {
  const { id } = await params;
  const sp = await searchParams;

  const req = await buildRequestFromHeaders(`/pruefrunden/${id}`);
  const sess = await getSessionFromRequest(req).catch(() => null);

  const pr = await ladePruefrunde(id);
  if (!pr) notFound();

  const istInhaber = !!sess && sess.nutzerId === pr.werkNutzerId;
  if (pr.pruefrunde.status === 'entwurf' && !istInhaber) notFound();

  const [angemeldet, feedbacksCount, hilfreichCount] = await Promise.all([
    zaehleAnmeldungen(id),
    zaehleFeedbacks(id),
    zaehleHilfreich(id),
  ]);

  const eigeneAnmeldung =
    sess && !istInhaber ? await ladeEigeneAnmeldung(id, sess.nutzerId) : null;

  const anmeldungen = istInhaber ? await ladeAnmeldungen(id) : [];

  const slotsFrei = angemeldet < pr.pruefrunde.gesuchteTester;
  const istOeffentlich = pr.pruefrunde.status === 'oeffentlich';
  const fristStr = formatFrist(pr.pruefrunde.frist);

  // Server-Actions an die ID binden
  const anmeldenBound = pruefrundeAnmeldenAction.bind(null, id);
  const schliessenBound = pruefrundeSchliessenAction.bind(null, id);
  const abschliessenBound = pruefrundeAbschliessenAction.bind(null, id);

  const testaufgabeHtml = renderPruefrundeMarkdown(pr.pruefrunde.testaufgabe);
  const testzielHtml = renderPruefrundeMarkdown(pr.pruefrunde.testziel);

  return (
    <div className="page-shell">
      <nav className="site-nav" aria-label="Hauptnavigation">
        <div className="wrap nav-inner">
          <Link href="/" className="brand" aria-label="Werkzirkel Start">
            <span className="brand-mark" aria-hidden="true">
              <span></span>
              <span></span>
              <span></span>
              <span></span>
            </span>
            <span>Werkzirkel</span>
          </Link>
          <div className="nav-links" aria-label="Bereiche">
            <Link href="/">Builder:innen</Link>
            <Link href="/werke">Werke</Link>
            <Link href="/pruefrunden" aria-current="page">
              {tn.nav_pruefrunden}
            </Link>
            <Link href="/bedarf">Bedarf einbringen</Link>
          </div>
          {sess ? (
            <Link className="nav-cta" href="/uebersicht">
              Übersicht
            </Link>
          ) : (
            <Link className="nav-cta" href="/anmelden">
              Anmelden
            </Link>
          )}
        </div>
      </nav>

      <header className="hero" id="top">
        <div className="wrap hero-grid single">
          <div>
            <p className="eyebrow">{td.eyebrow}</p>
            <h1>{pr.pruefrunde.titel}</h1>
            <div
              style={{
                display: 'flex',
                gap: 8,
                marginTop: 16,
                flexWrap: 'wrap',
              }}
            >
              <span className="status-pill warm">
                {werkstandLabel(pr.werkstand ?? '')}
              </span>
              <span className="status-pill">
                {statusLabel(pr.pruefrunde.status)}
              </span>
            </div>
            <p className="hero-copy">
              {td.werk_label}:{' '}
              <Link href={`/werke/${pr.werkId}`}>{pr.werkName}</Link> ·{' '}
              {td.inhaber_label}:{' '}
              <Link href={`/werkpass/${pr.inhaberId}`}>
                {pr.inhaberAnzeigename}
              </Link>{' '}
              · {td.frist_label}: {fristStr} · {td.tester_label}:{' '}
              {angemeldet}/{pr.pruefrunde.gesuchteTester}
            </p>
          </div>
        </div>
      </header>

      <section className="section product-section">
        <div className="wrap product-split">
          <div>
            {sp.erfolg === 'angemeldet' ? (
              <ErfolgBanner text="Du bist als Tester:in angemeldet. Du erhältst weitere Infos im Verlauf der Feedback-Loop." />
            ) : sp.erfolg === 'geschlossen' ? (
              <ErfolgBanner text="Feedback-Loop geschlossen. Tester:innen können noch Feedback abgeben." />
            ) : sp.erfolg === 'abgeschlossen' ? (
              <ErfolgBanner text="Feedback-Loop abgeschlossen. Vielen Dank an alle Beteiligten." />
            ) : null}
            <FehlerBanner code={sp.fehler} />

            <p className="eyebrow">{td.sektion_was_getestet}</p>
            <h2 style={{ fontSize: 32, marginTop: 4 }}>{td.sektion_testziel}</h2>
            <div
              className="md-content"
              style={{ marginTop: 12, color: 'var(--fg)', lineHeight: 1.55 }}
              dangerouslySetInnerHTML={{ __html: testzielHtml }}
            />

            <h2 style={{ fontSize: 28, marginTop: 32 }}>
              {td.sektion_testaufgabe}
            </h2>
            <div
              className="md-content"
              style={{ marginTop: 12, color: 'var(--fg)', lineHeight: 1.55 }}
              dangerouslySetInnerHTML={{ __html: testaufgabeHtml }}
            />

            <h2 style={{ fontSize: 28, marginTop: 32 }}>
              {td.sektion_zielgruppe}
            </h2>
            <p
              style={{
                marginTop: 8,
                color: 'var(--fg)',
                whiteSpace: 'pre-line',
              }}
            >
              {pr.pruefrunde.zielgruppe}
            </p>

            <h2 style={{ fontSize: 28, marginTop: 32 }}>
              {td.sektion_was_wissen}
            </h2>
            <div
              style={{
                display: 'flex',
                gap: 8,
                flexWrap: 'wrap',
                marginTop: 12,
              }}
            >
              {pr.pruefrunde.feedbackKategorien.map((k) => (
                <span key={k} className="status-pill">
                  {kategorieLabel(k)}
                </span>
              ))}
            </div>

            <h2 style={{ fontSize: 28, marginTop: 32 }}>
              {td.sektion_zeitaufwand}
            </h2>
            <p style={{ marginTop: 8, color: 'var(--fg)' }}>
              {td.zeitbedarf(pr.pruefrunde.zeitbedarfMinuten)}
            </p>
          </div>

          <aside aria-label="Aktionen">
            <article className="work-card">
              <div className="work-body">
                {!sess ? (
                  <>
                    <p style={{ margin: 0, color: 'var(--muted)' }}>
                      {td.action_anonym}
                    </p>
                    <div style={{ marginTop: 14 }}>
                      <Link
                        className="button primary"
                        href={`/anmelden?next=/pruefrunden/${id}`}
                      >
                        {td.action_anonym}
                      </Link>
                    </div>
                  </>
                ) : istInhaber ? (
                  <InhaberPanel
                    pruefrundeId={id}
                    status={pr.pruefrunde.status}
                    anmeldungen={anmeldungen}
                    feedbacksCount={feedbacksCount}
                    hilfreichCount={hilfreichCount}
                    schliessenAction={schliessenBound}
                    abschliessenAction={abschliessenBound}
                  />
                ) : eigeneAnmeldung &&
                  eigeneAnmeldung.status === 'feedback_gegeben' ? (
                  <p style={{ margin: 0 }}>{td.action_feedback_gegeben}</p>
                ) : eigeneAnmeldung &&
                  eigeneAnmeldung.status === 'angemeldet' ? (
                  <>
                    <p style={{ margin: 0 }}>{td.action_angemeldet(fristStr)}</p>
                    <div style={{ marginTop: 14 }}>
                      <Link
                        className="button primary"
                        href={`/pruefrunden/${id}/feedback`}
                      >
                        {td.action_feedback_link}
                      </Link>
                    </div>
                  </>
                ) : !istOeffentlich ? (
                  <p style={{ margin: 0, color: 'var(--muted)' }}>
                    {td.action_nicht_oeffentlich}
                  </p>
                ) : !slotsFrei ? (
                  <p style={{ margin: 0, color: 'var(--muted)' }}>
                    {td.action_voll(angemeldet, pr.pruefrunde.gesuchteTester)}
                  </p>
                ) : (
                  <form action={anmeldenBound}>
                    <p style={{ margin: 0, color: 'var(--muted)' }}>
                      Frei: {pr.pruefrunde.gesuchteTester - angemeldet} /{' '}
                      {pr.pruefrunde.gesuchteTester}
                    </p>
                    <button
                      type="submit"
                      className="button primary"
                      style={{ marginTop: 14 }}
                    >
                      {td.action_anmelden_button}
                    </button>
                  </form>
                )}
              </div>
            </article>
          </aside>
        </div>
      </section>

      <section className="section compact" aria-label="Inhalt melden">
        <div
          className="wrap"
          style={{ display: 'flex', justifyContent: 'flex-end' }}
        >
          <MeldenButton referenzTyp="nutzer" referenzId={pr.inhaberId} />
        </div>
      </section>
    </div>
  );
}

function ErfolgBanner({ text }: { text: string }) {
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

function FehlerBanner({ code }: { code?: string }) {
  if (!code) return null;
  const text =
    code === 'keine_rolle'
      ? 'Du brauchst eine Builder:innen-Rolle, um dich als Tester:in anzumelden.'
      : code === 'falscher_status'
        ? 'Diese Feedback-Loop nimmt keine Anmeldungen mehr an.'
        : code === 'eigenes_werk'
          ? 'Du kannst dich nicht für die Feedback-Loop deines eigenen Werks anmelden.'
          : code === 'voll'
            ? 'Die Feedback-Loop ist voll. Keine weiteren Anmeldungen möglich.'
            : code === 'bereits_angemeldet'
              ? 'Du bist bereits für diese Feedback-Loop angemeldet.'
              : code === 'kein_hilfreiches_feedback'
                ? 'Markiere mindestens ein Feedback als hilfreich, bevor du die Feedback-Loop abschließt.'
                : de.fehler.unbekannt;
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

interface InhaberPanelProps {
  pruefrundeId: string;
  status: PruefrundeStatus;
  anmeldungen: Array<{
    id: string;
    status: PruefrundeAnmeldungStatus;
    anzeigename: string;
  }>;
  feedbacksCount: number;
  hilfreichCount: number;
  schliessenAction: () => Promise<void>;
  abschliessenAction: () => Promise<void>;
}

function InhaberPanel({
  pruefrundeId,
  status,
  anmeldungen,
  feedbacksCount,
  hilfreichCount,
  schliessenAction,
  abschliessenAction,
}: InhaberPanelProps) {
  return (
    <>
      <p className="eyebrow" style={{ margin: 0 }}>
        {td.verwalten_titel}
      </p>
      <h3 style={{ margin: '4px 0 12px', fontSize: 20 }}>
        {td.verwalten_tester_titel}
      </h3>
      {anmeldungen.length === 0 ? (
        <p style={{ margin: 0, color: 'var(--muted)' }}>
          {td.verwalten_keine_tester}
        </p>
      ) : (
        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'grid',
            gap: 6,
          }}
        >
          {anmeldungen.map((a) => (
            <li
              key={a.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 8,
                fontSize: 14,
              }}
            >
              <span>{a.anzeigename}</span>
              <span className="status-pill" style={{ fontSize: 11 }}>
                {anmeldungsStatusLabel(a.status)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <p
        style={{
          marginTop: 18,
          color: 'var(--muted)',
          fontSize: 13,
        }}
      >
        Feedbacks: {feedbacksCount} · hilfreich: {hilfreichCount}
      </p>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          marginTop: 14,
        }}
      >
        {status === 'entwurf' ? (
          <Link
            className="button primary"
            href={`/pruefrunden/${pruefrundeId}/bearbeiten`}
          >
            {td.verwalten_zum_bearbeiten}
          </Link>
        ) : null}
        {status === 'oeffentlich' ? (
          feedbacksCount >= 1 ? (
            <form action={schliessenAction}>
              <button type="submit" className="button secondary">
                {td.verwalten_schliessen}
              </button>
              <p
                style={{
                  margin: '6px 0 0',
                  color: 'var(--muted)',
                  fontSize: 12,
                }}
              >
                {td.verwalten_schliessen_hinweis}
              </p>
            </form>
          ) : (
            <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13 }}>
              {td.verwalten_schliessen_hinweis}
            </p>
          )
        ) : null}
        {status === 'geschlossen' ? (
          hilfreichCount >= 1 ? (
            <form action={abschliessenAction}>
              <button type="submit" className="button primary">
                {td.verwalten_abschliessen}
              </button>
            </form>
          ) : (
            <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13 }}>
              {td.verwalten_abschliessen_hinweis}
            </p>
          )
        ) : null}
      </div>
    </>
  );
}
