/**
 * /termine/[id] — Oeffentliche Termin-Detailseite mit Server-Actions
 * fuer Anmeldung, Storno und City-Leads-Statusuebergaenge.
 *
 * Quelle: PRD §F-401..§F-405, §15.8.
 *
 * Zugriffs-Logik:
 *  - Termin nicht vorhanden → notFound().
 *  - status='geplant' und nicht City-Lead → notFound().
 *  - Sonst public lesbar.
 *
 * Action-Box-Varianten siehe Plan.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';

import { de } from '@/i18n/de';
import { db } from '@/lib/db';
import {
  auditLog,
  nutzer,
  termin,
  terminAnmeldung,
} from '@/lib/db/schema';
import type {
  TerminStatus,
  TerminAnmeldungStatus,
} from '@/lib/db/schema/enums';
import { getSessionFromRequest } from '@/lib/auth/session';
import { istKuratorVon } from '@/lib/auth/permissions';
import { renderPruefrundeMarkdown } from '@/lib/pruefrunde/markdown';
import { sendMail } from '@/lib/email/send';
import { env } from '@/lib/env';
import {
  ladeBedarfBezuege,
  ladeFoerderprofilBezuege,
} from '@/lib/termin/bezuege';
import { EQUITY_HINWEISTEXT } from '@/lib/foerderprofil/serialize';

const td = de.termine.detail;
const tnav = de.uebersicht;

const APP_URL = env.APP_URL.replace(/\/+$/, '');

interface PageParams {
  params: Promise<{ id: string }>;
}

interface PageProps extends PageParams {
  searchParams: Promise<{ fehler?: string; erfolg?: string }>;
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

function terminTypLabel(t: string): string {
  return (de.termin_typ as Record<string, string>)[t] ?? t;
}

function terminStatusLabel(s: string): string {
  return (de.termine.status as Record<string, string>)[s] ?? s;
}

function formatDatumZeit(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}.${mm}.${yyyy}, ${hh}:${min} Uhr`;
}

const TERMIN_TYP_LABEL_MAIL: Record<string, string> = {
  pruefabend: 'Pruefabend',
  schauabend: 'Demo Night',
  bedarfsschau: 'Briefing Night',
  baurunde: 'Build-Runde',
  werkgespraech: 'Werkgespraech',
  kennenlernrunde: 'Kennenlernrunde',
};

function formatMailDatum(d: Date): string {
  return new Intl.DateTimeFormat('de-DE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Berlin',
  }).format(d);
}

function formatMailUhrzeit(d: Date): string {
  return new Intl.DateTimeFormat('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Europe/Berlin',
  }).format(d);
}

async function ladeTermin(id: string) {
  const rows = await db
    .select()
    .from(termin)
    .where(eq(termin.id, id))
    .limit(1);
  return rows[0] ?? null;
}

async function ladeEigeneAnmeldung(terminId: string, nutzerId: string) {
  const rows = await db
    .select()
    .from(terminAnmeldung)
    .where(
      and(
        eq(terminAnmeldung.terminId, terminId),
        eq(terminAnmeldung.nutzerId, nutzerId),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

async function zaehleAngemeldet(terminId: string): Promise<number> {
  const rows = await db
    .select({ anzahl: sql<number>`count(*)::int` })
    .from(terminAnmeldung)
    .where(
      and(
        eq(terminAnmeldung.terminId, terminId),
        inArray(terminAnmeldung.status, ['angemeldet', 'anwesend']),
      ),
    );
  return rows[0]?.anzahl ?? 0;
}

/**
 * Berechnet die 1-basierte Position einer Wartelisten-Anmeldung im FIFO.
 * Reihenfolge: erstellt_am ASC (gleiche Logik wie der Hochrueck-Mechanismus).
 * Liefert `null`, wenn die Anmeldung nicht auf der Warteliste steht.
 */
async function berechneWartelistenPosition(
  terminId: string,
  nutzerId: string,
): Promise<number | null> {
  const rows = await db.execute<{ position: number }>(sql`
    SELECT position::int FROM (
      SELECT nutzer_id,
             row_number() OVER (ORDER BY erstellt_am ASC, id ASC) AS position
        FROM termin_anmeldung
       WHERE termin_id = ${terminId}
         AND status = 'warteliste'
    ) ranked
    WHERE nutzer_id = ${nutzerId}
    LIMIT 1
  `);
  return rows[0]?.position ?? null;
}

async function zaehleWarteliste(terminId: string): Promise<number> {
  const rows = await db
    .select({ anzahl: sql<number>`count(*)::int` })
    .from(terminAnmeldung)
    .where(
      and(
        eq(terminAnmeldung.terminId, terminId),
        eq(terminAnmeldung.status, 'warteliste'),
      ),
    );
  return rows[0]?.anzahl ?? 0;
}

/* ─────────────────────  Server Actions  ───────────────────── */

export async function terminAnmeldenAction(terminId: string): Promise<void> {
  'use server';

  const req = await buildRequestFromHeaders(`/termine/${terminId}`);
  const sess = await getSessionFromRequest(req);
  if (!sess) {
    redirect(`/anmelden?next=/termine/${terminId}`);
  }

  type TxOutcome =
    | { kind: 'not_found' }
    | { kind: 'falscher_status' }
    | { kind: 'termin_vergangen' }
    | {
        kind: 'ok';
        slotStatus: 'angemeldet' | 'warteliste';
        terminTitel: string;
        terminTyp: string;
        datumUhrzeit: Date;
        ortText: string | null;
        onlineLink: string | null;
        nutzerEmail: string;
      };

  const outcome = await db.transaction(async (tx): Promise<TxOutcome> => {
    const rows = await tx.execute<{
      id: string;
      status: string;
      titel: string;
      typ: string;
      datum_uhrzeit: Date;
      ort_text: string | null;
      online_link: string | null;
      max_teilnehmer: number;
    }>(sql`
      SELECT id, status, titel, typ, datum_uhrzeit, ort_text, online_link,
             max_teilnehmer
        FROM termin
       WHERE id = ${terminId}
       FOR UPDATE
    `);
    const row = rows[0];
    if (!row) return { kind: 'not_found' };
    if (row.status !== 'veroeffentlicht') return { kind: 'falscher_status' };
    const datum =
      row.datum_uhrzeit instanceof Date
        ? row.datum_uhrzeit
        : new Date(row.datum_uhrzeit);
    if (datum.getTime() <= Date.now()) return { kind: 'termin_vergangen' };

    const userRows = await tx
      .select({ email: nutzer.email })
      .from(nutzer)
      .where(eq(nutzer.id, sess.nutzerId))
      .limit(1);
    const userEmail = userRows[0]?.email;
    if (!userEmail) return { kind: 'not_found' };

    const countRows = await tx.execute<{ anzahl: number }>(sql`
      SELECT COUNT(*)::int AS anzahl
        FROM termin_anmeldung
       WHERE termin_id = ${terminId}
         AND status IN ('angemeldet', 'anwesend')
    `);
    const aktive = countRows[0]?.anzahl ?? 0;
    const slotStatus: 'angemeldet' | 'warteliste' =
      aktive < row.max_teilnehmer ? 'angemeldet' : 'warteliste';

    const newId = createId();
    const inserted = await tx.execute<{ id: string; status: string }>(sql`
      INSERT INTO termin_anmeldung (id, termin_id, nutzer_id, status)
      VALUES (${newId}, ${terminId}, ${sess.nutzerId}, ${slotStatus})
      ON CONFLICT (termin_id, nutzer_id) DO UPDATE
         SET status = EXCLUDED.status
       WHERE termin_anmeldung.status = 'storniert'
      RETURNING id, status
    `);
    let finalStatus: 'angemeldet' | 'warteliste';
    if (inserted[0]) {
      finalStatus = inserted[0].status as 'angemeldet' | 'warteliste';
    } else {
      const existing = await tx
        .select()
        .from(terminAnmeldung)
        .where(
          and(
            eq(terminAnmeldung.terminId, terminId),
            eq(terminAnmeldung.nutzerId, sess.nutzerId),
          ),
        )
        .limit(1);
      const ex = existing[0];
      if (!ex) return { kind: 'not_found' };
      finalStatus =
        ex.status === 'warteliste' ? 'warteliste' : 'angemeldet';
    }

    return {
      kind: 'ok',
      slotStatus: finalStatus,
      terminTitel: row.titel,
      terminTyp: row.typ,
      datumUhrzeit: datum,
      ortText: row.ort_text,
      onlineLink: row.online_link,
      nutzerEmail: userEmail,
    };
  });

  if (outcome.kind === 'not_found') notFound();
  if (outcome.kind === 'falscher_status') {
    redirect(`/termine/${terminId}?fehler=falscher_status`);
  }
  if (outcome.kind === 'termin_vergangen') {
    redirect(`/termine/${terminId}?fehler=termin_vergangen`);
  }

  try {
    await sendMail({
      to: outcome.nutzerEmail,
      nutzerId: sess.nutzerId,
      template: 'T-401',
      props: {
        terminTitel: outcome.terminTitel,
        terminTyp:
          TERMIN_TYP_LABEL_MAIL[outcome.terminTyp] ?? outcome.terminTyp,
        terminDatum: formatMailDatum(outcome.datumUhrzeit),
        terminUhrzeit: formatMailUhrzeit(outcome.datumUhrzeit),
        ...(outcome.ortText ? { ortText: outcome.ortText } : {}),
        ...(outcome.onlineLink ? { onlineLink: outcome.onlineLink } : {}),
        terminUrl: `${APP_URL}/termine/${terminId}`,
        icalUrl: `${APP_URL}/api/v1/termine/${terminId}/ical`,
        slotPosition: outcome.slotStatus,
      },
    });
  } catch (err) {
    console.error('[termin-anmelden-action] sendMail T-401:', err);
  }
  try {
    await db.insert(auditLog).values({
      nutzerId: sess.nutzerId,
      aktion: 'termin.angemeldet',
      referenzTyp: 'termin',
      referenzId: terminId,
      metadaten: { slot_status: outcome.slotStatus },
    });
  } catch {
    /* ignore */
  }

  revalidatePath(`/termine/${terminId}`);
  redirect(
    `/termine/${terminId}?erfolg=${
      outcome.slotStatus === 'angemeldet' ? 'angemeldet' : 'warteliste'
    }`,
  );
}

export async function terminStornierenAction(terminId: string): Promise<void> {
  'use server';

  const req = await buildRequestFromHeaders(`/termine/${terminId}`);
  const sess = await getSessionFromRequest(req);
  if (!sess) {
    redirect(`/anmelden?next=/termine/${terminId}`);
  }

  type TxOutcome =
    | { kind: 'not_found' }
    | { kind: 'bereits_storniert' }
    | {
        kind: 'ok';
        hochgerueckt: null | {
          email: string;
          nutzerId: string;
          terminTitel: string;
          terminTyp: string;
          datumUhrzeit: Date;
          ortText: string | null;
          onlineLink: string | null;
        };
      };

  const outcome = await db.transaction(async (tx): Promise<TxOutcome> => {
    const terminRows = await tx.execute<{
      id: string;
      titel: string;
      typ: string;
      datum_uhrzeit: Date;
      ort_text: string | null;
      online_link: string | null;
    }>(sql`
      SELECT id, titel, typ, datum_uhrzeit, ort_text, online_link
        FROM termin
       WHERE id = ${terminId}
       FOR UPDATE
    `);
    const terminRow = terminRows[0];
    if (!terminRow) return { kind: 'not_found' };

    const eigeneRows = await tx
      .select()
      .from(terminAnmeldung)
      .where(
        and(
          eq(terminAnmeldung.terminId, terminId),
          eq(terminAnmeldung.nutzerId, sess.nutzerId),
        ),
      )
      .limit(1);
    const eigene = eigeneRows[0];
    if (!eigene) return { kind: 'not_found' };
    if (eigene.status === 'storniert') return { kind: 'bereits_storniert' };

    const warVollerSlot = eigene.status === 'angemeldet';

    await tx
      .update(terminAnmeldung)
      .set({ status: 'storniert' })
      .where(eq(terminAnmeldung.id, eigene.id));

    if (!warVollerSlot) {
      return { kind: 'ok', hochgerueckt: null };
    }

    const warteRows = await tx.execute<{
      id: string;
      nutzer_id: string;
      email: string;
    }>(sql`
      SELECT ta.id, ta.nutzer_id, n.email
        FROM termin_anmeldung ta
        JOIN nutzer n ON n.id = ta.nutzer_id
       WHERE ta.termin_id = ${terminId}
         AND ta.status = 'warteliste'
       ORDER BY ta.erstellt_am ASC, ta.id ASC
       LIMIT 1
       FOR UPDATE OF ta
    `);
    const warte = warteRows[0];
    if (!warte) return { kind: 'ok', hochgerueckt: null };

    await tx
      .update(terminAnmeldung)
      .set({ status: 'angemeldet' })
      .where(eq(terminAnmeldung.id, warte.id));

    const datum =
      terminRow.datum_uhrzeit instanceof Date
        ? terminRow.datum_uhrzeit
        : new Date(terminRow.datum_uhrzeit);

    return {
      kind: 'ok',
      hochgerueckt: {
        email: warte.email,
        nutzerId: warte.nutzer_id,
        terminTitel: terminRow.titel,
        terminTyp: terminRow.typ,
        datumUhrzeit: datum,
        ortText: terminRow.ort_text,
        onlineLink: terminRow.online_link,
      },
    };
  });

  if (outcome.kind === 'not_found') notFound();
  if (outcome.kind === 'bereits_storniert') {
    redirect(`/termine/${terminId}?fehler=bereits_storniert`);
  }

  if (outcome.hochgerueckt) {
    const h = outcome.hochgerueckt;
    try {
      await sendMail({
        to: h.email,
        nutzerId: h.nutzerId,
        template: 'T-401',
        props: {
          terminTitel: h.terminTitel,
          terminTyp: TERMIN_TYP_LABEL_MAIL[h.terminTyp] ?? h.terminTyp,
          terminDatum: formatMailDatum(h.datumUhrzeit),
          terminUhrzeit: formatMailUhrzeit(h.datumUhrzeit),
          ...(h.ortText ? { ortText: h.ortText } : {}),
          ...(h.onlineLink ? { onlineLink: h.onlineLink } : {}),
          terminUrl: `${APP_URL}/termine/${terminId}`,
          icalUrl: `${APP_URL}/api/v1/termine/${terminId}/ical`,
          slotPosition: 'angemeldet',
        },
      });
    } catch (err) {
      console.error('[termin-stornieren] sendMail T-401 hochgerueckt:', err);
    }
  }

  try {
    await db.insert(auditLog).values({
      nutzerId: sess.nutzerId,
      aktion: 'termin.storniert',
      referenzTyp: 'termin',
      referenzId: terminId,
    });
  } catch {
    /* ignore */
  }

  revalidatePath(`/termine/${terminId}`);
  redirect(`/termine/${terminId}?erfolg=storniert`);
}

export async function terminVeroeffentlichenAction(
  terminId: string,
): Promise<void> {
  'use server';

  const req = await buildRequestFromHeaders(`/termine/${terminId}`);
  const sess = await getSessionFromRequest(req);
  if (!sess) {
    redirect(`/anmelden?next=/termine/${terminId}`);
  }

  const row = await ladeTermin(terminId);
  if (!row) notFound();
  const erlaubt = await istKuratorVon(sess.nutzerId, row.stadtId);
  if (!erlaubt) {
    redirect(`/termine/${terminId}?fehler=kein_zugriff`);
  }
  if (row.status !== 'geplant') {
    redirect(`/termine/${terminId}?fehler=falscher_status`);
  }

  await db
    .update(termin)
    .set({ status: 'veroeffentlicht', aktualisiertAm: new Date() })
    .where(eq(termin.id, terminId));

  try {
    await db.insert(auditLog).values({
      nutzerId: sess.nutzerId,
      aktion: 'termin.veroeffentlicht',
      referenzTyp: 'termin',
      referenzId: terminId,
    });
  } catch {
    /* ignore */
  }

  revalidatePath(`/termine/${terminId}`);
  redirect(`/termine/${terminId}?erfolg=veroeffentlicht`);
}

export async function terminAbsagenAction(terminId: string): Promise<void> {
  'use server';

  const req = await buildRequestFromHeaders(`/termine/${terminId}`);
  const sess = await getSessionFromRequest(req);
  if (!sess) {
    redirect(`/anmelden?next=/termine/${terminId}`);
  }

  const row = await ladeTermin(terminId);
  if (!row) notFound();
  const erlaubt = await istKuratorVon(sess.nutzerId, row.stadtId);
  if (!erlaubt) {
    redirect(`/termine/${terminId}?fehler=kein_zugriff`);
  }
  if (row.status !== 'veroeffentlicht') {
    redirect(`/termine/${terminId}?fehler=falscher_status`);
  }

  // Empfaenger fuer T-404
  const empfaenger = await db
    .select({
      nutzerId: nutzer.id,
      email: nutzer.email,
    })
    .from(terminAnmeldung)
    .innerJoin(nutzer, eq(nutzer.id, terminAnmeldung.nutzerId))
    .where(
      and(
        eq(terminAnmeldung.terminId, terminId),
        inArray(terminAnmeldung.status, ['angemeldet', 'warteliste']),
      ),
    );

  await db
    .update(termin)
    .set({ status: 'abgesagt', aktualisiertAm: new Date() })
    .where(eq(termin.id, terminId));

  const typLabel = TERMIN_TYP_LABEL_MAIL[row.typ] ?? row.typ;
  const datumStr = formatMailDatum(row.datumUhrzeit);
  for (const e of empfaenger) {
    try {
      await sendMail({
        to: e.email,
        nutzerId: e.nutzerId,
        template: 'T-404',
        props: {
          terminTitel: row.titel,
          terminTyp: typLabel,
          terminDatum: datumStr,
        },
      });
    } catch (err) {
      console.error('[termin-absagen] sendMail T-404:', err);
    }
  }

  try {
    await db.insert(auditLog).values({
      nutzerId: sess.nutzerId,
      aktion: 'termin.abgesagt',
      referenzTyp: 'termin',
      referenzId: terminId,
      metadaten: { benachrichtigt: empfaenger.length },
    });
  } catch {
    /* ignore */
  }

  revalidatePath(`/termine/${terminId}`);
  redirect(`/termine/${terminId}?erfolg=abgesagt`);
}

export async function terminDurchgefuehrtAction(
  terminId: string,
): Promise<void> {
  'use server';

  const req = await buildRequestFromHeaders(`/termine/${terminId}`);
  const sess = await getSessionFromRequest(req);
  if (!sess) {
    redirect(`/anmelden?next=/termine/${terminId}`);
  }

  const row = await ladeTermin(terminId);
  if (!row) notFound();
  const erlaubt = await istKuratorVon(sess.nutzerId, row.stadtId);
  if (!erlaubt) {
    redirect(`/termine/${terminId}?fehler=kein_zugriff`);
  }
  if (row.status !== 'veroeffentlicht') {
    redirect(`/termine/${terminId}?fehler=falscher_status`);
  }
  if (row.datumUhrzeit.getTime() >= Date.now()) {
    redirect(`/termine/${terminId}?fehler=termin_in_zukunft`);
  }

  await db
    .update(termin)
    .set({ status: 'durchgefuehrt', aktualisiertAm: new Date() })
    .where(eq(termin.id, terminId));

  try {
    await db.insert(auditLog).values({
      nutzerId: sess.nutzerId,
      aktion: 'termin.durchgefuehrt',
      referenzTyp: 'termin',
      referenzId: terminId,
    });
  } catch {
    /* ignore */
  }

  revalidatePath(`/termine/${terminId}`);
  redirect(`/termine/${terminId}?erfolg=durchgefuehrt`);
}

/* ─────────────────────  Page  ───────────────────── */

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { id } = await params;
  const row = await ladeTermin(id);
  if (!row || row.status === 'geplant') {
    return { title: 'Nicht gefunden', robots: { index: false, follow: false } };
  }
  return {
    title: `${row.titel} — Termin`,
    description: row.beschreibung.slice(0, 200),
  };
}

export default async function TerminDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const sp = await searchParams;

  const req = await buildRequestFromHeaders(`/termine/${id}`);
  const sess = await getSessionFromRequest(req).catch(() => null);

  const row = await ladeTermin(id);
  if (!row) notFound();

  const istKurator = sess
    ? await istKuratorVon(sess.nutzerId, row.stadtId)
    : false;
  if (row.status === 'geplant' && !istKurator) notFound();

  const [angemeldet, warteliste] = await Promise.all([
    zaehleAngemeldet(id),
    zaehleWarteliste(id),
  ]);

  // Bei Briefing Night: verknuepfte Bedarfe und Foerderprofile fuer die UI laden.
  type BedarfBezugUI = Awaited<ReturnType<typeof ladeBedarfBezuege>>[number];
  type FoerderprofilBezugUI = Awaited<
    ReturnType<typeof ladeFoerderprofilBezuege>
  >[number];
  let bedarfBezuege: BedarfBezugUI[] = [];
  let foerderprofilBezuege: FoerderprofilBezugUI[] = [];
  if (row.typ === 'bedarfsschau') {
    [bedarfBezuege, foerderprofilBezuege] = await Promise.all([
      ladeBedarfBezuege(id),
      ladeFoerderprofilBezuege(id),
    ]);
  }

  const eigeneAnmeldung = sess
    ? await ladeEigeneAnmeldung(id, sess.nutzerId)
    : null;

  // Persönliche Wartelisten-Position (nur wenn auf der Warteliste).
  const eigeneWartelistenPosition =
    sess && eigeneAnmeldung?.status === 'warteliste'
      ? await berechneWartelistenPosition(id, sess.nutzerId)
      : null;

  const istVergangen = row.datumUhrzeit.getTime() < Date.now();
  const istAbgesagt = row.status === 'abgesagt';
  const istDurchgefuehrt = row.status === 'durchgefuehrt';
  const istVeroeffentlicht = row.status === 'veroeffentlicht';
  const slotsFrei = angemeldet < row.maxTeilnehmer;

  const beschreibungHtml = renderPruefrundeMarkdown(row.beschreibung);

  // Server-Actions an die ID binden.
  const anmeldenBound = terminAnmeldenAction.bind(null, id);
  const stornierenBound = terminStornierenAction.bind(null, id);
  const veroeffentlichenBound = terminVeroeffentlichenAction.bind(null, id);
  const absagenBound = terminAbsagenAction.bind(null, id);
  const durchgefuehrtBound = terminDurchgefuehrtAction.bind(null, id);

  // JSON-LD Event-Schema (PRD §31)
  const eventJsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: row.titel,
    description: row.beschreibung.slice(0, 500),
    startDate: row.datumUhrzeit.toISOString(),
    eventStatus:
      row.status === 'abgesagt'
        ? 'https://schema.org/EventCancelled'
        : 'https://schema.org/EventScheduled',
    eventAttendanceMode: row.onlineLink
      ? row.ortText
        ? 'https://schema.org/MixedEventAttendanceMode'
        : 'https://schema.org/OnlineEventAttendanceMode'
      : 'https://schema.org/OfflineEventAttendanceMode',
    organizer: {
      '@type': 'Organization',
      name: 'Werkzirkel',
      url: APP_URL,
    },
    location: row.ortText
      ? {
          '@type': 'Place',
          name: row.ortText,
          address: row.ortText,
        }
      : row.onlineLink
        ? {
            '@type': 'VirtualLocation',
            url: row.onlineLink,
          }
        : undefined,
    url: `${APP_URL}/termine/${id}`,
    maximumAttendeeCapacity: row.maxTeilnehmer,
  };

  return (
    <div className="page-shell">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(eventJsonLd) }}
      />
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
            <Link href="/pruefrunden">{tnav.nav_pruefrunden}</Link>
            <Link href="/termine" aria-current="page">
              {tnav.nav_termine}
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
            <h1>{row.titel}</h1>
            <div
              style={{
                display: 'flex',
                gap: 8,
                marginTop: 12,
                flexWrap: 'wrap',
              }}
            >
              <span className="status-pill">{terminTypLabel(row.typ)}</span>
              <span
                style={{
                  color: 'var(--muted)',
                  fontSize: 14,
                  fontWeight: 600,
                  alignSelf: 'center',
                }}
              >
                {formatDatumZeit(row.datumUhrzeit)}
              </span>
              <span className="status-pill warm">
                {terminStatusLabel(row.status)}
              </span>
            </div>
          </div>
        </div>
      </header>

      <section className="section product-section">
        <div className="wrap product-split">
          <div>
            <ErfolgBanner code={sp.erfolg} />
            <FehlerBanner code={sp.fehler} />

            {istAbgesagt ? (
              <div
                role="alert"
                className="callout"
                style={{
                  marginBottom: 24,
                  padding: '14px 16px',
                  borderRadius: 10,
                  border: '1px solid #d04848',
                  background: '#fbeaea',
                  color: '#5a1a1a',
                }}
              >
                <strong>{td.banner_abgesagt}</strong>
              </div>
            ) : null}

            <h2 style={{ fontSize: 28, marginTop: 12 }}>
              {td.sektion_was_passiert}
            </h2>
            <div
              className="md-content"
              style={{ marginTop: 12, color: 'var(--fg)', lineHeight: 1.55 }}
              dangerouslySetInnerHTML={{ __html: beschreibungHtml }}
            />

            <h2 style={{ fontSize: 24, marginTop: 32 }}>{td.sektion_ort}</h2>
            <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
              {row.ortText ? (
                <p style={{ margin: 0 }}>{row.ortText}</p>
              ) : null}
              {row.onlineLink ? (
                <p style={{ margin: 0 }}>
                  <a
                    href={row.onlineLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--fg)' }}
                  >
                    {td.ort_online_label}
                  </a>
                </p>
              ) : null}
            </div>

            {row.typ === 'bedarfsschau' ? (
              <>
                <h2 style={{ fontSize: 24, marginTop: 32 }}>
                  {de.termine.bedarfsschau.sektion_bedarfe_titel}
                </h2>
                {bedarfBezuege.length === 0 ? (
                  <p style={{ margin: '8px 0 0', color: 'var(--muted)' }}>
                    {de.termine.bedarfsschau.sektion_bedarfe_leer}
                  </p>
                ) : (
                  <ul
                    style={{
                      listStyle: 'none',
                      margin: '12px 0 0',
                      padding: 0,
                      display: 'grid',
                      gap: 10,
                    }}
                  >
                    {bedarfBezuege.map((b) => {
                      const bb = b.bedarf as Record<string, unknown>;
                      const bId = String(bb.id);
                      return (
                        <li
                          key={b.bezug_id}
                          className="work-card"
                          style={{ padding: '12px 14px' }}
                        >
                          <strong>{String(bb.titel)}</strong>
                          <br />
                          <span
                            style={{
                              color: 'var(--muted)',
                              fontSize: 13,
                            }}
                          >
                            {String(bb.organisation)}
                          </span>
                          {sess ? (
                            <div style={{ marginTop: 6 }}>
                              <Link
                                href={`/bedarfe/${bId}`}
                                style={{
                                  fontSize: 13,
                                  color: 'var(--fg)',
                                }}
                              >
                                Bedarf ansehen →
                              </Link>
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}

                <h2 style={{ fontSize: 24, marginTop: 32 }}>
                  {de.termine.bedarfsschau.sektion_foerderprofile_titel}
                </h2>
                {foerderprofilBezuege.length === 0 ? (
                  <p style={{ margin: '8px 0 0', color: 'var(--muted)' }}>
                    {de.termine.bedarfsschau.sektion_foerderprofile_leer}
                  </p>
                ) : (
                  <ul
                    style={{
                      listStyle: 'none',
                      margin: '12px 0 0',
                      padding: 0,
                      display: 'grid',
                      gap: 10,
                    }}
                  >
                    {foerderprofilBezuege.map((f) => {
                      const fp = f.foerderprofil as Record<string, unknown>;
                      const fId = String(fp.id);
                      const equity =
                        fp.gegenleistung_typ === 'equity_offline';
                      return (
                        <li
                          key={f.bezug_id}
                          className="work-card"
                          style={{ padding: '12px 14px' }}
                        >
                          <strong>{String(fp.organisation)}</strong>
                          <br />
                          <span
                            style={{
                              color: 'var(--muted)',
                              fontSize: 13,
                            }}
                          >
                            {String(fp.foerderart)}
                          </span>
                          {equity ? (
                            <p
                              style={{
                                margin: '8px 0 0',
                                fontSize: 12,
                                color: 'var(--muted)',
                                fontStyle: 'italic',
                              }}
                            >
                              {EQUITY_HINWEISTEXT}
                            </p>
                          ) : null}
                          {sess ? (
                            <div style={{ marginTop: 6 }}>
                              <Link
                                href={`/foerderprofile/${fId}`}
                                style={{
                                  fontSize: 13,
                                  color: 'var(--fg)',
                                }}
                              >
                                Sponsor-Profil ansehen →
                              </Link>
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </>
            ) : null}
          </div>

          <aside aria-label="Aktionen" style={{ display: 'grid', gap: 16 }}>
            <article className="work-card">
              <div className="work-body">
                <p
                  style={{
                    margin: 0,
                    color: 'var(--muted)',
                    fontSize: 13,
                  }}
                >
                  {td.teilnehmer_counter(angemeldet, row.maxTeilnehmer)}
                </p>
                {warteliste > 0 ? (
                  <p
                    style={{
                      margin: '4px 0 0',
                      color: 'var(--muted)',
                      fontSize: 13,
                    }}
                  >
                    {td.warteliste_counter(warteliste)}
                  </p>
                ) : null}

                <div style={{ marginTop: 14 }}>
                  <ActionContent
                    terminId={id}
                    terminStatus={row.status}
                    istVergangen={istVergangen}
                    istAbgesagt={istAbgesagt}
                    istDurchgefuehrt={istDurchgefuehrt}
                    istVeroeffentlicht={istVeroeffentlicht}
                    slotsFrei={slotsFrei}
                    eigeneAnmeldung={eigeneAnmeldung}
                    eigeneWartelistenPosition={eigeneWartelistenPosition}
                    angemeldet={!!sess}
                    anmeldenAction={anmeldenBound}
                    stornierenAction={stornierenBound}
                  />
                </div>
              </div>
            </article>

            {istKurator ? (
              <article className="work-card">
                <div className="work-body">
                  <p className="eyebrow" style={{ margin: 0 }}>
                    {td.verwalten_titel}
                  </p>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      marginTop: 12,
                    }}
                  >
                    <Link
                      className="button secondary"
                      href={`/kurator/termine/${id}/bearbeiten`}
                    >
                      {td.verwalten_bearbeiten}
                    </Link>
                    {row.status === 'geplant' ? (
                      <form action={veroeffentlichenBound}>
                        <button type="submit" className="button primary">
                          {td.verwalten_veroeffentlichen}
                        </button>
                      </form>
                    ) : null}
                    {row.status === 'veroeffentlicht' ? (
                      <form action={absagenBound}>
                        <button type="submit" className="button secondary">
                          {td.verwalten_absagen}
                        </button>
                      </form>
                    ) : null}
                    {row.status === 'veroeffentlicht' && istVergangen ? (
                      <form action={durchgefuehrtBound}>
                        <button type="submit" className="button primary">
                          {td.verwalten_durchgefuehrt}
                        </button>
                      </form>
                    ) : null}
                    {(row.status === 'durchgefuehrt' || istVergangen) &&
                    row.status !== 'abgesagt' &&
                    row.status !== 'geplant' ? (
                      <Link
                        className="button secondary"
                        href={`/kurator/termine/${id}/anwesenheit`}
                      >
                        {td.verwalten_anwesenheit}
                      </Link>
                    ) : null}
                  </div>
                </div>
              </article>
            ) : null}
          </aside>
        </div>
      </section>
    </div>
  );
}

interface ActionContentProps {
  terminId: string;
  terminStatus: TerminStatus;
  istVergangen: boolean;
  istAbgesagt: boolean;
  istDurchgefuehrt: boolean;
  istVeroeffentlicht: boolean;
  slotsFrei: boolean;
  eigeneAnmeldung: {
    status: TerminAnmeldungStatus;
  } | null;
  eigeneWartelistenPosition: number | null;
  angemeldet: boolean;
  anmeldenAction: () => Promise<void>;
  stornierenAction: () => Promise<void>;
}

function ActionContent(props: ActionContentProps) {
  const {
    terminId,
    istAbgesagt,
    istDurchgefuehrt,
    istVergangen,
    istVeroeffentlicht,
    slotsFrei,
    eigeneAnmeldung,
    eigeneWartelistenPosition,
    angemeldet,
    anmeldenAction,
    stornierenAction,
  } = props;

  if (!angemeldet) {
    return (
      <Link
        className="button primary"
        href={`/anmelden?next=/termine/${terminId}`}
      >
        {td.action_anonym}
      </Link>
    );
  }

  if (istAbgesagt) {
    return null;
  }

  if (istDurchgefuehrt || (istVergangen && !eigeneAnmeldung)) {
    return (
      <p style={{ margin: 0, color: 'var(--muted)' }}>{td.action_vorbei}</p>
    );
  }

  if (eigeneAnmeldung) {
    const s = eigeneAnmeldung.status;
    if (s === 'angemeldet') {
      return (
        <>
          <p style={{ margin: 0 }}>
            <strong>{td.action_du_angemeldet}</strong>
          </p>
          <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
            <a
              className="button secondary"
              href={`/api/v1/termine/${terminId}/ical`}
            >
              {td.action_ical}
            </a>
            <form action={stornierenAction}>
              <button type="submit" className="button secondary">
                {td.action_storniert}
              </button>
            </form>
          </div>
        </>
      );
    }
    if (s === 'warteliste') {
      return (
        <>
          <p style={{ margin: 0 }}>
            <strong>{td.action_du_warteliste}</strong>
          </p>
          {eigeneWartelistenPosition !== null ? (
            <p
              style={{
                margin: '6px 0 0',
                fontSize: 14,
                color: 'var(--muted)',
              }}
            >
              Position {eigeneWartelistenPosition} auf der Warteliste — du
              rückst automatisch nach, sobald ein Platz frei wird.
            </p>
          ) : null}
          <div style={{ marginTop: 12 }}>
            <form action={stornierenAction}>
              <button type="submit" className="button secondary">
                {td.action_storniert}
              </button>
            </form>
          </div>
        </>
      );
    }
    if (s === 'anwesend') {
      return <p style={{ margin: 0 }}>{td.action_du_anwesend}</p>;
    }
    if (s === 'nicht_anwesend') {
      return <p style={{ margin: 0 }}>{td.action_du_nicht_anwesend}</p>;
    }
    // 'storniert' → fall through zu neuer Anmeldung
  }

  if (!istVeroeffentlicht) {
    return null;
  }

  if (slotsFrei) {
    return (
      <form action={anmeldenAction}>
        <button type="submit" className="button primary">
          {td.action_anmelden}
        </button>
      </form>
    );
  }
  return (
    <form action={anmeldenAction}>
      <button type="submit" className="button secondary">
        {td.action_warteliste}
      </button>
    </form>
  );
}

function ErfolgBanner({ code }: { code?: string }) {
  if (!code) return null;
  const text =
    code === 'angemeldet'
      ? 'Du bist angemeldet. Du erhältst eine Bestätigung per E-Mail.'
      : code === 'warteliste'
        ? 'Du stehst auf der Warteliste. Wir benachrichtigen dich, wenn ein Platz frei wird.'
        : code === 'storniert'
          ? 'Deine Anmeldung wurde storniert.'
          : code === 'veroeffentlicht'
            ? 'Termin veröffentlicht.'
            : code === 'abgesagt'
              ? 'Termin abgesagt. Angemeldete Personen wurden benachrichtigt.'
              : code === 'durchgefuehrt'
                ? 'Termin als durchgeführt markiert.'
                : null;
  if (!text) return null;
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
    code === 'falscher_status'
      ? de.termine.fehler.falscher_status
      : code === 'termin_vergangen'
        ? de.termine.fehler.termin_vergangen
        : code === 'bereits_storniert'
          ? de.termine.fehler.bereits_storniert
          : code === 'voll'
            ? de.termine.fehler.voll
            : code === 'kein_zugriff'
              ? de.fehler.nicht_berechtigt
              : code === 'termin_in_zukunft'
                ? 'Ein Termin kann erst nach seinem Datum als durchgeführt markiert werden.'
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
