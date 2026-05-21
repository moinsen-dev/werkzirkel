/**
 * T-502 — Foerderprofil verifiziert.
 *
 * Wird verschickt, wenn eine City-Lead das Foerderprofil erfolgreich
 * verifiziert hat. Das Profil ist ab jetzt oeffentlich sichtbar.
 *
 * Betreff: „Dein Foerderprofil ist freigeschaltet"
 */

import { Button, Heading, Section, Text } from '@react-email/components';
import * as React from 'react';
import { Layout } from './_layout';

export interface FoerderprofilVerifiziertProps {
  organisation: string;
  profilUrl: string;
  appUrl?: string;
}

export const T502_BETREFF = 'Dein Foerderprofil ist freigeschaltet';

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

export function FoerderprofilVerifiziert(
  props: FoerderprofilVerifiziertProps,
): React.JSX.Element {
  const { organisation, profilUrl, appUrl = 'https://werkzirkel.de' } = props;

  return (
    <Layout
      vorschau={`Dein Foerderprofil fuer ${organisation} ist verifiziert.`}
      appUrl={appUrl}
    >
      <Heading as="h1" style={{ fontSize: '20px', margin: '0 0 16px 0' }}>
        Dein Foerderprofil ist freigeschaltet
      </Heading>

      <Text style={{ margin: '0 0 16px 0' }}>
        Die City-Leads-Runde hat dein Profil fuer {organisation}
        verifiziert. Es ist ab sofort im Werkzirkel sichtbar und
        kann auf Briefing Nights vorgestellt werden.
      </Text>

      <Text style={{ margin: '0 0 16px 0' }}>
        Damit dein Profil aktiv bleibt, ist Teilnahme an mindestens einer
        Briefing Night in vier Quartalen Pflicht — sonst wird es automatisch
        pausiert. Du bekommst rechtzeitig eine Erinnerung.
      </Text>

      <Section style={{ textAlign: 'center', margin: '24px 0' }}>
        <Button href={profilUrl} style={buttonStyle}>
          Mein Foerderprofil ansehen
        </Button>
      </Section>
    </Layout>
  );
}

export default FoerderprofilVerifiziert;
