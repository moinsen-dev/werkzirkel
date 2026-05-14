/**
 * Render-Tests fuer /admin-Pages.
 *
 * Sichert das Akzeptanz-Kriterium "Alle /admin/*-Routes 403 fuer Nicht-Admins"
 * fuer die Page-Ebene (zusaetzlich zu den API-Tests in admin-backoffice.test.ts).
 *
 * Mockt next/headers und next/navigation analog zu anderen Page-Tests in
 * diesem Repository, damit die Server-Components ohne echten Next.js-Server
 * gerendert werden koennen.
 */

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createId } from '@paralleldrive/cuid2';

import { db } from '@/lib/db';
import { nutzer, session as sessionTable } from '@/lib/db/schema';
import type { Rolle } from '@/lib/db/schema/enums';
import { buildSessionCookie } from '@/lib/auth/session';

import { truncateAll } from '../_helpers/db-cleanup';

// ---- Mocks ------------------------------------------------------

let currentCookie: string | null = null;

vi.mock('next/headers', () => ({
  headers: async () => {
    const m = new Map<string, string>(
      currentCookie ? [['cookie', currentCookie]] : [],
    );
    return {
      entries: () => m.entries(),
      get: (name: string) => m.get(name.toLowerCase()) ?? null,
    };
  },
  cookies: async () => ({ set: () => {} }),
}));

const redirectCalls: string[] = [];
class RedirectError extends Error {
  constructor(public url: string) {
    super(`REDIRECT:${url}`);
  }
}
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    redirectCalls.push(url);
    throw new RedirectError(url);
  },
}));

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  }) =>
    (require('react') as typeof import('react')).createElement(
      'a',
      { href, ...(rest as Record<string, unknown>) },
      children,
    ),
}));

const { renderToStaticMarkup } = await import('react-dom/server');
const AdminLayout = (await import('@/app/admin/layout')).default;
const AdminDashboard = (await import('@/app/admin/page')).default;
const AdminKonfiguration = (await import('@/app/admin/konfiguration/page'))
  .default;

async function nutzerAnlegen(opts: {
  email: string;
  rollen?: Rolle[];
}): Promise<string> {
  const id = createId();
  await db.insert(nutzer).values({
    id,
    email: opts.email,
    klarname: 'Test',
    anzeigename: `anz-${id.slice(0, 6)}`,
    stadtId: 'hh',
    rollen: opts.rollen ?? ['macher'],
    emailVerifiziertAm: new Date(),
  });
  return id;
}

async function sessionAnlegen(nutzerId: string): Promise<string> {
  const sid = createId();
  await db.insert(sessionTable).values({
    id: sid,
    nutzerId,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });
  return sid;
}

function setCookieFromSession(sid: string) {
  currentCookie = buildSessionCookie(sid).split(';')[0]!;
}

describe('/admin Layout', () => {
  beforeEach(async () => {
    redirectCalls.length = 0;
    currentCookie = null;
    await truncateAll();
  });
  afterAll(truncateAll);

  it('Nicht eingeloggt → redirect /anmelden?next=/admin', async () => {
    let err: unknown = null;
    try {
      await AdminLayout({ children: 'kinder' });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(RedirectError);
    expect(redirectCalls[0]).toBe('/anmelden?next=/admin');
  });

  it('Eingeloggt aber kein Admin → rendert 403-Callout, KEIN Redirect', async () => {
    const u = await nutzerAnlegen({ email: 'p403@test.werkzirkel.de' });
    const sid = await sessionAnlegen(u);
    setCookieFromSession(sid);
    const tree = await AdminLayout({ children: 'kinder' });
    const html = renderToStaticMarkup(tree as React.ReactElement);
    expect(html).toContain('403');
    expect(html).toContain('Kein Zugriff');
    expect(redirectCalls).toHaveLength(0);
  });

  it('Admin → rendert Admin-Navigation und Kinder', async () => {
    const a = await nutzerAnlegen({
      email: 'pok@test.werkzirkel.de',
      rollen: ['admin'],
    });
    const sid = await sessionAnlegen(a);
    setCookieFromSession(sid);
    const tree = await AdminLayout({
      children: (require('react') as typeof import('react')).createElement(
        'div',
        null,
        'Kinder-Marker',
      ),
    });
    const html = renderToStaticMarkup(tree as React.ReactElement);
    expect(html).toContain('Admin-Navigation');
    expect(html).toContain('Kinder-Marker');
    expect(html).toContain('Nutzer:innen');
    expect(html).toContain('Audit-Log');
    expect(html).toContain('E-Mail-Log');
    expect(html).toContain('Konfiguration');
  });
});

describe('/admin (Dashboard) und Konfiguration-Stub', () => {
  beforeEach(async () => {
    redirectCalls.length = 0;
    currentCookie = null;
    await truncateAll();
  });
  afterAll(truncateAll);

  it('Dashboard rendert die 9 Count-Karten', async () => {
    const tree = await AdminDashboard();
    const html = renderToStaticMarkup(tree as React.ReactElement);
    expect(html).toContain('Dashboard');
    expect(html).toContain('Nutzer:innen aktiv');
    expect(html).toContain('Offene Meldungen');
    expect(html).toContain('Audit-Eintraege heute');
    expect(html).toContain('E-Mails heute');
    expect(html).toContain('Staedte aktiv');
  });

  it('Konfiguration-Page rendert den Stub-Hinweis', () => {
    const tree = AdminKonfiguration();
    const html = renderToStaticMarkup(tree as React.ReactElement);
    expect(html).toContain('Globale Konfiguration');
    expect(html).toContain('Werkstattbeitrag-Skala');
    expect(html).toContain('Foerdermitgliedschaft-Preise');
    expect(html).toContain('Verbotene Woerter');
  });
});
