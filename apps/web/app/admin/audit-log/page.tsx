/**
 * /admin/audit-log — Audit-Log-Browser mit Filtern.
 *
 * Filter: aktion, nutzer_id, datum (von / bis), Pagination.
 *
 * Permission via /admin/layout.tsx.
 *
 * PRD-Referenz: §15.14.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { and, desc, eq, gte, lt } from 'drizzle-orm';

import { db } from '@/lib/db';
import { auditLog } from '@/lib/db/schema';

export const metadata: Metadata = {
  title: 'Audit-Log — Admin',
};

interface PageProps {
  searchParams: Promise<{
    aktion?: string;
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

export default async function AdminAuditLogPage({ searchParams }: PageProps) {
  const sp = await searchParams;

  const aktion = sp.aktion?.trim() || undefined;
  const nutzerId = sp.nutzer_id?.trim() || undefined;
  const von = parseIsoDate(sp.von);
  const bis = parseIsoDate(sp.bis);
  const offset = Math.max(0, Number.parseInt(sp.offset ?? '0', 10) || 0);

  const filters = [];
  if (aktion) filters.push(eq(auditLog.aktion, aktion));
  if (nutzerId) filters.push(eq(auditLog.nutzerId, nutzerId));
  if (von) filters.push(gte(auditLog.erstelltAm, von));
  if (bis) {
    const bisExklusiv = new Date(bis);
    bisExklusiv.setUTCDate(bisExklusiv.getUTCDate() + 1);
    filters.push(lt(auditLog.erstelltAm, bisExklusiv));
  }

  const rows = await db
    .select()
    .from(auditLog)
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(desc(auditLog.erstelltAm), desc(auditLog.id))
    .limit(PAGE_LIMIT + 1)
    .offset(offset);
  const hasMore = rows.length > PAGE_LIMIT;
  const display = hasMore ? rows.slice(0, PAGE_LIMIT) : rows;

  const buildHref = (overrides: Record<string, string | undefined>): string => {
    const params = new URLSearchParams();
    const merged = {
      aktion,
      nutzer_id: nutzerId,
      von: sp.von,
      bis: sp.bis,
      ...overrides,
    };
    for (const [k, v] of Object.entries(merged)) {
      if (v) params.set(k, v);
    }
    const qs = params.toString();
    return qs ? `/admin/audit-log?${qs}` : '/admin/audit-log';
  };

  return (
    <>
      <header className="hero" id="top">
        <div className="wrap hero-grid single">
          <div>
            <p className="eyebrow">Werkzirkel · Admin · Audit-Log</p>
            <h1>Audit-Log-Browser</h1>
            <p className="hero-copy">
              Alle sicherheits- und governance-relevanten Aktionen.
            </p>
          </div>
        </div>
      </header>

      <section className="section compact">
        <div className="wrap">
          <form
            method="get"
            action="/admin/audit-log"
            style={{
              display: 'flex',
              gap: 12,
              flexWrap: 'wrap',
              alignItems: 'flex-end',
              marginBottom: 16,
            }}
            data-testid="admin-audit-filter"
          >
            <label>
              <span style={{ display: 'block', fontSize: 13 }}>Aktion</span>
              <input
                type="text"
                name="aktion"
                defaultValue={aktion ?? ''}
                placeholder="z.B. nutzer.gesperrt"
                style={{ minWidth: 220 }}
              />
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
            <Link href="/admin/audit-log">Zuruecksetzen</Link>
          </form>

          {display.length === 0 ? (
            <p style={{ color: 'var(--muted)' }}>Keine Eintraege.</p>
          ) : (
            <table style={tableStyle} data-testid="admin-audit-tabelle">
              <thead>
                <tr>
                  <th style={thStyle}>Zeit</th>
                  <th style={thStyle}>Aktion</th>
                  <th style={thStyle}>Nutzer-ID</th>
                  <th style={thStyle}>Referenz</th>
                  <th style={thStyle}>Metadaten</th>
                </tr>
              </thead>
              <tbody>
                {display.map((r) => (
                  <tr key={r.id}>
                    <td style={tdStyle}>
                      {r.erstelltAm.toISOString().replace('T', ' ').slice(0, 19)}
                    </td>
                    <td style={tdStyle}>{r.aktion}</td>
                    <td style={tdStyle}>{r.nutzerId ?? '—'}</td>
                    <td style={tdStyle}>
                      {r.referenzTyp ? `${r.referenzTyp}:${r.referenzId}` : '—'}
                    </td>
                    <td style={tdStyle}>
                      <pre
                        style={{
                          margin: 0,
                          fontSize: 12,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-all',
                        }}
                      >
                        {JSON.stringify(r.metadaten, null, 2)}
                      </pre>
                    </td>
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
