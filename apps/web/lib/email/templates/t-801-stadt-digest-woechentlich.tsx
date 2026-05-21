/**
 * T-801 — Stadt-Digest (woechentlich).
 *
 * Sendet jeden Mittwoch 09:00 Europe/Berlin pro aktive Stadt einen kurzen
 * Wochen-Digest: die 3 neuesten Werke, 2 naechsten Termine, 2 offenen
 * Quick-Helps. Opt-out via `nutzer.benachrichtigungs_einstellungen.stadt_digest`
 * (default `true`, siehe `lib/notifications/defaults.ts`).
 *
 * Quelle: PRD §8.14 (Benachrichtigungs-Strategie, Stadt-Digest), §31 + §42
 * Sprint 13 (T-801 Template), §F-307 (Newsletter pro Stadt).
 *
 * Betreff: „Werkzirkel <Stadt> — diese Woche im Zirkel"
 */

import { Button, Heading, Hr, Link, Section, Text } from '@react-email/components';
import * as React from 'react';

import { Layout } from './_layout';

export interface StadtDigestWerk {
  id: string;
  name: string;
  kurzbeschreibung: string;
  inhaberAnzeigename: string;
  /** Absolut, z.B. https://werkzirkel.de/werke/abc. */
  url: string;
}

export interface StadtDigestTermin {
  id: string;
  titel: string;
  /** Schon formatiert, z.B. „Mi, 21. Mai 2026, 19:00 Uhr". */
  datumZeitFormatiert: string;
  /** Schon formatiert, z.B. „Pruefabend" oder „Demo Night". */
  typLabel: string;
  url: string;
}

export interface StadtDigestHilfegesuch {
  id: string;
  titel: string;
  kurzbeschreibung: string;
  url: string;
}

export interface StadtDigestWoechentlichProps {
  /** Name der Stadt (z.B. „Hamburg"). */
  stadtName: string;
  /** Anzeigename der Empfaenger:in, dynamisch fuer die Anrede. */
  anzeigename: string;
  /** Bis zu 3 neueste Werke der Woche. */
  werke: StadtDigestWerk[];
  /** Bis zu 2 naechste Termine. */
  termine: StadtDigestTermin[];
  /** Bis zu 2 offene Quick-Helps. */
  hilfegesuche: StadtDigestHilfegesuch[];
  /** App-URL fuer Footer + CTA. */
  appUrl?: string;
}

export const T801_BETREFF_PREFIX = 'Werkzirkel';
export const T801_BETREFF_SUFFIX = '— diese Woche im Zirkel';

/**
 * Helfer fuer den dynamischen Betreff. Das Versand-Modul ruft das auf,
 * weil der Betreff pro Stadt variiert.
 */
export function t801BetreffFor(stadtName: string): string {
  return `${T801_BETREFF_PREFIX} ${stadtName} ${T801_BETREFF_SUFFIX}`;
}

const buttonStyle = {
  backgroundColor: '#0c0a09',
  color: '#ffffff',
  padding: '12px 24px',
  borderRadius: '6px',
  fontWeight: 600,
  fontSize: '15px',
  textDecoration: 'none',
  display: 'inline-block',
} as const;

const sektionTitelStyle = {
  fontSize: '15px',
  fontWeight: 700,
  margin: '24px 0 8px 0',
} as const;

const eintragStyle = {
  margin: '0 0 12px 0',
  paddingLeft: 0,
} as const;

const eintragTitelStyle = {
  margin: '0 0 4px 0',
  fontSize: '15px',
  fontWeight: 600,
} as const;

const eintragMetaStyle = {
  margin: 0,
  fontSize: '13px',
  color: '#78716c',
} as const;

export function StadtDigestWoechentlich(
  props: StadtDigestWoechentlichProps,
): React.JSX.Element {
  const {
    stadtName,
    anzeigename,
    werke,
    termine,
    hilfegesuche,
    appUrl = 'https://werkzirkel.de',
  } = props;

  const istLeer =
    werke.length === 0 && termine.length === 0 && hilfegesuche.length === 0;

  return (
    <Layout
      vorschau={`Werkzirkel ${stadtName}: ${werke.length} Werke, ${termine.length} Termine, ${hilfegesuche.length} Quick-Helps.`}
      appUrl={appUrl}
    >
      <Heading as="h1" style={{ fontSize: '22px', margin: '0 0 12px 0' }}>
        Werkzirkel {stadtName} — diese Woche
      </Heading>

      <Text style={{ margin: '0 0 16px 0' }}>
        Moin {anzeigename}, hier kommt dein woechentlicher Digest aus dem
        Werkzirkel {stadtName}. Drei neue Werke zum Anschauen, die naechsten
        Termine und ein paar offene Quick-Helps.
      </Text>

      {istLeer ? (
        <Section style={{ margin: '16px 0' }}>
          <Text style={{ margin: 0, fontStyle: 'italic', color: '#57534e' }}>
            Diese Woche war es ruhig im Zirkel. Wenn du selbst was bewegen
            willst, leg ein Werk an oder schreib ein Quick-Help — der Kreis
            schaut hin.
          </Text>
        </Section>
      ) : null}

      {werke.length > 0 ? (
        <Section>
          <Text style={sektionTitelStyle}>Neue Werke</Text>
          {werke.map((w) => (
            <Section key={w.id} style={eintragStyle}>
              <Text style={eintragTitelStyle}>
                <Link href={w.url} style={{ color: '#0c0a09' }}>
                  {w.name}
                </Link>
              </Text>
              <Text style={eintragMetaStyle}>
                von {w.inhaberAnzeigename}
              </Text>
              <Text style={{ ...eintragMetaStyle, color: '#1c1917' }}>
                {w.kurzbeschreibung}
              </Text>
            </Section>
          ))}
        </Section>
      ) : null}

      {termine.length > 0 ? (
        <Section>
          <Text style={sektionTitelStyle}>Naechste Termine</Text>
          {termine.map((t) => (
            <Section key={t.id} style={eintragStyle}>
              <Text style={eintragTitelStyle}>
                <Link href={t.url} style={{ color: '#0c0a09' }}>
                  {t.titel}
                </Link>
              </Text>
              <Text style={eintragMetaStyle}>
                {t.typLabel} · {t.datumZeitFormatiert}
              </Text>
            </Section>
          ))}
        </Section>
      ) : null}

      {hilfegesuche.length > 0 ? (
        <Section>
          <Text style={sektionTitelStyle}>Offene Quick-Helps</Text>
          {hilfegesuche.map((h) => (
            <Section key={h.id} style={eintragStyle}>
              <Text style={eintragTitelStyle}>
                <Link href={h.url} style={{ color: '#0c0a09' }}>
                  {h.titel}
                </Link>
              </Text>
              <Text style={{ ...eintragMetaStyle, color: '#1c1917' }}>
                {h.kurzbeschreibung}
              </Text>
            </Section>
          ))}
        </Section>
      ) : null}

      <Hr style={{ borderColor: '#e7e5e4', margin: '24px 0' }} />

      <Section style={{ textAlign: 'center', margin: '12px 0' }}>
        <Button href={`${appUrl}/werke`} style={buttonStyle}>
          Alle Werke ansehen
        </Button>
      </Section>

      <Text style={{ margin: '24px 0 0 0', fontSize: '13px', color: '#78716c' }}>
        Du bekommst diesen Digest, weil du im Werkzirkel {stadtName} angemeldet
        bist. Wenn du keine Wochen-Mails mehr moechtest, kannst du das in deinen
        Benachrichtigungs-Einstellungen ausschalten.
      </Text>
    </Layout>
  );
}

export default StadtDigestWoechentlich;
