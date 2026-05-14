/**
 * /hilfegesuche/neu — Neues Hilfegesuch anlegen (Server Component + Server Action).
 *
 * Auth-Pflicht — ohne Session redirect zu /anmelden. Validator schlaegt zu
 * lange Gueltigkeit (> now + 14 Tage) ab.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { de } from '@/i18n/de';
import { db } from '@/lib/db';
import { auditLog, hilfegesuch } from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';
import { hilfegesuchAnlegenSchema } from '@/lib/validators/hilfegesuch';

export const metadata: Metadata = {
  title: 'Neues Hilfegesuch',
  robots: { index: false, follow: false },
};

const th = de.hilfegesuche;

interface PageProps {
  searchParams: Promise<{ fehler?: string; feld?: string }>;
}

async function buildRequestFromHeaders(): Promise<Request> {
  const h = await headers();
  const headerInit: Record<string, string> = {};
  for (const [name, value] of h.entries()) {
    headerInit[name] = value;
  }
  return new Request('http://internal.werkzirkel/hilfegesuche/neu', {
    headers: headerInit,
  });
}

function defaultGueltigBisIsoLocal(): string {
  // 14 Tage in der Zukunft, lokales Datum als YYYY-MM-DD fuer <input type="date">.
  const d = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export async function hilfegesuchAnlegen(formData: FormData): Promise<void> {
  'use server';

  const req = await buildRequestFromHeaders();
  const sess = await getSessionFromRequest(req);
  if (!sess) {
    redirect('/anmelden?next=/hilfegesuche/neu');
  }

  const tagsRaw = String(formData.get('tags') ?? '');
  const tags = tagsRaw
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .slice(0, 10);

  // <input type="date"> liefert YYYY-MM-DD — interpretieren als Tagesende.
  const gueltigBisRaw = String(formData.get('gueltig_bis') ?? '').trim();
  const gueltigBisIso = gueltigBisRaw
    ? `${gueltigBisRaw}T23:59:59.000Z`
    : '';

  const candidate = {
    titel: String(formData.get('titel') ?? '').trim(),
    beschreibung: String(formData.get('beschreibung') ?? '').trim(),
    tags,
    gueltig_bis: gueltigBisIso,
  };

  const parsed = hilfegesuchAnlegenSchema.safeParse(candidate);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const firstFeld = Object.keys(fieldErrors)[0] ?? 'unbekannt';
    redirect(
      `/hilfegesuche/neu?fehler=validierung&feld=${encodeURIComponent(firstFeld)}`,
    );
  }
  const input = parsed.data!;

  const inserted = await db
    .insert(hilfegesuch)
    .values({
      nutzerId: sess.nutzerId,
      stadtId: sess.nutzer.stadtId,
      titel: input.titel,
      beschreibung: input.beschreibung,
      tags: input.tags,
      gueltigBis: input.gueltig_bis,
      status: 'offen',
    })
    .returning({ id: hilfegesuch.id });

  const row = inserted[0];
  if (!row) {
    redirect('/hilfegesuche/neu?fehler=unbekannt');
  }
  try {
    await db.insert(auditLog).values({
      nutzerId: sess.nutzerId,
      aktion: 'hilfegesuch.angelegt',
      referenzTyp: 'hilfegesuch',
      referenzId: row.id,
    });
  } catch {
    // tolerabel
  }
  redirect(`/hilfegesuche/${row.id}`);
}

export default async function HilfegesuchNeuPage({ searchParams }: PageProps) {
  const req = await buildRequestFromHeaders();
  const sess = await getSessionFromRequest(req);
  if (!sess) {
    redirect('/anmelden?next=/hilfegesuche/neu');
  }

  const sp = await searchParams;
  const fehlerText =
    sp.fehler === 'validierung'
      ? sp.feld
        ? `${th.fehler_validierung} (Feld: ${sp.feld})`
        : th.fehler_validierung
      : sp.fehler === 'unbekannt'
        ? de.fehler.unbekannt
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

      <header className="hero" id="top">
        <div className="wrap hero-grid single">
          <div>
            <p className="eyebrow">Werkzirkel · Hilfegesuch</p>
            <h1>{th.neu_titel}</h1>
            <p className="hero-copy">{th.neu_untertitel}</p>
          </div>
        </div>
      </header>

      <section className="section compact">
        <div className="wrap" style={{ maxWidth: 720 }}>
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

          <form
            action={hilfegesuchAnlegen}
            style={{ display: 'grid', gap: 16 }}
          >
            <label style={{ display: 'grid', gap: 6 }} htmlFor="titel">
              <span style={{ fontWeight: 600 }}>{th.neu_label_titel}</span>
              <input
                id="titel"
                name="titel"
                type="text"
                required
                minLength={3}
                maxLength={200}
                style={inputStyle}
              />
            </label>

            <label
              style={{ display: 'grid', gap: 6 }}
              htmlFor="beschreibung"
            >
              <span style={{ fontWeight: 600 }}>{th.neu_label_beschreibung}</span>
              <textarea
                id="beschreibung"
                name="beschreibung"
                required
                minLength={10}
                maxLength={4000}
                rows={6}
                style={textareaStyle}
              />
            </label>

            <label style={{ display: 'grid', gap: 6 }} htmlFor="tags">
              <span style={{ fontWeight: 600 }}>{th.neu_label_tags}</span>
              <input
                id="tags"
                name="tags"
                type="text"
                placeholder="marketing, ux, recht"
                style={inputStyle}
              />
            </label>

            <label
              style={{ display: 'grid', gap: 6 }}
              htmlFor="gueltig_bis"
            >
              <span style={{ fontWeight: 600 }}>{th.neu_label_gueltig_bis}</span>
              <input
                id="gueltig_bis"
                name="gueltig_bis"
                type="date"
                required
                defaultValue={defaultGueltigBisIsoLocal()}
                style={inputStyle}
              />
            </label>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button type="submit" className="button primary">
                {th.neu_button}
              </button>
              <Link href="/hilfegesuche" className="button secondary">
                Abbrechen
              </Link>
            </div>
          </form>
        </div>
      </section>
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
