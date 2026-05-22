/**
 * Integration-Tests fuer die sechs Rechtstexte-Pages (PRD §40).
 *
 * Pro Page:
 *  - Render ohne Throw, liefert HTML mit deutscher Sprache.
 *  - Pflicht-Strings vorhanden (Pflicht-Inhalte gem. PRD §40).
 *  - Footer-Stub aufgeloest: kein 'in Arbeit'/'aria-disabled' mehr.
 *  - Cross-Verlinkung auf andere Rechtstexte funktioniert (kein '#'-Stub).
 *
 * Plus: Footer-Links auf den drei Landingpages (/, /bedarf, /foerdern)
 * verweisen jetzt auf die echten URLs.
 */

import { describe, expect, it, vi } from 'vitest';

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

const { renderToStaticMarkup } = await import('react-dom/server');
const ImpressumPage = (await import('@/app/impressum/page')).default;
const DatenschutzPage = (await import('@/app/datenschutz/page')).default;
const AgbPage = (await import('@/app/agb/page')).default;
const RegelnPage = (await import('@/app/regeln/page')).default;
const StreitschlichtungPage = (await import('@/app/streitschlichtung/page')).default;
const CookiesPage = (await import('@/app/cookies/page')).default;
const MacherLandingpage = (await import('@/app/page')).default;
const BedarfLandingpage = (await import('@/app/bedarf/page')).default;
const FoerdernLandingpage = (await import('@/app/foerdern/page')).default;

function render(tree: React.ReactElement): string {
  return renderToStaticMarkup(tree);
}

describe('/impressum', () => {
  it('rendert mit Pflicht-Angaben nach § 5 TMG und § 18 Abs. 2 MStV', () => {
    const html = render(ImpressumPage() as React.ReactElement);
    expect(html).toContain('Impressum');
    expect(html).toContain('§ 5 TMG');
    expect(html).toContain('§ 18 Abs. 2 MStV');
    expect(html).toContain('Ulrich Diedrichsen');
    expect(html).toContain('Hamburg');
    expect(html).toContain('developer@moinsen.dev');
    expect(html).toContain('Umsatzsteuer-Identifikationsnummer');
    expect(html).toContain('Verantwortlich für den Inhalt');
  });

  it('Footer enthaelt Links auf alle Rechtstexte, KEINE Stubs', () => {
    const html = render(ImpressumPage() as React.ReactElement);
    expect(html).toContain('href="/datenschutz"');
    expect(html).toContain('href="/agb"');
    expect(html).toContain('href="/regeln"');
    expect(html).toContain('href="/streitschlichtung"');
    expect(html).toContain('href="/cookies"');
    expect(html).not.toContain('aria-disabled');
    expect(html).not.toContain('muted-link');
  });
});

describe('/datenschutz', () => {
  it('enthaelt Rechtsgrundlagen, AVV-Liste und Self-Service-Links', () => {
    const html = render(DatenschutzPage() as React.ReactElement);
    expect(html).toContain('Datenschutzerklärung');
    expect(html).toContain('Art. 13');
    expect(html).toContain('Art. 6 Abs. 1 lit. b DSGVO');
    expect(html).toContain('Art. 6 Abs. 1 lit. c DSGVO');
    expect(html).toContain('Art. 6 Abs. 1 lit. f DSGVO');

    // AVV-Liste (PRD §41) — alle sechs Verarbeiter genannt
    expect(html).toContain('Hetzner');
    expect(html).toContain('Cloudflare R2');
    expect(html).toContain('Resend');
    expect(html).toContain('Stripe');
    expect(html).toContain('Sentry');
    expect(html).toContain('Plausible');

    // Self-Service-Endpunkte fuer Betroffenenrechte
    expect(html).toContain('/api/v1/me/export');
    expect(html).toContain('/api/v1/me');
    expect(html).toContain('/einstellungen');

    // Beschwerderecht Hamburgische Datenschutzbeauftragte
    expect(html).toContain('Hamburgische Beauftragte für Datenschutz');
  });
});

describe('/agb', () => {
  it('sagt explizit: keine Provision, keine Vermittlung, keine Equity', () => {
    const html = render(AgbPage() as React.ReactElement);
    expect(html).toContain('Allgemeine Geschäftsbedingungen');

    // PRD §11A Werkstatt-Kultur-Schutz: 3x „KEINE"
    expect(html.toLowerCase()).toContain('keine provision');
    expect(html.toLowerCase()).toMatch(/keine.*vermittlung|vermittelt nicht/);
    expect(html).toMatch(/Equity|Beteiligungen|Investorenverhältnisse/);

    // Anwendbares Recht + Gerichtsstand Hamburg
    expect(html).toContain('deutsches Recht');
    expect(html).toContain('Hamburg');

    // Salvatorische Klausel + Widerrufsrecht + Haftung
    expect(html).toContain('Salvatorische');
    expect(html).toContain('Widerrufsrecht');
  });
});

describe('/regeln', () => {
  it('listet Werkstatt-Regeln aus PRD §9 + §11A', () => {
    const html = render(RegelnPage() as React.ReactElement);
    expect(html).toContain('Werkstatt-Regeln');
    expect(html).toMatch(/Cold-Outreach|Cold Outreach/);
    expect(html).toContain('Membership-Beitrag');
    expect(html).toMatch(/Sponsor-Status/);
    expect(html).toMatch(/Equity|Beteiligung/);
    expect(html).toMatch(/City-Leads|City-Leads/);
  });
});

describe('/streitschlichtung', () => {
  it('enthaelt VSBG-Hinweis (nimmt NICHT teil) + ODR-Link', () => {
    const html = render(StreitschlichtungPage() as React.ReactElement);
    expect(html).toContain('Streitschlichtung');
    expect(html).toContain('VSBG');
    expect(html).toMatch(/nicht verpflichtet und nicht bereit|nicht teil/);
    expect(html).toContain('ec.europa.eu/consumers/odr');
  });
});

describe('/cookies', () => {
  it('zeigt nur wz_session, kein Tracking, kein Banner', () => {
    const html = render(CookiesPage() as React.ReactElement);
    expect(html).toContain('Cookie');
    expect(html).toContain('wz_session');
    expect(html).toContain('TTDSG');
    expect(html).toMatch(/Kein Tracking|kein Tracking/);
    expect(html).toContain('Plausible');
  });
});

describe('Footer-Links auf Landingpages — keine 404-Stubs mehr', () => {
  it('/ (Macher-Landingpage) verlinkt alle Rechtstexte', () => {
    const html = render(MacherLandingpage() as React.ReactElement);
    expect(html).toContain('href="/impressum"');
    expect(html).toContain('href="/datenschutz"');
    expect(html).toContain('href="/agb"');
    expect(html).toContain('href="/regeln"');
    expect(html).not.toContain('folgt zum Plattform-Start');
    expect(html).not.toContain('muted-link');
  });

  it('/bedarf verlinkt alle Rechtstexte', () => {
    const html = render(BedarfLandingpage() as React.ReactElement);
    expect(html).toContain('href="/impressum"');
    expect(html).toContain('href="/datenschutz"');
    expect(html).toContain('href="/agb"');
    expect(html).toContain('href="/regeln"');
    expect(html).not.toContain('folgt zum Plattform-Start');
    expect(html).not.toContain('muted-link');
  });

  it('/foerdern verlinkt alle Rechtstexte', () => {
    const html = render(FoerdernLandingpage() as React.ReactElement);
    expect(html).toContain('href="/impressum"');
    expect(html).toContain('href="/datenschutz"');
    expect(html).toContain('href="/agb"');
    expect(html).toContain('href="/regeln"');
    expect(html).not.toContain('folgt zum Plattform-Start');
    expect(html).not.toContain('muted-link');
  });
});
