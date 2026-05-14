/**
 * T-404 — Werkzirkel-Termin wurde abgesagt.
 *
 * Wird an alle Angemeldeten (inkl. Warteliste) verschickt, sobald der
 * Termin von der Veranstalter:in oder vom System abgesagt wurde. Enthaelt
 * optional einen Absage-Grund.
 *
 * Betreff: „Werkzirkel-Termin abgesagt"
 */

import { Heading, Text } from '@react-email/components';
import * as React from 'react';
import { Layout } from './_layout';

export interface TerminAbgesagtProps {
  /** Titel des abgesagten Termins. */
  terminTitel: string;
  /** Typ-Label. */
  terminTyp: string;
  /** Deutsch formatiertes Datum. */
  terminDatum: string;
  /** Optional: vom Veranstalter angegebener Absage-Grund. */
  absageGrund?: string;
  /** App-URL fuer Footer-Links. */
  appUrl?: string;
}

export const T404_BETREFF = 'Werkzirkel-Termin abgesagt';

export function TerminAbgesagt(
  props: TerminAbgesagtProps,
): React.JSX.Element {
  const {
    terminTitel,
    terminTyp,
    terminDatum,
    absageGrund,
    appUrl = 'https://werkzirkel.de',
  } = props;

  return (
    <Layout
      vorschau={`Der Termin „${terminTitel}" am ${terminDatum} wurde abgesagt.`}
      appUrl={appUrl}
    >
      <Heading as="h1" style={{ fontSize: '20px', margin: '0 0 16px 0' }}>
        Termin abgesagt
      </Heading>

      <Text style={{ margin: '0 0 16px 0' }}>
        Der Termin „{terminTitel}“ ({terminTyp}) am {terminDatum} wurde leider
        abgesagt.
      </Text>

      {absageGrund ? (
        <Text style={{ margin: '0 0 16px 0' }}>
          <strong>Begründung der Veranstalter:in:</strong> {absageGrund}
        </Text>
      ) : null}

      <Text style={{ margin: '0 0 16px 0' }}>
        Wir melden uns, sobald ein Ersatztermin steht. Du musst nichts weiter
        tun — deine Anmeldung ist mit der Absage erledigt.
      </Text>

      <Text style={{ margin: '24px 0 0 0', fontSize: '14px', color: '#78716c' }}>
        Falls der Termin in deinem Kalender liegt, kannst du ihn dort
        gefahrlos löschen.
      </Text>
    </Layout>
  );
}

export default TerminAbgesagt;
