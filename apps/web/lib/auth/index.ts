/**
 * Werkzirkel — Better-Auth-Konfiguration.
 *
 * Initialisiert die zentrale `auth`-Instance mit:
 * - Drizzle-Adapter gegen unsere existierenden Tabellen `nutzer` / `session` / `magic_link_token`
 *   (Schema-Mapping ueber `modelName` + `fields` sichtbar in der Adapter-Config)
 * - Magic-Link-Plugin mit 15-Min-Expiry und SHA-256-Hashed-Token-Speicherung
 * - Session-Cookie `wz_session` (httpOnly, secure, sameSite=lax, 30-Tage-Sliding-Window)
 *
 * Konsumenten:
 * - `apps/web/app/api/auth/[...all]/route.ts` → exponiert `auth.handler` als Next.js-Route
 * - spaeter task-magic-link-endpoints → wickelt POST/GET unter `/api/v1/auth/*` mit Rate-Limits
 *
 * Die eigentliche Versand-Logik fuer Magic-Links wird in task-magic-link-endpoints
 * und task-email-templates-auth verdrahtet — hier nur der Hook-Slot.
 *
 * PRD-Referenz: §11 (Tech-Stack), §16 (Auth & Session).
 */

import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { magicLink } from 'better-auth/plugins';
import { db, schema } from '@/lib/db';
import { env } from '@/lib/env';

// Better-Auth verlangt im Production-Mode ein gesetztes Secret. In Dev/Test
// faellt es auf den BetterAuth-Default zurueck (gut genug fuer Unit-Tests).
const secret = env.BETTER_AUTH_SECRET ?? 'werkzirkel-dev-secret-not-for-production-use-1234';

declare global {
  var __werkzirkelAuth: ReturnType<typeof buildAuth> | undefined;
}

function buildAuth() {
  return betterAuth({
    appName: 'Werkzirkel',
    secret,
    baseURL: env.BETTER_AUTH_URL ?? env.APP_URL,
    basePath: '/api/auth',

    database: drizzleAdapter(db, {
      provider: 'pg',
      schema,
      // unsere Drizzle-Tabellen sind im Singular benannt — `nutzer`, `session`,
      // `magicLinkToken` — passt zu Better-Auths Singular-Default.
      usePlural: false,
    }),

    // ── User-Tabellen-Mapping ────────────────────────────────────────────────
    // Better-Auth erwartet die Tabelle `user`; wir mappen sie auf `nutzer`
    // und uebersetzen die Default-Spalten auf unsere deutschen Namen.
    user: {
      modelName: 'nutzer',
      fields: {
        // BaseUser-Felder → unsere Drizzle-Spalten (snake_case via casing-Config)
        name: 'anzeigename',
        emailVerified: 'email_verifiziert_am',
        image: 'avatar_url',
        createdAt: 'erstellt_am',
        updatedAt: 'aktualisiert_am',
        // `email` bleibt `email` — kein Mapping noetig.
      },
    },

    // ── Session-Tabellen-Mapping + Cookie-Konfig (PRD §16) ───────────────────
    session: {
      modelName: 'session',
      fields: {
        userId: 'nutzer_id',
        expiresAt: 'expires_at',
        ipAddress: 'ip_adresse',
        userAgent: 'user_agent',
        createdAt: 'erstellt_am',
        // `token` und `updatedAt` werden von Better-Auth auf Default-Spalten gemappt;
        // ein Migrations-Step kommt in einem spaeteren Schema-Task.
      },
      // 30 Tage Max-Age laut PRD §16
      expiresIn: 60 * 60 * 24 * 30,
      // Sliding-Window: bei jeder Nutzung innerhalb der naechsten 24 h verlaengern
      updateAge: 60 * 60 * 24,
    },

    // ── Magic-Link → magic_link_token statt Default-`verification`-Tabelle ───
    verification: {
      modelName: 'magic_link_token',
      fields: {
        identifier: 'email',
        value: 'token_hash',
        expiresAt: 'expires_at',
        createdAt: 'erstellt_am',
        // `updatedAt` faellt auf den Default zurueck — Schema-Anpassung kommt
        // im DB-Migrations-Task, wenn der end-to-end-Flow grun werden muss.
      },
    },

    // ── Plugins ──────────────────────────────────────────────────────────────
    plugins: [
      magicLink({
        // 15 Minuten Gueltigkeit, gemaess PRD §16
        expiresIn: 15 * 60,
        // Token wird ausschliesslich als SHA-256-Hash in `magic_link_token.token_hash`
        // persistiert — Klartext verlaesst nie den Server (PRD §16).
        storeToken: 'hashed',
        // Der tatsaechliche E-Mail-Versand wird in task-magic-link-endpoints und
        // task-email-templates-auth verdrahtet. Hier nur der Stub, damit die
        // Plugin-Initialisierung sauber laeuft.
        sendMagicLink: async () => {
          // no-op: wird durch task-email-templates-auth ersetzt
        },
      }),
    ],

    // ── Globale Cookie-Defaults + Session-Cookie-Name (PRD §16) ─────────────
    advanced: {
      cookiePrefix: 'wz',
      cookies: {
        session_token: {
          name: 'wz_session',
          attributes: {
            httpOnly: true,
            secure: true,
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 24 * 30, // 30 Tage
          },
        },
      },
      defaultCookieAttributes: {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
      },
    },
  });
}

// HMR-Schutz: in Dev/Test haengen wir die Instance an `globalThis`, damit
// Next.js' Hot-Reload nicht bei jedem Edit eine neue Auth-Instance erzeugt
// (DB-Pool und Plugin-State sollen stabil bleiben). Selbes Muster wie in
// `apps/web/lib/db/index.ts`.
export const auth = globalThis.__werkzirkelAuth ?? buildAuth();

if (env.NODE_ENV !== 'production') {
  globalThis.__werkzirkelAuth = auth;
}

export type Auth = typeof auth;
