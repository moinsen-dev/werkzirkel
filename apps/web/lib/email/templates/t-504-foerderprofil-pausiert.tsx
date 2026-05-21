/**
 * T-504 — Foerderprofil automatisch pausiert.
 *
 * Wird vom Auto-Pause-Cron verschickt, wenn das Foerderprofil 4 Quartale
 * ohne Briefing Night-Teilnahme war und deshalb pausiert wurde
 * (PRD §11A Schutz Kulturverlust 4).
 *
 * Betreff: „Dein Foerderprofil wurde pausiert"
 */

import { Button, Heading, Section, Text } from '@react-email/components';
import * as React from 'react';
import { Layout } from './_layout';

export interface FoerderprofilPausiertProps {
  organisation: string;
  /** Naechste Briefing Night-Suche-URL. */
  bedarfsschauUrl: string;
  appUrl?: string;
}

export const T504_BETREFF = 'Dein Foerderprofil wurde pausiert';

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

export function FoerderprofilPausiert(
  props: FoerderprofilPausiertProps,
): React.JSX.Element {
  const {
    organisation,
    bedarfsschauUrl,
    appUrl = 'https://werkzirkel.de',
  } = props;

  return (
    <Layout
      vorschau={`Dein Foerderprofil fuer ${organisation} wurde pausiert.`}
      appUrl={appUrl}
    >
      <Heading as="h1" style={{ fontSize: '20px', margin: '0 0 16px 0' }}>
        Dein Foerderprofil wurde pausiert
      </Heading>

      <Text style={{ margin: '0 0 16px 0' }}>
        Dein Foerderprofil fuer {organisation} hat vier Quartale lang keine
        Briefing Night besucht und wurde deshalb automatisch pausiert. Im
        Werkzirkel ist es jetzt nicht mehr sichtbar.
      </Text>

      <Text style={{ margin: '0 0 16px 0' }}>
        Komm zur naechsten Briefing Night in deiner Stadt — die Anwesenheit
        reaktiviert dein Profil automatisch. Du kannst es alternativ
        ueber die Profilseite manuell zur erneuten Verifikation einreichen.
      </Text>

      <Section style={{ textAlign: 'center', margin: '24px 0' }}>
        <Button href={bedarfsschauUrl} style={buttonStyle}>
          Naechste Briefing Night ansehen
        </Button>
      </Section>
    </Layout>
  );
}

export default FoerderprofilPausiert;
