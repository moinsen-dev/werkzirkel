/**
 * /einstellungen — Konto-Einstellungen (Server Component).
 *
 * Drei Tabs (PRD §28 UI, §F-001..§F-005):
 *   - profil         — Klarname, Anzeigename, Stadt, Rollen, Faehigkeiten, Avatar
 *   - benachrichtigungen — Benachrichtigungs-JSONB
 *   - datenschutz    — DSGVO-Export-Button + Konto-Pause-Toggle (Loeschung kommt
 *                       in task-konto-loeschung)
 *
 * Tab-Switching via Query-Parameter `?tab=` — kein Client-State.
 * Formulare verwenden Server Actions; Erfolgs-/Fehler-Meldungen via Query-Param.
 */

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { and, eq, isNull } from 'drizzle-orm';

import { de } from '@/i18n/de';
import { db } from '@/lib/db';
import {
  auditLog,
  foerdermitgliedschaft,
  magicLinkToken,
  nutzer,
  stadt,
} from '@/lib/db/schema';
import { STUFEN, priceIdForStufe } from '@/lib/foerdermitgliedschaft/stufen';
import { isStripeConfigured } from '@/lib/stripe/client';
import type { FoermitglStufe, FoermitglStatus } from '@/lib/db/schema/enums';
import {
  rolle as rolleEnum,
  teilnahmeart as teilnahmeartEnum,
} from '@/lib/db/schema/enums';
import type { Rolle } from '@/lib/db/schema/enums';
import { getSessionFromRequest } from '@/lib/auth/session';
import { generateMagicLinkToken } from '@/lib/auth/magic-link';
import { sendMail } from '@/lib/email/send';
import { env } from '@/lib/env';
import {
  defaultBenachrichtigungsEinstellungen,
  mergeBenachrichtigungsEinstellungen,
} from '@/lib/notifications/defaults';
import {
  nutzerProfilUpdateSchema,
  rollenErforderlichKlarname,
} from '@/lib/validators/nutzer';

export const metadata: Metadata = {
  title: 'Einstellungen',
};

type Tab = 'profil' | 'benachrichtigungen' | 'datenschutz' | 'foerdermitgliedschaft';

const TABS: ReadonlyArray<{ id: Tab; label: string }> = [
  { id: 'profil', label: de.einstellungen.tab_profil },
  { id: 'benachrichtigungen', label: de.einstellungen.tab_benachrichtigungen },
  {
    id: 'foerdermitgliedschaft',
    label: 'Foerdermitgliedschaft',
  },
  { id: 'datenschutz', label: de.einstellungen.tab_datenschutz },
];

function parseTab(raw: string | undefined): Tab {
  if (
    raw === 'benachrichtigungen' ||
    raw === 'datenschutz' ||
    raw === 'foerdermitgliedschaft'
  )
    return raw;
  return 'profil';
}

/**
 * Server Actions auf der Seite. Wir nutzen `headers()` (Next 15) um die
 * Cookies durchzureichen, da Session-Resolution gegen den aktuellen Request
 * laeuft.
 */
async function buildRequestFromHeaders(): Promise<Request> {
  const h = await headers();
  const headerInit: Record<string, string> = {};
  for (const [name, value] of h.entries()) {
    headerInit[name] = value;
  }
  // URL-Origin ist fuer Session-Auflesen irrelevant; wir geben einen Dummy mit.
  return new Request('http://internal.werkzirkel/einstellungen', {
    headers: headerInit,
  });
}

/**
 * Rolle hinzufuegen — Server Action fuer die 'Weitere Rollen'-Sektion.
 *
 * Akzeptiert `rolle` in FormData (bedarfstraeger | foerderer). Erzwingt
 * Klarname-Pflicht via `rollenErforderlichKlarname()` — wenn der aktuelle
 * Klarname leer ist, redirect mit deutscher Fehlermeldung (422-Equivalent
 * via Query-Param). Sonst Rollen-Array um die neue Rolle ergaenzen.
 */
async function rolleHinzufuegenAction(formData: FormData): Promise<void> {
  'use server';

  const req = await buildRequestFromHeaders();
  const sess = await getSessionFromRequest(req);
  if (!sess) {
    redirect('/anmelden?fehler=session-abgelaufen');
  }

  const rolleRaw = String(formData.get('rolle') ?? '');
  if (rolleRaw !== 'bedarfstraeger' && rolleRaw !== 'foerderer') {
    redirect('/einstellungen?tab=profil&fehler=' + encodeURIComponent('Unbekannte Rolle.'));
  }

  const aktuelleRollen = sess.nutzer.rollen ?? [];
  if (aktuelleRollen.includes(rolleRaw as Rolle)) {
    // Idempotent — schon drin.
    redirect('/einstellungen?tab=profil&ok=1');
  }

  const neueRollen = [...aktuelleRollen, rolleRaw as Rolle];

  if (
    rollenErforderlichKlarname(neueRollen) &&
    (sess.nutzer.klarname ?? '').trim().length === 0
  ) {
    redirect(
      '/einstellungen?tab=profil&fehler=' +
        encodeURIComponent(
          'Fuer Rollen Bedarfstraeger:in / Foerder:in ist ein Klarname Pflicht. Bitte ergaenze zuerst deinen Klarnamen oben im Formular.',
        ),
    );
  }

  await db
    .update(nutzer)
    .set({ rollen: neueRollen, aktualisiertAm: new Date() })
    .where(eq(nutzer.id, sess.nutzerId));

  redirect('/einstellungen?tab=profil&ok=1');
}

async function profilSpeichernAction(formData: FormData): Promise<void> {
  'use server';

  const req = await buildRequestFromHeaders();
  const sess = await getSessionFromRequest(req);
  if (!sess) {
    redirect('/anmelden?fehler=session-abgelaufen');
  }

  const rollen = formData.getAll('rollen').map(String).filter(Boolean);
  const faehigkeitenRaw = String(formData.get('faehigkeiten') ?? '');
  const faehigkeiten = faehigkeitenRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const interessenRaw = String(formData.get('interessen') ?? '');
  const interessen = interessenRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const teilnahmeartRaw = String(formData.get('teilnahmeart') ?? '');

  const candidate = {
    klarname: String(formData.get('klarname') ?? ''),
    anzeigename: String(formData.get('anzeigename') ?? ''),
    stadtId: String(formData.get('stadtId') ?? ''),
    kurzbeschreibung: String(formData.get('kurzbeschreibung') ?? ''),
    faehigkeiten,
    interessen,
    rollen,
    teilnahmeart: teilnahmeartRaw === '' ? null : teilnahmeartRaw,
    website: String(formData.get('website') ?? ''),
    github: String(formData.get('github') ?? ''),
    linkedin: String(formData.get('linkedin') ?? ''),
    mastodon: String(formData.get('mastodon') ?? ''),
  };

  const parsed = nutzerProfilUpdateSchema.safeParse(candidate);
  if (!parsed.success) {
    const firstError = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
    const msg = encodeURIComponent(firstError ?? 'Validierung fehlgeschlagen.');
    redirect(`/einstellungen?tab=profil&fehler=${msg}`);
  }
  const patch = parsed.data;

  const endRollen = patch.rollen ?? sess.nutzer.rollen;
  const endKlarname =
    patch.klarname !== undefined ? patch.klarname : sess.nutzer.klarname;
  if (rollenErforderlichKlarname(endRollen) && endKlarname.trim().length === 0) {
    const msg = encodeURIComponent(
      'Fuer Rollen Bedarfstraeger:in / Foerder:in ist ein Klarname Pflicht.',
    );
    redirect(`/einstellungen?tab=profil&fehler=${msg}`);
  }

  const update: Partial<typeof nutzer.$inferInsert> = {
    aktualisiertAm: new Date(),
  };
  if (patch.klarname !== undefined) update.klarname = patch.klarname;
  if (patch.anzeigename !== undefined) update.anzeigename = patch.anzeigename;
  if (patch.stadtId !== undefined) update.stadtId = patch.stadtId;
  update.kurzbeschreibung =
    patch.kurzbeschreibung === undefined || patch.kurzbeschreibung === ''
      ? null
      : patch.kurzbeschreibung;
  if (patch.faehigkeiten !== undefined) update.faehigkeiten = patch.faehigkeiten;
  if (patch.interessen !== undefined) update.interessen = patch.interessen;
  if (patch.rollen !== undefined) update.rollen = patch.rollen;
  update.teilnahmeart = patch.teilnahmeart ?? null;
  update.website = patch.website ?? null;
  update.github = patch.github ?? null;
  update.linkedin = patch.linkedin ?? null;
  update.mastodon = patch.mastodon ?? null;

  await db.update(nutzer).set(update).where(eq(nutzer.id, sess.nutzerId));

  redirect('/einstellungen?tab=profil&ok=1');
}

async function benachrichtigungenSpeichernAction(formData: FormData): Promise<void> {
  'use server';

  const req = await buildRequestFromHeaders();
  const sess = await getSessionFromRequest(req);
  if (!sess) {
    redirect('/anmelden?fehler=session-abgelaufen');
  }

  const next: Record<string, boolean> = {};
  for (const key of Object.keys(defaultBenachrichtigungsEinstellungen)) {
    next[key] = formData.get(`be.${key}`) === 'on';
  }

  await db
    .update(nutzer)
    .set({ benachrichtigungsEinstellungen: next, aktualisiertAm: new Date() })
    .where(eq(nutzer.id, sess.nutzerId));

  redirect('/einstellungen?tab=benachrichtigungen&ok=1');
}

async function kontoPausierenAction(): Promise<void> {
  'use server';
  const req = await buildRequestFromHeaders();
  const sess = await getSessionFromRequest(req);
  if (!sess) redirect('/anmelden?fehler=session-abgelaufen');
  await db
    .update(nutzer)
    .set({ status: 'pausiert', aktualisiertAm: new Date() })
    .where(eq(nutzer.id, sess.nutzerId));
  redirect('/einstellungen?tab=datenschutz&ok=pausiert');
}

async function kontoReaktivierenAction(): Promise<void> {
  'use server';
  const req = await buildRequestFromHeaders();
  const sess = await getSessionFromRequest(req);
  if (!sess) redirect('/anmelden?fehler=session-abgelaufen');
  const current = sess.nutzer.status;
  if (current !== 'aktiv' && current !== 'pausiert') {
    redirect('/einstellungen?tab=datenschutz&fehler=status-konflikt');
  }
  await db
    .update(nutzer)
    .set({ status: 'aktiv', aktualisiertAm: new Date() })
    .where(eq(nutzer.id, sess.nutzerId));
  redirect('/einstellungen?tab=datenschutz&ok=reaktiviert');
}

/**
 * Konto-Loeschung anfordern — Server-Action. Spiegelt die Logik des
 * POST /api/v1/me/delete-request inline (Idempotenz + T-003-Versand), damit
 * keine cross-Module-Origin-Pruefung in der Server-Action notwendig ist.
 * Eine Aenderung muss in beiden Pfaden gepflegt werden — verifiziert
 * durch den Integration-Test der API-Route.
 */
async function kontoLoeschenAnfordernAction(): Promise<void> {
  'use server';
  const req = await buildRequestFromHeaders();
  const sess = await getSessionFromRequest(req);
  if (!sess) redirect('/anmelden?fehler=session-abgelaufen');

  const email = sess.nutzer.email;

  await db
    .update(magicLinkToken)
    .set({ verwendetAm: new Date() })
    .where(
      and(
        eq(magicLinkToken.email, email),
        eq(magicLinkToken.zweck, 'konto_loeschen_bestaetigung'),
        isNull(magicLinkToken.verwendetAm),
      ),
    );

  const { clearToken, tokenHash } = generateMagicLinkToken();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  await db.insert(magicLinkToken).values({
    email,
    tokenHash,
    zweck: 'konto_loeschen_bestaetigung',
    expiresAt,
  });

  const confirmUrl = `${env.APP_URL}/api/v1/me/delete-confirm?token=${encodeURIComponent(clearToken)}`;
  await sendMail({
    to: email,
    template: 'T-003',
    props: { confirmUrl, appUrl: env.APP_URL },
    nutzerId: sess.nutzerId,
  });

  try {
    await db.insert(auditLog).values({
      nutzerId: sess.nutzerId,
      aktion: 'me.delete-requested',
      referenzTyp: 'nutzer',
      referenzId: sess.nutzerId,
    });
  } catch {
    // Audit-Failure darf den Versand nicht blockieren.
  }

  redirect('/einstellungen?tab=datenschutz&ok=loeschung-angefordert');
}

/**
 * Foerdermitgliedschaft starten — Server Action. Ruft den
 * /api/v1/me/foerdermitgliedschaft/start-Endpoint indirekt nach (gleiche
 * Logik inline, kein HTTP-Selbstaufruf): legt nichts in der DB an, erstellt
 * eine Stripe-Checkout-Session und leitet die Nutzer:in an Stripe weiter.
 */
async function foerdermitgliedschaftStartenAction(formData: FormData): Promise<void> {
  'use server';

  const req = await buildRequestFromHeaders();
  const sess = await getSessionFromRequest(req);
  if (!sess) redirect('/anmelden?fehler=session-abgelaufen');

  const stufeRaw = String(formData.get('stufe') ?? '');
  const stufe = stufeRaw as FoermitglStufe;
  if (!STUFEN.find((s) => s.stufe === stufe)) {
    redirect(
      '/einstellungen?tab=foerdermitgliedschaft&fehler=' +
        encodeURIComponent('Unbekannte Stufe.'),
    );
  }

  // Bereits aktive Mitgliedschaft? → Hinweis statt zweite Subscription.
  const bestehend = await db
    .select({ id: foerdermitgliedschaft.id, status: foerdermitgliedschaft.status })
    .from(foerdermitgliedschaft)
    .where(eq(foerdermitgliedschaft.nutzerId, sess.nutzerId))
    .limit(1);
  if (bestehend[0]?.status === 'aktiv') {
    redirect(
      '/einstellungen?tab=foerdermitgliedschaft&fehler=' +
        encodeURIComponent('Du hast bereits eine aktive Mitgliedschaft.'),
    );
  }

  if (!isStripeConfigured()) {
    redirect(
      '/einstellungen?tab=foerdermitgliedschaft&fehler=' +
        encodeURIComponent('Stripe ist nicht konfiguriert.'),
    );
  }
  const priceId = priceIdForStufe(stufe);
  if (!priceId) {
    redirect(
      '/einstellungen?tab=foerdermitgliedschaft&fehler=' +
        encodeURIComponent(`Fuer die Stufe '${stufe}' ist keine Preis-ID hinterlegt.`),
    );
  }

  const { getStripe } = await import('@/lib/stripe/client');
  let checkoutUrl: string;
  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card', 'sepa_debit', 'paypal'],
      line_items: [{ quantity: 1, price: priceId }],
      customer_email: sess.nutzer.email,
      metadata: {
        zweck: 'foerdermitgliedschaft',
        nutzer_id: sess.nutzerId,
        stufe,
      },
      subscription_data: {
        metadata: {
          zweck: 'foerdermitgliedschaft',
          nutzer_id: sess.nutzerId,
          stufe,
        },
      },
      success_url: `${env.APP_URL}/einstellungen?tab=foerdermitgliedschaft&ok=foerdermitgliedschaft_aktiv`,
      cancel_url: `${env.APP_URL}/einstellungen?tab=foerdermitgliedschaft&fehler=foerdermitgliedschaft_abgebrochen`,
    });
    if (!session.url) {
      throw new Error('Stripe-Session ohne URL.');
    }
    checkoutUrl = session.url;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[foerdermitgliedschaft-start-action] Stripe failed:', message);
    redirect(
      '/einstellungen?tab=foerdermitgliedschaft&fehler=' +
        encodeURIComponent('Stripe-Checkout konnte nicht erstellt werden.'),
    );
  }

  redirect(checkoutUrl);
}

/**
 * Foerdermitgliedschaft verwalten — Server Action. Erstellt einen
 * Stripe-Customer-Portal-Link und leitet die Nutzer:in dorthin weiter.
 */
async function foerdermitgliedschaftPortalAction(): Promise<void> {
  'use server';

  const req = await buildRequestFromHeaders();
  const sess = await getSessionFromRequest(req);
  if (!sess) redirect('/anmelden?fehler=session-abgelaufen');

  const rows = await db
    .select({ stripeCustomerId: foerdermitgliedschaft.stripeCustomerId })
    .from(foerdermitgliedschaft)
    .where(eq(foerdermitgliedschaft.nutzerId, sess.nutzerId))
    .limit(1);
  const stripeCustomerId = rows[0]?.stripeCustomerId;
  if (!stripeCustomerId) {
    redirect(
      '/einstellungen?tab=foerdermitgliedschaft&fehler=' +
        encodeURIComponent('Keine Foerdermitgliedschaft gefunden.'),
    );
  }

  if (!isStripeConfigured()) {
    redirect(
      '/einstellungen?tab=foerdermitgliedschaft&fehler=' +
        encodeURIComponent('Stripe ist nicht konfiguriert.'),
    );
  }

  const { getStripe } = await import('@/lib/stripe/client');
  let portalUrl: string;
  try {
    const stripe = getStripe();
    const portal = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${env.APP_URL}/einstellungen?tab=foerdermitgliedschaft`,
    });
    portalUrl = portal.url;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[foerdermitgliedschaft-portal-action] Stripe failed:', message);
    redirect(
      '/einstellungen?tab=foerdermitgliedschaft&fehler=' +
        encodeURIComponent('Customer-Portal-Link konnte nicht erstellt werden.'),
    );
  }

  redirect(portalUrl);
}

async function loeschungWiderrufenAction(): Promise<void> {
  'use server';
  const req = await buildRequestFromHeaders();
  const sess = await getSessionFromRequest(req);
  if (!sess) redirect('/anmelden?fehler=session-abgelaufen');
  await db
    .update(nutzer)
    .set({
      status: 'aktiv',
      loeschungAnstehendBis: null,
      aktualisiertAm: new Date(),
    })
    .where(eq(nutzer.id, sess.nutzerId));
  redirect('/einstellungen?tab=datenschutz&ok=loeschung-widerrufen');
}

export default async function EinstellungenPage(props: {
  searchParams: Promise<{
    tab?: string;
    ok?: string;
    fehler?: string;
    loeschung?: string;
  }>;
}) {
  const sp = await props.searchParams;
  const tab = parseTab(sp.tab);

  const req = await buildRequestFromHeaders();
  const sess = await getSessionFromRequest(req);
  if (!sess) {
    redirect('/anmelden?next=/einstellungen');
  }

  const staedte = await db.select().from(stadt);
  const me = sess.nutzer;
  const be = mergeBenachrichtigungsEinstellungen(me.benachrichtigungsEinstellungen);

  const mitgliedschaftRows = await db
    .select()
    .from(foerdermitgliedschaft)
    .where(eq(foerdermitgliedschaft.nutzerId, sess.nutzerId))
    .limit(1);
  const mitgliedschaft = mitgliedschaftRows[0] ?? null;

  return (
    <main className="wrap" style={{ paddingTop: 32, paddingBottom: 64 }}>
      <h1>{de.einstellungen.titel}</h1>

      <nav
        aria-label="Tab-Auswahl"
        style={{
          display: 'flex',
          gap: 8,
          margin: '20px 0 24px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        {TABS.map((t) => {
          const active = t.id === tab;
          return (
            <a
              key={t.id}
              href={`/einstellungen?tab=${t.id}`}
              aria-current={active ? 'page' : undefined}
              style={{
                padding: '10px 14px',
                borderBottom: active
                  ? '2px solid var(--accent)'
                  : '2px solid transparent',
                color: active ? 'var(--fg)' : 'var(--muted)',
                fontWeight: active ? 600 : 400,
              }}
            >
              {t.label}
            </a>
          );
        })}
      </nav>

      {sp.ok ? <Banner kind="ok" text={mapOkText(sp.ok)} /> : null}
      {sp.fehler ? <Banner kind="fehler" text={decodeURIComponent(sp.fehler)} /> : null}
      {sp.loeschung === 'bestaetigt' ? (
        <Banner kind="ok" text={de.einstellungen.konto_loeschen_bestaetigt} />
      ) : null}

      {tab === 'profil' ? (
        <ProfilTab
          me={me}
          staedte={staedte}
          profilSpeichernAction={profilSpeichernAction}
          rolleHinzufuegenAction={rolleHinzufuegenAction}
        />
      ) : null}
      {tab === 'benachrichtigungen' ? (
        <BenachrichtigungenTab
          values={be}
          benachrichtigungenSpeichernAction={benachrichtigungenSpeichernAction}
        />
      ) : null}
      {tab === 'foerdermitgliedschaft' ? (
        <FoerdermitgliedschaftTab
          mitgliedschaft={mitgliedschaft}
          startenAction={foerdermitgliedschaftStartenAction}
          portalAction={foerdermitgliedschaftPortalAction}
        />
      ) : null}
      {tab === 'datenschutz' ? (
        <DatenschutzTab
          status={me.status}
          loeschungAnstehendBis={me.loeschungAnstehendBis}
          kontoPausierenAction={kontoPausierenAction}
          kontoReaktivierenAction={kontoReaktivierenAction}
          kontoLoeschenAnfordernAction={kontoLoeschenAnfordernAction}
          loeschungWiderrufenAction={loeschungWiderrufenAction}
        />
      ) : null}
    </main>
  );
}

function Banner({ kind, text }: { kind: 'ok' | 'fehler'; text: string }) {
  const color = kind === 'ok' ? 'var(--accent)' : '#c33';
  return (
    <p
      role="status"
      style={{
        border: `1px solid ${color}`,
        background: `color-mix(in oklch, ${color} 8%, var(--surface))`,
        color,
        padding: '8px 12px',
        borderRadius: 6,
        marginBottom: 16,
      }}
    >
      {text}
    </p>
  );
}

function mapOkText(code: string): string {
  if (code === 'pausiert') return de.einstellungen.konto_pausiert;
  if (code === 'reaktiviert') return de.einstellungen.konto_reaktiviert;
  if (code === 'loeschung-angefordert')
    return de.einstellungen.konto_loeschen_bestaetigung_versendet;
  if (code === 'loeschung-widerrufen')
    return de.einstellungen.konto_loeschen_widerrufen_ok;
  if (code === 'foerdermitgliedschaft_aktiv')
    return 'Vielen Dank! Deine Foerdermitgliedschaft ist jetzt aktiv.';
  // Fallbacks fuer ok=1 je nach Tab — wir bleiben generisch.
  return 'Gespeichert.';
}

function formatLoeschungsDatum(d: Date): string {
  const pad = (n: number): string => n.toString().padStart(2, '0');
  return (
    `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} um ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())} Uhr`
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Tabs
// ────────────────────────────────────────────────────────────────────────────

function ProfilTab(props: {
  me: typeof nutzer.$inferSelect;
  staedte: Array<typeof stadt.$inferSelect>;
  profilSpeichernAction: (formData: FormData) => Promise<void>;
  rolleHinzufuegenAction: (formData: FormData) => Promise<void>;
}) {
  const { me, staedte, profilSpeichernAction, rolleHinzufuegenAction } = props;
  const istBedarfstraegerJetzt = (me.rollen ?? []).includes('bedarfstraeger');
  const istFoerdererJetzt = (me.rollen ?? []).includes('foerderer');

  return (
    <section>
      <form
        action={profilSpeichernAction}
        style={{ display: 'grid', gap: 16, maxWidth: 640 }}
      >
        <Field id="klarname" label="Klarname">
          <input
            type="text"
            id="klarname"
            name="klarname"
            defaultValue={me.klarname}
            maxLength={200}
          />
        </Field>

        <Field id="anzeigename" label="Anzeigename">
          <input
            type="text"
            id="anzeigename"
            name="anzeigename"
            defaultValue={me.anzeigename}
            maxLength={80}
          />
        </Field>

        <Field id="stadtId" label="Stadt">
          <select id="stadtId" name="stadtId" defaultValue={me.stadtId}>
            {staedte.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>

        <fieldset
          style={{ border: '1px solid var(--border)', padding: 12, borderRadius: 6 }}
        >
          <legend>Rollen</legend>
          {rolleEnum.map((r) => (
            <label key={r} style={{ display: 'block', margin: '4px 0' }}>
              <input
                type="checkbox"
                name="rollen"
                value={r}
                defaultChecked={me.rollen?.includes(r) ?? false}
              />{' '}
              {de.rolle[r] ?? r}
            </label>
          ))}
          <p style={{ color: 'var(--muted)', fontSize: 13, margin: '8px 0 0' }}>
            Hinweis: Fuer die Rollen Bedarfstraeger:in oder Foerder:in ist ein
            Klarname Pflicht.
          </p>
        </fieldset>

        <Field id="kurzbeschreibung" label="Kurzbeschreibung (max. 500)">
          <textarea
            id="kurzbeschreibung"
            name="kurzbeschreibung"
            defaultValue={me.kurzbeschreibung ?? ''}
            maxLength={500}
            rows={3}
          />
        </Field>

        <Field id="faehigkeiten" label="Faehigkeiten (komma-getrennt)">
          <input
            type="text"
            id="faehigkeiten"
            name="faehigkeiten"
            defaultValue={(me.faehigkeiten ?? []).join(', ')}
          />
        </Field>

        <Field id="interessen" label="Interessen (komma-getrennt)">
          <input
            type="text"
            id="interessen"
            name="interessen"
            defaultValue={(me.interessen ?? []).join(', ')}
          />
        </Field>

        <Field id="teilnahmeart" label="Teilnahmeart">
          <select
            id="teilnahmeart"
            name="teilnahmeart"
            defaultValue={me.teilnahmeart ?? ''}
          >
            <option value="">— bitte waehlen —</option>
            {teilnahmeartEnum.map((t) => (
              <option key={t} value={t}>
                {de.teilnahmeart[t] ?? t}
              </option>
            ))}
          </select>
        </Field>

        <Field id="website" label="Website">
          <input
            type="url"
            id="website"
            name="website"
            defaultValue={me.website ?? ''}
            placeholder="https://"
          />
        </Field>
        <Field id="github" label="GitHub">
          <input
            type="url"
            id="github"
            name="github"
            defaultValue={me.github ?? ''}
            placeholder="https://"
          />
        </Field>
        <Field id="linkedin" label="LinkedIn">
          <input
            type="url"
            id="linkedin"
            name="linkedin"
            defaultValue={me.linkedin ?? ''}
            placeholder="https://"
          />
        </Field>
        <Field id="mastodon" label="Mastodon">
          <input
            type="url"
            id="mastodon"
            name="mastodon"
            defaultValue={me.mastodon ?? ''}
            placeholder="https://"
          />
        </Field>

        <button type="submit" className="button primary">
          {de.einstellungen.profil_speichern}
        </button>
      </form>

      <hr style={{ margin: '32px 0', border: 0, borderTop: '1px solid var(--border)' }} />

      <h2>{de.einstellungen.avatar_hochladen}</h2>
      <form
        method="POST"
        action="/api/v1/me/avatar"
        encType="multipart/form-data"
        style={{ display: 'flex', gap: 12, alignItems: 'center' }}
      >
        {me.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={me.avatarUrl}
            alt="Aktueller Avatar"
            style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover' }}
          />
        ) : (
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: 'var(--border)',
            }}
          />
        )}
        <input type="file" name="file" accept="image/jpeg,image/png,image/webp" required />
        <button type="submit" className="button secondary">
          Hochladen
        </button>
      </form>
      <p style={{ color: 'var(--muted)', fontSize: 13 }}>
        JPEG, PNG oder WebP. Max. 2 MB.
      </p>

      {!istBedarfstraegerJetzt || !istFoerdererJetzt ? (
        <>
          <hr
            style={{
              margin: '32px 0',
              border: 0,
              borderTop: '1px solid var(--border)',
            }}
          />
          <h2>Weitere Rollen</h2>
          <p style={{ maxWidth: 640, color: 'var(--muted)' }}>
            Bedarfstraeger:innen und Foerder:innen treten im Werkzirkel mit
            Klarnamen auf. Pseudonyme sind dafuer nicht erlaubt. Wenn dein
            Klarname oben noch leer ist, ergaenze ihn zuerst und speichere
            das Profil.
          </p>
          <div
            style={{
              display: 'flex',
              gap: 12,
              flexWrap: 'wrap',
              marginTop: 12,
              maxWidth: 640,
            }}
          >
            {!istBedarfstraegerJetzt ? (
              <form action={rolleHinzufuegenAction}>
                <input type="hidden" name="rolle" value="bedarfstraeger" />
                <button type="submit" className="button secondary">
                  Bedarfstraeger:innen-Rolle hinzufuegen
                </button>
              </form>
            ) : null}
            {!istFoerdererJetzt ? (
              <form action={rolleHinzufuegenAction}>
                <input type="hidden" name="rolle" value="foerderer" />
                <button type="submit" className="button secondary">
                  Foerder:innen-Rolle hinzufuegen
                </button>
              </form>
            ) : null}
          </div>
        </>
      ) : null}
    </section>
  );
}

function BenachrichtigungenTab(props: {
  values: Required<typeof defaultBenachrichtigungsEinstellungen>;
  benachrichtigungenSpeichernAction: (formData: FormData) => Promise<void>;
}) {
  return (
    <section>
      <form
        action={props.benachrichtigungenSpeichernAction}
        style={{ display: 'grid', gap: 8, maxWidth: 640 }}
      >
        {(
          Object.keys(defaultBenachrichtigungsEinstellungen) as Array<
            keyof typeof defaultBenachrichtigungsEinstellungen
          >
        ).map((key) => (
          <label key={key} style={{ display: 'block', padding: '4px 0' }}>
            <input
              type="checkbox"
              name={`be.${key}`}
              defaultChecked={props.values[key]}
            />{' '}
            {de.benachrichtigung[key] ?? key}
          </label>
        ))}
        <button type="submit" className="button primary" style={{ marginTop: 12 }}>
          {de.einstellungen.benachrichtigungen_speichern}
        </button>
      </form>
    </section>
  );
}

function DatenschutzTab(props: {
  status: typeof nutzer.$inferSelect.status;
  loeschungAnstehendBis: Date | null;
  kontoPausierenAction: () => Promise<void>;
  kontoReaktivierenAction: () => Promise<void>;
  kontoLoeschenAnfordernAction: () => Promise<void>;
  loeschungWiderrufenAction: () => Promise<void>;
}) {
  const istLoeschungAnstehend =
    props.status === 'loeschung_anstehend' && props.loeschungAnstehendBis;

  return (
    <section style={{ display: 'grid', gap: 24, maxWidth: 640 }}>
      <div>
        <h2>Daten-Export</h2>
        <p>
          Du kannst jederzeit eine vollstaendige Kopie aller Daten herunterladen,
          die wir ueber dich gespeichert haben (DSGVO Art. 15 Auskunftsrecht).
          Der Export laeuft als JSON-Datei.
        </p>
        <p>
          <a href="/api/v1/me/export" download className="button secondary" role="button">
            Meine Daten exportieren
          </a>
        </p>
        <p>
          <small>Maximal 1 Export pro Stunde.</small>
        </p>
      </div>

      <div>
        <h2>Konto-Pause</h2>
        <p>{de.einstellungen.konto_pausieren_erklaerung}</p>
        {props.status === 'pausiert' ? (
          <form action={props.kontoReaktivierenAction}>
            <button type="submit" className="button primary">
              {de.einstellungen.konto_reaktivieren}
            </button>
          </form>
        ) : (
          <form action={props.kontoPausierenAction}>
            <button type="submit" className="button secondary">
              {de.einstellungen.konto_pausieren}
            </button>
          </form>
        )}
      </div>

      <div>
        <h2>{de.einstellungen.konto_loeschen_ueberschrift}</h2>
        {istLoeschungAnstehend ? (
          <>
            <p
              role="alert"
              style={{
                border: '1px solid #b91c1c',
                background: 'color-mix(in oklch, #b91c1c 8%, var(--surface))',
                color: '#b91c1c',
                padding: '12px 14px',
                borderRadius: 6,
                fontWeight: 500,
              }}
            >
              {de.einstellungen.konto_loeschen_anstehend_banner(
                formatLoeschungsDatum(props.loeschungAnstehendBis as Date),
              )}
            </p>
            <form action={props.loeschungWiderrufenAction}>
              <button type="submit" className="button primary">
                {de.einstellungen.konto_loeschen_widerrufen}
              </button>
            </form>
          </>
        ) : (
          <>
            <p>{de.einstellungen.konto_loeschen_erklaerung}</p>
            <form action={props.kontoLoeschenAnfordernAction}>
              <button
                type="submit"
                className="button secondary"
                style={{ borderColor: '#b91c1c', color: '#b91c1c' }}
              >
                {de.einstellungen.konto_loeschen_anfordern}
              </button>
            </form>
          </>
        )}
      </div>
    </section>
  );
}

function FoerdermitgliedschaftTab(props: {
  mitgliedschaft: typeof foerdermitgliedschaft.$inferSelect | null;
  startenAction: (formData: FormData) => Promise<void>;
  portalAction: () => Promise<void>;
}) {
  const { mitgliedschaft, startenAction, portalAction } = props;
  const aktivOderOffen =
    mitgliedschaft && mitgliedschaft.status !== 'gekuendigt';
  const statusLabel: Record<FoermitglStatus, string> = {
    aktiv: 'aktiv',
    gekuendigt: 'gekuendigt',
    zahlung_fehlt: 'Zahlung fehlt',
  };
  const stufenLabel: Record<FoermitglStufe, string> = Object.fromEntries(
    STUFEN.map((s) => [s.stufe, s.label]),
  ) as Record<FoermitglStufe, string>;

  return (
    <section style={{ display: 'grid', gap: 24, maxWidth: 880 }}>
      <div>
        <p>
          Mit einer Foerdermitgliedschaft tragt ihr die Werkstatt nachhaltig
          mit. Werkzirkel nimmt keine Provision auf Vermittlungen — der
          Beitrag fliesst transparent in die Werkstatt-Kasse. Mitglieder mit
          aktivem Status koennen mehr als fuenf Werke anlegen.
        </p>
      </div>

      {aktivOderOffen ? (
        <div
          style={{
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            padding: 16,
            borderRadius: 8,
          }}
        >
          <h2 style={{ marginTop: 0 }}>
            Deine Mitgliedschaft: {stufenLabel[mitgliedschaft.stufe]}
          </h2>
          <p>Status: {statusLabel[mitgliedschaft.status]}</p>
          {mitgliedschaft.beginn ? (
            <p style={{ color: 'var(--muted)', fontSize: 13 }}>
              Beginn: {mitgliedschaft.beginn.toISOString().slice(0, 10)}
            </p>
          ) : null}
          <form action={portalAction}>
            <button type="submit" className="button primary">
              Verwalten (Stripe Customer Portal)
            </button>
          </form>
        </div>
      ) : null}

      <div>
        <h2>{aktivOderOffen ? 'Stufe wechseln' : 'Stufe auswaehlen'}</h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 16,
          }}
        >
          {STUFEN.map((s) => (
            <div
              key={s.stufe}
              style={{
                border: '1px solid var(--border)',
                padding: 16,
                borderRadius: 8,
                display: 'grid',
                gap: 8,
                background: 'var(--surface)',
              }}
            >
              <h3 style={{ margin: 0 }}>{s.label}</h3>
              <p style={{ margin: 0, fontWeight: 600 }}>{s.preisText}</p>
              <p
                style={{
                  margin: 0,
                  color: 'var(--muted)',
                  fontSize: 13,
                  flexGrow: 1,
                }}
              >
                {s.beschreibung}
              </p>
              <form action={startenAction}>
                <input type="hidden" name="stufe" value={s.stufe} />
                <button
                  type="submit"
                  className="button primary"
                  disabled={aktivOderOffen ?? undefined}
                >
                  Aktivieren
                </button>
              </form>
            </div>
          ))}
        </div>
        {aktivOderOffen ? (
          <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 12 }}>
            Wechsel der Stufe geht ueber das Stripe Customer Portal oben.
          </p>
        ) : null}
      </div>
    </section>
  );
}

function Field(props: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gap: 4 }}>
      <label htmlFor={props.id} style={{ fontSize: 14, fontWeight: 500 }}>
        {props.label}
      </label>
      {props.children}
    </div>
  );
}
