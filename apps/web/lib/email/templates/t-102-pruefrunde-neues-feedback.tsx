/**
 * T-102 — Neues Feedback zu einem Werk.
 *
 * Wird an die Werk-Inhaber:in versendet, sobald eine Tester:in ihr Feedback
 * zu einer Pruefrunde abgegeben hat.
 *
 * Betreff: „Neues Feedback zu deinem Werk"
 */

import { Button, Heading, Section, Text } from '@react-email/components';
import * as React from 'react';
import { Layout } from './_layout';

export interface PruefrundeNeuesFeedbackProps {
  /** Name des Werks, zu dem das Feedback gehoert. */
  werkName: string;
  /** Titel der Pruefrunde. */
  pruefrundeTitel: string;
  /** Direkter Link zur Pruefrunde-Detailseite mit Feedback-Liste. */
  pruefrundeUrl: string;
  /** Wie viele Rueckmeldungen insgesamt eingegangen sind (inkl. dieser). */
  anzahlFeedbacks: number;
  /** App-URL fuer Footer-Links. */
  appUrl?: string;
}

export const T102_BETREFF = 'Neues Feedback zu deinem Werk';

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

export function PruefrundeNeuesFeedback(
  props: PruefrundeNeuesFeedbackProps,
): React.JSX.Element {
  const {
    werkName,
    pruefrundeTitel,
    pruefrundeUrl,
    anzahlFeedbacks,
    appUrl = 'https://werkzirkel.de',
  } = props;

  const rueckmeldungSatz =
    anzahlFeedbacks === 1
      ? 'Bisher 1 Rückmeldung erhalten.'
      : `Bisher ${anzahlFeedbacks} Rückmeldungen erhalten.`;

  return (
    <Layout
      vorschau={`Neue Rueckmeldung zu „${pruefrundeTitel}" — schau rein.`}
      appUrl={appUrl}
    >
      <Heading as="h1" style={{ fontSize: '20px', margin: '0 0 16px 0' }}>
        Neues Feedback zu deinem Werk
      </Heading>

      <Text style={{ margin: '0 0 16px 0' }}>
        Es gibt neues Feedback zu deiner Feedback-Loop „{pruefrundeTitel}“ für dein
        Werk „{werkName}“. {rueckmeldungSatz}
      </Text>

      <Text style={{ margin: '0 0 16px 0' }}>
        Schau rein und markiere, was dir wirklich geholfen hat. Markiertes
        Feedback wird auf deinem Werk anonym sichtbar — so erkennen andere,
        woran du gearbeitet hast.
      </Text>

      <Section style={{ textAlign: 'center', margin: '24px 0' }}>
        <Button href={pruefrundeUrl} style={buttonStyle}>
          Feedback ansehen
        </Button>
      </Section>

      <Text style={{ margin: '24px 0 0 0', fontSize: '14px', color: '#78716c' }}>
        Werkzirkel ist eine Werkstatt: ehrliche Rückmeldungen sind ihr
        wertvollster Rohstoff. Nimm dir Zeit für die Antworten.
      </Text>
    </Layout>
  );
}

export default PruefrundeNeuesFeedback;
