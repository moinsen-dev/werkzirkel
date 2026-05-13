/**
 * T-001 — Magic-Link Login.
 *
 * Wird verschickt, wenn eine bereits registrierte Person per Magic-Link
 * eine neue Sitzung anfordert. Tonalitaet: du-Anrede, sachlich.
 *
 * Betreff: „Dein Anmelde-Link fuer den Werkzirkel"
 */

import { Button, Heading, Section, Text } from '@react-email/components';
import * as React from 'react';
import { Layout } from './_layout';

export interface MagicLinkLoginProps {
  /** Klickbare URL zum Einloggen (enthaelt den Magic-Link-Token). */
  magicLinkUrl: string;
  /** Gueltigkeitsdauer in Minuten (ueblich: 15). */
  expiresInMinutes: number;
  /** App-URL fuer Footer-Links. Default: aus env. */
  appUrl?: string;
}

export const T001_BETREFF = 'Dein Anmelde-Link für den Werkzirkel';

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

export function MagicLinkLogin(props: MagicLinkLoginProps): React.JSX.Element {
  const { magicLinkUrl, expiresInMinutes, appUrl = 'https://werkzirkel.de' } = props;
  return (
    <Layout
      vorschau={`Dein Anmelde-Link ist ${expiresInMinutes} Minuten gültig.`}
      appUrl={appUrl}
    >
      <Heading as="h1" style={{ fontSize: '20px', margin: '0 0 16px 0' }}>
        Anmelde-Link für deinen Werkzirkel
      </Heading>

      <Text style={{ margin: '0 0 16px 0' }}>
        Klick auf den Knopf unten, um dich in deinem Werkzirkel-Konto
        anzumelden. Der Link ist {expiresInMinutes} Minuten gültig und kann
        nur einmal verwendet werden.
      </Text>

      <Section style={{ textAlign: 'center', margin: '24px 0' }}>
        <Button href={magicLinkUrl} style={buttonStyle}>
          Jetzt anmelden
        </Button>
      </Section>

      <Text style={{ margin: '24px 0 8px 0', fontSize: '14px' }}>
        Falls der Knopf nicht funktioniert, kopier diese Adresse in deinen
        Browser:
      </Text>
      <Text style={linkBlockStyle}>{magicLinkUrl}</Text>

      <Text style={{ margin: '24px 0 0 0', fontSize: '14px', color: '#78716c' }}>
        Hast du keine Anmeldung angefordert? Ignorier diese E-Mail einfach —
        ohne Klick passiert nichts.
      </Text>
    </Layout>
  );
}

export default MagicLinkLogin;
