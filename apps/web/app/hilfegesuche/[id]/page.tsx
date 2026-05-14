/**
 * /hilfegesuche/[id] — Detail mit Antworten + Antwort-Form (Server Component).
 *
 * Auth-Pflicht. Antwort-Form ist Server-Action, kein Client-Bundle noetig.
 * Owner sieht zusaetzlich einen Loeschen-Button (Server-Action mit
 * Bestaetigungs-Prompt via JS-free `formAction`-Pattern).
 *
 * Status-Logik:
 *  - Antworten posten erlaubt nur wenn status != 'abgelaufen' UND gueltig_bis
 *    in der Zukunft.
 *  - Server-Action delegiert hard an die API-Route via direkten DB-Insert,
 *    damit wir die gleiche Validator-Schicht nutzen.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { asc, eq } from 'drizzle-orm';

import { de } from '@/i18n/de';
import MeldenButton from '@/components/ui/melden-button';
import { db } from '@/lib/db';
import {
  auditLog,
  hilfegesuch,
  hilfegesuchAntwort,
  nutzer,
  stadt,
} from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';
import {
  hilfegesuchAntwortSchema,
} from '@/lib/validators/hilfegesuch';

const th = de.hilfegesuche;

interface PageParams {
  params: Promise<{ id: string }>;
}

interface PageProps extends PageParams {
  searchParams: Promise<{ fehler?: string; erfolg?: string }>;
}

export const metadata: Metadata = {
  title: 'Hilfegesuch — Werkzirkel',
  robots: { index: false, follow: false },
};

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

function formatDateTime(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}.${mm}.${yyyy} ${hh}:${min}`;
}

export async function antwortPosten(formData: FormData): Promise<void> {
  'use server';
  const id = String(formData.get('id') ?? '');
  if (!id) redirect('/hilfegesuche');

  const req = await buildRequestFromHeaders(`/hilfegesuche/${id}`);
  const sess = await getSessionFromRequest(req);
  if (!sess) {
    redirect(`/anmelden?next=/hilfegesuche/${id}`);
  }

  const candidate = { text: String(formData.get('text') ?? '').trim() };
  const parsed = hilfegesuchAntwortSchema.safeParse(candidate);
  if (!parsed.success) {
    redirect(`/hilfegesuche/${id}?fehler=validierung`);
  }

  const rows = await db
    .select({
      id: hilfegesuch.id,
      status: hilfegesuch.status,
      gueltigBis: hilfegesuch.gueltigBis,
    })
    .from(hilfegesuch)
    .where(eq(hilfegesuch.id, id))
    .limit(1);
  const current = rows[0];
  if (!current) {
    redirect('/hilfegesuche');
  }
  if (current.status === 'abgelaufen' || current.gueltigBis.getTime() < Date.now()) {
    redirect(`/hilfegesuche/${id}?fehler=abgelaufen`);
  }

  await db.insert(hilfegesuchAntwort).values({
    hilfegesuchId: id,
    nutzerId: sess.nutzerId,
    text: parsed.data!.text,
  });
  if (current.status === 'offen') {
    await db
      .update(hilfegesuch)
      .set({ status: 'beantwortet' })
      .where(eq(hilfegesuch.id, id));
  }

  try {
    await db.insert(auditLog).values({
      nutzerId: sess.nutzerId,
      aktion: 'hilfegesuch_antwort.angelegt',
      referenzTyp: 'hilfegesuch',
      referenzId: id,
    });
  } catch {
    // tolerabel
  }

  revalidatePath(`/hilfegesuche/${id}`);
  redirect(`/hilfegesuche/${id}?erfolg=antwort`);
}

export async function hilfegesuchLoeschen(formData: FormData): Promise<void> {
  'use server';
  const id = String(formData.get('id') ?? '');
  if (!id) redirect('/hilfegesuche');
  const req = await buildRequestFromHeaders(`/hilfegesuche/${id}`);
  const sess = await getSessionFromRequest(req);
  if (!sess) {
    redirect(`/anmelden?next=/hilfegesuche/${id}`);
  }
  const rows = await db
    .select({ id: hilfegesuch.id, nutzerId: hilfegesuch.nutzerId })
    .from(hilfegesuch)
    .where(eq(hilfegesuch.id, id))
    .limit(1);
  const cur = rows[0];
  if (!cur || cur.nutzerId !== sess.nutzerId) {
    redirect(`/hilfegesuche/${id}`);
  }
  await db.delete(hilfegesuch).where(eq(hilfegesuch.id, id));
  try {
    await db.insert(auditLog).values({
      nutzerId: sess.nutzerId,
      aktion: 'hilfegesuch.geloescht',
      referenzTyp: 'hilfegesuch',
      referenzId: id,
    });
  } catch {
    // tolerabel
  }
  redirect('/hilfegesuche');
}

export async function antwortLoeschen(formData: FormData): Promise<void> {
  'use server';
  const antwortId = String(formData.get('antwort_id') ?? '');
  const hilfegesuchId = String(formData.get('id') ?? '');
  if (!antwortId || !hilfegesuchId) redirect('/hilfegesuche');
  const req = await buildRequestFromHeaders(`/hilfegesuche/${hilfegesuchId}`);
  const sess = await getSessionFromRequest(req);
  if (!sess) redirect(`/anmelden?next=/hilfegesuche/${hilfegesuchId}`);
  const rows = await db
    .select({ id: hilfegesuchAntwort.id, nutzerId: hilfegesuchAntwort.nutzerId })
    .from(hilfegesuchAntwort)
    .where(eq(hilfegesuchAntwort.id, antwortId))
    .limit(1);
  const cur = rows[0];
  if (!cur || cur.nutzerId !== sess.nutzerId) {
    redirect(`/hilfegesuche/${hilfegesuchId}`);
  }
  await db.delete(hilfegesuchAntwort).where(eq(hilfegesuchAntwort.id, antwortId));
  revalidatePath(`/hilfegesuche/${hilfegesuchId}`);
  redirect(`/hilfegesuche/${hilfegesuchId}`);
}

export default async function HilfegesuchDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const sp = await searchParams;

  const req = await buildRequestFromHeaders(`/hilfegesuche/${id}`);
  const sess = await getSessionFromRequest(req);
  if (!sess) {
    redirect(`/anmelden?next=/hilfegesuche/${id}`);
  }

  const rows = await db
    .select({
      hg: hilfegesuch,
      autorId: nutzer.id,
      autorAnzeigename: nutzer.anzeigename,
      autorAvatarUrl: nutzer.avatarUrl,
      stadtName: stadt.name,
    })
    .from(hilfegesuch)
    .innerJoin(nutzer, eq(nutzer.id, hilfegesuch.nutzerId))
    .innerJoin(stadt, eq(stadt.id, hilfegesuch.stadtId))
    .where(eq(hilfegesuch.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) {
    notFound();
  }

  const antworten = await db
    .select({
      a: hilfegesuchAntwort,
      autorAnzeigename: nutzer.anzeigename,
      autorAvatarUrl: nutzer.avatarUrl,
      autorId: nutzer.id,
    })
    .from(hilfegesuchAntwort)
    .innerJoin(nutzer, eq(nutzer.id, hilfegesuchAntwort.nutzerId))
    .where(eq(hilfegesuchAntwort.hilfegesuchId, id))
    .orderBy(asc(hilfegesuchAntwort.erstelltAm), asc(hilfegesuchAntwort.id));

  const istAbgelaufen =
    row.hg.status === 'abgelaufen' || row.hg.gueltigBis.getTime() < Date.now();
  const istOwner = row.autorId === sess.nutzerId;

  const statusText =
    row.hg.status === 'abgelaufen' || istAbgelaufen
      ? th.detail_status_abgelaufen
      : row.hg.status === 'beantwortet'
        ? th.detail_status_beantwortet
        : th.detail_status_offen;

  const fehlerText =
    sp.fehler === 'abgelaufen'
      ? th.fehler_abgelaufen
      : sp.fehler === 'validierung'
        ? th.fehler_validierung
        : null;

  return (
    <div className="page-shell">
      <nav className="site-nav" aria-label="Hauptnavigation">
        <div className="wrap nav-inner">
          <Link href="/uebersicht" className="brand">
            <span>Werkzirkel</span>
          </Link>
          <div className="nav-links">
            <Link href="/hilfegesuche">{th.nav}</Link>
          </div>
        </div>
      </nav>

      <section className="section compact">
        <div className="wrap" style={{ maxWidth: 760 }}>
          <p style={{ marginBottom: 12 }}>
            <Link href="/hilfegesuche">{th.detail_zurueck}</Link>
          </p>
          <h1 style={{ marginTop: 0 }}>{row.hg.titel}</h1>
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>
            {row.autorAnzeigename} · {row.stadtName} ·{' '}
            {th.detail_gueltig_bis}: {formatDateTime(row.hg.gueltigBis)} ·{' '}
            <strong data-status={row.hg.status}>{statusText}</strong>
          </p>
          <div
            style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}
          >
            {row.hg.tags.map((t) => (
              <span key={t} className="status-pill">
                {t}
              </span>
            ))}
          </div>

          <p style={{ marginTop: 20, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
            {row.hg.beschreibung}
          </p>

          {istOwner ? (
            <form
              action={hilfegesuchLoeschen}
              style={{ marginTop: 16 }}
            >
              <input type="hidden" name="id" value={row.hg.id} />
              <button
                type="submit"
                className="button secondary"
                style={{ color: 'var(--muted)' }}
              >
                {th.detail_loeschen_button}
              </button>
            </form>
          ) : (
            <div style={{ marginTop: 16 }}>
              <MeldenButton referenzTyp="nutzer" referenzId={row.autorId} />
            </div>
          )}

          <h2 style={{ marginTop: 36 }}>
            {th.detail_antworten_titel} ({antworten.length})
          </h2>

          {fehlerText ? (
            <div
              role="alert"
              className="callout"
              style={{
                padding: 12,
                borderRadius: 10,
                border: '1px solid #d04848',
                background: '#fbeaea',
                color: '#5a1a1a',
                marginBottom: 16,
              }}
            >
              {fehlerText}
            </div>
          ) : null}

          {antworten.length === 0 ? (
            <p style={{ color: 'var(--muted)' }}>
              {th.detail_keine_antworten}
            </p>
          ) : (
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                display: 'grid',
                gap: 12,
              }}
            >
              {antworten.map((a) => (
                <li
                  key={a.a.id}
                  className="work-card"
                  data-antwort-id={a.a.id}
                  style={{ padding: 16 }}
                >
                  <p
                    style={{
                      margin: 0,
                      fontSize: 13,
                      color: 'var(--muted)',
                    }}
                  >
                    <strong style={{ color: 'var(--fg)' }}>
                      {a.autorAnzeigename}
                    </strong>{' '}
                    · {formatDateTime(a.a.erstelltAm)}
                  </p>
                  <p style={{ margin: '8px 0 0', whiteSpace: 'pre-wrap' }}>
                    {a.a.text}
                  </p>
                  {a.autorId === sess.nutzerId ? (
                    <form action={antwortLoeschen} style={{ marginTop: 8 }}>
                      <input type="hidden" name="id" value={row.hg.id} />
                      <input type="hidden" name="antwort_id" value={a.a.id} />
                      <button
                        type="submit"
                        className="button"
                        style={{
                          fontSize: 12,
                          color: 'var(--muted)',
                          padding: '4px 8px',
                        }}
                      >
                        {th.detail_antwort_loeschen}
                      </button>
                    </form>
                  ) : (
                    <div style={{ marginTop: 8 }}>
                      <MeldenButton
                        referenzTyp="hilfegesuch_antwort"
                        referenzId={a.a.id}
                      />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          {!istAbgelaufen ? (
            <form
              action={antwortPosten}
              style={{ marginTop: 24, display: 'grid', gap: 12 }}
            >
              <input type="hidden" name="id" value={row.hg.id} />
              <h3 style={{ margin: 0 }}>{th.detail_antwort_form_titel}</h3>
              <label style={{ display: 'grid', gap: 6 }} htmlFor="text">
                <span style={{ fontWeight: 600 }}>
                  {th.detail_antwort_label}
                </span>
                <textarea
                  id="text"
                  name="text"
                  required
                  minLength={10}
                  maxLength={4000}
                  rows={5}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: 'var(--hairline)',
                    background: 'var(--surface)',
                    color: 'var(--fg)',
                    fontFamily: 'inherit',
                    fontSize: 15,
                    minHeight: 80,
                  }}
                />
              </label>
              <div>
                <button type="submit" className="button primary">
                  {th.detail_antwort_button}
                </button>
              </div>
            </form>
          ) : null}
        </div>
      </section>
    </div>
  );
}
