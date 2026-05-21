/**
 * T-602 — Membership-Beitrag verifiziert (Sachleistung).
 *
 * Wird verschickt, wenn eine City-Lead die Sachleistung als
 * Membership-Beitrag anerkannt hat. Beitrag ist jetzt 6 Monate gueltig.
 *
 * Betreff: „Deine Sachleistung wurde als Membership-Beitrag anerkannt"
 */

import { Button, Heading, Section, Text } from '@react-email/components';
import * as React from 'react';
import { Layout } from './_layout';

export interface WerkstattbeitragVerifiziertProps {
  anzeigename: string;
  /** Gueltig bis als ISO-Datum (YYYY-MM-DD). */
  gueltigBis: string;
  uebersichtUrl: string;
  appUrl?: string;
}

export const T602_BETREFF =
  'Deine Sachleistung wurde als Membership-Beitrag anerkannt';

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

export function WerkstattbeitragVerifiziert(
  props: WerkstattbeitragVerifiziertProps,
): React.JSX.Element {
  const {
    anzeigename,
    gueltigBis,
    uebersichtUrl,
    appUrl = 'https://werkzirkel.de',
  } = props;

  return (
    <Layout
      vorschau="Deine Sachleistung ist als Membership-Beitrag anerkannt."
      appUrl={appUrl}
    >
      <Heading as="h1" style={{ fontSize: '20px', margin: '0 0 16px 0' }}>
        Deine Sachleistung ist anerkannt
      </Heading>

      <Text style={{ margin: '0 0 16px 0' }}>
        Hallo {anzeigename}, die City-Leads-Runde hat deine Sachleistung
        als Membership-Beitrag verifiziert. Damit kannst du Bedarfe in den
        Werkzirkel einbringen.
      </Text>

      <Text style={{ margin: '0 0 16px 0' }}>
        Der Beitrag ist bis {gueltigBis} gueltig und reicht fuer bis zu
        vier Bedarfe.
      </Text>

      <Section style={{ textAlign: 'center', margin: '24px 0' }}>
        <Button href={uebersichtUrl} style={buttonStyle}>
          Meine Werkstattbeitraege ansehen
        </Button>
      </Section>
    </Layout>
  );
}

export default WerkstattbeitragVerifiziert;
