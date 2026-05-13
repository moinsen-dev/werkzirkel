/**
 * T-103 — Reziprozitaets-Frist endet in 3 Tagen.
 *
 * Wird verschickt, wenn die offene Reziprozitaets-Verpflichtung (Tests, die
 * im Gegenzug fuer eine eigene Pruefrunde geschuldet werden) in 3 Tagen
 * faellig wird.
 *
 * Betreff: „Deine Reziprozitaets-Frist endet in 3 Tagen"
 */

import { Button, Heading, Section, Text } from '@react-email/components';
import * as React from 'react';
import { Layout } from './_layout';

export interface ReziprozitaetFrist3dProps {
  /** Deutsch formatierte Frist (z.B. „16. Mai 2026"). */
  fristFormatted: string;
  /** Anzahl noch offener Tests, die abzugeben sind. */
  offeneAnzahl: number;
  /** Link zur Pruefrunden-Suche (idealerweise mit Stadt-Filter). */
  pruefrundenSucheUrl: string;
  /** App-URL fuer Footer-Links. */
  appUrl?: string;
}

export const T103_BETREFF = 'Deine Reziprozitäts-Frist endet in 3 Tagen';

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

export function ReziprozitaetFrist3d(
  props: ReziprozitaetFrist3dProps,
): React.JSX.Element {
  const {
    fristFormatted,
    offeneAnzahl,
    pruefrundenSucheUrl,
    appUrl = 'https://werkzirkel.de',
  } = props;

  const testSatz =
    offeneAnzahl === 1
      ? 'Noch 1 Test ist offen.'
      : `Noch ${offeneAnzahl} Tests sind offen.`;

  return (
    <Layout
      vorschau={`Deine Reziprozitaets-Frist endet am ${fristFormatted}.`}
      appUrl={appUrl}
    >
      <Heading as="h1" style={{ fontSize: '20px', margin: '0 0 16px 0' }}>
        Noch 3 Tage bis zu deiner Reziprozitäts-Frist
      </Heading>

      <Text style={{ margin: '0 0 16px 0' }}>
        Du hast vor einer Weile eine Prüfrunde gestartet und im Gegenzug
        versprochen, zwei Werke anderer zu testen. Die Frist dafür endet am
        {' '}{fristFormatted}. {testSatz}
      </Text>

      <Text style={{ margin: '0 0 16px 0' }}>
        Such dir eine offene Prüfrunde aus und gib ehrliches Feedback. So
        bleibt der Kreis lebendig — und du kannst danach wieder eigene
        Prüfrunden starten.
      </Text>

      <Section style={{ textAlign: 'center', margin: '24px 0' }}>
        <Button href={pruefrundenSucheUrl} style={buttonStyle}>
          Prüfrunden ansehen
        </Button>
      </Section>

      <Text style={{ margin: '24px 0 0 0', fontSize: '14px', color: '#78716c' }}>
        Werkzirkel funktioniert nur, wenn jeder gibt, was er nimmt. Drei
        Tage reichen für ein paar Tests — leg los, solange du Ruhe hast.
      </Text>
    </Layout>
  );
}

export default ReziprozitaetFrist3d;
