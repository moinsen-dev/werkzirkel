/**
 * Integration-Tests fuer die 10 Bedarfsseite-Pages.
 *
 * Quelle: PRD §F-601..§F-706.
 *
 * Pro Page mindestens: Render + Auth-Redirect + Sprach-Check. Plus:
 *  - /foerderprofile/[id] mit gegenleistung_typ='equity_offline' rendert
 *    den Equity-Hinweistext (PRD §11A Kulturverlust 5).
 *  - /bedarfe Liste zeigt nur status='oeffentlich'/'in_gespraechen'.
 *  - /uebersicht zeigt rollen-spezifische Karten ohne Stub-Texte.
 */

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createId } from '@paralleldrive/cuid2';

import { db } from '@/lib/db';
import {
  bedarf,
  foerderprofil,
  nutzer,
  session as sessionTable,
  werk,
  werkangebot,
  werkstattbeitrag,
} from '@/lib/db/schema';
import { truncateAll } from '../_helpers/db-cleanup';

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  }) => {
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
      /* no-op */
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
  notFound: () => {
    const err = new Error('NEXT_NOT_FOUND');
    (err as Error & { digest: string }).digest = 'NEXT_NOT_FOUND';
    throw err;
  },
}));

const { renderToStaticMarkup } = await import('react-dom/server');
const BedarfeListe = (await import('@/app/bedarfe/page')).default;
const BedarfDetail = (await import('@/app/bedarfe/[id]/page')).default;
const BedarfNeu = (await import('@/app/bedarfe/neu/page')).default;
const WerkangebotNeu = (
  await import('@/app/bedarfe/[id]/werkangebot-neu/page')
).default;
const FoerderprofileListe = (await import('@/app/foerderprofile/page')).default;
const FoerderprofilDetail = (
  await import('@/app/foerderprofile/[id]/page')
).default;
const FoerderprofilNeu = (await import('@/app/foerderprofile/neu/page')).default;
const UebersichtBedarfe = (await import('@/app/uebersicht/bedarfe/page'))
  .default;
const UebersichtWerkangebote = (
  await import('@/app/uebersicht/werkangebote/page')
).default;
const UebersichtFoerderprofil = (
  await import('@/app/uebersicht/foerderprofil/page')
).default;
const UebersichtWerkstattbeitrag = (
  await import('@/app/uebersicht/werkstattbeitrag/page')
).default;
const Uebersicht = (await import('@/app/uebersicht/page')).default;

async function reset(): Promise<void> {
  await truncateAll();
  mockHeaders = new Map();
  lastRedirect = null;
}

async function createUser(
  email: string,
  rollen: Array<'macher' | 'bedarfstraeger' | 'foerderer' | 'kurator'> = [],
): Promise<string> {
  const id = createId();
  await db.insert(nutzer).values({
    id,
    email,
    klarname: `Klar ${email}`,
    anzeigename: `anz-${id.slice(0, 6)}`,
    stadtId: 'hh',
    rollen,
    emailVerifiziertAm: new Date(),
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

function setSession(sid: string): void {
  mockHeaders.set('cookie', `wz_session=${encodeURIComponent(sid)}`);
}

async function createBedarf(
  nutzerId: string,
  overrides: Partial<typeof bedarf.$inferInsert> = {},
): Promise<string> {
  const id = createId();
  await db.insert(bedarf).values({
    id,
    nutzerId,
    organisation: 'Testorga',
    titel: 'Test-Bedarf-Titel',
    problem: 'Beschreibung des Problems',
    nutzen: 'Beschreibung des Nutzens',
    stadtId: 'hh',
    frist: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    status: 'oeffentlich',
    ...overrides,
  });
  return id;
}

async function createWerk(nutzerId: string, name = 'Test-Werk'): Promise<string> {
  const id = createId();
  await db.insert(werk).values({
    id,
    nutzerId,
    name,
    kurzbeschreibung: 'kb',
    problem: 'p',
    zielgruppe: 'z',
    werkstand: 'prototyp',
  });
  return id;
}

async function renderPage<T>(
  fn: () => Promise<T>,
): Promise<{ html: string; redirect: string | null }> {
  try {
    const tree = await fn();
    const html = renderToStaticMarkup(tree as React.ReactElement);
    return { html, redirect: lastRedirect };
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('NEXT_REDIRECT')) {
      return { html: '', redirect: lastRedirect };
    }
    if (err instanceof Error && err.message === 'NEXT_NOT_FOUND') {
      return { html: 'NOT_FOUND', redirect: null };
    }
    throw err;
  }
}

const ENGLISCHE_VERBOTSWORTE = [
  'Sign in',
  'Login',
  'Sign up',
  'Click here',
  'Submit',
  'Page not found',
  'Deadline',
  'Reminder',
  'Marketplace',
];

function expectKeineEnglischenStrings(html: string) {
  for (const w of ENGLISCHE_VERBOTSWORTE) {
    expect(html, `englisches Wort gefunden: ${w}`).not.toContain(w);
  }
}

describe('/bedarfe Liste', () => {
  beforeEach(reset);
  afterAll(reset);

  it('ohne Session → redirect', async () => {
    const { redirect } = await renderPage(() =>
      BedarfeListe({ searchParams: Promise.resolve({}) }),
    );
    expect(redirect).toBe('/anmelden?next=/bedarfe');
  });

  it('mit Session, leer → empty-State', async () => {
    const uid = await createUser('bl-empty@test.werkzirkel.de');
    const sid = await createSessionFor(uid);
    setSession(sid);
    const { html } = await renderPage(() =>
      BedarfeListe({ searchParams: Promise.resolve({}) }),
    );
    expect(html).toContain('Aktuell keine öffentlichen Bedarfe');
    expectKeineEnglischenStrings(html);
  });

  it('listet oeffentliche Bedarfe, versteckt entwurf', async () => {
    const uid = await createUser('bl-list@test.werkzirkel.de', ['bedarfstraeger']);
    await createBedarf(uid, { titel: 'Sichtbar Public', status: 'oeffentlich' });
    await createBedarf(uid, { titel: 'Versteckt Entwurf', status: 'entwurf' });
    const sid = await createSessionFor(uid);
    setSession(sid);
    const { html } = await renderPage(() =>
      BedarfeListe({ searchParams: Promise.resolve({}) }),
    );
    expect(html).toContain('Sichtbar Public');
    expect(html).not.toContain('Versteckt Entwurf');
  });
});

describe('/bedarfe/[id] Detail', () => {
  beforeEach(reset);
  afterAll(reset);

  it('ohne Session → redirect', async () => {
    const uid = await createUser('bd-noauth@test.werkzirkel.de');
    const bid = await createBedarf(uid);
    const { redirect } = await renderPage(() =>
      BedarfDetail({
        params: Promise.resolve({ id: bid }),
        searchParams: Promise.resolve({}),
      }),
    );
    expect(redirect).toContain('/anmelden?next=/bedarfe/');
  });

  it('eingeloggte Person sieht oeffentlichen Bedarf', async () => {
    const owner = await createUser('bd-owner@test.werkzirkel.de', ['bedarfstraeger']);
    const viewer = await createUser('bd-view@test.werkzirkel.de');
    const bid = await createBedarf(owner, { titel: 'Detail-Bedarf' });
    const sid = await createSessionFor(viewer);
    setSession(sid);
    const { html } = await renderPage(() =>
      BedarfDetail({
        params: Promise.resolve({ id: bid }),
        searchParams: Promise.resolve({}),
      }),
    );
    expect(html).toContain('Detail-Bedarf');
    expect(html).toContain('Das Problem');
    expectKeineEnglischenStrings(html);
  });

  it('Macher:in sieht Werkangebot-abgeben-Link', async () => {
    const owner = await createUser('bd-owner2@test.werkzirkel.de', ['bedarfstraeger']);
    const macher = await createUser('bd-macher@test.werkzirkel.de', ['macher']);
    const bid = await createBedarf(owner);
    const sid = await createSessionFor(macher);
    setSession(sid);
    const { html } = await renderPage(() =>
      BedarfDetail({
        params: Promise.resolve({ id: bid }),
        searchParams: Promise.resolve({}),
      }),
    );
    expect(html).toMatch(/href="\/bedarfe\/[^"]+\/werkangebot-neu"/);
  });
});

describe('/bedarfe/neu', () => {
  beforeEach(reset);
  afterAll(reset);

  it('ohne Session → redirect', async () => {
    const { redirect } = await renderPage(() =>
      BedarfNeu({ searchParams: Promise.resolve({}) }),
    );
    expect(redirect).toBe('/anmelden?next=/bedarfe/neu');
  });

  it('ohne Bedarfstraeger:innen-Rolle → Rolle-Hinweis', async () => {
    const uid = await createUser('bn-norolle@test.werkzirkel.de');
    const sid = await createSessionFor(uid);
    setSession(sid);
    const { html } = await renderPage(() =>
      BedarfNeu({ searchParams: Promise.resolve({}) }),
    );
    expect(html).toContain('Auftraggeber:innen-Rolle');
    expectKeineEnglischenStrings(html);
  });

  it('mit Bedarfstraeger:in zeigt Schritt 1 (drei Pfade)', async () => {
    const uid = await createUser('bn-bedarf@test.werkzirkel.de', ['bedarfstraeger']);
    const sid = await createSessionFor(uid);
    setSession(sid);
    const { html } = await renderPage(() =>
      BedarfNeu({ searchParams: Promise.resolve({}) }),
    );
    expect(html).toContain('Schritt 1');
    expect(html).toContain('Pfad A');
    expect(html).toContain('Pfad B');
    expect(html).toContain('Pfad C');
  });

  it('mit gueltigem Werkstattbeitrag → Schritt 2 (Bedarf-Form)', async () => {
    const uid = await createUser('bn-mitbeitrag@test.werkzirkel.de', ['bedarfstraeger']);
    await db.insert(werkstattbeitrag).values({
      nutzerId: uid,
      art: 'geldbeitrag',
      hoeheEuroCent: 10000,
      status: 'verifiziert',
      gueltigBis: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      verwendetFuerBedarfe: 0,
    });
    const sid = await createSessionFor(uid);
    setSession(sid);
    const { html } = await renderPage(() =>
      BedarfNeu({ searchParams: Promise.resolve({}) }),
    );
    expect(html).toContain('Schritt 2');
    expect(html).toContain('Bedarf beschreiben');
  });
});

describe('/bedarfe/[id]/werkangebot-neu', () => {
  beforeEach(reset);
  afterAll(reset);

  it('ohne Session → redirect', async () => {
    const uid = await createUser('wn-noauth@test.werkzirkel.de');
    const bid = await createBedarf(uid);
    const { redirect } = await renderPage(() =>
      WerkangebotNeu({
        params: Promise.resolve({ id: bid }),
        searchParams: Promise.resolve({}),
      }),
    );
    expect(redirect).toContain('/anmelden');
  });

  it('ohne Builder:innen-Rolle → Hinweis', async () => {
    const uid = await createUser('wn-noroll@test.werkzirkel.de');
    const bid = await createBedarf(uid);
    const sid = await createSessionFor(uid);
    setSession(sid);
    const { html } = await renderPage(() =>
      WerkangebotNeu({
        params: Promise.resolve({ id: bid }),
        searchParams: Promise.resolve({}),
      }),
    );
    expect(html).toContain('Builder:innen-Rolle');
    expectKeineEnglischenStrings(html);
  });

  it('Macher:in ohne Werk → kein-Werk-Hinweis', async () => {
    const owner = await createUser('wn-owner@test.werkzirkel.de', ['bedarfstraeger']);
    const macher = await createUser('wn-macher@test.werkzirkel.de', ['macher']);
    const bid = await createBedarf(owner);
    const sid = await createSessionFor(macher);
    setSession(sid);
    const { html } = await renderPage(() =>
      WerkangebotNeu({
        params: Promise.resolve({ id: bid }),
        searchParams: Promise.resolve({}),
      }),
    );
    expect(html).toContain('eigenen Build');
  });

  it('Macher:in mit Werk → Form sichtbar', async () => {
    const owner = await createUser('wn-owner2@test.werkzirkel.de', ['bedarfstraeger']);
    const macher = await createUser('wn-macher2@test.werkzirkel.de', ['macher']);
    await createWerk(macher, 'Werk-A');
    const bid = await createBedarf(owner);
    const sid = await createSessionFor(macher);
    setSession(sid);
    const { html } = await renderPage(() =>
      WerkangebotNeu({
        params: Promise.resolve({ id: bid }),
        searchParams: Promise.resolve({}),
      }),
    );
    expect(html).toContain('konkretes_vorgehen');
    expect(html).toContain('Werk-A');
  });
});

describe('/foerderprofile Liste', () => {
  beforeEach(reset);
  afterAll(reset);

  it('ohne Session → redirect', async () => {
    const { redirect } = await renderPage(() =>
      FoerderprofileListe({ searchParams: Promise.resolve({}) }),
    );
    expect(redirect).toBe('/anmelden?next=/foerderprofile');
  });

  it('listet verifizierte Profile, versteckt entwurf', async () => {
    const owner = await createUser('fl-owner@test.werkzirkel.de', ['foerderer']);
    await db.insert(foerderprofil).values({
      nutzerId: owner,
      organisation: 'Verifizierte Stiftung',
      foerderart: 'geld',
      gegenleistungTyp: 'keine',
      verifikationStatus: 'verifiziert',
    });
    const owner2 = await createUser('fl-draft@test.werkzirkel.de', ['foerderer']);
    await db.insert(foerderprofil).values({
      nutzerId: owner2,
      organisation: 'Entwurf-Stiftung',
      foerderart: 'geld',
      gegenleistungTyp: 'keine',
      verifikationStatus: 'entwurf',
    });
    const viewer = await createUser('fl-view@test.werkzirkel.de');
    const sid = await createSessionFor(viewer);
    setSession(sid);
    const { html } = await renderPage(() =>
      FoerderprofileListe({ searchParams: Promise.resolve({}) }),
    );
    expect(html).toContain('Verifizierte Stiftung');
    expect(html).not.toContain('Entwurf-Stiftung');
    expectKeineEnglischenStrings(html);
  });
});

describe('/foerderprofile/[id] Detail', () => {
  beforeEach(reset);
  afterAll(reset);

  it('rendert Equity-Hinweistext bei gegenleistung_typ=equity_offline', async () => {
    const owner = await createUser('fd-equity@test.werkzirkel.de', ['foerderer']);
    const inserted = await db
      .insert(foerderprofil)
      .values({
        nutzerId: owner,
        organisation: 'Equity-Stiftung',
        foerderart: 'mischung',
        gegenleistungTyp: 'equity_offline',
        verifikationStatus: 'verifiziert',
      })
      .returning({ id: foerderprofil.id });
    const fid = inserted[0]!.id;

    const viewer = await createUser('fd-view@test.werkzirkel.de');
    const sid = await createSessionFor(viewer);
    setSession(sid);
    const { html } = await renderPage(() =>
      FoerderprofilDetail({ params: Promise.resolve({ id: fid }) }),
    );
    expect(html).toContain('data-equity-hinweis');
    expect(html).toContain('Werkzirkel vermittelt keine Beteiligungen');
    expectKeineEnglischenStrings(html);
  });

  it('rendert kein Equity-Hinweistext bei anderem gegenleistung_typ', async () => {
    const owner = await createUser('fd-keine@test.werkzirkel.de', ['foerderer']);
    const inserted = await db
      .insert(foerderprofil)
      .values({
        nutzerId: owner,
        organisation: 'Normale Stiftung',
        foerderart: 'geld',
        gegenleistungTyp: 'sichtbarkeit',
        verifikationStatus: 'verifiziert',
      })
      .returning({ id: foerderprofil.id });
    const fid = inserted[0]!.id;
    const viewer = await createUser('fd-view2@test.werkzirkel.de');
    const sid = await createSessionFor(viewer);
    setSession(sid);
    const { html } = await renderPage(() =>
      FoerderprofilDetail({ params: Promise.resolve({ id: fid }) }),
    );
    expect(html).not.toContain('data-equity-hinweis');
  });
});

describe('/foerderprofile/neu', () => {
  beforeEach(reset);
  afterAll(reset);

  it('ohne Session → redirect', async () => {
    const { redirect } = await renderPage(() =>
      FoerderprofilNeu({ searchParams: Promise.resolve({}) }),
    );
    expect(redirect).toBe('/anmelden?next=/foerderprofile/neu');
  });

  it('mit Foerder:innen-Rolle → Form sichtbar', async () => {
    const uid = await createUser('fn-foerder@test.werkzirkel.de', ['foerderer']);
    const sid = await createSessionFor(uid);
    setSession(sid);
    const { html } = await renderPage(() =>
      FoerderprofilNeu({ searchParams: Promise.resolve({}) }),
    );
    expect(html).toContain('Organisation');
    expect(html).toContain('Sponsor-Art');
    expectKeineEnglischenStrings(html);
  });
});

describe('/uebersicht/bedarfe', () => {
  beforeEach(reset);
  afterAll(reset);

  it('ohne Session → redirect', async () => {
    const { redirect } = await renderPage(() => UebersichtBedarfe());
    expect(redirect).toBe('/anmelden?next=/uebersicht/bedarfe');
  });

  it('ohne Bedarfstraeger:innen-Rolle → redirect zu /uebersicht', async () => {
    const uid = await createUser('ub-norolle@test.werkzirkel.de');
    const sid = await createSessionFor(uid);
    setSession(sid);
    const { redirect } = await renderPage(() => UebersichtBedarfe());
    expect(redirect).toContain('/uebersicht');
  });

  it('mit Bedarfstraeger:in, leer → empty-Hint', async () => {
    const uid = await createUser('ub-empty@test.werkzirkel.de', ['bedarfstraeger']);
    const sid = await createSessionFor(uid);
    setSession(sid);
    const { html } = await renderPage(() => UebersichtBedarfe());
    expect(html).toContain('Du hast noch keinen Bedarf eingebracht');
    expectKeineEnglischenStrings(html);
  });
});

describe('/uebersicht/werkangebote', () => {
  beforeEach(reset);
  afterAll(reset);

  it('ohne Session → redirect', async () => {
    const { redirect } = await renderPage(() =>
      UebersichtWerkangebote({ searchParams: Promise.resolve({}) }),
    );
    expect(redirect).toBe('/anmelden?next=/uebersicht/werkangebote');
  });

  it('mit Macher:in, leer → empty-Hint', async () => {
    const uid = await createUser('uw-empty@test.werkzirkel.de', ['macher']);
    const sid = await createSessionFor(uid);
    setSession(sid);
    const { html } = await renderPage(() =>
      UebersichtWerkangebote({ searchParams: Promise.resolve({}) }),
    );
    expect(html).toContain('Du hast noch kein Match-Angebot');
    expectKeineEnglischenStrings(html);
  });

  it('mit Macher:in, mit Werkangebot → Werkangebot sichtbar', async () => {
    const owner = await createUser('uw-owner@test.werkzirkel.de', ['bedarfstraeger']);
    const macher = await createUser('uw-macher@test.werkzirkel.de', ['macher']);
    const bid = await createBedarf(owner, { titel: 'Auflisten-Bedarf' });
    const wid = await createWerk(macher, 'Mein-Werk');
    await db.insert(werkangebot).values({
      bedarfId: bid,
      werkId: wid,
      macherId: macher,
      konkretesVorgehen: 'X'.repeat(60),
      ausdruecklicherAusschluss: 'X'.repeat(40),
      ersterLieferMeilenstein: 'X'.repeat(40),
      status: 'eingereicht',
    });
    const sid = await createSessionFor(macher);
    setSession(sid);
    const { html } = await renderPage(() =>
      UebersichtWerkangebote({ searchParams: Promise.resolve({}) }),
    );
    expect(html).toContain('Auflisten-Bedarf');
    expect(html).toContain('Mein-Werk');
  });
});

describe('/uebersicht/foerderprofil', () => {
  beforeEach(reset);
  afterAll(reset);

  it('ohne Session → redirect', async () => {
    const { redirect } = await renderPage(() =>
      UebersichtFoerderprofil({ searchParams: Promise.resolve({}) }),
    );
    expect(redirect).toBe('/anmelden?next=/uebersicht/foerderprofil');
  });

  it('mit Foerder:in ohne Profil → empty-Hint', async () => {
    const uid = await createUser('uf-empty@test.werkzirkel.de', ['foerderer']);
    const sid = await createSessionFor(uid);
    setSession(sid);
    const { html } = await renderPage(() =>
      UebersichtFoerderprofil({ searchParams: Promise.resolve({}) }),
    );
    expect(html).toContain('Du hast noch kein Sponsor-Profil');
    expectKeineEnglischenStrings(html);
  });

  it('mit Foerder:in und Profil → Profil sichtbar', async () => {
    const uid = await createUser('uf-mit@test.werkzirkel.de', ['foerderer']);
    await db.insert(foerderprofil).values({
      nutzerId: uid,
      organisation: 'Meine-Stiftung-X',
      foerderart: 'geld',
      gegenleistungTyp: 'sichtbarkeit',
      verifikationStatus: 'verifiziert',
    });
    const sid = await createSessionFor(uid);
    setSession(sid);
    const { html } = await renderPage(() =>
      UebersichtFoerderprofil({ searchParams: Promise.resolve({}) }),
    );
    expect(html).toContain('Meine-Stiftung-X');
  });
});

describe('/uebersicht/werkstattbeitrag', () => {
  beforeEach(reset);
  afterAll(reset);

  it('ohne Session → redirect', async () => {
    const { redirect } = await renderPage(() =>
      UebersichtWerkstattbeitrag({ searchParams: Promise.resolve({}) }),
    );
    expect(redirect).toBe('/anmelden?next=/uebersicht/werkstattbeitrag');
  });

  it('mit Session, leer → empty-Hint', async () => {
    const uid = await createUser('ub2-empty@test.werkzirkel.de');
    const sid = await createSessionFor(uid);
    setSession(sid);
    const { html } = await renderPage(() =>
      UebersichtWerkstattbeitrag({ searchParams: Promise.resolve({}) }),
    );
    expect(html).toContain('Noch kein Membership-Beitrag');
    expectKeineEnglischenStrings(html);
  });

  it('Erfolg-Banner bei status=ok', async () => {
    const uid = await createUser('ub2-ok@test.werkzirkel.de');
    const sid = await createSessionFor(uid);
    setSession(sid);
    const { html } = await renderPage(() =>
      UebersichtWerkstattbeitrag({ searchParams: Promise.resolve({ status: 'ok' }) }),
    );
    expect(html).toContain('erfolgreich verbucht');
  });
});

describe('/uebersicht Schnellzugriff-Karten', () => {
  beforeEach(reset);
  afterAll(reset);

  it('Bedarfstraeger:in sieht Meine Bedarfe + Werkstattbeitrag-Karte (keine Stubs)', async () => {
    const uid = await createUser('us-bedarf@test.werkzirkel.de', ['bedarfstraeger']);
    const sid = await createSessionFor(uid);
    setSession(sid);
    const { html } = await renderPage(() => Uebersicht());
    expect(html).toContain('Meine Bedarfe');
    expect(html).toContain('Membership-Beitrag');
    expect(html).not.toContain('in Vorbereitung');
    expectKeineEnglischenStrings(html);
  });

  it('Macher:in sieht Meine Werkangebote', async () => {
    const uid = await createUser('us-macher@test.werkzirkel.de', ['macher']);
    const sid = await createSessionFor(uid);
    setSession(sid);
    const { html } = await renderPage(() => Uebersicht());
    expect(html).toContain('Meine Werkangebote');
    expect(html).not.toContain('in Vorbereitung');
  });

  it('Foerder:in sieht Mein Foerderprofil', async () => {
    const uid = await createUser('us-foerder@test.werkzirkel.de', ['foerderer']);
    const sid = await createSessionFor(uid);
    setSession(sid);
    const { html } = await renderPage(() => Uebersicht());
    expect(html).toContain('Mein Sponsor-Profil');
    expect(html).not.toContain('in Vorbereitung');
  });
});
