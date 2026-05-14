/**
 * /bedarfe/[id] — Bedarf-Detail (Server Component, eingeloggt-only).
 *
 * Quelle: PRD §F-604, §11A Schutz S2/S3.
 *
 * Sichtbarkeit gemaess API §F-604:
 *  - oeffentlich/in_gespraechen/erfuellt/eingestellt: alle eingeloggten sehen.
 *  - entwurf/in_pruefung: nur Owner und Kurator.
 *
 * Action-Box rechts je nach Rolle:
 *  - Macher:in (nicht Owner): Link zu /bedarfe/[id]/werkangebot-neu.
 *  - Bedarfstraeger:in (Owner): Werkangebote-Liste mit Status-Buttons (Server-Actions)
 *    + Erfuellt-markieren-Button.
 *  - Andere (eingeloggt aber weder Macher:in noch Owner): kein Action-Button.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';

import { de } from '@/i18n/de';
import { db } from '@/lib/db';
import {
  auditLog,
  bedarf,
  nutzer,
  werk,
  werkangebot,
} from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';
import { hasRolle } from '@/lib/auth/permissions';
import type {
  BedarfStatus,
  WerkangebotStatus,
} from '@/lib/db/schema/enums';

const td = de.bedarfsseite.bedarf_detail;
const tn = de.uebersicht;

interface PageParams {
  params: Promise<{ id: string }>;
}

interface PageProps extends PageParams {
  searchParams: Promise<{ erfolg?: string; fehler?: string }>;
}

const PUBLIC_STATUS: BedarfStatus[] = [
  'oeffentlich',
  'in_gespraechen',
  'erfuellt',
  'eingestellt',
];

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

function formatEuro(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return '';
  return `${Math.round(cents / 100).toLocaleString('de-DE')} €`;
}

function statusLabel(s: BedarfStatus): string {
  return (
    (de.bedarfsseite.bedarf_status_label as Record<string, string>)[s] ?? s
  );
}

function werkangebotStatusLabel(s: WerkangebotStatus): string {
  return (
    (de.bedarfsseite.werkangebot_status_label as Record<string, string>)[s] ?? s
  );
}

async function ladeBedarf(id: string) {
  const rows = await db
    .select()
    .from(bedarf)
    .where(eq(bedarf.id, id))
    .limit(1);
  return rows[0] ?? null;
}

async function ladeWerkangebote(bedarfId: string) {
  return db
    .select({
      id: werkangebot.id,
      werkId: werkangebot.werkId,
      werkName: werk.name,
      macherId: werkangebot.macherId,
      macherAnzeigename: nutzer.anzeigename,
      konkretesVorgehen: werkangebot.konkretesVorgehen,
      ausschluss: werkangebot.ausdruecklicherAusschluss,
      meilenstein: werkangebot.ersterLieferMeilenstein,
      status: werkangebot.status,
    })
    .from(werkangebot)
    .innerJoin(werk, eq(werk.id, werkangebot.werkId))
    .innerJoin(nutzer, eq(nutzer.id, werkangebot.macherId))
    .where(eq(werkangebot.bedarfId, bedarfId));
}

async function eigenesWerkangebot(bedarfId: string, macherId: string) {
  const rows = await db
    .select()
    .from(werkangebot)
    .where(
      and(
        eq(werkangebot.bedarfId, bedarfId),
        eq(werkangebot.macherId, macherId),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

/* ─────────── Server Actions ─────────── */

export async function setzeWerkangebotStatusAction(
  werkangebotId: string,
  bedarfId: string,
  ziel: WerkangebotStatus,
): Promise<void> {
  'use server';

  const req = await buildRequestFromHeaders(`/bedarfe/${bedarfId}`);
  const sess = await getSessionFromRequest(req);
  if (!sess) {
    redirect(`/anmelden?next=/bedarfe/${bedarfId}`);
  }

  const wRows = await db
    .select({
      id: werkangebot.id,
      bedarfId: werkangebot.bedarfId,
      bedarfOwner: bedarf.nutzerId,
      status: werkangebot.status,
    })
    .from(werkangebot)
    .innerJoin(bedarf, eq(bedarf.id, werkangebot.bedarfId))
    .where(eq(werkangebot.id, werkangebotId))
    .limit(1);
  const row = wRows[0];
  if (!row) notFound();
  if (row.bedarfOwner !== sess.nutzerId) {
    redirect(`/bedarfe/${bedarfId}?fehler=kein_zugriff`);
  }

  await db
    .update(werkangebot)
    .set({ status: ziel, aktualisiertAm: new Date() })
    .where(eq(werkangebot.id, werkangebotId));

  try {
    await db.insert(auditLog).values({
      nutzerId: sess.nutzerId,
      aktion: 'werkangebot.status_geaendert',
      referenzTyp: 'werkangebot',
      referenzId: werkangebotId,
      metadaten: { zu: ziel, rolle: 'bedarfstraeger' },
    });
  } catch {
    /* ignore */
  }

  revalidatePath(`/bedarfe/${bedarfId}`);
  redirect(`/bedarfe/${bedarfId}?erfolg=status_gesetzt`);
}

export async function markiereBedarfErfuelltAction(
  bedarfId: string,
): Promise<void> {
  'use server';

  const req = await buildRequestFromHeaders(`/bedarfe/${bedarfId}`);
  const sess = await getSessionFromRequest(req);
  if (!sess) {
    redirect(`/anmelden?next=/bedarfe/${bedarfId}`);
  }

  const rows = await db
    .select()
    .from(bedarf)
    .where(eq(bedarf.id, bedarfId))
    .limit(1);
  const row = rows[0];
  if (!row) notFound();
  if (row.nutzerId !== sess.nutzerId) {
    redirect(`/bedarfe/${bedarfId}?fehler=kein_zugriff`);
  }
  if (row.status !== 'oeffentlich' && row.status !== 'in_gespraechen') {
    redirect(`/bedarfe/${bedarfId}?fehler=falscher_status`);
  }

  await db
    .update(bedarf)
    .set({
      status: 'erfuellt',
      erfuelltAm: new Date(),
      aktualisiertAm: new Date(),
    })
    .where(eq(bedarf.id, bedarfId));

  try {
    await db.insert(auditLog).values({
      nutzerId: sess.nutzerId,
      aktion: 'bedarf.erfuellt',
      referenzTyp: 'bedarf',
      referenzId: bedarfId,
    });
  } catch {
    /* ignore */
  }

  revalidatePath(`/bedarfe/${bedarfId}`);
  redirect(`/bedarfe/${bedarfId}?erfolg=erfuellt`);
}

/* ─────────── Metadata ─────────── */

export async function generateMetadata({
  params,
}: PageParams): Promise<Metadata> {
  const { id } = await params;
  const row = await ladeBedarf(id);
  return {
    title: row ? `${row.titel} — Bedarf` : 'Bedarf nicht gefunden',
    robots: { index: false, follow: false },
  };
}

/* ─────────── Page ─────────── */

export default async function BedarfDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const sp = await searchParams;

  const req = await buildRequestFromHeaders(`/bedarfe/${id}`);
  const sess = await getSessionFromRequest(req);
  if (!sess) {
    redirect(`/anmelden?next=/bedarfe/${id}`);
  }

  const b = await ladeBedarf(id);
  if (!b) notFound();

  const istOwner = b.nutzerId === sess.nutzerId;
  if (!istOwner && !PUBLIC_STATUS.includes(b.status)) {
    notFound();
  }

  const istMacher = hasRolle(sess.nutzer, 'macher');

  const werkangebote = istOwner ? await ladeWerkangebote(id) : [];
  const eigenes =
    !istOwner && istMacher
      ? await eigenesWerkangebot(id, sess.nutzerId)
      : null;

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
            <Link href="/uebersicht">{tn.nav_uebersicht}</Link>
            <Link href="/bedarfe" aria-current="page">
              {de.bedarfsseite.nav_bedarfe}
            </Link>
            <Link href="/foerderprofile">
              {de.bedarfsseite.nav_foerderprofile}
            </Link>
          </div>
        </div>
      </nav>

      <header className="hero" id="top">
        <div className="wrap hero-grid single">
          <div>
            <p className="eyebrow">{td.eyebrow}</p>
            <h1>{b.titel}</h1>
            <div
              style={{
                display: 'flex',
                gap: 8,
                marginTop: 16,
                flexWrap: 'wrap',
              }}
            >
              <span className="status-pill">{statusLabel(b.status)}</span>
              <span style={{ color: 'var(--muted)' }}>
                {td.sektion_organisation}: {b.organisation}
              </span>
            </div>
          </div>
        </div>
      </header>

      <section className="section product-section">
        <div className="wrap product-split">
          <div>
            {sp.erfolg === 'status_gesetzt' ? (
              <Banner
                kind="ok"
                text="Status des Werkangebots wurde aktualisiert."
              />
            ) : sp.erfolg === 'erfuellt' ? (
              <Banner
                kind="ok"
                text="Danke — der Bedarf ist als erfüllt markiert."
              />
            ) : sp.erfolg === 'erfolgsbeitrag_bezahlt' ? (
              <Banner
                kind="ok"
                text="Vielen Dank! Deine Spende geht in die Werkstatt-Kasse Hamburg."
              />
            ) : null}
            {sp.fehler === 'kein_zugriff' ? (
              <Banner kind="fehler" text="Du darfst das nicht setzen." />
            ) : sp.fehler === 'falscher_status' ? (
              <Banner
                kind="fehler"
                text="Status-Wechsel in diesem Zustand nicht möglich."
              />
            ) : sp.fehler === 'erfolgsbeitrag_abgebrochen' ? (
              <Banner
                kind="fehler"
                text="Erfolgsbeitrag wurde abgebrochen — du kannst es jederzeit erneut versuchen."
              />
            ) : null}

            <h2 style={{ fontSize: 28, marginTop: 12 }}>{td.sektion_problem}</h2>
            <p
              style={{
                marginTop: 8,
                color: 'var(--fg)',
                whiteSpace: 'pre-line',
                lineHeight: 1.55,
              }}
            >
              {b.problem}
            </p>

            <h2 style={{ fontSize: 28, marginTop: 32 }}>{td.sektion_nutzen}</h2>
            <p
              style={{
                marginTop: 8,
                color: 'var(--fg)',
                whiteSpace: 'pre-line',
                lineHeight: 1.55,
              }}
            >
              {b.nutzen}
            </p>

            <h2 style={{ fontSize: 28, marginTop: 32 }}>{td.sektion_groesse}</h2>
            <div className="work-meta" style={{ marginTop: 12 }}>
              {b.groessenordnungZeitWochen ? (
                <div className="meta-box">
                  <span>Zeit</span>
                  <strong>{b.groessenordnungZeitWochen} Wochen</strong>
                </div>
              ) : null}
              {b.groessenordnungAufwandTage ? (
                <div className="meta-box">
                  <span>Aufwand</span>
                  <strong>{b.groessenordnungAufwandTage} Tage</strong>
                </div>
              ) : null}
              {b.geldrahmenMinEuroCent !== null ||
              b.geldrahmenMaxEuroCent !== null ? (
                <div className="meta-box">
                  <span>Geldrahmen</span>
                  <strong>
                    {formatEuro(b.geldrahmenMinEuroCent)}
                    {b.geldrahmenMinEuroCent !== null &&
                    b.geldrahmenMaxEuroCent !== null
                      ? ' – '
                      : ''}
                    {formatEuro(b.geldrahmenMaxEuroCent)}
                  </strong>
                </div>
              ) : null}
              <div className="meta-box">
                <span>{td.sektion_frist}</span>
                <strong>{formatFrist(b.frist)}</strong>
              </div>
            </div>
          </div>

          <aside aria-label="Aktionen">
            <article className="work-card">
              <div className="work-body">
                {istOwner ? (
                  <OwnerPanel
                    bedarfId={id}
                    bedarfStatus={b.status}
                    werkangebote={werkangebote}
                  />
                ) : istMacher ? (
                  eigenes ? (
                    <>
                      <p className="eyebrow" style={{ margin: 0 }}>
                        Dein Werkangebot
                      </p>
                      <p style={{ marginTop: 8 }}>
                        Status: <strong>{werkangebotStatusLabel(eigenes.status)}</strong>
                      </p>
                      <p
                        style={{
                          margin: '8px 0 0',
                          color: 'var(--muted)',
                          fontSize: 13,
                        }}
                      >
                        {td.action_macher_hinweis}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="eyebrow" style={{ margin: 0 }}>
                        Macher:in
                      </p>
                      <p
                        style={{
                          margin: '6px 0 12px',
                          color: 'var(--muted)',
                          fontSize: 13,
                        }}
                      >
                        {td.action_macher_hinweis}
                      </p>
                      <Link
                        className="button primary"
                        href={`/bedarfe/${id}/werkangebot-neu`}
                      >
                        {td.action_macher_werkangebot}
                      </Link>
                    </>
                  )
                ) : (
                  <p style={{ margin: 0, color: 'var(--muted)' }}>
                    {td.action_kein_macher_hinweis}
                  </p>
                )}
              </div>
            </article>
          </aside>
        </div>
      </section>
    </div>
  );
}

interface OwnerPanelProps {
  bedarfId: string;
  bedarfStatus: BedarfStatus;
  werkangebote: Awaited<ReturnType<typeof ladeWerkangebote>>;
}

function OwnerPanel({ bedarfId, bedarfStatus, werkangebote }: OwnerPanelProps) {
  const kannErfuellen =
    bedarfStatus === 'oeffentlich' || bedarfStatus === 'in_gespraechen';
  const erfuellenBound = markiereBedarfErfuelltAction.bind(null, bedarfId);

  return (
    <>
      <p className="eyebrow" style={{ margin: 0 }}>
        {td.verwalten_titel}
      </p>
      {werkangebote.length === 0 ? (
        <p style={{ margin: '8px 0 0', color: 'var(--muted)' }}>
          {td.verwalten_keine}
        </p>
      ) : (
        <ul
          style={{
            listStyle: 'none',
            margin: '12px 0 0',
            padding: 0,
            display: 'grid',
            gap: 16,
          }}
        >
          {werkangebote.map((w) => {
            const statusAction = setzeWerkangebotStatusAction.bind(
              null,
              w.id,
              bedarfId,
            );
            return (
              <li
                key={w.id}
                style={{
                  border: 'var(--hairline)',
                  borderRadius: 10,
                  padding: 12,
                  display: 'grid',
                  gap: 6,
                }}
              >
                <p style={{ margin: 0, fontWeight: 600 }}>{w.werkName}</p>
                <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13 }}>
                  von {w.macherAnzeigename}
                </p>
                <p style={{ margin: '4px 0', fontSize: 13 }}>
                  Status: {werkangebotStatusLabel(w.status)}
                </p>
                <details style={{ fontSize: 13 }}>
                  <summary style={{ cursor: 'pointer', color: 'var(--muted)' }}>
                    Details ansehen
                  </summary>
                  <div style={{ marginTop: 6 }}>
                    <p style={{ margin: 0 }}>
                      <strong>Vorgehen:</strong> {w.konkretesVorgehen}
                    </p>
                    <p style={{ margin: '6px 0 0' }}>
                      <strong>Ausschluss:</strong> {w.ausschluss}
                    </p>
                    <p style={{ margin: '6px 0 0' }}>
                      <strong>Meilenstein:</strong> {w.meilenstein}
                    </p>
                  </div>
                </details>
                {w.status === 'eingereicht' ||
                w.status === 'in_gespraechen' ? (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {w.status === 'eingereicht' ? (
                      <form
                        action={statusAction.bind(null, 'in_gespraechen')}
                      >
                        <button
                          type="submit"
                          className="button secondary"
                          style={{ fontSize: 13 }}
                        >
                          {td.verwalten_in_gespraechen}
                        </button>
                      </form>
                    ) : null}
                    <form action={statusAction.bind(null, 'beauftragt')}>
                      <button
                        type="submit"
                        className="button secondary"
                        style={{ fontSize: 13 }}
                      >
                        {td.verwalten_beauftragt}
                      </button>
                    </form>
                    <form action={statusAction.bind(null, 'nicht_gewaehlt')}>
                      <button
                        type="submit"
                        className="button"
                        style={{ fontSize: 13, color: 'var(--muted)' }}
                      >
                        {td.verwalten_nicht_gewaehlt}
                      </button>
                    </form>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {kannErfuellen ? (
        <div style={{ marginTop: 18 }}>
          <form action={erfuellenBound}>
            <button type="submit" className="button primary">
              {td.verwalten_erfuellt}
            </button>
          </form>
          <p
            style={{
              margin: '8px 0 0',
              color: 'var(--muted)',
              fontSize: 12,
            }}
          >
            {td.verwalten_erfuellt_hinweis}
          </p>
        </div>
      ) : null}

      {bedarfStatus === 'erfuellt' ? (
        <ErfolgsbeitragPanel bedarfId={bedarfId} />
      ) : null}
    </>
  );
}

/**
 * Spende-Modal-Stub fuer den Erfolgsbeitrag.
 *
 * Slider 0–10 % (default 5 %). Bedarfstraeger:in waehlt einen Prozent-
 * Satz und einen Cent-Betrag (Default-Annahme: 1.000 € Auftrag, Slider
 * 5 % → 50 €); fuer den Stub reicht ein einfacher Number-Input + Range.
 * Echte Auftrags-Groesse koennte spaeter aus `selbstauskunft_*` gelesen
 * werden.
 *
 * Form posted gegen `/api/v1/bedarfe/:id/erfolgsbeitrag`; bei Erfolg
 * leitet die API per `checkoutUrl` zu Stripe um (clientseitige Redirect-
 * Logik wuerde JS verlangen — hier zeigen wir den Link sichtbar).
 *
 * NB: das Modal ist progressively-enhanced. Ohne JS sieht die Person
 * den Slider und kann via Submit den Endpoint anrufen — die Antwort
 * enthaelt `checkoutUrl`, die wir per `<meta http-equiv="refresh">` als
 * naechsten Schritt zeigen (siehe Server-Action unten).
 */
function ErfolgsbeitragPanel({ bedarfId }: { bedarfId: string }) {
  return (
    <div
      style={{
        marginTop: 18,
        padding: 14,
        borderRadius: 10,
        background: 'var(--surface-alt, #f6f6f1)',
      }}
    >
      <p className="eyebrow" style={{ margin: 0 }}>
        Erfolgsbeitrag (freiwillig)
      </p>
      <p style={{ margin: '8px 0', fontSize: 13, color: 'var(--muted)' }}>
        Werkzirkel nimmt keine Provision. Wenn du magst, spende einen Anteil an
        die Werkstatt-Kasse Hamburg — z.&nbsp;B. 5&nbsp;%.
      </p>
      <form
        action={`/api/v1/bedarfe/${bedarfId}/erfolgsbeitrag`}
        method="post"
        encType="application/json"
        style={{ display: 'grid', gap: 8 }}
      >
        <label style={{ fontSize: 13 }}>
          Prozent-Satz
          <input
            type="range"
            name="prozent_satz"
            min={0}
            max={10}
            step={0.5}
            defaultValue={5}
            style={{ display: 'block', width: '100%', marginTop: 4 }}
          />
        </label>
        <label style={{ fontSize: 13 }}>
          Betrag in Cent (1 € = 100)
          <input
            type="number"
            name="hoehe_euro_cent"
            min={100}
            max={10_000_000}
            step={100}
            defaultValue={5000}
            style={{ display: 'block', width: '100%', marginTop: 4 }}
          />
        </label>
        <button type="submit" className="button primary" style={{ fontSize: 13 }}>
          Spenden
        </button>
      </form>
    </div>
  );
}

function Banner({ kind, text }: { kind: 'ok' | 'fehler'; text: string }) {
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
      {text}
    </div>
  );
}
