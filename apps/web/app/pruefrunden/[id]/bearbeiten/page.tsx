/**
 * /pruefrunden/[id]/bearbeiten — Pruefrunde bearbeiten + veroeffentlichen.
 *
 * Quelle: PRD §F-201/§F-202, §14.2 (Statusmaschine), §17 (Reziprozitaet).
 *
 * - Auth + Inhaber:innen-Check (404 sonst).
 * - Bearbeiten nur in status='entwurf' moeglich; sonst Read-Only-Hinweis.
 * - Server Actions:
 *    * pruefrundeAktualisierenAction: PATCH eines Entwurfs.
 *    * pruefrundeVeroeffentlichenAction: Status entwurf→oeffentlich mit
 *      Reziprozitaets-Check (`kannPruefrundeStarten`).
 *    * pruefrundeLoeschenAction: DELETE eines Entwurfs.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';

import { de } from '@/i18n/de';
import { db } from '@/lib/db';
import { auditLog, pruefrunde, werk } from '@/lib/db/schema';
import {
  feedbackKategorie as feedbackKategorieEnum,
} from '@/lib/db/schema/enums';
import { getSessionFromRequest } from '@/lib/auth/session';
import { pruefrundePatchSchema } from '@/lib/validators/pruefrunde';
import {
  findeOffenePruefrundenAnderer,
  getSaldoForUser,
  kannPruefrundeStarten,
} from '@/lib/reziprozitaet/engine';

const tb = de.pruefrunden.bearbeiten;
const tnav = de.uebersicht;
const tn = de.pruefrunden.neu;

export const metadata: Metadata = {
  title: 'Feedback-Loop bearbeiten',
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    frisch?: string;
    gespeichert?: string;
    fehler?: string;
    feld?: string;
    veroeffentlicht?: string;
    frist?: string;
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

async function ladePruefrunde(id: string) {
  const rows = await db
    .select({
      pruefrunde,
      werkNutzerId: werk.nutzerId,
      werkName: werk.name,
    })
    .from(pruefrunde)
    .innerJoin(werk, eq(werk.id, pruefrunde.werkId))
    .where(eq(pruefrunde.id, id))
    .limit(1);
  return rows[0] ?? null;
}

function formatDatumInput(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${yyyy}-${mm}-${dd}`;
}

function formatFrist(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

function kategorieLabel(k: string): string {
  return (
    (de.pruefrunden.feedback_kategorie as Record<string, string>)[k] ?? k
  );
}

/* ───────────────────── Server Actions ───────────────────── */

export async function pruefrundeAktualisierenAction(
  pruefrundeId: string,
  formData: FormData,
): Promise<void> {
  'use server';

  const req = await buildRequestFromHeaders(
    `/pruefrunden/${pruefrundeId}/bearbeiten`,
  );
  const sess = await getSessionFromRequest(req);
  if (!sess) {
    redirect(`/anmelden?next=/pruefrunden/${pruefrundeId}/bearbeiten`);
  }

  const current = await ladePruefrunde(pruefrundeId);
  if (!current) notFound();
  if (current.werkNutzerId !== sess.nutzerId) notFound();
  if (current.pruefrunde.status !== 'entwurf') {
    redirect(`/pruefrunden/${pruefrundeId}/bearbeiten?fehler=nicht_editierbar`);
  }

  const kategorien = formData
    .getAll('feedback_kategorien')
    .map((v) => String(v))
    .filter(Boolean);

  const zeitStr = String(formData.get('zeitbedarf_minuten') ?? '').trim();
  const gesuchtStr = String(formData.get('gesuchte_tester') ?? '').trim();
  const fristStr = String(formData.get('frist') ?? '').trim();

  const candidate = {
    titel: String(formData.get('titel') ?? '').trim(),
    testziel: String(formData.get('testziel') ?? '').trim(),
    testaufgabe: String(formData.get('testaufgabe') ?? '').trim(),
    zielgruppe: String(formData.get('zielgruppe') ?? '').trim(),
    zeitbedarf_minuten: zeitStr ? Number(zeitStr) : undefined,
    gesuchte_tester: gesuchtStr ? Number(gesuchtStr) : undefined,
    feedback_kategorien: kategorien.length > 0 ? kategorien : undefined,
    frist: fristStr ? fristStr : undefined,
  };

  const parsed = pruefrundePatchSchema.safeParse(candidate);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const firstFeld = Object.keys(fieldErrors)[0] ?? 'unbekannt';
    redirect(
      `/pruefrunden/${pruefrundeId}/bearbeiten?fehler=validierung&feld=${encodeURIComponent(firstFeld)}`,
    );
  }
  const patch = parsed.data;

  const update: Partial<typeof pruefrunde.$inferInsert> = {
    aktualisiertAm: new Date(),
  };
  if (patch.titel !== undefined) update.titel = patch.titel;
  if (patch.testziel !== undefined) update.testziel = patch.testziel;
  if (patch.testaufgabe !== undefined) update.testaufgabe = patch.testaufgabe;
  if (patch.zielgruppe !== undefined) update.zielgruppe = patch.zielgruppe;
  if (patch.zeitbedarf_minuten !== undefined)
    update.zeitbedarfMinuten = patch.zeitbedarf_minuten;
  if (patch.gesuchte_tester !== undefined)
    update.gesuchteTester = patch.gesuchte_tester;
  if (patch.feedback_kategorien !== undefined)
    update.feedbackKategorien = patch.feedback_kategorien;
  if (patch.frist !== undefined) update.frist = patch.frist;

  await db
    .update(pruefrunde)
    .set(update)
    .where(eq(pruefrunde.id, pruefrundeId));

  try {
    await db.insert(auditLog).values({
      nutzerId: sess.nutzerId,
      aktion: 'pruefrunde.aktualisiert',
      referenzTyp: 'pruefrunde',
      referenzId: pruefrundeId,
    });
  } catch {
    /* ignore */
  }

  revalidatePath(`/pruefrunden/${pruefrundeId}/bearbeiten`);
  redirect(`/pruefrunden/${pruefrundeId}/bearbeiten?gespeichert=1`);
}

async function veroeffentlichenIntern(
  pruefrundeId: string,
  verpflichtungAkzeptiert: boolean,
): Promise<void> {
  const req = await buildRequestFromHeaders(
    `/pruefrunden/${pruefrundeId}/bearbeiten`,
  );
  const sess = await getSessionFromRequest(req);
  if (!sess) {
    redirect(`/anmelden?next=/pruefrunden/${pruefrundeId}/bearbeiten`);
  }

  const current = await ladePruefrunde(pruefrundeId);
  if (!current) notFound();
  if (current.werkNutzerId !== sess.nutzerId) notFound();
  if (current.pruefrunde.status !== 'entwurf') {
    redirect(`/pruefrunden/${pruefrundeId}/bearbeiten?fehler=nicht_editierbar`);
  }

  const check = await kannPruefrundeStarten(
    sess.nutzerId,
    current.pruefrunde.frist,
    pruefrundeId,
    undefined,
    { verpflichtung_akzeptiert: verpflichtungAkzeptiert },
  );

  if (check.ok === false) {
    const fehler =
      check.grund === 'frist_abgelaufen' ? 'reziprozitaet' : 'saldo_zu_niedrig';
    redirect(`/pruefrunden/${pruefrundeId}/bearbeiten?fehler=${fehler}`);
  }

  await db
    .update(pruefrunde)
    .set({ status: 'oeffentlich', aktualisiertAm: new Date() })
    .where(eq(pruefrunde.id, pruefrundeId));

  try {
    await db.insert(auditLog).values({
      nutzerId: sess.nutzerId,
      aktion: 'pruefrunde.veroeffentlicht',
      referenzTyp: 'pruefrunde',
      referenzId: pruefrundeId,
      metadaten:
        check.modus === 'neue_verpflichtung'
          ? {
              reziprozitaet_modus: 'neue_verpflichtung',
              verpflichtungs_id: check.verpflichtungs_id,
            }
          : { reziprozitaet_modus: 'saldo_erfuellt' },
    });
  } catch {
    /* ignore */
  }

  const fristParam =
    check.modus === 'neue_verpflichtung'
      ? `&frist=${encodeURIComponent(check.frist.toISOString())}`
      : '';
  revalidatePath(`/pruefrunden/${pruefrundeId}`);
  redirect(
    `/pruefrunden/${pruefrundeId}/bearbeiten?veroeffentlicht=${check.modus}${fristParam}`,
  );
}

export async function pruefrundeVeroeffentlichenAction(
  pruefrundeId: string,
): Promise<void> {
  'use server';
  // Ohne expliziten Opt-In: Engine blockt bei Saldo<2 mit
  // `saldo_zu_niedrig` → der Bearbeiten-Screen zeigt dann den
  // Auswahl-Block mit den 2 offenen Pruefrunden anderer + dem
  // "Verpflichtung eingehen"-Pfad.
  await veroeffentlichenIntern(pruefrundeId, false);
}

export async function pruefrundeMitVerpflichtungVeroeffentlichenAction(
  pruefrundeId: string,
): Promise<void> {
  'use server';
  // Explizit gewählter 14-Tage-Verpflichtungs-Pfad. Wird nur aus dem
  // Auswahl-Block heraus aufgerufen, der nach einem `saldo_zu_niedrig`
  // angezeigt wird.
  await veroeffentlichenIntern(pruefrundeId, true);
}

export async function pruefrundeLoeschenAction(
  pruefrundeId: string,
): Promise<void> {
  'use server';

  const req = await buildRequestFromHeaders(
    `/pruefrunden/${pruefrundeId}/bearbeiten`,
  );
  const sess = await getSessionFromRequest(req);
  if (!sess) {
    redirect(`/anmelden?next=/pruefrunden/${pruefrundeId}/bearbeiten`);
  }

  const current = await ladePruefrunde(pruefrundeId);
  if (!current) notFound();
  if (current.werkNutzerId !== sess.nutzerId) notFound();
  if (current.pruefrunde.status !== 'entwurf') {
    redirect(`/pruefrunden/${pruefrundeId}/bearbeiten?fehler=nicht_loeschbar`);
  }

  await db.delete(pruefrunde).where(eq(pruefrunde.id, pruefrundeId));

  try {
    await db.insert(auditLog).values({
      nutzerId: sess.nutzerId,
      aktion: 'pruefrunde.geloescht',
      referenzTyp: 'pruefrunde',
      referenzId: pruefrundeId,
    });
  } catch {
    /* ignore */
  }

  redirect('/uebersicht/pruefrunden?erfolg=geloescht');
}

/* ───────────────────── Page ───────────────────── */

export default async function PruefrundeBearbeitenPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const sp = await searchParams;

  const req = await buildRequestFromHeaders(
    `/pruefrunden/${id}/bearbeiten`,
  );
  const sess = await getSessionFromRequest(req);
  if (!sess) {
    redirect(`/anmelden?next=/pruefrunden/${id}/bearbeiten`);
  }

  const current = await ladePruefrunde(id);
  if (!current) notFound();
  if (current.werkNutzerId !== sess.nutzerId) notFound();

  const p = current.pruefrunde;
  const istEntwurf = p.status === 'entwurf';

  const aktualisierenBound = pruefrundeAktualisierenAction.bind(null, id);
  const veroeffentlichenBound = pruefrundeVeroeffentlichenAction.bind(null, id);
  const veroeffentlichenMitVerpflichtungBound =
    pruefrundeMitVerpflichtungVeroeffentlichenAction.bind(null, id);
  const loeschenBound = pruefrundeLoeschenAction.bind(null, id);

  // Gegenseitigkeits-Hint vorab: zeige Auswahl-Block, wenn Saldo<2.
  const saldo = istEntwurf
    ? await getSaldoForUser(sess.nutzerId)
    : null;
  const benoetigtVerpflichtungsWahl =
    istEntwurf && saldo !== null && saldo.tests_gegeben < 2;
  const offenePruefrundenAnderer = benoetigtVerpflichtungsWahl
    ? await findeOffenePruefrundenAnderer(sess.nutzerId, 2)
    : [];

  const minFrist = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
  const maxFrist = new Date(Date.now() + 59 * 24 * 60 * 60 * 1000);

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
            <p className="eyebrow">{tb.eyebrow}</p>
            <h1>{p.titel}</h1>
            <p className="hero-copy">{tb.untertitel}</p>
            <p style={{ color: 'var(--muted)' }}>Werk: {current.werkName}</p>
          </div>
        </div>
      </header>

      <section className="section compact">
        <div className="wrap" style={{ maxWidth: 760 }}>
          {sp.gespeichert === '1' || sp.frisch === '1' ? (
            <ErfolgBanner
              text={
                sp.frisch === '1'
                  ? 'Feedback-Loop angelegt. Du kannst sie jetzt feinschleifen und veröffentlichen.'
                  : tb.erfolg_gespeichert
              }
            />
          ) : null}

          {sp.veroeffentlicht === 'saldo_erfuellt' ? (
            <ErfolgBanner text={tb.erfolg_veroeffentlicht_saldo} />
          ) : null}

          {sp.veroeffentlicht === 'neue_verpflichtung' && sp.frist ? (
            <InfoBanner
              text={tb.erfolg_veroeffentlicht_verpflichtung(
                formatFrist(new Date(sp.frist)),
              )}
            />
          ) : null}

          {sp.fehler === 'reziprozitaet' ? (
            <FehlerBanner text={tb.fehler_reziprozitaet}>
              <Link href="/pruefrunden">{tb.pruefrunden_finden}</Link>
            </FehlerBanner>
          ) : null}

          {sp.fehler === 'saldo_zu_niedrig' ? (
            <FehlerBanner text="Gegenseitigkeits-Gate greift: du hast noch keine zwei Tests gegeben. Wähle unten zwischen Feedback geben oder 14-Tage-Verpflichtung." />
          ) : null}

          {sp.fehler === 'validierung' ? (
            <FehlerBanner
              text={
                sp.feld
                  ? `${tb.fehler_validierung} (Feld: ${sp.feld})`
                  : tb.fehler_validierung
              }
            />
          ) : null}

          {sp.fehler === 'nicht_editierbar' ? (
            <FehlerBanner text={tb.nicht_editierbar_text} />
          ) : null}

          {!istEntwurf ? (
            <div
              role="status"
              className="callout"
              style={{
                padding: 16,
                borderRadius: 12,
                marginBottom: 16,
              }}
            >
              <strong>{tb.nicht_editierbar_titel}</strong>
              <p style={{ margin: '6px 0 0' }}>{tb.nicht_editierbar_text}</p>
              <p style={{ margin: '12px 0 0' }}>
                <Link
                  href={`/pruefrunden/${id}`}
                  className="button secondary"
                >
                  Zur Detailseite
                </Link>
              </p>
            </div>
          ) : (
            <>
              <form
                action={aktualisierenBound}
                style={{ display: 'grid', gap: 16 }}
              >
                <label style={{ display: 'grid', gap: 6 }} htmlFor="titel">
                  <span style={{ fontWeight: 600 }}>{tn.label_titel}</span>
                  <input
                    id="titel"
                    name="titel"
                    type="text"
                    required
                    maxLength={200}
                    defaultValue={p.titel}
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
                    defaultValue={p.testziel}
                    style={textareaStyle}
                  />
                </label>

                <label style={{ display: 'grid', gap: 6 }} htmlFor="testaufgabe">
                  <span style={{ fontWeight: 600 }}>
                    {tn.label_testaufgabe}
                  </span>
                  <textarea
                    id="testaufgabe"
                    name="testaufgabe"
                    required
                    maxLength={5000}
                    rows={6}
                    defaultValue={p.testaufgabe}
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
                    defaultValue={p.zielgruppe}
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
                  <label
                    style={{ display: 'grid', gap: 6 }}
                    htmlFor="zeitbedarf_minuten"
                  >
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
                      defaultValue={p.zeitbedarfMinuten}
                      required
                      style={inputStyle}
                    />
                  </label>
                  <label
                    style={{ display: 'grid', gap: 6 }}
                    htmlFor="gesuchte_tester"
                  >
                    <span style={{ fontWeight: 600 }}>
                      {tn.label_gesuchte_tester}
                    </span>
                    <input
                      id="gesuchte_tester"
                      name="gesuchte_tester"
                      type="number"
                      min={1}
                      max={10}
                      defaultValue={p.gesuchteTester}
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
                    {feedbackKategorieEnum.map((k) => (
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
                          defaultChecked={p.feedbackKategorien.includes(k)}
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
                    defaultValue={formatDatumInput(p.frist)}
                    required
                    style={inputStyle}
                  />
                </label>

                <div
                  style={{
                    display: 'flex',
                    gap: 12,
                    flexWrap: 'wrap',
                  }}
                >
                  <button type="submit" className="button secondary">
                    {tb.button_speichern}
                  </button>
                </div>
              </form>

              <hr
                style={{
                  margin: '32px 0 24px',
                  border: 0,
                  borderTop: 'var(--hairline)',
                }}
              />

              {benoetigtVerpflichtungsWahl ? (
                <section
                  aria-labelledby="reziprozitaet-wahl-titel"
                  style={{
                    marginBottom: 24,
                    padding: 16,
                    borderRadius: 12,
                    border: '1px solid var(--border, #d6d3d1)',
                    background: 'var(--surface-alt, #f6f6f1)',
                  }}
                >
                  <h2
                    id="reziprozitaet-wahl-titel"
                    style={{ fontSize: 18, margin: '0 0 8px' }}
                  >
                    Gegenseitigkeits-Gate
                  </h2>
                  <p style={{ margin: '0 0 12px', fontSize: 14 }}>
                    Du hast bisher{' '}
                    <strong>{saldo?.tests_gegeben ?? 0} Test
                    {saldo?.tests_gegeben === 1 ? '' : 's'}</strong> gegeben.
                    Werkzirkel verlangt mindestens 2, bevor eine Feedback-Loop
                    veröffentlicht werden darf — sonst klafft das soziale
                    Konto. Du kannst auf zwei Wegen weiterkommen:
                  </p>

                  {offenePruefrundenAnderer.length > 0 ? (
                    <div style={{ margin: '12px 0 16px' }}>
                      <p
                        style={{
                          margin: '0 0 8px',
                          fontWeight: 600,
                          fontSize: 14,
                        }}
                      >
                        Weg 1: gib jetzt Feedback zu zwei offenen Feedback-Loops
                        anderer Builds
                      </p>
                      <ul
                        style={{
                          margin: 0,
                          paddingLeft: 18,
                          fontSize: 14,
                          display: 'grid',
                          gap: 6,
                        }}
                      >
                        {offenePruefrundenAnderer.map((pf) => (
                          <li key={pf.id}>
                            <Link href={`/pruefrunden/${pf.id}`}>
                              {pf.titel}
                            </Link>{' '}
                            <span style={{ color: 'var(--muted)' }}>
                              · {pf.werkName}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p
                      style={{
                        margin: '0 0 16px',
                        fontSize: 13,
                        color: 'var(--muted)',
                      }}
                    >
                      Aktuell sind keine offenen Feedback-Loops anderer Builds
                      verfügbar — der Verpflichtungs-Weg unten bleibt offen.
                    </p>
                  )}

                  <hr
                    style={{
                      border: 0,
                      borderTop: 'var(--hairline)',
                      margin: '12px 0',
                    }}
                  />

                  <p
                    style={{
                      margin: '0 0 8px',
                      fontWeight: 600,
                      fontSize: 14,
                    }}
                  >
                    Weg 2: Verpflichtung eingehen
                  </p>
                  <p style={{ margin: '0 0 12px', fontSize: 14 }}>
                    Veröffentliche jetzt — verpflichte dich aber im selben
                    Zug, innerhalb der nächsten 14 Tage Feedback zu zwei
                    Feedback-Loops anderer Builds zu geben. Bis dahin gilt das
                    als offene Gegenseitigkeits-Schuld in deinem Builder-Profil.
                  </p>
                  <form action={veroeffentlichenMitVerpflichtungBound}>
                    <button type="submit" className="button primary">
                      Veröffentlichen mit 14-Tage-Verpflichtung
                    </button>
                  </form>
                </section>
              ) : (
                <form
                  action={veroeffentlichenBound}
                  style={{ marginBottom: 16 }}
                >
                  <button type="submit" className="button primary">
                    {tb.button_veroeffentlichen}
                  </button>
                  <p
                    style={{
                      margin: '8px 0 0',
                      color: 'var(--muted)',
                      fontSize: 13,
                    }}
                  >
                    Beim Veröffentlichen prüfen wir dein Test-Saldo
                    (Gegenseitigkeit).
                  </p>
                </form>
              )}

              <form action={loeschenBound}>
                <button
                  type="submit"
                  className="button"
                  style={{ color: '#5a1a1a' }}
                >
                  {tb.button_loeschen}
                </button>
              </form>
            </>
          )}
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

function InfoBanner({ text }: { text: string }) {
  return (
    <div
      role="status"
      className="callout"
      style={{
        marginBottom: 16,
        padding: '12px 14px',
        borderRadius: 10,
        border: '1px solid #2a4d8f',
        background: '#e8eef8',
        color: '#1a2a4d',
      }}
    >
      <strong>{text}</strong>
    </div>
  );
}

function FehlerBanner({
  text,
  children,
}: {
  text: string;
  children?: React.ReactNode;
}) {
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
      <strong>{text}</strong>
      {children ? <div style={{ marginTop: 8 }}>{children}</div> : null}
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
