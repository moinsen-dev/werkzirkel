/**
 * T-202 — Match-Angebot-Status geaendert (an Builder:in).
 *
 * Wird verschickt, wenn die Bedarfstraeger:in den Status eines
 * eingereichten Match-Angebots wechselt:
 *  - in_gespraechen → "Wir sind im Gespraech."
 *  - beauftragt    → "Du wurdest beauftragt."
 *  - nicht_gewaehlt → "Diesmal nicht gewaehlt."
 *
 * Ehrliche, ruhige Sprache. Kein Wettbewerbs-Vokabular.
 *
 * Betreff: variiert je nach Status (im Code dynamisch zusammengesetzt).
 */

import { Button, Heading, Section, Text } from '@react-email/components';
import * as React from 'react';
import { Layout } from './_layout';

export type WerkangebotWerkangebotStatusForMail =
  | 'in_gespraechen'
  | 'beauftragt'
  | 'nicht_gewaehlt';

export interface WerkangebotWerkangebotStatusGeaendertProps {
  bedarfTitel: string;
  werkName: string;
  neuerStatus: WerkangebotWerkangebotStatusForMail;
  werkangebotUrl: string;
  appUrl?: string;
}

const STATUS_BETREFF: Record<WerkangebotWerkangebotStatusForMail, string> = {
  in_gespraechen: 'Bedarfstraeger:in meldet sich zu deinem Match-Angebot',
  beauftragt: 'Dein Match-Angebot wurde beauftragt',
  nicht_gewaehlt: 'Diesmal nicht gewaehlt — dein Match-Angebot',
};

/**
 * Statisch exportierter Default-Betreff, damit der sendMail-Helper im
 * Registry-Switch dieselbe Convention wie andere Templates erfuellt. Der
 * tatsaechliche Betreff wird zur Render-Zeit aus den Props gebildet
 * (siehe `betreffFor`).
 */
export const T202_BETREFF = 'Match-Angebot-Status hat sich geaendert';

export function betreffFor(status: WerkangebotWerkangebotStatusForMail): string {
  return STATUS_BETREFF[status];
}

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

function bodyText(status: WerkangebotWerkangebotStatusForMail): { intro: string; ausblick: string } {
  switch (status) {
    case 'in_gespraechen':
      return {
        intro: 'Die Bedarfstraeger:in moechte mit dir ins Gespraech kommen.',
        ausblick:
          'Du bekommst in den naechsten Tagen eine Kontaktaufnahme. Bitte antworte zeitnah; im Werkzirkel sprechen wir uns direkt ab, ohne Vermittlung.',
      };
    case 'beauftragt':
      return {
        intro: 'Glueckwunsch — die Bedarfstraeger:in hat dich beauftragt.',
        ausblick:
          'Die weitere Abstimmung erfolgt direkt zwischen euch. Werkzirkel ist die Buehne, nicht die Vermittlerin; bitte rechnet bilateral ab.',
      };
    case 'nicht_gewaehlt':
      return {
        intro:
          'Die Bedarfstraeger:in hat sich diesmal fuer ein anderes Match-Angebot entschieden.',
        ausblick:
          'Das ist kein Urteil ueber dich oder dein Werk — sondern ein Hinweis, dass es bei dieser Frage nicht gepasst hat. Andere Bedarfe folgen.',
      };
  }
}

export function WerkangebotWerkangebotStatusGeaendert(
  props: WerkangebotWerkangebotStatusGeaendertProps,
): React.JSX.Element {
  const {
    bedarfTitel,
    werkName,
    neuerStatus,
    werkangebotUrl,
    appUrl = 'https://werkzirkel.de',
  } = props;
  const text = bodyText(neuerStatus);

  return (
    <Layout
      vorschau={`Dein Match-Angebot zu "${bedarfTitel}" — Status: ${neuerStatus.replace('_', ' ')}.`}
      appUrl={appUrl}
    >
      <Heading as="h1" style={{ fontSize: '20px', margin: '0 0 16px 0' }}>
        {STATUS_BETREFF[neuerStatus]}
      </Heading>

      <Text style={{ margin: '0 0 16px 0' }}>{text.intro}</Text>

      <Text style={{ margin: '0 0 16px 0' }}>
        Bedarf: {'„'}{bedarfTitel}{'“'}
        <br />
        Werk: {'„'}{werkName}{'“'}
      </Text>

      <Text style={{ margin: '0 0 16px 0' }}>{text.ausblick}</Text>

      <Section style={{ textAlign: 'center', margin: '24px 0' }}>
        <Button href={werkangebotUrl} style={buttonStyle}>
          Match-Angebot ansehen
        </Button>
      </Section>
    </Layout>
  );
}

export default WerkangebotWerkangebotStatusGeaendert;
