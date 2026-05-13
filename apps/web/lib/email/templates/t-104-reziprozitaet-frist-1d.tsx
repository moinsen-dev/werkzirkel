/**
 * T-104 — Reziprozitaets-Frist endet morgen (letzte Erinnerung).
 *
 * Wird verschickt, wenn die offene Reziprozitaets-Verpflichtung morgen
 * abzulaufen droht. Wer bis dahin nicht abgibt, kann keine neuen
 * Pruefrunden starten, bis die offenen Tests nachgeholt sind.
 *
 * Betreff: „Deine Reziprozitaets-Frist endet morgen"
 */

import { Button, Heading, Section, Text } from '@react-email/components';
import * as React from 'react';
import { Layout } from './_layout';

export interface ReziprozitaetFrist1dProps {
  /** Deutsch formatierte Frist (z.B. „14. Mai 2026"). */
  fristFormatted: string;
  /** Anzahl noch offener Tests, die abzugeben sind. */
  offeneAnzahl: number;
  /** Link zur Pruefrunden-Suche. */
  pruefrundenSucheUrl: string;
  /** App-URL fuer Footer-Links. */
  appUrl?: string;
}

export const T104_BETREFF = 'Deine Reziprozitäts-Frist endet morgen';

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

export function ReziprozitaetFrist1d(
  props: ReziprozitaetFrist1dProps,
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
      vorschau={`Letzte Erinnerung: deine Reziprozitaets-Frist endet morgen (${fristFormatted}).`}
      appUrl={appUrl}
    >
      <Heading as="h1" style={{ fontSize: '20px', margin: '0 0 16px 0' }}>
        Letzte Erinnerung: deine Reziprozitäts-Frist endet morgen
      </Heading>

      <Text style={{ margin: '0 0 16px 0' }}>
        Morgen, am {fristFormatted}, läuft deine Reziprozitäts-Frist ab.
        {' '}{testSatz}
      </Text>

      <Text style={{ margin: '0 0 16px 0' }}>
        Wenn du bis dahin keine Tests abgibst, kannst du keine neuen
        Prüfrunden starten, bis du das nachholst. Deine bestehenden Werke
        bleiben unberührt — nur der Start neuer Prüfrunden ruht.
      </Text>

      <Section style={{ textAlign: 'center', margin: '24px 0' }}>
        <Button href={pruefrundenSucheUrl} style={buttonStyle}>
          Jetzt eine Prüfrunde testen
        </Button>
      </Section>

      <Text style={{ margin: '24px 0 0 0', fontSize: '14px', color: '#78716c' }}>
        Ein Test dauert je nach Werk 15 bis 60 Minuten. Such dir eines aus,
        bei dem du wirklich etwas zu sagen hast — der Werkstatt-Kreis lebt
        von ehrlichen Rückmeldungen.
      </Text>
    </Layout>
  );
}

export default ReziprozitaetFrist1d;
