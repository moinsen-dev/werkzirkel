/**
 * T-201 — Werkangebot eingegangen (an Bedarfstraeger:in).
 *
 * Wird verschickt, sobald eine Macher:in ein neues Werkangebot zu einem
 * Bedarf eingereicht hat (Status 'eingereicht').
 *
 * PRD §11A Schutz S2: Werkangebote sind NICHT oeffentlich — diese E-Mail
 * geht ausschliesslich an die Bedarfstraeger:in, kein Reply-To an die
 * Macher:in. Kontaktaufnahme erfolgt erst nach 'in_gespraechen'-Wechsel.
 *
 * Betreff: „Neues Werkangebot zu deinem Bedarf"
 */

import { Button, Heading, Section, Text } from '@react-email/components';
import * as React from 'react';
import { Layout } from './_layout';

export interface WerkangebotEingegangenProps {
  bedarfTitel: string;
  werkName: string;
  macherAnzeigename: string;
  werkangebotUrl: string;
  appUrl?: string;
}

export const T201_BETREFF = 'Neues Werkangebot zu deinem Bedarf';

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

export function WerkangebotEingegangen(
  props: WerkangebotEingegangenProps,
): React.JSX.Element {
  const {
    bedarfTitel,
    werkName,
    macherAnzeigename,
    werkangebotUrl,
    appUrl = 'https://werkzirkel.de',
  } = props;

  return (
    <Layout
      vorschau={`${macherAnzeigename} hat ein Werkangebot zu "${bedarfTitel}" eingereicht.`}
      appUrl={appUrl}
    >
      <Heading as="h1" style={{ fontSize: '20px', margin: '0 0 16px 0' }}>
        Neues Werkangebot zu deinem Bedarf
      </Heading>

      <Text style={{ margin: '0 0 16px 0' }}>
        {macherAnzeigename} hat mit dem Werk {'„'}{werkName}{'“'} ein
        Werkangebot zu deinem Bedarf {'„'}{bedarfTitel}{'“'} eingereicht.
      </Text>

      <Text style={{ margin: '0 0 16px 0' }}>
        Du siehst das Werkangebot in deiner Uebersicht. Pruefe es in Ruhe,
        es ist kein Pitch-Wettbewerb. Wenn es passt, setze den Status auf
        {' '}{'„'}in Gespraechen{'“'} — dann tauschen wir Kontaktdaten aus.
      </Text>

      <Section style={{ textAlign: 'center', margin: '24px 0' }}>
        <Button href={werkangebotUrl} style={buttonStyle}>
          Werkangebot ansehen
        </Button>
      </Section>
    </Layout>
  );
}

export default WerkangebotEingegangen;
