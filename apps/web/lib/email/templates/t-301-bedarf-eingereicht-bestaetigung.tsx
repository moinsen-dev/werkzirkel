/**
 * T-301 — Bedarf eingereicht (Bestaetigung an Bedarfstraeger:in).
 *
 * Wird verschickt, sobald eine Bedarfstraeger:in den Bedarf zur
 * City-Leads-Pruefung eingereicht hat (Status 'in_pruefung').
 *
 * Betreff: „Dein Bedarf ist eingereicht"
 */

import { Button, Heading, Section, Text } from '@react-email/components';
import * as React from 'react';
import { Layout } from './_layout';

export interface BedarfEingereichtBestaetigungProps {
  titel: string;
  organisation: string;
  bedarfUrl: string;
  appUrl?: string;
}

export const T301_BETREFF = 'Dein Bedarf ist eingereicht';

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

export function BedarfEingereichtBestaetigung(
  props: BedarfEingereichtBestaetigungProps,
): React.JSX.Element {
  const { titel, organisation, bedarfUrl, appUrl = 'https://werkzirkel.de' } = props;

  return (
    <Layout
      vorschau={`Dein Bedarf "${titel}" liegt jetzt in der City-Leads-Pruefung.`}
      appUrl={appUrl}
    >
      <Heading as="h1" style={{ fontSize: '20px', margin: '0 0 16px 0' }}>
        Dein Bedarf ist eingereicht
      </Heading>

      <Text style={{ margin: '0 0 16px 0' }}>
        Vielen Dank — dein Bedarf {'„'}{titel}{'“'} fuer {organisation} liegt
        jetzt bei der City-Leads-Runde. Wir pruefen, ob er gut in
        den Werkzirkel passt, und melden uns innerhalb weniger Tage.
      </Text>

      <Text style={{ margin: '0 0 16px 0' }}>
        Bis dahin ist der Bedarf als {'„'}in Pruefung{'“'} markiert und noch
        nicht fuer die Werkstatt sichtbar.
      </Text>

      <Section style={{ textAlign: 'center', margin: '24px 0' }}>
        <Button href={bedarfUrl} style={buttonStyle}>
          Meinen Bedarf ansehen
        </Button>
      </Section>
    </Layout>
  );
}

export default BedarfEingereichtBestaetigung;
