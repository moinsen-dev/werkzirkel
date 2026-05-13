/**
 * T-101 — Neue Anmeldung zu einer Pruefrunde.
 *
 * Wird an die Werk-Inhaber:in versendet, wenn sich jemand neues als
 * Tester:in fuer eine ihrer veroeffentlichten Pruefrunden gemeldet hat.
 *
 * Betreff: „Neue Anmeldung zu deiner Pruefrunde"
 */

import { Button, Heading, Section, Text } from '@react-email/components';
import * as React from 'react';
import { Layout } from './_layout';

export interface PruefrundeNeueAnmeldungProps {
  /** Name des Werks, zu dem die Pruefrunde gehoert. */
  werkName: string;
  /** Titel der Pruefrunde (z.B. „Erster Test der Onboarding-Strecke"). */
  pruefrundeTitel: string;
  /** Anzeigename der Person, die sich angemeldet hat. */
  testerAnzeigename: string;
  /** Direkter Link zur Pruefrunde-Detailseite (Inhaber:innen-Sicht). */
  pruefrundeUrl: string;
  /** Wie viele Tester:innen insgesamt schon angemeldet sind (inkl. der neuen). */
  anzahlAngemeldet: number;
  /** Wie viele Tester:innen die Pruefrunde insgesamt sucht. */
  gesuchteTester: number;
  /** App-URL fuer Footer-Links. */
  appUrl?: string;
}

export const T101_BETREFF = 'Neue Anmeldung zu deiner Prüfrunde';

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

export function PruefrundeNeueAnmeldung(
  props: PruefrundeNeueAnmeldungProps,
): React.JSX.Element {
  const {
    werkName,
    pruefrundeTitel,
    testerAnzeigename,
    pruefrundeUrl,
    anzahlAngemeldet,
    gesuchteTester,
    appUrl = 'https://werkzirkel.de',
  } = props;

  const offen = Math.max(gesuchteTester - anzahlAngemeldet, 0);
  const restSatz =
    offen > 0
      ? `Du suchst noch ${offen} weitere Tester:in${offen === 1 ? '' : 'nen'}.`
      : 'Deine Pruefrunde ist damit voll besetzt.';

  return (
    <Layout
      vorschau={`${testerAnzeigename} meldet sich als Tester:in zu „${pruefrundeTitel}".`}
      appUrl={appUrl}
    >
      <Heading as="h1" style={{ fontSize: '20px', margin: '0 0 16px 0' }}>
        Neue Anmeldung zu deiner Prüfrunde
      </Heading>

      <Text style={{ margin: '0 0 16px 0' }}>
        {testerAnzeigename} hat sich als Tester:in für deine Prüfrunde
        {' '}„{pruefrundeTitel}“ zu deinem Werk „{werkName}“ angemeldet.
      </Text>

      <Text style={{ margin: '0 0 16px 0' }}>
        Stand jetzt: {anzahlAngemeldet} von {gesuchteTester} Plätzen belegt.
        {' '}
        {restSatz}
      </Text>

      <Section style={{ textAlign: 'center', margin: '24px 0' }}>
        <Button href={pruefrundeUrl} style={buttonStyle}>
          Prüfrunde ansehen
        </Button>
      </Section>

      <Text style={{ margin: '24px 0 0 0', fontSize: '14px', color: '#78716c' }}>
        So funktioniert der Kreis: Wer Feedback sammelt, gibt im Gegenzug
        Feedback. Sobald deine Tester:innen ihre Rückmeldungen abgegeben
        haben, bekommst du eine Nachricht.
      </Text>
    </Layout>
  );
}

export default PruefrundeNeueAnmeldung;
