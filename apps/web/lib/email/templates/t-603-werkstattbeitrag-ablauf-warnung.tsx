/**
 * T-603 — Werkstattbeitrag laeuft bald aus (30-Tage-Warnung).
 *
 * Wird vom Cron-Job 30 Tage vor Ablauf der 6-Monats-Gueltigkeit verschickt.
 * Empfaenger kann einen neuen Beitrag erbringen (Schauabend / Sachleistung /
 * Geldbeitrag) oder den aktuellen einfach auslaufen lassen.
 *
 * Betreff: „Dein Werkstattbeitrag laeuft bald aus"
 */

import { Button, Heading, Section, Text } from '@react-email/components';
import * as React from 'react';
import { Layout } from './_layout';

export interface WerkstattbeitragAblaufWarnungProps {
  anzeigename: string;
  /** Gueltig bis als ISO-Datum (YYYY-MM-DD). */
  gueltigBis: string;
  /** Anzahl der noch verbleibenden Tage (z.B. 30). */
  tageBisAblauf: number;
  uebersichtUrl: string;
  appUrl?: string;
}

export const T603_BETREFF = 'Dein Werkstattbeitrag laeuft bald aus';

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

export function WerkstattbeitragAblaufWarnung(
  props: WerkstattbeitragAblaufWarnungProps,
): React.JSX.Element {
  const {
    anzeigename,
    gueltigBis,
    tageBisAblauf,
    uebersichtUrl,
    appUrl = 'https://werkzirkel.de',
  } = props;

  return (
    <Layout
      vorschau={`Dein Werkstattbeitrag laeuft in ${tageBisAblauf} Tagen aus.`}
      appUrl={appUrl}
    >
      <Heading as="h1" style={{ fontSize: '20px', margin: '0 0 16px 0' }}>
        Dein Werkstattbeitrag laeuft bald aus
      </Heading>

      <Text style={{ margin: '0 0 16px 0' }}>
        Hallo {anzeigename}, dein Werkstattbeitrag ist noch bis
        {' '}{gueltigBis} gueltig — das sind {tageBisAblauf} Tage.
      </Text>

      <Text style={{ margin: '0 0 16px 0' }}>
        Wenn du weiter Bedarfe einbringen moechtest, hast du drei
        Wege fuer einen neuen Beitrag:
      </Text>

      <Text style={{ margin: '0 0 8px 0' }}>
        - Zum naechsten Schauabend kommen — automatischer Beitrag.
      </Text>
      <Text style={{ margin: '0 0 8px 0' }}>
        - Eine Sachleistung beitragen (z.B. Raum, Getraenke, Doku).
      </Text>
      <Text style={{ margin: '0 0 16px 0' }}>
        - Geldbeitrag von 50, 100 oder 150 Euro ueber die Plattform.
      </Text>

      <Section style={{ textAlign: 'center', margin: '24px 0' }}>
        <Button href={uebersichtUrl} style={buttonStyle}>
          Meine Werkstattbeitraege ansehen
        </Button>
      </Section>
    </Layout>
  );
}

export default WerkstattbeitragAblaufWarnung;
