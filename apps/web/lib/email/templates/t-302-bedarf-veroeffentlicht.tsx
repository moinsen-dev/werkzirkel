/**
 * T-302 — Bedarf veroeffentlicht.
 *
 * Wird verschickt, wenn eine Kurator:in den Bedarf von 'in_pruefung'
 * auf 'oeffentlich' setzt. Der Bedarf ist ab jetzt fuer die Werkstatt
 * sichtbar; Macher:innen koennen Werkangebote dazu abgeben.
 *
 * Betreff: „Dein Bedarf ist freigeschaltet"
 */

import { Button, Heading, Section, Text } from '@react-email/components';
import * as React from 'react';
import { Layout } from './_layout';

export interface BedarfVeroeffentlichtProps {
  titel: string;
  organisation: string;
  bedarfUrl: string;
  appUrl?: string;
}

export const T302_BETREFF = 'Dein Bedarf ist freigeschaltet';

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

export function BedarfVeroeffentlicht(
  props: BedarfVeroeffentlichtProps,
): React.JSX.Element {
  const { titel, organisation, bedarfUrl, appUrl = 'https://werkzirkel.de' } = props;

  return (
    <Layout
      vorschau={`Dein Bedarf "${titel}" ist freigeschaltet und in der Werkstatt sichtbar.`}
      appUrl={appUrl}
    >
      <Heading as="h1" style={{ fontSize: '20px', margin: '0 0 16px 0' }}>
        Dein Bedarf ist freigeschaltet
      </Heading>

      <Text style={{ margin: '0 0 16px 0' }}>
        Die Kurator:innen-Runde hat deinen Bedarf {'„'}{titel}{'“'} fuer
        {' '}{organisation} freigeschaltet. Macher:innen koennen jetzt
        Werkangebote dazu abgeben.
      </Text>

      <Text style={{ margin: '0 0 16px 0' }}>
        Du bekommst eine Nachricht, sobald ein Werkangebot eingegangen ist.
        Direkte Kontaktaufnahme von Macher:innen erfolgt ausschliesslich
        ueber den Werkzirkel — bitte melde Cold-Outreach per E-Mail an
        die Kurator:innen.
      </Text>

      <Section style={{ textAlign: 'center', margin: '24px 0' }}>
        <Button href={bedarfUrl} style={buttonStyle}>
          Meinen Bedarf ansehen
        </Button>
      </Section>
    </Layout>
  );
}

export default BedarfVeroeffentlicht;
