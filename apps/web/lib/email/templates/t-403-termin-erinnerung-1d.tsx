/**
 * T-403 — Erinnerung 1 Tag vor einem Werkzirkel-Termin.
 *
 * Wird per Cron am Vortag an alle angemeldeten Teilnehmer:innen verschickt.
 * Inhaltlich knapper als T-402, dafuer mit Fokus auf „morgen geht's los".
 *
 * Betreff: „Erinnerung: dein Werkzirkel-Termin morgen"
 */

import { Button, Heading, Section, Text } from '@react-email/components';
import * as React from 'react';
import { Layout } from './_layout';

export interface TerminErinnerung1dProps {
  /** Titel des Termins. */
  terminTitel: string;
  /** Typ-Label. */
  terminTyp: string;
  /** Deutsch formatiertes Datum. */
  terminDatum: string;
  /** Uhrzeit als HH:MM. */
  terminUhrzeit: string;
  /** Optional: Ort-/Adress-Text. */
  ortText?: string;
  /** Optional: Online-Meeting-Link. */
  onlineLink?: string;
  /** Direkter Link zur Termin-Detailseite. */
  terminUrl: string;
  /** Link zum iCal-Download. */
  icalUrl: string;
  /** App-URL fuer Footer-Links. */
  appUrl?: string;
}

export const T403_BETREFF = 'Erinnerung: dein Werkzirkel-Termin morgen';

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

const sekundaerButtonStyle = {
  ...buttonStyle,
  backgroundColor: '#ffffff',
  color: '#0c0a09',
  border: '1px solid #0c0a09',
  marginLeft: '8px',
} as const;

const datenZeileStyle = {
  margin: '0 0 6px 0',
} as const;

export function TerminErinnerung1d(
  props: TerminErinnerung1dProps,
): React.JSX.Element {
  const {
    terminTitel,
    terminTyp,
    terminDatum,
    terminUhrzeit,
    ortText,
    onlineLink,
    terminUrl,
    icalUrl,
    appUrl = 'https://werkzirkel.de',
  } = props;

  return (
    <Layout
      vorschau={`Morgen: „${terminTitel}" um ${terminUhrzeit} Uhr.`}
      appUrl={appUrl}
    >
      <Heading as="h1" style={{ fontSize: '20px', margin: '0 0 16px 0' }}>
        Morgen ist dein Termin
      </Heading>

      <Text style={{ margin: '0 0 16px 0' }}>
        Morgen findet dein Termin „{terminTitel}“ statt — hier nochmal die
        Eckdaten zur Übersicht.
      </Text>

      <Section style={{ margin: '0 0 16px 0' }}>
        <Text style={datenZeileStyle}>
          <strong>Termin:</strong> {terminTitel}
        </Text>
        <Text style={datenZeileStyle}>
          <strong>Typ:</strong> {terminTyp}
        </Text>
        <Text style={datenZeileStyle}>
          <strong>Datum:</strong> {terminDatum}
        </Text>
        <Text style={datenZeileStyle}>
          <strong>Uhrzeit:</strong> {terminUhrzeit} Uhr
        </Text>
        {ortText ? (
          <Text style={datenZeileStyle}>
            <strong>Ort:</strong> {ortText}
          </Text>
        ) : null}
        {onlineLink ? (
          <Text style={datenZeileStyle}>
            <strong>Online-Link:</strong> {onlineLink}
          </Text>
        ) : null}
      </Section>

      <Section style={{ textAlign: 'center', margin: '24px 0' }}>
        <Button href={terminUrl} style={buttonStyle}>
          Termin ansehen
        </Button>
        <Button href={icalUrl} style={sekundaerButtonStyle}>
          In Kalender übernehmen
        </Button>
      </Section>

      <Text style={{ margin: '24px 0 0 0', fontSize: '14px', color: '#78716c' }}>
        Falls du doch nicht kommen kannst, sag bitte zügig über die
        Termin-Seite ab, damit jemand von der Warteliste nachrücken kann.
      </Text>
    </Layout>
  );
}

export default TerminErinnerung1d;
