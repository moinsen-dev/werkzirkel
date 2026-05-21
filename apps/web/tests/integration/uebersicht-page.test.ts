/**
 * Integration-Tests fuer die `/uebersicht`-Seite (Server Component).
 *
 * Wir mocken `next/headers`, `next/navigation` und `next/link` und rufen
 * die Page-Komponente direkt auf. `redirect()` wirft einen sentinel
 * Error, den wir abfangen und auf den Ziel-Pfad pruefen.
 *
 * Die Page laeuft gegen die echte Test-DB — Sessions, Nutzer:innen und
 * `test_saldo`-Rows werden via Helper-Funktionen angelegt und nach jedem
 * Test ueber `truncateAll()` aufgeraeumt.
 */

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createId } from '@paralleldrive/cuid2';
import { eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import {
  nutzer,
  session as sessionTable,
  testSaldo,
} from '@/lib/db/schema';
import { truncateAll } from '../_helpers/db-cleanup';

// `next/link` zieht Client-Component-Internals — fuer den Server-Render
// in Tests ersetzen wir es durch eine schmale Komponente.
vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (require('react') as typeof import('react')).createElement(
      'a',
      { href, ...(rest as Record<string, unknown>) },
      children,
    );
  },
}));

let mockHeaders = new Map<string, string>();
let lastRedirect: string | null = null;

vi.mock('next/headers', () => ({
  headers: async () => ({
    entries: () => mockHeaders.entries(),
    get: (name: string) => mockHeaders.get(name.toLowerCase()) ?? null,
  }),
  cookies: async () => ({
    set: () => {
      /* no-op fuer Render-Pfad */
    },
  }),
}));

vi.mock('next/navigation', () => ({
  redirect: (target: string) => {
    lastRedirect = target;
    const err = new Error(`NEXT_REDIRECT: ${target}`);
    (err as Error & { digest: string }).digest = `NEXT_REDIRECT;replace;${target};307;`;
    throw err;
  },
}));

// Erst nach den Mocks importieren.
const { renderToStaticMarkup } = await import('react-dom/server');
const UebersichtModule = await import('@/app/uebersicht/page');
const UebersichtPage = UebersichtModule.default;

const TEST_EMAIL = 'uebersicht-page@test.werkzirkel.de';
const TEST_EMAIL_OFFEN = 'uebersicht-offen@test.werkzirkel.de';

async function reset(): Promise<void> {
  await truncateAll();
  mockHeaders = new Map();
  lastRedirect = null;
}

async function createUser(
  email: string,
  overrides: Partial<typeof nutzer.$inferInsert> = {},
): Promise<string> {
  const id = createId();
  await db.insert(nutzer).values({
    id,
    email,
    klarname: 'Übersicht Tester',
    anzeigename: 'uebersicht-test',
    stadtId: 'hh',
    rollen: ['macher'],
    emailVerifiziertAm: new Date(),
    ...overrides,
  });
  return id;
}

async function createSessionFor(nutzerId: string): Promise<string> {
  const id = createId();
  await db.insert(sessionTable).values({
    id,
    nutzerId,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });
  return id;
}

function setSessionCookie(sid: string): void {
  mockHeaders.set('cookie', `wz_session=${encodeURIComponent(sid)}`);
}

async function renderWithSession(sid: string | null): Promise<string> {
  if (sid) setSessionCookie(sid);
  try {
    const tree = await UebersichtPage();
    return renderToStaticMarkup(tree);
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('NEXT_REDIRECT')) {
      return '';
    }
    throw err;
  }
}

describe('/uebersicht page', () => {
  beforeEach(reset);
  afterAll(reset);

  it('ohne Session → redirect zu /anmelden?next=/uebersicht', async () => {
    const html = await renderWithSession(null);
    expect(html).toBe('');
    expect(lastRedirect).toBe('/anmelden?next=/uebersicht');
  });

  it('mit gueltiger Session → 200, rendert Anzeigename und Feedback-Saldo', async () => {
    const userId = await createUser(TEST_EMAIL, {
      anzeigename: 'Lara aus HH',
    });
    const sid = await createSessionFor(userId);
    const html = await renderWithSession(sid);
    expect(lastRedirect).toBeNull();
    expect(html).toContain('Hallo, Lara aus HH.');
    expect(html).toContain('Feedback-Saldo');
  });

  it('ohne test_saldo-Row → rendert 0/0/0 (keine `undefined`)', async () => {
    const userId = await createUser(TEST_EMAIL);
    const sid = await createSessionFor(userId);
    const html = await renderWithSession(sid);
    expect(html).not.toContain('undefined');
    // Drei Zahlen "0" in den Saldo-Boxen.
    const occurrences = html.match(/<strong>0<\/strong>/g) ?? [];
    expect(occurrences.length).toBeGreaterThanOrEqual(3);
  });

  it('mit offene_verpflichtung_anzahl > 0 → roter Hinweis-Banner', async () => {
    const userId = await createUser(TEST_EMAIL_OFFEN);
    const sid = await createSessionFor(userId);
    await db.insert(testSaldo).values({
      nutzerId: userId,
      testsGegeben: 1,
      testsErhalten: 0,
      offeneVerpflichtungAnzahl: 2,
      naechsteVerpflichtungFrist: new Date('2026-06-01T12:00:00Z'),
    });
    const html = await renderWithSession(sid);
    expect(html).toContain('role="alert"');
    expect(html).toContain('2 offene Feedback-Schulden');
    expect(html).toContain('01.06.2026');
  });

  it('rendert Abmelden-Button und Werkpass-Link', async () => {
    const userId = await createUser(TEST_EMAIL);
    const sid = await createSessionFor(userId);
    const html = await renderWithSession(sid);
    expect(html).toContain('Abmelden');
    expect(html).toContain('Builder-Profil bearbeiten');
    expect(html).toMatch(/href="\/einstellungen\?tab=profil"/);
  });

  it('rendert Schnellzugriff-Karten mit echten Links (Werke, Pruefrunden, Termine)', async () => {
    const userId = await createUser(TEST_EMAIL);
    const sid = await createSessionFor(userId);
    const html = await renderWithSession(sid);
    expect(html).toContain('Schnellzugriff');
    expect(html).toContain('Meine Builds');
    expect(html).toContain('Meine Feedback-Loops');
    // Stubs wurden in wp-werkpass-werke, wp-pruefrunden und wp-termine
    // aufgeloest — die Links zeigen jetzt auf echte Routen.
    expect(html).toMatch(/href="\/uebersicht\/werke"/);
    expect(html).toMatch(/href="\/uebersicht\/pruefrunden"/);
  });

  // Session-DB-Lookup wird vom Helper validiert
  it('Session-Row in DB → Page rendert', async () => {
    const userId = await createUser(TEST_EMAIL);
    const sid = await createSessionFor(userId);
    const sessionRows = await db
      .select()
      .from(sessionTable)
      .where(eq(sessionTable.id, sid));
    expect(sessionRows.length).toBe(1);
    const html = await renderWithSession(sid);
    expect(html).toContain('Builder-Profil');
  });
});
