/**
 * T-003 — Konto-Loeschung-Bestaetigung.
 *
 * Wird verschickt, nachdem jemand „Konto loeschen" in den Einstellungen
 * angeklickt hat. Erst nach Klick auf den Bestaetigungs-Link startet die
 * 7-Tage-Karenz.
 *
 * Betreff: „Bitte bestaetige die Loeschung deines Werkzirkel-Kontos"
 */

import { Button, Heading, Section, Text } from '@react-email/components';
import * as React from 'react';
import { Layout } from './_layout';

export interface KontoLoeschungBestaetigungProps {
  /** Klickbare URL zur Bestaetigung der Loeschung. */
  confirmUrl: string;
  /** Voraussichtliches Loeschdatum (heute + 7 Tage zum Zeitpunkt des Versands). */
  voraussichtlichesLoeschdatum: string;
  /** App-URL fuer Footer-Links. */
  appUrl?: string;
}

export const T003_BETREFF = 'Bitte bestätige die Löschung deines Werkzirkel-Kontos';

const buttonStyle = {
  backgroundColor: '#b91c1c',
  color: '#ffffff',
  padding: '12px 24px',
  borderRadius: '6px',
  fontWeight: 600,
  fontSize: '15px',
  textDecoration: 'none',
  display: 'inline-block',
} as const;

const linkBlockStyle = {
  wordBreak: 'break-all' as const,
  color: '#57534e',
  fontSize: '13px',
  fontFamily: 'monospace',
  backgroundColor: '#f5f5f4',
  padding: '12px',
  borderRadius: '4px',
};

export function KontoLoeschungBestaetigung(
  props: KontoLoeschungBestaetigungProps,
): React.JSX.Element {
  const {
    confirmUrl,
    voraussichtlichesLoeschdatum,
    appUrl = 'https://werkzirkel.de',
  } = props;
  return (
    <Layout
      vorschau={`Klick zur Bestätigung — Löschung am ${voraussichtlichesLoeschdatum}.`}
      appUrl={appUrl}
    >
      <Heading as="h1" style={{ fontSize: '20px', margin: '0 0 16px 0' }}>
        Möchtest du dein Konto wirklich löschen?
      </Heading>

      <Text style={{ margin: '0 0 16px 0' }}>
        Du hast in den Einstellungen die Löschung deines Werkzirkel-Kontos
        angefordert. Wir wollen sichergehen, dass das wirklich du bist.
      </Text>

      <Text style={{ margin: '0 0 16px 0' }}>
        Mit einem Klick auf den Knopf unten startet eine 7-tägige Karenzzeit.
        In diesen 7 Tagen kannst du die Löschung jederzeit widerrufen.
        Wenn du den Knopf jetzt klickst, wird dein Konto{' '}
        <strong>voraussichtlich am {voraussichtlichesLoeschdatum}</strong>{' '}
        endgültig gelöscht — mit all deinen Werken, deinem Profil und allen
        persönlichen Daten.
      </Text>

      <Section style={{ textAlign: 'center', margin: '24px 0' }}>
        <Button href={confirmUrl} style={buttonStyle}>
          Löschung bestätigen
        </Button>
      </Section>

      <Text style={{ margin: '24px 0 8px 0', fontSize: '14px' }}>
        Falls der Knopf nicht funktioniert, kopier diese Adresse in deinen
        Browser:
      </Text>
      <Text style={linkBlockStyle}>{confirmUrl}</Text>

      <Text style={{ margin: '24px 0 0 0', fontSize: '14px', color: '#78716c' }}>
        Hast du die Löschung nicht angefordert? Ignorier diese E-Mail — dann
        bleibt dein Konto wie es ist.
      </Text>
    </Layout>
  );
}

export default KontoLoeschungBestaetigung;
