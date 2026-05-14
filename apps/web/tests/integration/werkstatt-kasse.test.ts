/**
 * Integration-Tests für die Werkstatt-Kasse (PRD §8.11):
 *   - POST /api/v1/kurator/werkstatt-kasse                — Kurator legt Eintrag an
 *   - GET  /api/v1/kurator/werkstatt-kasse                — Kurator-Übersicht eigene Stadt
 *   - POST /api/v1/admin/werkstatt-kasse/:id/freigeben    — Admin gibt frei
 *   - POST /api/v1/kurator/werkstatt-kasse/quartal/:q/abschliessen
 *   - GET  /api/v1/werkstatt-kasse/:stadt                  — public, nur freigegebene
 *   - Webhook-Eintrag (werkstattbeitrag) ist sichtbar im Public-Endpoint
 *     (sobald freigegeben — Webhook setzt das automatisch).
 */

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createId } from '@paralleldrive/cuid2';
import { eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import {
  nutzer,
  session as sessionTable,
  werkstattbeitrag,
  werkstattKasseEintrag,
} from '@/lib/db/schema';
import { env } from '@/lib/env';
import { buildSessionCookie } from '@/lib/auth/session';

import { POST as kuratorKassePost, GET as kuratorKasseGet } from '@/app/api/v1/kurator/werkstatt-kasse/route';
import { POST as adminFreigebenPost } from '@/app/api/v1/admin/werkstatt-kasse/[id]/freigeben/route';
import { POST as quartalAbschliessenPost } from '@/app/api/v1/kurator/werkstatt-kasse/quartal/[q]/abschliessen/route';
import { GET as publicKasseGet } from '@/app/api/v1/werkstatt-kasse/[stadt]/route';
import { handleCheckoutSessionCompleted } from '@/lib/stripe/webhook';

import { truncateAll } from '../_helpers/db-cleanup';

const APP_ORIGIN = new URL(env.APP_URL).origin;

type Rolle = 'macher' | 'bedarfstraeger' | 'foerderer' | 'kurator' | 'admin';

async function userAnlegen(opts: {
  email: string;
  rollen: Rolle[];
  stadtId?: string;
}): Promise<string> {
  const id = createId();
  await db.insert(nutzer).values({
    id,
    email: opts.email,
    klarname: `Klar ${opts.email}`,
    anzeigename: `anz-${id.slice(0, 6)}`,
    stadtId: opts.stadtId ?? 'hh',
    rollen: opts.rollen,
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

function buildRequest(opts: {
  method: 'GET' | 'POST';
  path: string;
  sessionId?: string;
  body?: unknown;
}): Request {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    origin: APP_ORIGIN,
    'x-forwarded-for': '127.0.0.1',
  };
  if (opts.sessionId) {
    headers.cookie = buildSessionCookie(opts.sessionId).split(';')[0]!;
  }
  return new Request(`${APP_ORIGIN}${opts.path}`, {
    method: opts.method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

describe('POST /api/v1/kurator/werkstatt-kasse — Kurator legt Eintrag an', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  it('Ohne Session → 401', async () => {
    const res = await kuratorKassePost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/kurator/werkstatt-kasse',
        body: {
          typ: 'ausgang',
          kategorie: 'raum_miete',
          hoehe_euro_cent: 12000,
          beschreibung: 'Raum-Miete Mai',
          datum: '2026-05-01',
        },
      }),
    );
    expect(res.status).toBe(401);
  });

  it('Ohne Kurator-Rolle → 403', async () => {
    const userId = await userAnlegen({
      email: 'kasse-not-kurator@test.werkzirkel.de',
      rollen: ['macher'],
    });
    const sid = await sessionAnlegen(userId);
    const res = await kuratorKassePost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/kurator/werkstatt-kasse',
        sessionId: sid,
        body: {
          typ: 'ausgang',
          kategorie: 'raum_miete',
          hoehe_euro_cent: 12000,
          beschreibung: 'Raum-Miete Mai',
          datum: '2026-05-01',
        },
      }),
    );
    expect(res.status).toBe(403);
  });

  it('Validator: unbekannte Kategorie für Ausgang → 422', async () => {
    const userId = await userAnlegen({
      email: 'kasse-bad-kategorie@test.werkzirkel.de',
      rollen: ['kurator'],
    });
    const sid = await sessionAnlegen(userId);
    const res = await kuratorKassePost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/kurator/werkstatt-kasse',
        sessionId: sid,
        body: {
          typ: 'ausgang',
          kategorie: 'werkstattbeitraege', // gehört zu Eingang!
          hoehe_euro_cent: 5000,
          beschreibung: 'falsch zugeordnet',
          datum: '2026-05-01',
        },
      }),
    );
    expect(res.status).toBe(422);
  });

  it('Kurator-Eintrag wird angelegt mit Status=unfreigegeben', async () => {
    const userId = await userAnlegen({
      email: 'kasse-kurator-ok@test.werkzirkel.de',
      rollen: ['kurator'],
    });
    const sid = await sessionAnlegen(userId);
    const res = await kuratorKassePost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/kurator/werkstatt-kasse',
        sessionId: sid,
        body: {
          typ: 'ausgang',
          kategorie: 'raum_miete',
          hoehe_euro_cent: 12000,
          beschreibung: 'Raum-Miete Mai 2026',
          datum: '2026-05-01',
        },
      }),
    );
    expect(res.status).toBe(201);
    const data = (await res.json()) as {
      eintrag: { id: string; freigegeben_am: string | null; quartal: string };
    };
    expect(data.eintrag.freigegeben_am).toBeNull();
    expect(data.eintrag.quartal).toBe('2026-Q2');

    // In DB landet er als unfreigegeben.
    const dbRows = await db
      .select()
      .from(werkstattKasseEintrag)
      .where(eq(werkstattKasseEintrag.id, data.eintrag.id));
    expect(dbRows.length).toBe(1);
    expect(dbRows[0]?.freigegebenAm).toBeNull();
    expect(dbRows[0]?.stadtId).toBe('hh');
    expect(dbRows[0]?.erfasstDurch).toBe(userId);
  });
});

describe('GET /api/v1/kurator/werkstatt-kasse — Kurator-Übersicht eigene Stadt', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  it('Liefert auch unfreigegebene Einträge der eigenen Stadt', async () => {
    const kuratorId = await userAnlegen({
      email: 'kasse-uebersicht@test.werkzirkel.de',
      rollen: ['kurator'],
    });
    const sid = await sessionAnlegen(kuratorId);

    await db.insert(werkstattKasseEintrag).values([
      {
        stadtId: 'hh',
        typ: 'ausgang',
        kategorie: 'raum_miete',
        hoeheEuroCent: 12000,
        beschreibung: 'Raum Mai',
        datum: '2026-05-01',
        quartal: '2026-Q2',
        erfasstDurch: kuratorId,
      },
      {
        stadtId: 'hh',
        typ: 'eingang',
        kategorie: 'sonstige_spenden',
        hoeheEuroCent: 5000,
        beschreibung: 'Bar-Spende',
        datum: '2026-05-02',
        quartal: '2026-Q2',
        erfasstDurch: kuratorId,
        freigegebenAm: new Date(),
        freigegebenDurch: kuratorId,
      },
    ]);

    const res = await kuratorKasseGet(
      buildRequest({
        method: 'GET',
        path: '/api/v1/kurator/werkstatt-kasse',
        sessionId: sid,
      }),
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      eintraege: Array<{ freigegeben_am: string | null }>;
    };
    expect(data.eintraege.length).toBe(2);
    // Beide Status-Varianten enthalten.
    const ohne = data.eintraege.filter((e) => e.freigegeben_am === null);
    expect(ohne.length).toBe(1);
  });
});

describe('POST /api/v1/admin/werkstatt-kasse/:id/freigeben', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  it('Nicht-Admin → 403', async () => {
    const kuratorId = await userAnlegen({
      email: 'kasse-frei-not-admin@test.werkzirkel.de',
      rollen: ['kurator'],
    });
    const sid = await sessionAnlegen(kuratorId);
    const ins = await db
      .insert(werkstattKasseEintrag)
      .values({
        stadtId: 'hh',
        typ: 'ausgang',
        kategorie: 'raum_miete',
        hoeheEuroCent: 12000,
        beschreibung: 'Raum',
        datum: '2026-05-01',
        quartal: '2026-Q2',
        erfasstDurch: kuratorId,
      })
      .returning();
    const id = ins[0]!.id;
    const res = await adminFreigebenPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/admin/werkstatt-kasse/${id}/freigeben`,
        sessionId: sid,
      }),
      { params: Promise.resolve({ id }) },
    );
    expect(res.status).toBe(403);
  });

  it('Admin gibt frei → freigegeben_am gesetzt, freigegeben_durch=admin', async () => {
    const adminId = await userAnlegen({
      email: 'kasse-frei-admin@test.werkzirkel.de',
      rollen: ['admin'],
    });
    const sid = await sessionAnlegen(adminId);
    const kuratorId = await userAnlegen({
      email: 'kasse-frei-kurator@test.werkzirkel.de',
      rollen: ['kurator'],
    });
    const ins = await db
      .insert(werkstattKasseEintrag)
      .values({
        stadtId: 'hh',
        typ: 'ausgang',
        kategorie: 'raum_miete',
        hoeheEuroCent: 12000,
        beschreibung: 'Raum',
        datum: '2026-05-01',
        quartal: '2026-Q2',
        erfasstDurch: kuratorId,
      })
      .returning();
    const id = ins[0]!.id;

    const res = await adminFreigebenPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/admin/werkstatt-kasse/${id}/freigeben`,
        sessionId: sid,
      }),
      { params: Promise.resolve({ id }) },
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      eintrag: { freigegeben_am: string | null; freigegeben_durch: string | null };
    };
    expect(data.eintrag.freigegeben_am).not.toBeNull();
    expect(data.eintrag.freigegeben_durch).toBe(adminId);
  });

  it('Idempotent: zweimal freigeben überschreibt nicht', async () => {
    const adminId = await userAnlegen({
      email: 'kasse-frei-idem@test.werkzirkel.de',
      rollen: ['admin'],
    });
    const sid = await sessionAnlegen(adminId);
    const ins = await db
      .insert(werkstattKasseEintrag)
      .values({
        stadtId: 'hh',
        typ: 'ausgang',
        kategorie: 'raum_miete',
        hoeheEuroCent: 12000,
        beschreibung: 'Raum',
        datum: '2026-05-01',
        quartal: '2026-Q2',
        erfasstDurch: adminId,
      })
      .returning();
    const id = ins[0]!.id;
    const params = { params: Promise.resolve({ id }) };

    const res1 = await adminFreigebenPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/admin/werkstatt-kasse/${id}/freigeben`,
        sessionId: sid,
      }),
      params,
    );
    expect(res1.status).toBe(200);
    const data1 = (await res1.json()) as {
      eintrag: { freigegeben_am: string | null };
    };
    const first = data1.eintrag.freigegeben_am!;

    // 50ms warten, damit ein Re-Update messbar wäre.
    await new Promise((r) => setTimeout(r, 50));

    const res2 = await adminFreigebenPost(
      buildRequest({
        method: 'POST',
        path: `/api/v1/admin/werkstatt-kasse/${id}/freigeben`,
        sessionId: sid,
      }),
      { params: Promise.resolve({ id }) },
    );
    expect(res2.status).toBe(200);
    const data2 = (await res2.json()) as {
      eintrag: { freigegeben_am: string | null };
    };
    expect(data2.eintrag.freigegeben_am).toBe(first);
  });
});

describe('GET /api/v1/werkstatt-kasse/:stadt — public, nur freigegebene', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  it('Unbekannte Stadt → 404', async () => {
    const res = await publicKasseGet(
      buildRequest({
        method: 'GET',
        path: '/api/v1/werkstatt-kasse/unbekannt',
      }),
      { params: Promise.resolve({ stadt: 'unbekannt' }) },
    );
    expect(res.status).toBe(404);
  });

  it('Zeigt NUR freigegebene Einträge + Quartals-Summen', async () => {
    const kuratorId = await userAnlegen({
      email: 'kasse-pub-kurator@test.werkzirkel.de',
      rollen: ['kurator'],
    });

    await db.insert(werkstattKasseEintrag).values([
      {
        stadtId: 'hh',
        typ: 'eingang',
        kategorie: 'werkstattbeitraege',
        hoeheEuroCent: 5000,
        beschreibung: 'Beitrag (freigegeben)',
        datum: '2026-05-01',
        quartal: '2026-Q2',
        erfasstDurch: kuratorId,
        freigegebenAm: new Date(),
      },
      {
        stadtId: 'hh',
        typ: 'ausgang',
        kategorie: 'raum_miete',
        hoeheEuroCent: 12000,
        beschreibung: 'Raum (UNFREIGEGEBEN)',
        datum: '2026-05-02',
        quartal: '2026-Q2',
        erfasstDurch: kuratorId,
      },
    ]);

    const res = await publicKasseGet(
      buildRequest({
        method: 'GET',
        path: '/api/v1/werkstatt-kasse/hh?quartal=2026-Q2',
      }),
      { params: Promise.resolve({ stadt: 'hh' }) },
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      eintraege: Array<{ beschreibung: string; freigegeben_am: string | null }>;
      summen: { eingang_cent: number; ausgang_cent: number; saldo_cent: number };
    };
    expect(data.eintraege.length).toBe(1);
    expect(data.eintraege[0]?.beschreibung).toBe('Beitrag (freigegeben)');
    expect(data.eintraege[0]?.freigegeben_am).not.toBeNull();
    expect(data.summen.eingang_cent).toBe(5000);
    expect(data.summen.ausgang_cent).toBe(0);
    expect(data.summen.saldo_cent).toBe(5000);
  });

  it('Slug hamburg → wie hh', async () => {
    const kuratorId = await userAnlegen({
      email: 'kasse-pub-slug@test.werkzirkel.de',
      rollen: ['kurator'],
    });
    await db.insert(werkstattKasseEintrag).values({
      stadtId: 'hh',
      typ: 'eingang',
      kategorie: 'sonstige_spenden',
      hoeheEuroCent: 1000,
      beschreibung: 'Spende',
      datum: '2026-05-03',
      quartal: '2026-Q2',
      erfasstDurch: kuratorId,
      freigegebenAm: new Date(),
    });
    const res = await publicKasseGet(
      buildRequest({
        method: 'GET',
        path: '/api/v1/werkstatt-kasse/hamburg',
      }),
      { params: Promise.resolve({ stadt: 'hamburg' }) },
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { stadt: { id: string } };
    expect(data.stadt.id).toBe('hh');
  });
});

describe('POST /api/v1/kurator/werkstatt-kasse/quartal/:q/abschliessen', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  it('Liefert Snapshot mit Saldo (Quartal-Summe stimmt mit Daten überein)', async () => {
    const kuratorId = await userAnlegen({
      email: 'kasse-abschluss@test.werkzirkel.de',
      rollen: ['kurator'],
    });
    const sid = await sessionAnlegen(kuratorId);

    await db.insert(werkstattKasseEintrag).values([
      {
        stadtId: 'hh',
        typ: 'eingang',
        kategorie: 'werkstattbeitraege',
        hoeheEuroCent: 5000,
        beschreibung: 'A',
        datum: '2026-05-01',
        quartal: '2026-Q2',
        erfasstDurch: kuratorId,
        freigegebenAm: new Date(),
      },
      {
        stadtId: 'hh',
        typ: 'eingang',
        kategorie: 'erfolgsbeitraege',
        hoeheEuroCent: 2500,
        beschreibung: 'B',
        datum: '2026-05-04',
        quartal: '2026-Q2',
        erfasstDurch: kuratorId,
      },
      {
        stadtId: 'hh',
        typ: 'ausgang',
        kategorie: 'raum_miete',
        hoeheEuroCent: 3000,
        beschreibung: 'C',
        datum: '2026-05-06',
        quartal: '2026-Q2',
        erfasstDurch: kuratorId,
      },
    ]);

    const res = await quartalAbschliessenPost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/kurator/werkstatt-kasse/quartal/2026-Q2/abschliessen',
        sessionId: sid,
      }),
      { params: Promise.resolve({ q: '2026-Q2' }) },
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      abschluss: {
        summe_eingang_cent: number;
        summe_ausgang_cent: number;
        saldo_cent: number;
        anzahl_eintraege: number;
        anzahl_freigegeben: number;
        anzahl_offen: number;
      };
    };
    expect(data.abschluss.summe_eingang_cent).toBe(7500);
    expect(data.abschluss.summe_ausgang_cent).toBe(3000);
    expect(data.abschluss.saldo_cent).toBe(4500);
    expect(data.abschluss.anzahl_eintraege).toBe(3);
    expect(data.abschluss.anzahl_freigegeben).toBe(1);
    expect(data.abschluss.anzahl_offen).toBe(2);
  });

  it('Ungültiges Quartal-Format → 422', async () => {
    const kuratorId = await userAnlegen({
      email: 'kasse-abschluss-bad@test.werkzirkel.de',
      rollen: ['kurator'],
    });
    const sid = await sessionAnlegen(kuratorId);
    const res = await quartalAbschliessenPost(
      buildRequest({
        method: 'POST',
        path: '/api/v1/kurator/werkstatt-kasse/quartal/abc/abschliessen',
        sessionId: sid,
      }),
      { params: Promise.resolve({ q: 'abc' }) },
    );
    expect(res.status).toBe(422);
  });
});

describe('Webhook-Eintrag (werkstattbeitrag) wird automatisch freigegeben + ist public sichtbar', () => {
  beforeEach(truncateAll);
  afterAll(truncateAll);

  it('Stripe-Webhook → Kasse-Eintrag automatisch freigegeben + im public GET sichtbar', async () => {
    const userId = await userAnlegen({
      email: 'kasse-webhook-wb@test.werkzirkel.de',
      rollen: ['bedarfstraeger'],
    });
    const beitragId = createId();
    const stripeSessionId = 'cs_kasse_' + createId();
    await db.insert(werkstattbeitrag).values({
      id: beitragId,
      nutzerId: userId,
      art: 'geldbeitrag',
      hoeheEuroCent: 5000,
      status: 'erfasst',
      stripeSessionId,
    });
    const session = {
      id: stripeSessionId,
      object: 'checkout.session',
      amount_total: 5000,
      currency: 'eur',
      metadata: {
        zweck: 'werkstattbeitrag',
        nutzer_id: userId,
        werkstattbeitrag_id: beitragId,
      },
    } as unknown as Parameters<typeof handleCheckoutSessionCompleted>[0];

    await handleCheckoutSessionCompleted(session);

    // Kasse-Eintrag ist automatisch freigegeben (Stripe-Trust).
    const kasseRows = await db
      .select()
      .from(werkstattKasseEintrag)
      .where(eq(werkstattKasseEintrag.referenzId, beitragId));
    expect(kasseRows.length).toBe(1);
    expect(kasseRows[0]?.freigegebenAm).not.toBeNull();

    // Public-Endpoint zeigt den Eintrag.
    const quartal = kasseRows[0]!.quartal;
    const res = await publicKasseGet(
      buildRequest({
        method: 'GET',
        path: `/api/v1/werkstatt-kasse/hh?quartal=${quartal}`,
      }),
      { params: Promise.resolve({ stadt: 'hh' }) },
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      eintraege: Array<{ referenz_typ: string | null; referenz_id: string | null }>;
    };
    const wb = data.eintraege.find((e) => e.referenz_id === beitragId);
    expect(wb).toBeTruthy();
    expect(wb?.referenz_typ).toBe('werkstattbeitrag');
  });
});
