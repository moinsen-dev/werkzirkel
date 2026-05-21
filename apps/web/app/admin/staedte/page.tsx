/**
 * /admin/staedte — Staedte-Verwaltung.
 *
 * - Liste aller Staedte.
 * - Form: neue Stadt anlegen.
 * - Inline-Form: Status aendern (aktivieren/deaktivieren).
 * - Inline-Form: City-Lead ernennen (E-Mail-Suche).
 *
 * Server-Actions spiegeln die /api/v1/admin/staedte/*-Endpoints.
 * Permission via /admin/layout.tsx.
 *
 * PRD-Referenz: §15.14, §26, §10.
 */

import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { eq, inArray } from 'drizzle-orm';

import { db } from '@/lib/db';
import { auditLog, nutzer, stadt } from '@/lib/db/schema';
import {
  stadtStatus as stadtStatusEnum,
  type Rolle,
  type StadtStatus,
} from '@/lib/db/schema/enums';
import { getSessionFromRequest } from '@/lib/auth/session';
import { istAdmin } from '@/lib/auth/permissions';
import { adminStadtAnlegenSchema } from '@/lib/validators/admin';

export const metadata: Metadata = {
  title: 'Staedte — Admin',
};

interface PageProps {
  searchParams: Promise<{ ok?: string; fehler?: string }>;
}

async function buildRequestFromHeaders(): Promise<Request> {
  const h = await headers();
  const headerInit: Record<string, string> = {};
  for (const [name, value] of h.entries()) {
    headerInit[name] = value;
  }
  return new Request('http://internal.werkzirkel/admin/staedte', {
    headers: headerInit,
  });
}

async function ensureAdmin(): Promise<{ nutzerId: string } | null> {
  const req = await buildRequestFromHeaders();
  const sess = await getSessionFromRequest(req);
  if (!sess) return null;
  if (!istAdmin(sess.nutzer)) return null;
  return { nutzerId: sess.nutzerId };
}

export async function anlegenAction(formData: FormData): Promise<void> {
  'use server';
  const admin = await ensureAdmin();
  if (!admin) redirect('/admin/staedte?fehler=keine_rolle');

  const raw = {
    id: String(formData.get('id') ?? '').trim().toLowerCase(),
    name: String(formData.get('name') ?? '').trim(),
    status: String(formData.get('status') ?? 'vorbereitung').trim(),
    beschreibung:
      String(formData.get('beschreibung') ?? '').trim() || null,
    sortierung: String(formData.get('sortierung') ?? '100'),
  };
  const parsed = adminStadtAnlegenSchema.safeParse(raw);
  if (!parsed.success) {
    redirect('/admin/staedte?fehler=validierung');
  }
  const input = parsed.data;

  const exists = await db
    .select({ id: stadt.id })
    .from(stadt)
    .where(eq(stadt.id, input.id.toLowerCase()))
    .limit(1);
  if (exists.length > 0) {
    redirect('/admin/staedte?fehler=stadt_existiert');
  }

  await db.insert(stadt).values({
    id: input.id.toLowerCase(),
    name: input.name,
    status: input.status,
    beschreibung: input.beschreibung ?? null,
    sortierung: input.sortierung,
  });

  try {
    await db.insert(auditLog).values({
      nutzerId: admin.nutzerId,
      aktion: 'stadt.angelegt',
      referenzTyp: 'stadt',
      referenzId: input.id,
      metadaten: { name: input.name, status: input.status },
    });
  } catch {
    /* audit best-effort */
  }

  redirect('/admin/staedte?ok=angelegt');
}

export async function statusAction(formData: FormData): Promise<void> {
  'use server';
  const admin = await ensureAdmin();
  if (!admin) redirect('/admin/staedte?fehler=keine_rolle');

  const id = String(formData.get('id') ?? '').trim();
  const status = String(formData.get('status') ?? '').trim() as StadtStatus;
  if (!id || !(stadtStatusEnum as readonly string[]).includes(status)) {
    redirect('/admin/staedte?fehler=validierung');
  }
  const rows = await db.select().from(stadt).where(eq(stadt.id, id)).limit(1);
  const row = rows[0];
  if (!row) redirect('/admin/staedte?fehler=nicht_gefunden');

  await db
    .update(stadt)
    .set({ status, aktualisiertAm: new Date() })
    .where(eq(stadt.id, id));

  try {
    await db.insert(auditLog).values({
      nutzerId: admin.nutzerId,
      aktion: 'stadt.aktualisiert',
      referenzTyp: 'stadt',
      referenzId: id,
      metadaten: {
        vorher: { status: row.status },
        nachher: { status },
      },
    });
  } catch {
    /* audit best-effort */
  }

  redirect('/admin/staedte?ok=aktualisiert');
}

export async function kuratorAction(formData: FormData): Promise<void> {
  'use server';
  const admin = await ensureAdmin();
  if (!admin) redirect('/admin/staedte?fehler=keine_rolle');

  const stadtId = String(formData.get('stadt_id') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  if (!stadtId || !email) {
    redirect('/admin/staedte?fehler=validierung');
  }

  const stadtRows = await db
    .select()
    .from(stadt)
    .where(eq(stadt.id, stadtId))
    .limit(1);
  if (stadtRows.length === 0) {
    redirect('/admin/staedte?fehler=stadt_nicht_gefunden');
  }

  const nutzerRows = await db
    .select()
    .from(nutzer)
    .where(eq(nutzer.email, email))
    .limit(1);
  const nutzerRow = nutzerRows[0];
  if (!nutzerRow) {
    redirect('/admin/staedte?fehler=nutzer_nicht_gefunden');
  }

  await db.transaction(async (tx) => {
    await tx
      .update(stadt)
      .set({ kuratorId: nutzerRow.id, aktualisiertAm: new Date() })
      .where(eq(stadt.id, stadtId));

    const neueRollen: Rolle[] = nutzerRow.rollen.includes('kurator')
      ? nutzerRow.rollen
      : ([...nutzerRow.rollen, 'kurator'] as Rolle[]);
    await tx
      .update(nutzer)
      .set({ rollen: neueRollen, aktualisiertAm: new Date() })
      .where(eq(nutzer.id, nutzerRow.id));
  });

  try {
    await db.insert(auditLog).values({
      nutzerId: admin.nutzerId,
      aktion: 'kurator.ernannt',
      referenzTyp: 'stadt',
      referenzId: stadtId,
      metadaten: { nutzer_id: nutzerRow.id, email },
    });
  } catch {
    /* audit best-effort */
  }

  redirect('/admin/staedte?ok=kurator_ernannt');
}

export default async function AdminStaedtePage({ searchParams }: PageProps) {
  const sp = await searchParams;

  const rows = await db.select().from(stadt).orderBy(stadt.sortierung, stadt.id);

  // City-Leads-Info zu jeder Stadt nachladen
  const kuratorIds = rows
    .map((r) => r.kuratorId)
    .filter((v): v is string => v !== null);
  const kuratoren = kuratorIds.length
    ? await db
        .select({
          id: nutzer.id,
          anzeigename: nutzer.anzeigename,
          email: nutzer.email,
        })
        .from(nutzer)
        .where(inArray(nutzer.id, kuratorIds))
    : [];
  const kuratorMap = new Map(kuratoren.map((k) => [k.id, k]));

  return (
    <>
      <header className="hero" id="top">
        <div className="wrap hero-grid single">
          <div>
            <p className="eyebrow">Werkzirkel · Admin · Staedte</p>
            <h1>Staedte-Verwaltung</h1>
            <p className="hero-copy">
              Neue Regionen anlegen, Status setzen, City-Leads ernennen.
            </p>
          </div>
        </div>
      </header>

      <section className="section compact">
        <div className="wrap">
          {sp.ok ? (
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
              Aktion erfolgreich ({sp.ok}).
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
              Fehler: {sp.fehler}
            </div>
          ) : null}

          <h2>Vorhandene Staedte</h2>
          <table style={tableStyle} data-testid="admin-staedte-tabelle">
            <thead>
              <tr>
                <th style={thStyle}>Kuerzel</th>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>City-Lead</th>
                <th style={thStyle}>Aktion</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const k = s.kuratorId ? kuratorMap.get(s.kuratorId) : null;
                return (
                  <tr key={s.id}>
                    <td style={tdStyle}>{s.id}</td>
                    <td style={tdStyle}>{s.name}</td>
                    <td style={tdStyle}>
                      <form action={statusAction} style={{ display: 'inline' }}>
                        <input type="hidden" name="id" value={s.id} />
                        <select name="status" defaultValue={s.status}>
                          {stadtStatusEnum.map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>{' '}
                        <button type="submit">setzen</button>
                      </form>
                    </td>
                    <td style={tdStyle}>
                      {k ? `${k.anzeigename} (${k.email})` : '—'}
                    </td>
                    <td style={tdStyle}>
                      <form action={kuratorAction}>
                        <input type="hidden" name="stadt_id" value={s.id} />
                        <input
                          type="email"
                          name="email"
                          placeholder="E-Mail"
                          required
                          style={{ width: 200 }}
                        />{' '}
                        <button type="submit">Kurator ernennen</button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <h2 style={{ marginTop: 32 }}>Neue Stadt anlegen</h2>
          <form
            action={anlegenAction}
            style={{
              display: 'grid',
              gridTemplateColumns: '160px 1fr',
              gap: 10,
              maxWidth: 600,
            }}
            data-testid="admin-stadt-anlegen"
          >
            <label htmlFor="id">Kuerzel (z.B. „k“)</label>
            <input
              id="id"
              name="id"
              type="text"
              required
              maxLength={20}
              pattern="[A-Za-z0-9_\-]+"
            />
            <label htmlFor="name">Name</label>
            <input id="name" name="name" type="text" required maxLength={120} />
            <label htmlFor="status">Status</label>
            <select id="status" name="status" defaultValue="vorbereitung">
              {stadtStatusEnum.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
            <label htmlFor="beschreibung">Beschreibung</label>
            <textarea id="beschreibung" name="beschreibung" maxLength={500} />
            <label htmlFor="sortierung">Sortierung</label>
            <input
              id="sortierung"
              name="sortierung"
              type="number"
              min={0}
              max={10000}
              defaultValue={100}
            />
            <span />
            <button type="submit" className="button primary">
              Stadt anlegen
            </button>
          </form>
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
