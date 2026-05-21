/**
 * /registrieren — Klarname-Pflicht-Form fuer Bedarfstraeger:innen + Foerder:innen.
 *
 * Diese Seite wird vom Magic-Link-Verify-Handler aufgerufen, wenn
 * `zweck=registrierung-bedarf` oder `zweck=registrierung-foerder`. Sie
 * erscheint NACH dem Klick auf den Magic-Link — die Session ist also bereits
 * gesetzt, die Nutzer:in ist bereits angelegt (mit rollen=['bedarfstraeger']
 * bzw. ['foerderer']) und der Klarname ist leer.
 *
 * Aufgabe:
 * - Fordert Klarname + Organisation (Pflicht beider Rollen nach PRD §13.2).
 * - Persistiert beides auf den Nutzer (Organisation in `kurzbeschreibung`,
 *   damit kein zusaetzliches DB-Feld noetig ist — fuer den Iter-1-Flow).
 * - Redirected nach erfolgreichem Submit zu /uebersicht.
 *
 * Ohne Session: redirect zu /anmelden.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { nutzer } from '@/lib/db/schema/nutzer';
import type { Rolle } from '@/lib/db/schema/enums';
import { getSessionFromRequest } from '@/lib/auth/session';
import {
  istBedarfstraeger,
  istFoerderer,
} from '@/lib/auth/permissions';

export const metadata: Metadata = {
  title: 'Registrierung abschließen',
  robots: { index: false, follow: false },
};

type RegistrierenRolle = 'bedarf' | 'foerder';

function parseRolle(raw: string | undefined): RegistrierenRolle | null {
  if (raw === 'bedarf' || raw === 'foerder') return raw;
  return null;
}

async function buildRequestFromHeaders(): Promise<Request> {
  const h = await headers();
  const headerInit: Record<string, string> = {};
  for (const [name, value] of h.entries()) {
    headerInit[name] = value;
  }
  return new Request('http://internal.werkzirkel/registrieren', {
    headers: headerInit,
  });
}

async function registrierungAbschliessenAction(formData: FormData): Promise<void> {
  'use server';

  const req = await buildRequestFromHeaders();
  const sess = await getSessionFromRequest(req);
  if (!sess) {
    redirect('/anmelden?fehler=session-abgelaufen');
  }

  const rolleRaw = String(formData.get('rolle') ?? '');
  const rolle = parseRolle(rolleRaw);
  if (!rolle) {
    redirect('/registrieren?fehler=rolle-fehlt');
  }

  const klarname = String(formData.get('klarname') ?? '').trim();
  const organisation = String(formData.get('organisation') ?? '').trim();
  const agbZugestimmt = formData.get('agb_zustimmung') === 'ja';

  if (!agbZugestimmt) {
    redirect(
      `/registrieren?rolle=${rolle}&fehler=` +
        encodeURIComponent(
          'Bitte stimme den Werkstatt-Regeln und der AGB zu, bevor du fortfaehrst.',
        ),
    );
  }
  if (klarname.length === 0) {
    redirect(
      `/registrieren?rolle=${rolle}&fehler=` +
        encodeURIComponent('Klarname ist Pflicht fuer diese Rolle.'),
    );
  }
  if (organisation.length === 0) {
    redirect(
      `/registrieren?rolle=${rolle}&fehler=` +
        encodeURIComponent('Organisation ist Pflicht fuer diese Rolle.'),
    );
  }
  if (klarname.length > 200) {
    redirect(
      `/registrieren?rolle=${rolle}&fehler=` +
        encodeURIComponent('Klarname zu lang (max. 200 Zeichen).'),
    );
  }
  if (organisation.length > 500) {
    redirect(
      `/registrieren?rolle=${rolle}&fehler=` +
        encodeURIComponent('Organisation zu lang (max. 500 Zeichen).'),
    );
  }

  // Rolle ggf. ergaenzen — wenn der Nutzer-Account via Magic-Link bereits mit
  // der richtigen Rolle angelegt wurde, ist sie schon drin. Defensiv mergen.
  const erforderlicheRolle: Rolle =
    rolle === 'bedarf' ? 'bedarfstraeger' : 'foerderer';
  const existing: Rolle[] = sess.nutzer.rollen ?? [];
  const naechsteRollen: Rolle[] = existing.includes(erforderlicheRolle)
    ? existing
    : [...existing, erforderlicheRolle];

  await db
    .update(nutzer)
    .set({
      klarname,
      kurzbeschreibung: organisation,
      rollen: naechsteRollen,
      aktualisiertAm: new Date(),
    })
    .where(eq(nutzer.id, sess.nutzerId));

  redirect('/uebersicht');
}

export default async function RegistrierenPage(props: {
  searchParams: Promise<{ rolle?: string; fehler?: string }>;
}) {
  const sp = await props.searchParams;
  const rolle = parseRolle(sp.rolle);
  const fehler = sp.fehler ?? '';

  if (!rolle) {
    redirect('/anmelden');
  }

  const req = await buildRequestFromHeaders();
  const sess = await getSessionFromRequest(req);
  if (!sess) {
    redirect(`/anmelden?next=${encodeURIComponent(`/registrieren?rolle=${rolle}`)}`);
  }

  // Wenn die Person bereits Klarname hat UND in der entsprechenden Rolle ist,
  // ist die Pflicht-Etappe erledigt — direkt zu /uebersicht.
  const klarnameVorhanden = sess.nutzer.klarname.trim().length > 0;
  const rolleErfuellt =
    rolle === 'bedarf' ? istBedarfstraeger(sess.nutzer) : istFoerderer(sess.nutzer);
  if (klarnameVorhanden && rolleErfuellt) {
    redirect('/uebersicht');
  }

  const titel =
    rolle === 'bedarf'
      ? 'Bedarf einbringen — Registrierung abschließen'
      : 'Sponsor:in werden — Registrierung abschließen';

  const erklaerung =
    rolle === 'bedarf'
      ? 'Auftraggeber:innen treten im Werkzirkel mit Klarnamen auf. Pseudonyme sind für diese Rolle nicht erlaubt. Bitte ergänze deinen Klarnamen und die Organisation, die du vertrittst.'
      : 'Sponsor:innen treten im Werkzirkel mit Klarnamen auf. Pseudonyme sind für diese Rolle nicht erlaubt. Bitte ergänze deinen Klarnamen und die Organisation, die du vertrittst.';

  return (
    <main className="wrap" style={{ paddingTop: 32, paddingBottom: 64 }}>
      <p className="eyebrow">Werkzirkel</p>
      <h1>{titel}</h1>
      <p style={{ maxWidth: 640 }}>{erklaerung}</p>

      {fehler ? (
        <p
          role="alert"
          style={{
            border: '1px solid #d04848',
            background: '#fbeaea',
            color: '#5a1a1a',
            padding: '12px 14px',
            borderRadius: 6,
            margin: '16px 0',
            maxWidth: 640,
          }}
        >
          {decodeURIComponent(fehler)}
        </p>
      ) : null}

      <form
        action={registrierungAbschliessenAction}
        style={{ display: 'grid', gap: 16, maxWidth: 640, marginTop: 16 }}
      >
        <input type="hidden" name="rolle" value={rolle} />

        <div style={{ display: 'grid', gap: 4 }}>
          <label
            htmlFor="klarname"
            style={{ fontSize: 14, fontWeight: 500 }}
          >
            Klarname (Pflicht)
          </label>
          <input
            type="text"
            id="klarname"
            name="klarname"
            required
            maxLength={200}
            defaultValue={sess.nutzer.klarname}
            placeholder="Vor- und Nachname"
          />
        </div>

        <div style={{ display: 'grid', gap: 4 }}>
          <label
            htmlFor="organisation"
            style={{ fontSize: 14, fontWeight: 500 }}
          >
            Organisation (Pflicht)
          </label>
          <input
            type="text"
            id="organisation"
            name="organisation"
            required
            maxLength={500}
            defaultValue={sess.nutzer.kurzbeschreibung ?? ''}
            placeholder="Name deiner Organisation"
          />
          <small style={{ color: 'var(--muted)' }}>
            Verein, Unternehmen, Stiftung, freiberuflich — was zutrifft.
          </small>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'flex-start',
            padding: '10px 12px',
            borderRadius: 10,
            background: 'var(--surface-alt, #f6f6f1)',
          }}
        >
          <input
            type="checkbox"
            id="agb_zustimmung"
            name="agb_zustimmung"
            value="ja"
            required
            style={{ marginTop: 4 }}
          />
          <label htmlFor="agb_zustimmung" style={{ fontSize: 14 }}>
            Ich habe die{' '}
            <Link href="/regeln" target="_blank" rel="noopener">
              Werkstatt-Regeln
            </Link>{' '}
            und die{' '}
            <Link href="/agb" target="_blank" rel="noopener">
              AGB
            </Link>{' '}
            gelesen und stimme ihnen zu.
          </label>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button type="submit" className="button primary">
            Registrierung abschließen
          </button>
          <Link
            href="/anmelden"
            style={{ color: 'var(--muted)', textDecoration: 'underline' }}
          >
            Abbrechen
          </Link>
        </div>
      </form>
    </main>
  );
}
