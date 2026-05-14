/**
 * T-505 — Foerderprofil Bedarfsschau-Erinnerung (Quartalsende-Hinweis).
 *
 * Wird vom Auto-Pause-Cron als Vorwarnung verschickt, wenn das Foerderprofil
 * in absehbarer Zeit pausiert wird (z.B. weil die letzte Bedarfsschau-
 * Teilnahme drei Quartale her ist). Soll motivieren, eine bevorstehende
 * Bedarfsschau zu besuchen, bevor das Profil pausiert.
 *
 * Betreff: „Erinnerung: deine naechste Bedarfsschau im Werkzirkel"
 */

import { Button, Heading, Section, Text } from '@react-email/components';
import * as React from 'react';
import { Layout } from './_layout';

export interface FoerderprofilBedarfsschauErinnerungProps {
  organisation: string;
  /** Anzahl Monate seit letzter Bedarfsschau (gerundet). */
  monateOhneTeilnahme: number;
  bedarfsschauUrl: string;
  appUrl?: string;
}

export const T505_BETREFF =
  'Erinnerung: deine naechste Bedarfsschau im Werkzirkel';

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

export function FoerderprofilBedarfsschauErinnerung(
  props: FoerderprofilBedarfsschauErinnerungProps,
): React.JSX.Element {
  const {
    organisation,
    monateOhneTeilnahme,
    bedarfsschauUrl,
    appUrl = 'https://werkzirkel.de',
  } = props;

  return (
    <Layout
      vorschau={`Dein Foerderprofil fuer ${organisation} braucht bald wieder eine Bedarfsschau-Teilnahme.`}
      appUrl={appUrl}
    >
      <Heading as="h1" style={{ fontSize: '20px', margin: '0 0 16px 0' }}>
        Komm zur naechsten Bedarfsschau
      </Heading>

      <Text style={{ margin: '0 0 16px 0' }}>
        Dein Foerderprofil fuer {organisation} war seit {monateOhneTeilnahme}{' '}
        Monaten auf keiner Bedarfsschau. Damit es weiter sichtbar bleibt,
        bitten wir dich, in den kommenden Wochen wieder dabei zu sein.
      </Text>

      <Text style={{ margin: '0 0 16px 0' }}>
        Bedarfsschauen finden in den Werkzirkel-Staedten regelmaessig statt
        — du findest die naechsten Termine ueber den Link unten.
      </Text>

      <Section style={{ textAlign: 'center', margin: '24px 0' }}>
        <Button href={bedarfsschauUrl} style={buttonStyle}>
          Naechste Bedarfsschau ansehen
        </Button>
      </Section>

      <Text style={{ margin: '24px 0 0 0', fontSize: '14px', color: '#78716c' }}>
        Falls du keinen Termin findest oder Rueckfragen hast, antworte
        einfach auf diese E-Mail.
      </Text>
    </Layout>
  );
}

export default FoerderprofilBedarfsschauErinnerung;
