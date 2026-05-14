/**
 * T-601 — Werkstattbeitrag bezahlt (Geldbeitrag via Stripe).
 *
 * Wird verschickt, sobald Stripe via `checkout.session.completed`-Webhook
 * den Geldbeitrag bestaetigt hat. Der Beitrag ist jetzt 6 Monate gueltig
 * und kann fuer bis zu 4 Bedarfe verwendet werden.
 *
 * Betreff: „Dein Werkstattbeitrag ist eingegangen — danke!"
 */

import { Button, Heading, Section, Text } from '@react-email/components';
import * as React from 'react';
import { Layout } from './_layout';

export interface WerkstattbeitragBezahltProps {
  /** Anzeigename der Bedarfstraeger:in. */
  anzeigename: string;
  /** Hoehe des Beitrags in EUR (z.B. „50", „100", „150"). */
  hoeheEuro: string;
  /** Gueltig bis als ISO-Datum (YYYY-MM-DD). */
  gueltigBis: string;
  /** Link zur Werkstattbeitrag-Uebersicht. */
  uebersichtUrl: string;
  appUrl?: string;
}

export const T601_BETREFF = 'Dein Werkstattbeitrag ist eingegangen — danke!';

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

export function WerkstattbeitragBezahlt(
  props: WerkstattbeitragBezahltProps,
): React.JSX.Element {
  const {
    anzeigename,
    hoeheEuro,
    gueltigBis,
    uebersichtUrl,
    appUrl = 'https://werkzirkel.de',
  } = props;

  return (
    <Layout
      vorschau={`Dein Werkstattbeitrag von ${hoeheEuro} Euro ist eingegangen.`}
      appUrl={appUrl}
    >
      <Heading as="h1" style={{ fontSize: '20px', margin: '0 0 16px 0' }}>
        Dein Werkstattbeitrag ist eingegangen
      </Heading>

      <Text style={{ margin: '0 0 16px 0' }}>
        Hallo {anzeigename}, vielen Dank fuer deinen Werkstattbeitrag von
        {' '}{hoeheEuro} Euro. Damit traegst du den Werkzirkel Hamburg
        und kannst jetzt Bedarfe einbringen.
      </Text>

      <Text style={{ margin: '0 0 16px 0' }}>
        Der Beitrag ist bis {gueltigBis} gueltig und reicht fuer bis zu
        vier Bedarfe. Danach (oder nach Ablauf) brauchst du einen neuen
        Beitrag — entweder per Schauabend-Teilnahme, Sachleistung oder
        wieder als Geldbeitrag.
      </Text>

      <Section style={{ textAlign: 'center', margin: '24px 0' }}>
        <Button href={uebersichtUrl} style={buttonStyle}>
          Meine Werkstattbeitraege ansehen
        </Button>
      </Section>
    </Layout>
  );
}

export default WerkstattbeitragBezahlt;
