/**
 * T-002 — Magic-Link Registrierung / Begruessung.
 *
 * Wird verschickt, nachdem jemand sich erstmalig registriert hat und seine
 * E-Mail-Adresse bestaetigen muss.
 *
 * Betreff: „Willkommen im Werkzirkel — bestaetige deine E-Mail"
 */

import { Button, Heading, Section, Text } from '@react-email/components';
import * as React from 'react';
import { Layout } from './_layout';

export interface MagicLinkRegistrierungProps {
  /** Klickbare URL zur Bestaetigung der E-Mail. */
  magicLinkUrl: string;
  /** Gewaehlter Anzeigename der neuen Person. */
  anzeigename: string;
  /** App-URL fuer Footer-Links. */
  appUrl?: string;
}

export const T002_BETREFF = 'Willkommen im Werkzirkel — bestätige deine E-Mail';

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

const linkBlockStyle = {
  wordBreak: 'break-all' as const,
  color: '#57534e',
  fontSize: '13px',
  fontFamily: 'monospace',
  backgroundColor: '#f5f5f4',
  padding: '12px',
  borderRadius: '4px',
};

export function MagicLinkRegistrierung(
  props: MagicLinkRegistrierungProps,
): React.JSX.Element {
  const { magicLinkUrl, anzeigename, appUrl = 'https://werkzirkel.de' } = props;
  return (
    <Layout
      vorschau={`Hallo ${anzeigename} — bestätige deine E-Mail, dann geht's los.`}
      appUrl={appUrl}
    >
      <Heading as="h1" style={{ fontSize: '20px', margin: '0 0 16px 0' }}>
        Schön, dass du da bist, {anzeigename}.
      </Heading>

      <Text style={{ margin: '0 0 16px 0' }}>
        Du hast dich beim Werkzirkel angemeldet. Klick auf den Knopf unten,
        um deine E-Mail-Adresse zu bestätigen und dein Konto freizuschalten.
      </Text>

      <Section style={{ textAlign: 'center', margin: '24px 0' }}>
        <Button href={magicLinkUrl} style={buttonStyle}>
          E-Mail bestätigen
        </Button>
      </Section>

      <Text style={{ margin: '24px 0 8px 0', fontSize: '14px' }}>
        Falls der Knopf nicht funktioniert, kopier diese Adresse in deinen
        Browser:
      </Text>
      <Text style={linkBlockStyle}>{magicLinkUrl}</Text>

      <Text style={{ margin: '24px 0 8px 0' }}>
        Werkzirkel ist kein Marktplatz, sondern eine Werkstatt: erst zeigen,
        was du baust — dann findet sich, was du brauchst. Schau dich um, leg
        ein Werk an und gib anderen ehrliches Feedback.
      </Text>

      <Text style={{ margin: '24px 0 0 0', fontSize: '14px', color: '#78716c' }}>
        Hast du dich nicht angemeldet? Ignorier diese E-Mail — dann passiert
        nichts.
      </Text>
    </Layout>
  );
}

export default MagicLinkRegistrierung;
