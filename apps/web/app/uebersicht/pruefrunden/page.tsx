/**
 * /uebersicht/pruefrunden — Eigene Pruefrunden (Server Component).
 *
 * Quelle: PRD §F-208, §17 (Reziprozitaet sichtbar).
 *
 * Drei Abschnitte:
 *  1. ROTER Verpflichtungs-Banner, wenn `offene_verpflichtung_anzahl > 0`.
 *  2. „Eigene gestartete Pruefrunden" — alle Status, Quick-Actions.
 *  3. „Als Tester:in angemeldet" — Anmeldungen mit Feedback-Link.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { desc, eq, inArray, sql } from 'drizzle-orm';

import { de } from '@/i18n/de';
import { db } from '@/lib/db';
import {
  nutzer,
  pruefrunde,
  pruefrundenAnmeldung,
  werk,
} from '@/lib/db/schema';
import {
  type PruefrundeStatus,
  type PruefrundeAnmeldungStatus,
} from '@/lib/db/schema/enums';
import { getSessionFromRequest } from '@/lib/auth/session';
import { getSaldoForUser } from '@/lib/reziprozitaet/saldo';

const tm = de.pruefrunden.meine;
const tnav = de.uebersicht;

export const metadata: Metadata = {
  title: 'Meine Feedback-Loops',
  robots: { index: false, follow: false },
};

interface PageProps {
  searchParams: Promise<{ erfolg?: string }>;
}

async function buildRequestFromHeaders(): Promise<Request> {
  const h = await headers();
  const headerInit: Record<string, string> = {};
  for (const [name, value] of h.entries()) {
    headerInit[name] = value;
  }
  return new Request('http://internal.werkzirkel/uebersicht/pruefrunden', {
    headers: headerInit,
  });
}

function formatFrist(d: Date | null): string {
  if (!d) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

function statusLabel(s: PruefrundeStatus): string {
  return (de.pruefrunden.status as Record<string, string>)[s] ?? s;
}

function anmeldungsStatusLabel(s: PruefrundeAnmeldungStatus): string {
  if (s === 'angemeldet') return 'angemeldet';
  if (s === 'feedback_gegeben') return 'Feedback gegeben';
  return 'zurückgezogen';
}

export default async function MeinePruefrundenPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const req = await buildRequestFromHeaders();
  const sess = await getSessionFromRequest(req);
  if (!sess) {
    redirect('/anmelden?next=/uebersicht/pruefrunden');
  }

  const saldo = await getSaldoForUser(sess.nutzerId);

  // Eigene Pruefrunden (alle Status) — JOIN werk fuer Werk-Namen.
  const eigene = await db
    .select({
      id: pruefrunde.id,
      titel: pruefrunde.titel,
      status: pruefrunde.status,
      frist: pruefrunde.frist,
      gesuchteTester: pruefrunde.gesuchteTester,
      werkId: werk.id,
      werkName: werk.name,
    })
    .from(pruefrunde)
    .innerJoin(werk, eq(werk.id, pruefrunde.werkId))
    .where(eq(werk.nutzerId, sess.nutzerId))
    .orderBy(desc(pruefrunde.aktualisiertAm));

  // Tester:innen-Counter pro Pruefrunde
  const eigeneIds = eigene.map((p) => p.id);
  const counterMap = new Map<string, number>();
  if (eigeneIds.length > 0) {
    const rows = await db
      .select({
        pruefrundeId: pruefrundenAnmeldung.pruefrundeId,
        anzahl: sql<number>`count(*)::int`,
      })
      .from(pruefrundenAnmeldung)
      .where(
        inArray(pruefrundenAnmeldung.pruefrundeId, eigeneIds),
      )
      .groupBy(pruefrundenAnmeldung.pruefrundeId);
    for (const r of rows) counterMap.set(r.pruefrundeId, r.anzahl);
  }

  // Als Tester:in angemeldet
  const alsTester = await db
    .select({
      anmeldungId: pruefrundenAnmeldung.id,
      anmeldungStatus: pruefrundenAnmeldung.status,
      pruefrundeId: pruefrunde.id,
      titel: pruefrunde.titel,
      pruefrundeStatus: pruefrunde.status,
      frist: pruefrunde.frist,
      werkName: werk.name,
      inhaberAnzeigename: nutzer.anzeigename,
    })
    .from(pruefrundenAnmeldung)
    .innerJoin(pruefrunde, eq(pruefrunde.id, pruefrundenAnmeldung.pruefrundeId))
    .innerJoin(werk, eq(werk.id, pruefrunde.werkId))
    .innerJoin(nutzer, eq(nutzer.id, werk.nutzerId))
    .where(eq(pruefrundenAnmeldung.testerId, sess.nutzerId))
    .orderBy(desc(pruefrundenAnmeldung.erstelltAm));

  const verpflichtungOffen = saldo.offene_verpflichtung_anzahl > 0;

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
            <Link href="/uebersicht/werke">{tnav.nav_werke}</Link>
            <Link href="/uebersicht/pruefrunden" aria-current="page">
              {tnav.nav_pruefrunden}
            </Link>
          </div>
        </div>
      </nav>

      <header className="hero" id="top">
        <div className="wrap hero-grid single">
          <div>
            <p className="eyebrow">{tm.eyebrow}</p>
            <h1>{tm.titel}</h1>
            <p className="hero-copy">{tm.untertitel}</p>
          </div>
        </div>
      </header>

      <section className="section compact">
        <div className="wrap">
          {sp.erfolg === 'feedback-abgegeben' ? (
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
              <strong>{tm.erfolg_feedback_abgegeben}</strong>
            </div>
          ) : null}

          {verpflichtungOffen ? (
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
              <strong>{tm.verpflichtung_banner_titel}</strong>
              <p style={{ margin: '8px 0 0' }}>
                {tm.verpflichtung_banner_text(
                  saldo.offene_verpflichtung_anzahl,
                  formatFrist(saldo.naechste_verpflichtung_frist),
                )}
              </p>
              <p style={{ margin: '12px 0 0' }}>
                <Link href="/pruefrunden" className="button secondary">
                  {tm.verpflichtung_link}
                </Link>
              </p>
            </div>
          ) : null}

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              marginBottom: 16,
            }}
          >
            <h2 style={{ fontSize: 28, margin: 0 }}>{tm.sektion_gestartet}</h2>
            <Link className="button secondary" href="/pruefrunden/neu">
              {tm.neue_pruefrunde}
            </Link>
          </div>

          {eigene.length === 0 ? (
            <article className="work-card" aria-label={tm.sektion_gestartet}>
              <div className="work-body">
                <p style={{ margin: 0, color: 'var(--muted)' }}>
                  {tm.sektion_gestartet_leer}
                </p>
              </div>
            </article>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'repeat(auto-fill, minmax(280px, 1fr))',
                gap: 16,
                marginBottom: 36,
              }}
            >
              {eigene.map((p) => (
                <article
                  key={p.id}
                  className="work-card"
                  aria-label={p.titel}
                >
                  <div className="work-body">
                    <h3 style={{ margin: 0, fontSize: 18 }}>
                      <Link href={`/pruefrunden/${p.id}`} style={{ color: 'var(--fg)' }}>
                        {p.titel}
                      </Link>
                    </h3>
                    <p
                      style={{
                        margin: '6px 0 12px',
                        color: 'var(--muted)',
                        fontSize: 13,
                      }}
                    >
                      zu {p.werkName}
                    </p>
                    <div
                      style={{
                        display: 'flex',
                        gap: 6,
                        flexWrap: 'wrap',
                        marginBottom: 12,
                      }}
                    >
                      <span className="status-pill">
                        {statusLabel(p.status)}
                      </span>
                      <span className="status-pill warm">
                        Frist: {formatFrist(p.frist)}
                      </span>
                      <span className="status-pill">
                        {counterMap.get(p.id) ?? 0} / {p.gesuchteTester} Tester:in
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {p.status === 'entwurf' ? (
                        <Link
                          className="button secondary"
                          href={`/pruefrunden/${p.id}/bearbeiten`}
                        >
                          Bearbeiten
                        </Link>
                      ) : (
                        <Link
                          className="button secondary"
                          href={`/pruefrunden/${p.id}`}
                        >
                          Verwalten
                        </Link>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          <h2 style={{ fontSize: 28, marginTop: 12 }}>{tm.sektion_als_tester}</h2>

          {alsTester.length === 0 ? (
            <article className="work-card" aria-label={tm.sektion_als_tester}>
              <div className="work-body">
                <p style={{ margin: 0, color: 'var(--muted)' }}>
                  {tm.sektion_als_tester_leer}
                </p>
              </div>
            </article>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'repeat(auto-fill, minmax(280px, 1fr))',
                gap: 16,
              }}
            >
              {alsTester.map((a) => (
                <article
                  key={a.anmeldungId}
                  className="work-card"
                  aria-label={a.titel}
                >
                  <div className="work-body">
                    <h3 style={{ margin: 0, fontSize: 18 }}>
                      <Link
                        href={`/pruefrunden/${a.pruefrundeId}`}
                        style={{ color: 'var(--fg)' }}
                      >
                        {a.titel}
                      </Link>
                    </h3>
                    <p
                      style={{
                        margin: '6px 0 12px',
                        color: 'var(--muted)',
                        fontSize: 13,
                      }}
                    >
                      zu {a.werkName} · {a.inhaberAnzeigename}
                    </p>
                    <div
                      style={{
                        display: 'flex',
                        gap: 6,
                        flexWrap: 'wrap',
                        marginBottom: 12,
                      }}
                    >
                      <span className="status-pill">
                        {anmeldungsStatusLabel(a.anmeldungStatus)}
                      </span>
                      <span className="status-pill warm">
                        Frist: {formatFrist(a.frist)}
                      </span>
                    </div>
                    {a.anmeldungStatus === 'angemeldet' &&
                    a.pruefrundeStatus === 'oeffentlich' ? (
                      <Link
                        className="button primary"
                        href={`/pruefrunden/${a.pruefrundeId}/feedback`}
                      >
                        Feedback abgeben
                      </Link>
                    ) : (
                      <Link
                        className="button secondary"
                        href={`/pruefrunden/${a.pruefrundeId}`}
                      >
                        Details ansehen
                      </Link>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
