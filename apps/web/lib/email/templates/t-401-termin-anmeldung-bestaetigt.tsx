/**
 * T-401 — Termin-Anmeldung bestaetigt.
 *
 * Wird an Teilnehmer:innen verschickt, sobald ihre Anmeldung zu einem
 * Werkzirkel-Termin (Online-Co-Working, Praesenz-Treffen, Werkstatt-Tag)
 * angenommen wurde — entweder als regulaerer Slot oder als Warteliste.
 *
 * Betreff: „Deine Termin-Anmeldung im Werkzirkel"
 */

import { Button, Heading, Section, Text } from '@react-email/components';
import * as React from 'react';
import { Layout } from './_layout';

export interface TerminAnmeldungBestaetigtProps {
  /** Titel des Termins (z.B. „Open Co-Working Hamburg"). */
  terminTitel: string;
  /** Typ-Label (z.B. „Online-Co-Working", „Praesenz-Treffen"). */
  terminTyp: string;
  /** Deutsch formatiertes Datum (z.B. „16. Mai 2026"). */
  terminDatum: string;
  /** Uhrzeit als HH:MM (z.B. „18:30"). */
  terminUhrzeit: string;
  /** Optional: Ort-/Adress-Text fuer Praesenz-Termine. */
  ortText?: string;
  /** Optional: Online-Meeting-Link (Jitsi, Zoom, …). */
  onlineLink?: string;
  /** Direkter Link zur Termin-Detailseite. */
  terminUrl: string;
  /** Link zum iCal-Download (`/api/v1/termine/<id>/ical`). */
  icalUrl: string;
  /** Position der Anmeldung — regulaer oder Warteliste. */
  slotPosition: 'angemeldet' | 'warteliste';
  /** App-URL fuer Footer-Links. */
  appUrl?: string;
}

export const T401_BETREFF = 'Deine Termin-Anmeldung im Werkzirkel';

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

export function TerminAnmeldungBestaetigt(
  props: TerminAnmeldungBestaetigtProps,
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
    slotPosition,
    appUrl = 'https://werkzirkel.de',
  } = props;

  const istWarteliste = slotPosition === 'warteliste';
  const vorschau = istWarteliste
    ? `Du stehst auf der Warteliste fuer „${terminTitel}".`
    : `Deine Anmeldung zu „${terminTitel}" am ${terminDatum} ist bestaetigt.`;

  const ueberschrift = istWarteliste
    ? 'Du stehst auf der Warteliste'
    : 'Deine Anmeldung ist bestätigt';

  const einleitung = istWarteliste
    ? `Der Termin „${terminTitel}" ist aktuell voll. Wir haben dich auf die Warteliste gesetzt und benachrichtigen dich, sobald ein Platz frei wird.`
    : `Schön, dass du dabei bist. Hier alle Daten zu „${terminTitel}" zum Mitnehmen.`;

  return (
    <Layout vorschau={vorschau} appUrl={appUrl}>
      <Heading as="h1" style={{ fontSize: '20px', margin: '0 0 16px 0' }}>
        {ueberschrift}
      </Heading>

      <Text style={{ margin: '0 0 16px 0' }}>{einleitung}</Text>

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

      {!istWarteliste ? (
        <Text style={{ margin: '0 0 16px 0' }}>
          Du kannst diesen Termin direkt in deinen Kalender übernehmen — der
          iCal-Download enthält Titel, Datum und Ort bzw. Online-Link.
        </Text>
      ) : null}

      <Section style={{ textAlign: 'center', margin: '24px 0' }}>
        <Button href={terminUrl} style={buttonStyle}>
          Termin ansehen
        </Button>
        {!istWarteliste ? (
          <Button href={icalUrl} style={sekundaerButtonStyle}>
            In Kalender übernehmen
          </Button>
        ) : null}
      </Section>

      <Text style={{ margin: '24px 0 0 0', fontSize: '14px', color: '#78716c' }}>
        Wenn du nicht teilnehmen kannst, sag bitte rechtzeitig über die
        Termin-Seite ab — so kann jemand von der Warteliste nachrücken.
      </Text>
    </Layout>
  );
}

export default TerminAnmeldungBestaetigt;
