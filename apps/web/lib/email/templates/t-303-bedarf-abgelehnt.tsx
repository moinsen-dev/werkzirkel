/**
 * T-303 — Bedarf abgelehnt.
 *
 * Wird verschickt, wenn eine Kurator:in den eingereichten Bedarf ablehnt
 * (Status 'eingestellt'). Enthaelt den Grund-Text der Kurator:in.
 *
 * Betreff: „Dein Bedarf wurde nicht freigeschaltet"
 */

import { Heading, Section, Text } from '@react-email/components';
import * as React from 'react';
import { Layout } from './_layout';

export interface BedarfAbgelehntProps {
  titel: string;
  organisation: string;
  grund: string;
  appUrl?: string;
}

export const T303_BETREFF = 'Dein Bedarf wurde nicht freigeschaltet';

const grundBoxStyle = {
  backgroundColor: '#fef3c7',
  border: '1px solid #fcd34d',
  borderRadius: '6px',
  padding: '12px 16px',
  margin: '16px 0',
} as const;

export function BedarfAbgelehnt(
  props: BedarfAbgelehntProps,
): React.JSX.Element {
  const { titel, organisation, grund, appUrl = 'https://werkzirkel.de' } = props;

  return (
    <Layout
      vorschau={`Dein Bedarf "${titel}" wurde nicht freigeschaltet.`}
      appUrl={appUrl}
    >
      <Heading as="h1" style={{ fontSize: '20px', margin: '0 0 16px 0' }}>
        Dein Bedarf wurde nicht freigeschaltet
      </Heading>

      <Text style={{ margin: '0 0 16px 0' }}>
        Die Kurator:innen-Runde hat deinen Bedarf {'„'}{titel}{'“'} fuer
        {' '}{organisation} nicht freigeschaltet. Begruendung:
      </Text>

      <Section style={grundBoxStyle}>
        <Text style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{grund}</Text>
      </Section>

      <Text style={{ margin: '0 0 16px 0' }}>
        Wenn du den Bedarf anpassen oder erneut einreichen moechtest:
        Antworte einfach auf diese E-Mail — wir lesen mit.
      </Text>
    </Layout>
  );
}

export default BedarfAbgelehnt;
