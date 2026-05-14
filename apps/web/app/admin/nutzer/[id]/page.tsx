/**
 * /admin/nutzer/[id] — Detail-View einer Nutzer:in mit Sperren/Entsperren-Action.
 *
 * Server-Actions spiegeln POST /api/v1/admin/nutzer/:id/(ent)sperren.
 * Permission via /admin/layout.tsx.
 *
 * PRD-Referenz: §15.14, §F-504.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { auditLog, nutzer, session as sessionTable } from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';
import { istAdmin } from '@/lib/auth/permissions';

export const metadata: Metadata = {
  title: 'Nutzer-Detail — Admin',
};

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; fehler?: string }>;
}

async function buildRequestFromHeaders(): Promise<Request> {
  const h = await headers();
  const headerInit: Record<string, string> = {};
  for (const [name, value] of h.entries()) {
    headerInit[name] = value;
  }
  return new Request('http://internal.werkzirkel/admin/nutzer', {
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

export async function sperrenAction(formData: FormData): Promise<void> {
  'use server';
  const admin = await ensureAdmin();
  if (!admin) {
    redirect('/admin/nutzer?fehler=keine_rolle');
  }
  const id = String(formData.get('id') ?? '').trim();
  if (!id) {
    redirect('/admin/nutzer?fehler=fehlende_id');
  }
  if (id === admin.nutzerId) {
    redirect(`/admin/nutzer/${id}?fehler=self_sperre`);
  }
  const grund = String(formData.get('grund') ?? '').trim() || null;

  const rows = await db
    .select()
    .from(nutzer)
    .where(eq(nutzer.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) {
    redirect('/admin/nutzer?fehler=nicht_gefunden');
  }

  if (row.status !== 'gesperrt') {
    await db
      .update(nutzer)
      .set({ status: 'gesperrt', aktualisiertAm: new Date() })
      .where(eq(nutzer.id, id));
  }
  const deletedSessions = await db
    .delete(sessionTable)
    .where(eq(sessionTable.nutzerId, id))
    .returning({ id: sessionTable.id });

  try {
    await db.insert(auditLog).values({
      nutzerId: admin.nutzerId,
      aktion: 'nutzer.gesperrt',
      referenzTyp: 'nutzer',
      referenzId: id,
      metadaten: {
        grund,
        sessions_invalidiert: deletedSessions.length,
      },
    });
  } catch {
    /* audit best-effort */
  }
  redirect(`/admin/nutzer/${id}?ok=gesperrt`);
}

export async function entsperrenAction(formData: FormData): Promise<void> {
  'use server';
  const admin = await ensureAdmin();
  if (!admin) {
    redirect('/admin/nutzer?fehler=keine_rolle');
  }
  const id = String(formData.get('id') ?? '').trim();
  if (!id) {
    redirect('/admin/nutzer?fehler=fehlende_id');
  }
  const rows = await db
    .select()
    .from(nutzer)
    .where(eq(nutzer.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) {
    redirect('/admin/nutzer?fehler=nicht_gefunden');
  }
  if (row.status !== 'aktiv') {
    await db
      .update(nutzer)
      .set({ status: 'aktiv', aktualisiertAm: new Date() })
      .where(eq(nutzer.id, id));
  }
  try {
    await db.insert(auditLog).values({
      nutzerId: admin.nutzerId,
      aktion: 'nutzer.entsperrt',
      referenzTyp: 'nutzer',
      referenzId: id,
      metadaten: { vorheriger_status: row.status },
    });
  } catch {
    /* audit best-effort */
  }
  redirect(`/admin/nutzer/${id}?ok=entsperrt`);
}

export default async function AdminNutzerDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const sp = await searchParams;

  const rows = await db.select().from(nutzer).where(eq(nutzer.id, id)).limit(1);
  const row = rows[0];

  if (!row) {
    return (
      <section className="section compact">
        <div className="wrap">
          <p>Nutzer:in nicht gefunden.</p>
          <p>
            <Link href="/admin/nutzer">← zur Liste</Link>
          </p>
        </div>
      </section>
    );
  }

  const sessions = await db
    .select({ id: sessionTable.id, expiresAt: sessionTable.expiresAt })
    .from(sessionTable)
    .where(eq(sessionTable.nutzerId, id));

  return (
    <>
      <header className="hero" id="top">
        <div className="wrap hero-grid single">
          <div>
            <p className="eyebrow">Werkzirkel · Admin · Nutzer-Detail</p>
            <h1>{row.anzeigename}</h1>
            <p className="hero-copy">{row.email}</p>
          </div>
        </div>
      </header>

      <section className="section compact">
        <div className="wrap">
          <p>
            <Link href="/admin/nutzer">← zur Liste</Link>
          </p>

          {sp.ok === 'gesperrt' ? (
            <Banner kind="ok">Konto gesperrt + Sessions invalidiert.</Banner>
          ) : null}
          {sp.ok === 'entsperrt' ? (
            <Banner kind="ok">Konto entsperrt.</Banner>
          ) : null}
          {sp.fehler === 'self_sperre' ? (
            <Banner kind="err">Du kannst dich nicht selbst sperren.</Banner>
          ) : null}

          <dl style={dlStyle} data-testid="admin-nutzer-detail">
            <dt>Klarname</dt>
            <dd>{row.klarname}</dd>
            <dt>Stadt</dt>
            <dd>{row.stadtId}</dd>
            <dt>Rollen</dt>
            <dd>{row.rollen.join(', ')}</dd>
            <dt>Status</dt>
            <dd data-testid="status-cell">{row.status}</dd>
            <dt>Aktive Sessions</dt>
            <dd>{sessions.length}</dd>
            <dt>Konto angelegt</dt>
            <dd>{row.erstelltAm.toISOString().slice(0, 10)}</dd>
          </dl>

          <div style={{ marginTop: 16, display: 'flex', gap: 12 }}>
            {row.status !== 'gesperrt' ? (
              <form action={sperrenAction}>
                <input type="hidden" name="id" value={row.id} />
                <label style={{ display: 'block', marginBottom: 8 }}>
                  Grund (optional)
                  <br />
                  <input
                    type="text"
                    name="grund"
                    placeholder="z.B. Spam-Werbung"
                    style={{ width: 300 }}
                  />
                </label>
                <button type="submit" className="button primary">
                  Konto sperren
                </button>
              </form>
            ) : (
              <form action={entsperrenAction}>
                <input type="hidden" name="id" value={row.id} />
                <button type="submit" className="button primary">
                  Konto entsperren
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
    </>
  );
}

function Banner({
  kind,
  children,
}: {
  kind: 'ok' | 'err';
  children: React.ReactNode;
}) {
  const style: React.CSSProperties =
    kind === 'ok'
      ? {
          background: '#e7f5ec',
          border: '1px solid #2a8c4a',
          color: '#1a4a26',
        }
      : {
          background: '#fbeaea',
          border: '1px solid #d04848',
          color: '#5a1a1a',
        };
  return (
    <div
      role={kind === 'ok' ? 'status' : 'alert'}
      style={{
        marginBottom: 12,
        padding: 12,
        borderRadius: 10,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

const dlStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'max-content 1fr',
  gap: '6px 16px',
  marginTop: 12,
};
