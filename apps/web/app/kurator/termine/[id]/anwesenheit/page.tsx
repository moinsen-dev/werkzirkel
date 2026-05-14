/**
 * /kurator/termine/[id]/anwesenheit — Anwesenheit dokumentieren.
 *
 * Quelle: PRD §8.8, §F-401..§F-405.
 *
 * Auth + Kurator:in der Stadt (sonst 404). Liste aller Anmeldungen mit
 * Checkbox "anwesend". Default checked wenn Status bereits 'anwesend'.
 * Stornierte Anmeldungen werden NICHT angezeigt (PRD: storniert bleibt
 * storniert).
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { asc, eq, inArray } from 'drizzle-orm';

import { de } from '@/i18n/de';
import { db } from '@/lib/db';
import {
  auditLog,
  nutzer,
  termin,
  terminAnmeldung,
} from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';
import { istKuratorVon } from '@/lib/auth/permissions';
import { maybeCreateSchauabendBeitrag } from '@/lib/werkstattbeitrag/schauabend-hook';

const ta = de.termine.anwesenheit;
const tnav = de.uebersicht;

export const metadata: Metadata = {
  title: 'Anwesenheit dokumentieren',
  robots: { index: false, follow: false },
};

interface PageParams {
  params: Promise<{ id: string }>;
}

interface PageProps extends PageParams {
  searchParams: Promise<{ erfolg?: string; fehler?: string }>;
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

export async function anwesenheitSpeichernAction(
  terminId: string,
  formData: FormData,
): Promise<void> {
  'use server';

  const path = `/kurator/termine/${terminId}/anwesenheit`;
  const req = await buildRequestFromHeaders(path);
  const sess = await getSessionFromRequest(req);
  if (!sess) {
    redirect(`/anmelden?next=${path}`);
  }

  const terminRows = await db
    .select()
    .from(termin)
    .where(eq(termin.id, terminId))
    .limit(1);
  const terminRow = terminRows[0];
  if (!terminRow) notFound();

  const erlaubt = await istKuratorVon(sess.nutzerId, terminRow.stadtId);
  if (!erlaubt) notFound();

  const istVergangen = terminRow.datumUhrzeit.getTime() < Date.now();
  if (!istVergangen && terminRow.status !== 'durchgefuehrt') {
    redirect(`${path}?fehler=termin_in_zukunft`);
  }

  const anwesendIds = formData
    .getAll('anwesend')
    .map((v) => String(v))
    .filter(Boolean);
  const notizenRaw = formData.get('notizen_nach_termin');
  const notizen =
    typeof notizenRaw === 'string' ? notizenRaw.slice(0, 5000) : null;

  const anwesendSet = new Set(anwesendIds);

  type FreshAnwesend = { anmeldungId: string; nutzerId: string };

  const result = await db.transaction(async (tx) => {
    const alle = await tx
      .select({
        id: terminAnmeldung.id,
        nutzerId: terminAnmeldung.nutzerId,
        status: terminAnmeldung.status,
      })
      .from(terminAnmeldung)
      .where(eq(terminAnmeldung.terminId, terminId));

    const aktivIds: string[] = [];
    const echteAnwesendIds: string[] = [];
    const freshlyAnwesend: FreshAnwesend[] = [];
    for (const a of alle) {
      if (a.status === 'storniert') continue;
      aktivIds.push(a.id);
      if (anwesendSet.has(a.id)) {
        echteAnwesendIds.push(a.id);
        if (a.status !== 'anwesend') {
          freshlyAnwesend.push({ anmeldungId: a.id, nutzerId: a.nutzerId });
        }
      }
    }

    if (aktivIds.length > 0) {
      await tx
        .update(terminAnmeldung)
        .set({ status: 'nicht_anwesend' })
        .where(inArray(terminAnmeldung.id, aktivIds));
    }

    if (echteAnwesendIds.length > 0) {
      await tx
        .update(terminAnmeldung)
        .set({ status: 'anwesend' })
        .where(inArray(terminAnmeldung.id, echteAnwesendIds));
    }

    if (notizen !== null) {
      await tx
        .update(termin)
        .set({
          notizenNachTermin: notizen,
          aktualisiertAm: new Date(),
        })
        .where(eq(termin.id, terminId));
    }

    return {
      anwesendCount: echteAnwesendIds.length,
      nichtAnwesendCount: aktivIds.length - echteAnwesendIds.length,
      freshlyAnwesend,
    };
  });

  // Werkstattbeitrag-Hook ausserhalb der Transaktion.
  for (const fa of result.freshlyAnwesend) {
    try {
      await maybeCreateSchauabendBeitrag({
        nutzer_id: fa.nutzerId,
        termin_id: terminId,
        termin_typ: terminRow.typ,
      });
    } catch (err) {
      console.error(
        '[anwesenheit-action] maybeCreateSchauabendBeitrag failed:',
        err,
      );
    }
  }

  try {
    await db.insert(auditLog).values({
      nutzerId: sess.nutzerId,
      aktion: 'termin.anwesenheit_dokumentiert',
      referenzTyp: 'termin',
      referenzId: terminId,
      metadaten: {
        anwesend: result.anwesendCount,
        nicht_anwesend: result.nichtAnwesendCount,
        notizen_gesetzt: notizen !== null,
      },
    });
  } catch {
    /* ignore */
  }

  redirect(`${path}?erfolg=gespeichert`);
}

export default async function AnwesenheitPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const path = `/kurator/termine/${id}/anwesenheit`;

  const req = await buildRequestFromHeaders(path);
  const sess = await getSessionFromRequest(req);
  if (!sess) {
    redirect(`/anmelden?next=${path}`);
  }

  const terminRows = await db
    .select()
    .from(termin)
    .where(eq(termin.id, id))
    .limit(1);
  const terminRow = terminRows[0];
  if (!terminRow) notFound();

  const erlaubt = await istKuratorVon(sess.nutzerId, terminRow.stadtId);
  if (!erlaubt) notFound();

  const anmeldungen = await db
    .select({
      id: terminAnmeldung.id,
      status: terminAnmeldung.status,
      anzeigename: nutzer.anzeigename,
      avatarUrl: nutzer.avatarUrl,
    })
    .from(terminAnmeldung)
    .innerJoin(nutzer, eq(nutzer.id, terminAnmeldung.nutzerId))
    .where(eq(terminAnmeldung.terminId, id))
    .orderBy(asc(terminAnmeldung.erstelltAm));

  const sichtbar = anmeldungen.filter((a) => a.status !== 'storniert');

  const speichernBound = anwesenheitSpeichernAction.bind(null, id);

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
            <Link href="/uebersicht/termine" aria-current="page">
              {tnav.nav_termine}
            </Link>
          </div>
        </div>
      </nav>

      <header className="hero" id="top">
        <div className="wrap hero-grid single">
          <div>
            <p className="eyebrow">{ta.eyebrow}</p>
            <h1>{ta.titel}</h1>
            <p className="hero-copy">
              {terminRow.titel} · {ta.untertitel}
            </p>
            <div style={{ marginTop: 12 }}>
              <Link href={`/termine/${id}`} className="button secondary">
                {ta.zurueck_link}
              </Link>
            </div>
          </div>
        </div>
      </header>

      <section className="section compact">
        <div className="wrap" style={{ maxWidth: 760 }}>
          {sp.erfolg === 'gespeichert' ? (
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
              <strong>{ta.erfolg}</strong>
            </div>
          ) : null}

          {sp.fehler === 'termin_in_zukunft' ? (
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
              Anwesenheit kann erst nach dem Termin dokumentiert werden.
            </div>
          ) : null}

          {sichtbar.length === 0 ? (
            <article className="work-card">
              <div className="work-body">
                <p style={{ margin: 0, color: 'var(--muted)' }}>
                  {ta.keine_anmeldungen}
                </p>
              </div>
            </article>
          ) : (
            <form
              action={speichernBound}
              style={{ display: 'grid', gap: 16 }}
            >
              <ul
                aria-label="Anmeldungen"
                style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: 0,
                  display: 'grid',
                  gap: 8,
                }}
              >
                {sichtbar.map((a) => (
                  <li key={a.id}>
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '10px 14px',
                        borderRadius: 10,
                        border: 'var(--hairline)',
                        background: 'var(--surface)',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        name="anwesend"
                        value={a.id}
                        defaultChecked={a.status === 'anwesend'}
                      />
                      <span style={{ flex: 1 }}>{a.anzeigename}</span>
                      <span
                        className="status-pill"
                        style={{ fontSize: 11 }}
                      >
                        {anmeldungsStatusLabel(a.status)}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>

              <label style={{ display: 'grid', gap: 6 }} htmlFor="notizen">
                <span style={{ fontWeight: 600 }}>{ta.label_notizen}</span>
                <textarea
                  id="notizen"
                  name="notizen_nach_termin"
                  maxLength={5000}
                  rows={4}
                  defaultValue={terminRow.notizenNachTermin ?? ''}
                  style={textareaStyle}
                />
              </label>

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <button type="submit" className="button primary">
                  {ta.button_speichern}
                </button>
                <Link href={`/termine/${id}`} className="button secondary">
                  Abbrechen
                </Link>
              </div>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}

function anmeldungsStatusLabel(s: string): string {
  return (
    (de.termine.meine.anmeldung_status as Record<string, string>)[s] ?? s
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
  minHeight: 80,
};
