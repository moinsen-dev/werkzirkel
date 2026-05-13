/**
 * /anmelden — Magic-Link-Anmeldeseite.
 *
 * Server Component. Liest `?next`, `?fehler`, `?gesendet` aus den
 * Search-Params:
 * - `?fehler=token-ungueltig` → roter Banner ueber dem Formular.
 * - `?fehler=loeschung-token-ungueltig` → roter Banner mit Loeschungs-Text.
 * - `?fehler=rate-limit` → roter Banner mit Wartezeit-Hinweis.
 * - `?fehler=ungueltige-email` → roter Banner mit E-Mail-Validierungs-Text.
 * - `?gesendet=1` → gruener Erfolgs-Banner statt Formular.
 *
 * Formular postet an die Server-Action `magicLinkAnfordern` aus `actions.ts`.
 * Die Action ruft `requestMagicLink()` aus `lib/auth/magic-link.ts` direkt
 * auf — kein HTTP-Hop, damit der Origin-CSRF-Check der Route nicht stoert.
 *
 * `?next=/uebersicht` wird durchgeschleift: in das versteckte FormData-Feld,
 * dann in `magic_link_token.next_path` persistiert, beim Verify-Klick aus
 * dem Token gelesen.
 */

import type { Metadata } from 'next';
import Link from 'next/link';

import { de } from '@/i18n/de';
import { magicLinkAnfordern } from './actions';

export const metadata: Metadata = {
  title: 'Anmelden',
  description:
    'Per Magic-Link beim Werkzirkel anmelden oder einen Werkpass anlegen. Kein Passwort, keine Cookies-Banner-Wand.',
};

const t = de.anmelden;

const fehlerBannerStyle = {
  borderColor: '#d04848',
  background: '#fbeaea',
  color: '#5a1a1a',
  marginTop: '16px',
} as const;

const erfolgBannerStyle = {
  borderColor: '#3a8a3a',
  background: '#e9f5ea',
  color: '#1d4a1d',
  marginTop: '20px',
} as const;

interface Params {
  searchParams: Promise<{
    next?: string;
    fehler?: string;
    gesendet?: string;
  }>;
}

export default async function AnmeldenPage({ searchParams }: Params) {
  const sp = await searchParams;
  const next = typeof sp.next === 'string' ? sp.next : '';
  const fehler = typeof sp.fehler === 'string' ? sp.fehler : '';
  const gesendet = sp.gesendet === '1';

  return (
    <div className="page-shell">
      <nav className="site-nav" aria-label="Hauptnavigation">
        <div className="wrap nav-inner">
          <Link href="/" className="brand" aria-label="Werkzirkel Start">
            <span className="brand-mark" aria-hidden="true">
              <span></span>
              <span></span>
              <span></span>
              <span></span>
            </span>
            <span>Werkzirkel</span>
          </Link>
          <div className="nav-links" aria-label="Bereiche">
            <Link href="/">Macher:innen</Link>
            <Link href="/bedarf">Bedarf einbringen</Link>
            <Link href="/foerdern">Werke fördern</Link>
          </div>
        </div>
      </nav>

      <header className="hero" id="top">
        <div className="wrap hero-grid single">
          <div>
            <p className="eyebrow">{t.eyebrow}</p>
            <h1>{t.titel}</h1>
            <p className="hero-copy">{t.untertitel}</p>

            {fehler === 'token-ungueltig' && (
              <div role="alert" className="callout" style={fehlerBannerStyle}>
                {t.fehler_token_ungueltig}
              </div>
            )}
            {fehler === 'loeschung-token-ungueltig' && (
              <div role="alert" className="callout" style={fehlerBannerStyle}>
                {t.fehler_loeschung_token_ungueltig}
              </div>
            )}
            {fehler === 'rate-limit' && (
              <div role="alert" className="callout" style={fehlerBannerStyle}>
                {t.fehler_rate_limit}
              </div>
            )}
            {fehler === 'ungueltige-email' && (
              <div role="alert" className="callout" style={fehlerBannerStyle}>
                {t.fehler_ungueltige_email}
              </div>
            )}

            {gesendet ? (
              <div role="status" className="callout" style={erfolgBannerStyle}>
                <strong>{t.erfolg}</strong>
              </div>
            ) : (
              <form
                className="waitlist"
                action={magicLinkAnfordern}
                style={{ marginTop: '20px' }}
              >
                <label htmlFor="email">{t.email_label}</label>
                <div className="waitlist-row">
                  <input
                    id="email"
                    name="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder={t.email_placeholder}
                    aria-label={t.email_label}
                    required
                  />
                </div>
                <input type="hidden" name="next" value={next} />
                <div
                  className="hero-actions"
                  style={{ marginTop: '12px', flexWrap: 'wrap' }}
                >
                  <button
                    className="button primary"
                    type="submit"
                    name="zweck"
                    value="login"
                  >
                    {t.button_login}
                  </button>
                  <button
                    className="button secondary"
                    type="submit"
                    name="zweck"
                    value="registrierung"
                  >
                    {t.button_registrieren}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </header>

      <footer className="site-footer">
        <div className="wrap footer-inner">
          <span>Werkzirkel — Gemeinsam digitale Produkte bauen.</span>
          <div className="footer-links" aria-label="Fußnavigation">
            <Link href="/">Macher:innen</Link>
            <Link href="/bedarf">Bedarf</Link>
            <Link href="/foerdern">Fördern</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
