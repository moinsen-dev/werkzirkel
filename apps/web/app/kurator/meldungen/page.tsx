/**
 * /kurator/meldungen — Kurator-Postfach fuer Meldungen.
 *
 * Quelle: PRD §27 (Workflow + SLA 48h), §F-503.
 *
 * - Permission: Rolle 'kurator' oder 'admin' (sonst Hinweis-Callout).
 * - Filter via `?status=offen|in_pruefung|erledigt|verworfen` — Default: alle.
 * - Pro Meldung eine Resolution-Form mit Server-Action, die intern den
 *   PATCH-Endpoint reproduziert (Status + Aktion + Notiz).
 *
 * Bewusst minimalistisch — die Form-Komponente nutzt native HTML + Server-Action,
 * keine Client-Hydration. Das macht die Page in Tests einfach renderbar.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { desc, eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import {
  auditLog,
  bedarf,
  foerderprofil,
  hilfegesuchAntwort,
  meldung,
  nutzer,
  werk,
  werkangebot,
} from '@/lib/db/schema';
import {
  meldungStatus as meldungStatusEnum,
  type MeldungReferenzTyp,
  type MeldungStatus,
} from '@/lib/db/schema/enums';
import { getSessionFromRequest } from '@/lib/auth/session';
import { hasRolle } from '@/lib/auth/permissions';
import {
  meldungAktion,
  meldungResolutionSchema,
  type MeldungAktion,
} from '@/lib/validators/meldung';

export const metadata: Metadata = {
  title: 'Meldungen — Kurator-Postfach',
  robots: { index: false, follow: false },
};

interface PageProps {
  searchParams: Promise<{ status?: string; fehler?: string; ok?: string }>;
}

async function buildRequestFromHeaders(): Promise<Request> {
  const h = await headers();
  const headerInit: Record<string, string> = {};
  for (const [name, value] of h.entries()) {
    headerInit[name] = value;
  }
  return new Request('http://internal.werkzirkel/kurator/meldungen', {
    headers: headerInit,
  });
}

const KATEGORIE_LABELS: Record<string, string> = {
  cold_outreach: 'Kalt-Akquise',
  sales_sprech: 'Sales-Sprech',
  spam: 'Spam',
  beleidigung: 'Beleidigung',
  sonstiges: 'Sonstiges',
};

const REFERENZ_LABELS: Record<MeldungReferenzTyp, string> = {
  werk: 'Werk',
  bedarf: 'Bedarf',
  werkangebot: 'Werkangebot',
  foerderprofil: 'Foerderprofil',
  nutzer: 'Nutzer:in',
  feedback: 'Feedback',
  hilfegesuch_antwort: 'Hilfegesuch-Antwort',
};

const STATUS_LABELS: Record<MeldungStatus, string> = {
  offen: 'Offen',
  in_pruefung: 'In Pruefung',
  erledigt: 'Erledigt',
  verworfen: 'Verworfen',
};

const AKTION_LABELS: Record<MeldungAktion, string> = {
  keine: 'Keine Folge-Aktion',
  inhalt_ausgeblendet: 'Inhalt ausblenden',
  nutzer_gesperrt: 'Nutzer:in sperren',
};

function refLink(typ: MeldungReferenzTyp, id: string): string | null {
  switch (typ) {
    case 'werk':
      return `/werke/${id}`;
    case 'bedarf':
      return `/bedarfe/${id}`;
    case 'foerderprofil':
      return `/foerderprofile/${id}`;
    case 'nutzer':
      return `/werkpass/${id}`;
    default:
      return null;
  }
}

/**
 * Server-Action: Meldung resolven. Spiegelt PATCH /api/v1/kurator/meldungen/:id.
 */
export async function resolveAction(formData: FormData): Promise<void> {
  'use server';

  const req = await buildRequestFromHeaders();
  const sess = await getSessionFromRequest(req);
  if (!sess) {
    redirect('/anmelden?next=/kurator/meldungen');
  }
  if (!hasRolle(sess.nutzer, 'kurator') && !hasRolle(sess.nutzer, 'admin')) {
    redirect('/kurator/meldungen?fehler=keine_rolle');
  }

  const meldungId = String(formData.get('meldung_id') ?? '').trim();
  if (!meldungId) {
    redirect('/kurator/meldungen?fehler=fehlende_id');
  }

  const candidate = {
    status: String(formData.get('status') ?? '').trim(),
    aktion: String(formData.get('aktion') ?? 'keine').trim(),
    ergebnis_notiz:
      String(formData.get('ergebnis_notiz') ?? '').trim() || null,
  };

  const parsed = meldungResolutionSchema.safeParse(candidate);
  if (!parsed.success) {
    redirect('/kurator/meldungen?fehler=validierung');
  }
  const input = parsed.data;

  const rows = await db
    .select()
    .from(meldung)
    .where(eq(meldung.id, meldungId))
    .limit(1);
  const row = rows[0];
  if (!row) redirect('/kurator/meldungen?fehler=nicht_gefunden');

  // Aktion anwenden
  if (input.aktion === 'inhalt_ausgeblendet') {
    switch (row.referenzTyp) {
      case 'werk':
        await db
          .update(werk)
          .set({ status: 'ausgeblendet', aktualisiertAm: new Date() })
          .where(eq(werk.id, row.referenzId));
        break;
      case 'bedarf':
        await db
          .update(bedarf)
          .set({ status: 'eingestellt', aktualisiertAm: new Date() })
          .where(eq(bedarf.id, row.referenzId));
        break;
      case 'foerderprofil':
        await db
          .update(foerderprofil)
          .set({ verifikationStatus: 'pausiert', aktualisiertAm: new Date() })
          .where(eq(foerderprofil.id, row.referenzId));
        break;
      case 'werkangebot':
        await db
          .update(werkangebot)
          .set({ status: 'zurueckgezogen', aktualisiertAm: new Date() })
          .where(eq(werkangebot.id, row.referenzId));
        break;
      case 'hilfegesuch_antwort':
        await db
          .delete(hilfegesuchAntwort)
          .where(eq(hilfegesuchAntwort.id, row.referenzId));
        break;
      default:
        redirect('/kurator/meldungen?fehler=aktion_nicht_unterstuetzt');
    }
  } else if (input.aktion === 'nutzer_gesperrt') {
    let inhaberId: string | null = null;
    if (row.referenzTyp === 'nutzer') {
      inhaberId = row.referenzId;
    } else if (row.referenzTyp === 'werk') {
      const r = await db
        .select({ nutzerId: werk.nutzerId })
        .from(werk)
        .where(eq(werk.id, row.referenzId))
        .limit(1);
      inhaberId = r[0]?.nutzerId ?? null;
    } else if (row.referenzTyp === 'bedarf') {
      const r = await db
        .select({ nutzerId: bedarf.nutzerId })
        .from(bedarf)
        .where(eq(bedarf.id, row.referenzId))
        .limit(1);
      inhaberId = r[0]?.nutzerId ?? null;
    } else if (row.referenzTyp === 'foerderprofil') {
      const r = await db
        .select({ nutzerId: foerderprofil.nutzerId })
        .from(foerderprofil)
        .where(eq(foerderprofil.id, row.referenzId))
        .limit(1);
      inhaberId = r[0]?.nutzerId ?? null;
    } else if (row.referenzTyp === 'werkangebot') {
      const r = await db
        .select({ macherId: werkangebot.macherId })
        .from(werkangebot)
        .where(eq(werkangebot.id, row.referenzId))
        .limit(1);
      inhaberId = r[0]?.macherId ?? null;
    } else if (row.referenzTyp === 'hilfegesuch_antwort') {
      const r = await db
        .select({ nutzerId: hilfegesuchAntwort.nutzerId })
        .from(hilfegesuchAntwort)
        .where(eq(hilfegesuchAntwort.id, row.referenzId))
        .limit(1);
      inhaberId = r[0]?.nutzerId ?? null;
    }
    if (!inhaberId) {
      redirect('/kurator/meldungen?fehler=inhaber_nicht_ermittelbar');
    }
    await db
      .update(nutzer)
      .set({ status: 'gesperrt', aktualisiertAm: new Date() })
      .where(eq(nutzer.id, inhaberId));
  }

  const jetzt = new Date();
  const istGeschlossen =
    input.status === 'erledigt' || input.status === 'verworfen';
  await db
    .update(meldung)
    .set({
      status: input.status,
      ergebnisNotiz: input.ergebnis_notiz ?? null,
      bearbeiterId: sess.nutzerId,
      geschlossenAm: istGeschlossen ? jetzt : null,
    })
    .where(eq(meldung.id, row.id));

  try {
    await db.insert(auditLog).values({
      nutzerId: sess.nutzerId,
      aktion: 'meldung.resolviert',
      referenzTyp: 'meldung',
      referenzId: row.id,
      metadaten: {
        neuer_status: input.status,
        aktion: input.aktion,
        referenz_typ: row.referenzTyp,
        referenz_id: row.referenzId,
      },
    });
  } catch {
    // ignorieren
  }

  redirect('/kurator/meldungen?ok=resolviert');
}

export default async function KuratorMeldungenPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const req = await buildRequestFromHeaders();
  const sess = await getSessionFromRequest(req);
  if (!sess) {
    redirect('/anmelden?next=/kurator/meldungen');
  }

  const istKurator =
    hasRolle(sess.nutzer, 'kurator') || hasRolle(sess.nutzer, 'admin');

  const statusFilter =
    sp.status && (meldungStatusEnum as readonly string[]).includes(sp.status)
      ? (sp.status as MeldungStatus)
      : undefined;

  const filterCondition = statusFilter
    ? eq(meldung.status, statusFilter)
    : undefined;

  const rows = istKurator
    ? await db
        .select({
          meldung,
          melderAnzeigename: nutzer.anzeigename,
        })
        .from(meldung)
        .leftJoin(nutzer, eq(nutzer.id, meldung.gemeldetVon))
        .where(filterCondition)
        .orderBy(desc(meldung.erstelltAm), desc(meldung.id))
        .limit(100)
    : [];

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
            <Link href="/uebersicht">Uebersicht</Link>
            <Link href="/kurator/meldungen" aria-current="page">
              Meldungen
            </Link>
          </div>
        </div>
      </nav>

      <header className="hero" id="top">
        <div className="wrap hero-grid single">
          <div>
            <p className="eyebrow">Werkzirkel · Kurator-Postfach</p>
            <h1>Meldungen</h1>
            <p className="hero-copy">
              SLA 48 Stunden ab Eingang. Pruefe jede Meldung, setze Status, und
              waehle ggf. eine Folge-Aktion (Inhalt ausblenden / Nutzer:in sperren).
            </p>
          </div>
        </div>
      </header>

      <section className="section compact">
        <div className="wrap">
          {!istKurator ? (
            <div
              role="alert"
              className="callout"
              style={{ padding: 16, borderRadius: 12 }}
            >
              <strong>Nur Kurator:innen und Admins koennen das Postfach lesen.</strong>
            </div>
          ) : (
            <>
              {sp.ok === 'resolviert' ? (
                <div
                  role="status"
                  style={{
                    marginBottom: 12,
                    padding: 12,
                    borderRadius: 10,
                    background: '#e7f5ec',
                    border: '1px solid #2a8c4a',
                    color: '#1a4a26',
                  }}
                >
                  Meldung aktualisiert.
                </div>
              ) : null}
              {sp.fehler ? (
                <div
                  role="alert"
                  style={{
                    marginBottom: 12,
                    padding: 12,
                    borderRadius: 10,
                    border: '1px solid #d04848',
                    background: '#fbeaea',
                    color: '#5a1a1a',
                  }}
                >
                  {sp.fehler === 'keine_rolle'
                    ? 'Keine Berechtigung.'
                    : sp.fehler === 'inhaber_nicht_ermittelbar'
                      ? 'Inhaber:in nicht ermittelbar. Bitte manuell sperren.'
                      : sp.fehler === 'aktion_nicht_unterstuetzt'
                        ? 'Aktion fuer diesen Referenz-Typ nicht unterstuetzt.'
                        : `Aktion fehlgeschlagen (${sp.fehler}).`}
                </div>
              ) : null}

              <nav aria-label="Status-Filter" style={{ marginBottom: 16 }}>
                <ul
                  style={{
                    display: 'flex',
                    gap: 12,
                    listStyle: 'none',
                    padding: 0,
                    margin: 0,
                    flexWrap: 'wrap',
                  }}
                >
                  <li>
                    <Link
                      href="/kurator/meldungen"
                      aria-current={statusFilter ? undefined : 'page'}
                    >
                      Alle
                    </Link>
                  </li>
                  {(meldungStatusEnum as readonly MeldungStatus[]).map((s) => (
                    <li key={s}>
                      <Link
                        href={`/kurator/meldungen?status=${s}`}
                        aria-current={statusFilter === s ? 'page' : undefined}
                      >
                        {STATUS_LABELS[s]}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>

              {rows.length === 0 ? (
                <p style={{ color: 'var(--muted)' }}>
                  Keine Meldungen in diesem Filter.
                </p>
              ) : (
                <ul
                  style={{
                    listStyle: 'none',
                    padding: 0,
                    margin: 0,
                    display: 'grid',
                    gap: 16,
                  }}
                  data-testid="meldungen-liste"
                >
                  {rows.map((r) => {
                    const link = refLink(r.meldung.referenzTyp, r.meldung.referenzId);
                    return (
                      <li
                        key={r.meldung.id}
                        style={{
                          border: 'var(--hairline)',
                          borderRadius: 12,
                          padding: 16,
                          background: 'var(--surface)',
                        }}
                        data-meldung-id={r.meldung.id}
                      >
                        <div
                          style={{
                            display: 'flex',
                            gap: 8,
                            flexWrap: 'wrap',
                            marginBottom: 8,
                          }}
                        >
                          <span className="status-pill">
                            {STATUS_LABELS[r.meldung.status]}
                          </span>
                          <span className="status-pill">
                            {KATEGORIE_LABELS[r.meldung.kategorie] ??
                              r.meldung.kategorie}
                          </span>
                          <span className="status-pill warm">
                            {REFERENZ_LABELS[r.meldung.referenzTyp]}
                          </span>
                        </div>

                        <p style={{ margin: '4px 0', fontSize: 14 }}>
                          <strong>Referenz:</strong>{' '}
                          {link ? (
                            <Link href={link}>{r.meldung.referenzId}</Link>
                          ) : (
                            <code>{r.meldung.referenzId}</code>
                          )}
                        </p>
                        <p style={{ margin: '4px 0', fontSize: 13, color: 'var(--muted)' }}>
                          <strong>Gemeldet von:</strong>{' '}
                          {r.melderAnzeigename ?? 'anonym'} ·{' '}
                          {r.meldung.erstelltAm.toLocaleString('de-DE')}
                        </p>
                        {r.meldung.beschreibung ? (
                          <p
                            style={{
                              margin: '8px 0',
                              padding: 8,
                              background: 'var(--surface-muted, #f7f7f6)',
                              borderRadius: 6,
                              whiteSpace: 'pre-line',
                            }}
                          >
                            {r.meldung.beschreibung}
                          </p>
                        ) : null}

                        {r.meldung.ergebnisNotiz ? (
                          <p
                            style={{
                              margin: '8px 0 0',
                              fontStyle: 'italic',
                              color: 'var(--muted)',
                            }}
                          >
                            Notiz: {r.meldung.ergebnisNotiz}
                          </p>
                        ) : null}

                        {r.meldung.status !== 'erledigt' &&
                        r.meldung.status !== 'verworfen' ? (
                          <form
                            action={resolveAction}
                            style={{
                              display: 'grid',
                              gap: 8,
                              marginTop: 12,
                              maxWidth: 560,
                            }}
                          >
                            <input
                              type="hidden"
                              name="meldung_id"
                              value={r.meldung.id}
                            />
                            <label style={{ display: 'grid', gap: 4 }}>
                              <span style={{ fontWeight: 600 }}>Status</span>
                              <select
                                name="status"
                                defaultValue="erledigt"
                                style={inputStyle}
                              >
                                {(meldungStatusEnum as readonly MeldungStatus[]).map(
                                  (s) => (
                                    <option key={s} value={s}>
                                      {STATUS_LABELS[s]}
                                    </option>
                                  ),
                                )}
                              </select>
                            </label>
                            <label style={{ display: 'grid', gap: 4 }}>
                              <span style={{ fontWeight: 600 }}>Aktion</span>
                              <select
                                name="aktion"
                                defaultValue="keine"
                                style={inputStyle}
                              >
                                {(meldungAktion as readonly MeldungAktion[]).map(
                                  (a) => (
                                    <option key={a} value={a}>
                                      {AKTION_LABELS[a]}
                                    </option>
                                  ),
                                )}
                              </select>
                            </label>
                            <label style={{ display: 'grid', gap: 4 }}>
                              <span style={{ fontWeight: 600 }}>
                                Ergebnis-Notiz (optional)
                              </span>
                              <textarea
                                name="ergebnis_notiz"
                                rows={2}
                                maxLength={2000}
                                style={{
                                  ...inputStyle,
                                  resize: 'vertical',
                                }}
                              />
                            </label>
                            <div>
                              <button type="submit" className="button primary">
                                Resolution speichern
                              </button>
                            </div>
                          </form>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '8px 10px',
  border: '1px solid var(--hairline-color, #ccc)',
  borderRadius: 8,
  fontSize: 14,
  fontFamily: 'inherit',
};
