/**
 * T-501 — Foerderprofil eingereicht (Bestaetigung an Foerder:in).
 *
 * Wird verschickt, sobald eine Foerder:in ihr Profil zur Verifikation
 * eingereicht hat. Das Profil ist jetzt im Kurator:innen-Postfach.
 *
 * Betreff: „Dein Foerderprofil ist eingereicht"
 */

import { Button, Heading, Section, Text } from '@react-email/components';
import * as React from 'react';
import { Layout } from './_layout';

export interface FoerderprofilEingereichtProps {
  /** Organisation aus dem Foerderprofil. */
  organisation: string;
  /** Link zum eigenen Foerderprofil. */
  profilUrl: string;
  /** App-URL fuer Footer-Links. */
  appUrl?: string;
}

export const T501_BETREFF = 'Dein Foerderprofil ist eingereicht';

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

export function FoerderprofilEingereicht(
  props: FoerderprofilEingereichtProps,
): React.JSX.Element {
  const { organisation, profilUrl, appUrl = 'https://werkzirkel.de' } = props;

  return (
    <Layout
      vorschau={`Dein Foerderprofil fuer ${organisation} ist zur Verifikation eingereicht.`}
      appUrl={appUrl}
    >
      <Heading as="h1" style={{ fontSize: '20px', margin: '0 0 16px 0' }}>
        Dein Foerderprofil ist eingereicht
      </Heading>

      <Text style={{ margin: '0 0 16px 0' }}>
        Vielen Dank — dein Foerderprofil fuer {organisation} liegt jetzt
        bei der Kurator:innen-Runde. Wir melden uns innerhalb von zwei
        Wochen mit einem Vorstellungs-Gespraech.
      </Text>

      <Text style={{ margin: '0 0 16px 0' }}>
        Bis dahin ist das Profil als „in Verifikation“ markiert und
        noch nicht oeffentlich sichtbar.
      </Text>

      <Section style={{ textAlign: 'center', margin: '24px 0' }}>
        <Button href={profilUrl} style={buttonStyle}>
          Mein Foerderprofil ansehen
        </Button>
      </Section>
    </Layout>
  );
}

export default FoerderprofilEingereicht;
