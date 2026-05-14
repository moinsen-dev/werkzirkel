/**
 * /admin/nutzer — Liste aller Nutzer:innen mit Such- und Filter-Funktion.
 *
 * Permission via /admin/layout.tsx.
 *
 * PRD-Referenz: §15.14, §26.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';

import { db } from '@/lib/db';
import { nutzer, stadt } from '@/lib/db/schema';
import {
  nutzerStatus as nutzerStatusEnum,
  rolle as rolleEnum,
  type NutzerStatus,
  type Rolle,
} from '@/lib/db/schema/enums';

export const metadata: Metadata = {
  title: 'Nutzer:innen — Admin',
};

interface PageProps {
  searchParams: Promise<{
    q?: string;
    stadt?: string;
    rolle?: string;
    status?: string;
    offset?: string;
  }>;
}

const PAGE_LIMIT = 50;

export default async function AdminNutzerListPage({ searchParams }: PageProps) {
  const sp = await searchParams;

  const q = sp.q?.trim() || undefined;
  const stadtFilter = sp.stadt?.trim() || undefined;
  const rolleFilter =
    sp.rolle && (rolleEnum as readonly string[]).includes(sp.rolle)
      ? (sp.rolle as Rolle)
      : undefined;
  const statusFilter =
    sp.status && (nutzerStatusEnum as readonly string[]).includes(sp.status)
      ? (sp.status as NutzerStatus)
      : undefined;
  const offset = Math.max(0, Number.parseInt(sp.offset ?? '0', 10) || 0);

  const filters = [];
  if (q) {
    const pat = `%${q}%`;
    filters.push(
      or(
        ilike(nutzer.email, pat),
        ilike(nutzer.klarname, pat),
        ilike(nutzer.anzeigename, pat),
      )!,
    );
  }
  if (stadtFilter) filters.push(eq(nutzer.stadtId, stadtFilter));
  if (statusFilter) filters.push(eq(nutzer.status, statusFilter));
  if (rolleFilter) filters.push(sql`${rolleFilter} = ANY(${nutzer.rollen})`);

  const rows = await db
    .select()
    .from(nutzer)
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(desc(nutzer.erstelltAm), desc(nutzer.id))
    .limit(PAGE_LIMIT + 1)
    .offset(offset);
  const hasMore = rows.length > PAGE_LIMIT;
  const display = hasMore ? rows.slice(0, PAGE_LIMIT) : rows;

  const staedte = await db
    .select({ id: stadt.id, name: stadt.name })
    .from(stadt)
    .orderBy(stadt.sortierung);

  const buildHref = (overrides: Record<string, string | undefined>): string => {
    const params = new URLSearchParams();
    const merged = {
      q,
      stadt: stadtFilter,
      rolle: rolleFilter,
      status: statusFilter,
      ...overrides,
    };
    for (const [k, v] of Object.entries(merged)) {
      if (v) params.set(k, v);
    }
    const qs = params.toString();
    return qs ? `/admin/nutzer?${qs}` : '/admin/nutzer';
  };

  return (
    <>
      <header className="hero" id="top">
        <div className="wrap hero-grid single">
          <div>
            <p className="eyebrow">Werkzirkel · Admin · Nutzer:innen</p>
            <h1>Nutzer:innen-Verwaltung</h1>
            <p className="hero-copy">
              Suche, filtere, sperre und entsperre Konten.
            </p>
          </div>
        </div>
      </header>

      <section className="section compact">
        <div className="wrap">
          <form
            method="get"
            action="/admin/nutzer"
            style={{
              display: 'flex',
              gap: 12,
              flexWrap: 'wrap',
              alignItems: 'flex-end',
              marginBottom: 16,
            }}
            data-testid="admin-nutzer-filter"
          >
            <label>
              <span style={{ display: 'block', fontSize: 13 }}>Suche</span>
              <input
                type="text"
                name="q"
                defaultValue={q ?? ''}
                placeholder="E-Mail, Klarname, Anzeigename"
                style={{ minWidth: 240 }}
              />
            </label>
            <label>
              <span style={{ display: 'block', fontSize: 13 }}>Stadt</span>
              <select name="stadt" defaultValue={stadtFilter ?? ''}>
                <option value="">— alle —</option>
                {staedte.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span style={{ display: 'block', fontSize: 13 }}>Rolle</span>
              <select name="rolle" defaultValue={rolleFilter ?? ''}>
                <option value="">— alle —</option>
                {rolleEnum.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span style={{ display: 'block', fontSize: 13 }}>Status</span>
              <select name="status" defaultValue={statusFilter ?? ''}>
                <option value="">— alle —</option>
                {nutzerStatusEnum.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="button primary">
              Filtern
            </button>
            <Link href="/admin/nutzer">Zuruecksetzen</Link>
          </form>

          {display.length === 0 ? (
            <p style={{ color: 'var(--muted)' }}>Keine Treffer.</p>
          ) : (
            <table style={tableStyle} data-testid="admin-nutzer-tabelle">
              <thead>
                <tr>
                  <th style={thStyle}>E-Mail</th>
                  <th style={thStyle}>Anzeigename</th>
                  <th style={thStyle}>Stadt</th>
                  <th style={thStyle}>Rollen</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Aktion</th>
                </tr>
              </thead>
              <tbody>
                {display.map((u) => (
                  <tr key={u.id}>
                    <td style={tdStyle}>{u.email}</td>
                    <td style={tdStyle}>{u.anzeigename}</td>
                    <td style={tdStyle}>{u.stadtId}</td>
                    <td style={tdStyle}>{u.rollen.join(', ')}</td>
                    <td style={tdStyle}>{u.status}</td>
                    <td style={tdStyle}>
                      <Link href={`/admin/nutzer/${u.id}`}>Detail</Link>
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
