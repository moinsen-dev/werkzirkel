/**
 * T-202 — Werkangebot-Status geaendert (an Macher:in).
 *
 * Wird verschickt, wenn die Bedarfstraeger:in den Status eines
 * eingereichten Werkangebots wechselt:
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

export type WerkangebotStatusForMail =
  | 'in_gespraechen'
  | 'beauftragt'
  | 'nicht_gewaehlt';

export interface WerkangebotStatusGeaendertProps {
  bedarfTitel: string;
  werkName: string;
  neuerStatus: WerkangebotStatusForMail;
  werkangebotUrl: string;
  appUrl?: string;
}

const STATUS_BETREFF: Record<WerkangebotStatusForMail, string> = {
  in_gespraechen: 'Bedarfstraeger:in meldet sich zu deinem Werkangebot',
  beauftragt: 'Dein Werkangebot wurde beauftragt',
  nicht_gewaehlt: 'Diesmal nicht gewaehlt — dein Werkangebot',
};

/**
 * Statisch exportierter Default-Betreff, damit der sendMail-Helper im
 * Registry-Switch dieselbe Convention wie andere Templates erfuellt. Der
 * tatsaechliche Betreff wird zur Render-Zeit aus den Props gebildet
 * (siehe `betreffFor`).
 */
export const T202_BETREFF = 'Werkangebot-Status hat sich geaendert';

export function betreffFor(status: WerkangebotStatusForMail): string {
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

function bodyText(status: WerkangebotStatusForMail): { intro: string; ausblick: string } {
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
          'Die Bedarfstraeger:in hat sich diesmal fuer ein anderes Werkangebot entschieden.',
        ausblick:
          'Das ist kein Urteil ueber dich oder dein Werk — sondern ein Hinweis, dass es bei dieser Frage nicht gepasst hat. Andere Bedarfe folgen.',
      };
  }
}

export function WerkangebotStatusGeaendert(
  props: WerkangebotStatusGeaendertProps,
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
      vorschau={`Dein Werkangebot zu "${bedarfTitel}" — Status: ${neuerStatus.replace('_', ' ')}.`}
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
          Werkangebot ansehen
        </Button>
      </Section>
    </Layout>
  );
}

export default WerkangebotStatusGeaendert;
