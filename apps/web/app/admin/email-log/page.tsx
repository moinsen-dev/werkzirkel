/**
 * /admin/email-log — Browser fuer alle versendeten E-Mails.
 *
 * Filter: template, status, nutzer_id, von / bis. Pagination.
 *
 * Permission via /admin/layout.tsx.
 *
 * PRD-Referenz: §15.14.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { and, desc, eq, gte, lt } from 'drizzle-orm';

import { db } from '@/lib/db';
import { emailBenachrichtigungLog } from '@/lib/db/schema';
import {
  emailStatus as emailStatusEnum,
  type EmailStatus,
} from '@/lib/db/schema/enums';

export const metadata: Metadata = {
  title: 'E-Mail-Log — Admin',
};

interface PageProps {
  searchParams: Promise<{
    template?: string;
    status?: string;
    nutzer_id?: string;
    von?: string;
    bis?: string;
    offset?: string;
  }>;
}

const PAGE_LIMIT = 50;

function parseIsoDate(s: string | undefined): Date | null {
  if (!s) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export default async function AdminEmailLogPage({ searchParams }: PageProps) {
  const sp = await searchParams;

  const template = sp.template?.trim() || undefined;
  const nutzerId = sp.nutzer_id?.trim() || undefined;
  const status =
    sp.status && (emailStatusEnum as readonly string[]).includes(sp.status)
      ? (sp.status as EmailStatus)
      : undefined;
  const von = parseIsoDate(sp.von);
  const bis = parseIsoDate(sp.bis);
  const offset = Math.max(0, Number.parseInt(sp.offset ?? '0', 10) || 0);

  const filters = [];
  if (template) filters.push(eq(emailBenachrichtigungLog.template, template));
  if (status) filters.push(eq(emailBenachrichtigungLog.status, status));
  if (nutzerId) filters.push(eq(emailBenachrichtigungLog.nutzerId, nutzerId));
  if (von) filters.push(gte(emailBenachrichtigungLog.erstelltAm, von));
  if (bis) {
    const bisExklusiv = new Date(bis);
    bisExklusiv.setUTCDate(bisExklusiv.getUTCDate() + 1);
    filters.push(lt(emailBenachrichtigungLog.erstelltAm, bisExklusiv));
  }

  const rows = await db
    .select()
    .from(emailBenachrichtigungLog)
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(
      desc(emailBenachrichtigungLog.erstelltAm),
      desc(emailBenachrichtigungLog.id),
    )
    .limit(PAGE_LIMIT + 1)
    .offset(offset);
  const hasMore = rows.length > PAGE_LIMIT;
  const display = hasMore ? rows.slice(0, PAGE_LIMIT) : rows;

  const buildHref = (overrides: Record<string, string | undefined>): string => {
    const params = new URLSearchParams();
    const merged = {
      template,
      status,
      nutzer_id: nutzerId,
      von: sp.von,
      bis: sp.bis,
      ...overrides,
    };
    for (const [k, v] of Object.entries(merged)) {
      if (v) params.set(k, v);
    }
    const qs = params.toString();
    return qs ? `/admin/email-log?${qs}` : '/admin/email-log';
  };

  return (
    <>
      <header className="hero" id="top">
        <div className="wrap hero-grid single">
          <div>
            <p className="eyebrow">Werkzirkel · Admin · E-Mail-Log</p>
            <h1>E-Mail-Log-Browser</h1>
            <p className="hero-copy">
              Alle ausgehenden E-Mails inkl. Bounce-Status.
            </p>
          </div>
        </div>
      </header>

      <section className="section compact">
        <div className="wrap">
          <form
            method="get"
            action="/admin/email-log"
            style={{
              display: 'flex',
              gap: 12,
              flexWrap: 'wrap',
              alignItems: 'flex-end',
              marginBottom: 16,
            }}
            data-testid="admin-email-filter"
          >
            <label>
              <span style={{ display: 'block', fontSize: 13 }}>Template</span>
              <input
                type="text"
                name="template"
                defaultValue={template ?? ''}
                placeholder="z.B. T-101 pruefrunde-neue-anmeldung"
                style={{ minWidth: 240 }}
              />
            </label>
            <label>
              <span style={{ display: 'block', fontSize: 13 }}>Status</span>
              <select name="status" defaultValue={status ?? ''}>
                <option value="">— alle —</option>
                {emailStatusEnum.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span style={{ display: 'block', fontSize: 13 }}>Nutzer-ID</span>
              <input
                type="text"
                name="nutzer_id"
                defaultValue={nutzerId ?? ''}
                style={{ minWidth: 200 }}
              />
            </label>
            <label>
              <span style={{ display: 'block', fontSize: 13 }}>Von</span>
              <input type="date" name="von" defaultValue={sp.von ?? ''} />
            </label>
            <label>
              <span style={{ display: 'block', fontSize: 13 }}>Bis</span>
              <input type="date" name="bis" defaultValue={sp.bis ?? ''} />
            </label>
            <button type="submit" className="button primary">
              Filtern
            </button>
            <Link href="/admin/email-log">Zuruecksetzen</Link>
          </form>

          {display.length === 0 ? (
            <p style={{ color: 'var(--muted)' }}>Keine Eintraege.</p>
          ) : (
            <table style={tableStyle} data-testid="admin-email-tabelle">
              <thead>
                <tr>
                  <th style={thStyle}>Zeit</th>
                  <th style={thStyle}>Empfaenger</th>
                  <th style={thStyle}>Template</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Betreff</th>
                  <th style={thStyle}>Fehler</th>
                </tr>
              </thead>
              <tbody>
                {display.map((r) => (
                  <tr key={r.id}>
                    <td style={tdStyle}>
                      {r.erstelltAm.toISOString().replace('T', ' ').slice(0, 19)}
                    </td>
                    <td style={tdStyle}>{r.email}</td>
                    <td style={tdStyle}>{r.template}</td>
                    <td style={tdStyle}>{r.status}</td>
                    <td style={tdStyle}>{r.betreff}</td>
                    <td style={tdStyle}>{r.fehlerMeldung ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div style={{ marginTop: 16, display: 'flex', gap: 16 }}>
            {offset > 0 ? (
              <Link
                href={buildHref({
                  offset:
                    Math.max(0, offset - PAGE_LIMIT) === 0
                      ? undefined
                      : String(offset - PAGE_LIMIT),
                })}
              >
                ← vorherige
              </Link>
            ) : null}
            {hasMore ? (
              <Link href={buildHref({ offset: String(offset + PAGE_LIMIT) })}>
                naechste →
              </Link>
            ) : null}
          </div>
        </div>
      </section>
    </>
  );
}

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  marginTop: 12,
};

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 10px',
  borderBottom: '2px solid var(--hairline-color, #ddd)',
  fontWeight: 600,
};

const tdStyle: React.CSSProperties = {
  padding: '8px 10px',
  borderBottom: '1px solid var(--hairline-color, #eee)',
  verticalAlign: 'top',
};
