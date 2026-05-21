/**
 * T-503 — Foerderprofil abgelehnt.
 *
 * Wird verschickt, wenn eine City-Lead das Foerderprofil ablehnt.
 * Enthaelt den Grund-Text der City-Lead.
 *
 * Betreff: „Dein Foerderprofil wurde nicht freigeschaltet"
 */

import { Heading, Section, Text } from '@react-email/components';
import * as React from 'react';
import { Layout } from './_layout';

export interface FoerderprofilAbgelehntProps {
  organisation: string;
  grund: string;
  appUrl?: string;
}

export const T503_BETREFF = 'Dein Foerderprofil wurde nicht freigeschaltet';

const grundBoxStyle = {
  backgroundColor: '#fef3c7',
  border: '1px solid #fcd34d',
  borderRadius: '6px',
  padding: '12px 16px',
  margin: '16px 0',
} as const;

export function FoerderprofilAbgelehnt(
  props: FoerderprofilAbgelehntProps,
): React.JSX.Element {
  const { organisation, grund, appUrl = 'https://werkzirkel.de' } = props;

  return (
    <Layout
      vorschau={`Dein Foerderprofil fuer ${organisation} wurde nicht freigeschaltet.`}
      appUrl={appUrl}
    >
      <Heading as="h1" style={{ fontSize: '20px', margin: '0 0 16px 0' }}>
        Dein Foerderprofil wurde nicht freigeschaltet
      </Heading>

      <Text style={{ margin: '0 0 16px 0' }}>
        Die City-Leads-Runde hat dein Profil fuer {organisation} nicht
        freigeschaltet. Begruendung:
      </Text>

      <Section style={grundBoxStyle}>
        <Text style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{grund}</Text>
      </Section>

      <Text style={{ margin: '0 0 16px 0' }}>
        Wenn du Rueckfragen hast oder das Profil anpassen moechtest:
        Antworte einfach auf diese E-Mail — wir lesen mit.
      </Text>
    </Layout>
  );
}

export default FoerderprofilAbgelehnt;
