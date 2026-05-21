/**
 * Sprach-Check fuer die `/uebersicht`-Seite.
 *
 * Acceptance-Criterion: kein englischer String im HTML-Output. Wir mocken
 * `next/headers`, `next/navigation`, `next/link` und das DB-Modul, rendern
 * die Page in einem Logged-In-Zustand und pruefen gegen eine Verbots-Liste.
 *
 * Liegt im `unit/`-Ordner (happy-dom-Env), damit kein echter Postgres
 * gebraucht wird — DB-Antworten werden vollstaendig gemockt.
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('next/headers', () => ({
  headers: async () => ({
    entries: () => [['cookie', 'wz_session=stubsession']][Symbol.iterator](),
    get: (name: string) =>
      name.toLowerCase() === 'cookie' ? 'wz_session=stubsession' : null,
  }),
  cookies: async () => ({
    set: () => {
      /* no-op */
    },
  }),
}));

vi.mock('next/navigation', () => ({
  redirect: (target: string) => {
    const err = new Error(`NEXT_REDIRECT: ${target}`);
    (err as Error & { digest: string }).digest = `NEXT_REDIRECT;replace;${target};307;`;
    throw err;
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
  }) => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return (require('react') as typeof import('react')).createElement(
      'a',
      { href, ...(rest as Record<string, unknown>) },
      children,
    );
  },
}));

// Session-Helper mocken — wir simulieren einen gueltigen Login mit voll
// gefuellten Feldern (Klarname, alle Rollen-Labels, etc.), damit moeglichst
// viele Code-Pfade ausgelesen werden.
vi.mock('@/lib/auth/session', () => ({
  getSessionFromRequest: async () => ({
    id: 'stub-session-id',
    nutzerId: 'stub-user-id',
    expiresAt: new Date(Date.now() + 60_000),
    userAgent: null,
    ipAdresse: null,
    nutzer: {
      id: 'stub-user-id',
      email: 'stub@test.werkzirkel.de',
      emailVerifiziertAm: new Date(),
      klarname: 'Lara Beispielname',
      anzeigename: 'lara',
      stadtId: 'hh',
      kurzbeschreibung: null,
      faehigkeiten: [],
      interessen: [],
      rollen: ['macher', 'kurator'],
      website: null,
      github: null,
      linkedin: null,
      mastodon: null,
      avatarUrl: null,
      teilnahmeart: null,
      foerdermitgliedSeit: null,
      foerdermitgliedBis: null,
      benachrichtigungsEinstellungen: {},
      status: 'aktiv',
      loeschungAnstehendBis: null,
      erstelltAm: new Date(),
      aktualisiertAm: new Date(),
    },
  }),
  buildClearSessionCookie: () => 'wz_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0',
}));

// DB-Modul mocken — die Page macht zwei Selects (stadt + test_saldo).
vi.mock('@/lib/db', () => {
  function chain(rows: unknown[]): {
    from: () => { where: () => { limit: () => unknown[] } };
  } {
    return {
      from: () => ({
        where: () => ({
          limit: () => rows,
        }),
      }),
    };
  }
  let selectCallCount = 0;
  return {
    db: {
      select: () => {
        selectCallCount += 1;
        // 1. Call: stadt-Lookup, 2. Call: testSaldo-Lookup
        if (selectCallCount === 1) {
          return chain([
            { id: 'hh', name: 'Hamburg', status: 'aktiv', sortierung: 10 },
          ]);
        }
        return chain([]);
      },
      delete: () => ({
        where: () => Promise.resolve([]),
      }),
    },
  };
});

const { renderToStaticMarkup } = await import('react-dom/server');
const UebersichtModule = await import('@/app/uebersicht/page');
const UebersichtPage = UebersichtModule.default;

const VERBOTENE_BEGRIFFE = [
  'Sign in',
  'Sign out',
  'Sign-in',
  'Sign-up',
  'Logout',
  'Log out',
  'Log in',
  'Login',
  'Dashboard',
  'Welcome',
  'Profile',
  'Settings',
  'Quick access',
  'Overview',
  'Balance',
  'Given',
  'Received',
  'Open',
  'Coming soon',
  'In preparation',
  'Submit',
];

async function renderPage(): Promise<string> {
  const tree = await UebersichtPage();
  return renderToStaticMarkup(tree);
}

describe('/uebersicht Sprach-Check', () => {
  it('enthaelt keine englischen Begriffe', async () => {
    const html = await renderPage();
    for (const begriff of VERBOTENE_BEGRIFFE) {
      expect(html, `verbotener Begriff "${begriff}" gefunden`).not.toContain(
        begriff,
      );
    }
  });

  it('rendert die deutsche Begruessung mit Anzeigename', async () => {
    const html = await renderPage();
    expect(html).toContain('Hallo, lara.');
    expect(html).toContain('Builder-Profil');
    expect(html).toContain('Feedback-Saldo');
    expect(html).toContain('Schnellzugriff');
  });
});
