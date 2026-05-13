/**
 * T-004 — Konto-Loeschung-Erinnerung (2 Tage vor Ablauf der Karenz).
 *
 * Wird verschickt, wenn die 7-Tage-Karenz bei einer angeforderten Loeschung
 * fast abgelaufen ist (5. Tag nach Bestaetigung → noch 2 Tage offen).
 *
 * Betreff: „Dein Konto wird in 2 Tagen geloescht"
 */

import { Button, Heading, Section, Text } from '@react-email/components';
import * as React from 'react';
import { Layout } from './_layout';

export interface KontoLoeschungErinnerungProps {
  /** Klickbare URL, mit der die Loeschung widerrufen werden kann. */
  cancelUrl: string;
  /** Datum der endgueltigen Loeschung (z.B. „15. Mai 2026"). */
  deletionDate: string;
  /** App-URL fuer Footer-Links. */
  appUrl?: string;
}

export const T004_BETREFF = 'Dein Konto wird in 2 Tagen gelöscht';

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

const linkBlockStyle = {
  wordBreak: 'break-all' as const,
  color: '#57534e',
  fontSize: '13px',
  fontFamily: 'monospace',
  backgroundColor: '#f5f5f4',
  padding: '12px',
  borderRadius: '4px',
};

export function KontoLoeschungErinnerung(
  props: KontoLoeschungErinnerungProps,
): React.JSX.Element {
  const { cancelUrl, deletionDate, appUrl = 'https://werkzirkel.de' } = props;
  return (
    <Layout
      vorschau={`Endgültige Löschung am ${deletionDate} — du kannst noch widerrufen.`}
      appUrl={appUrl}
    >
      <Heading as="h1" style={{ fontSize: '20px', margin: '0 0 16px 0' }}>
        Letzte Erinnerung: Dein Konto wird in 2 Tagen gelöscht
      </Heading>

      <Text style={{ margin: '0 0 16px 0' }}>
        Vor ein paar Tagen hast du die Löschung deines Werkzirkel-Kontos
        angefordert. Am {deletionDate} ist es endgültig soweit: deine Werke,
        dein Profil und alle persönlichen Daten werden entfernt.
      </Text>

      <Text style={{ margin: '0 0 16px 0' }}>
        Falls du es dir anders überlegt hast, kannst du die Löschung jetzt
        noch zurücknehmen.
      </Text>

      <Section style={{ textAlign: 'center', margin: '24px 0' }}>
        <Button href={cancelUrl} style={buttonStyle}>
          Löschung zurücknehmen
        </Button>
      </Section>

      <Text style={{ margin: '24px 0 8px 0', fontSize: '14px' }}>
        Falls der Knopf nicht funktioniert, kopier diese Adresse in deinen
        Browser:
      </Text>
      <Text style={linkBlockStyle}>{cancelUrl}</Text>

      <Text style={{ margin: '24px 0 0 0', fontSize: '14px', color: '#78716c' }}>
        Möchtest du die Löschung wirklich durchziehen? Dann musst du nichts
        tun — am {deletionDate} läuft sie automatisch.
      </Text>
    </Layout>
  );
}

export default KontoLoeschungErinnerung;
