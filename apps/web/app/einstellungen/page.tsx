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
import { auditLog, magicLinkToken, nutzer, stadt } from '@/lib/db/schema';
import {
  rolle as rolleEnum,
  teilnahmeart as teilnahmeartEnum,
} from '@/lib/db/schema/enums';
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

type Tab = 'profil' | 'benachrichtigungen' | 'datenschutz';

const TABS: ReadonlyArray<{ id: Tab; label: string }> = [
  { id: 'profil', label: de.einstellungen.tab_profil },
  { id: 'benachrichtigungen', label: de.einstellungen.tab_benachrichtigungen },
  { id: 'datenschutz', label: de.einstellungen.tab_datenschutz },
];

function parseTab(raw: string | undefined): Tab {
  if (raw === 'benachrichtigungen' || raw === 'datenschutz') return raw;
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
        />
      ) : null}
      {tab === 'benachrichtigungen' ? (
        <BenachrichtigungenTab
          values={be}
          benachrichtigungenSpeichernAction={benachrichtigungenSpeichernAction}
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
}) {
  const { me, staedte, profilSpeichernAction } = props;

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
