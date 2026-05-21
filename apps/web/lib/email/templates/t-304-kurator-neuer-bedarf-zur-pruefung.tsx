/**
 * T-304 — Neuer Bedarf wartet im Kurator-Postfach.
 *
 * Wird an alle City-Leads einer Stadt verschickt, sobald ein Bedarf in
 * den Status 'in_pruefung' eingereicht wurde. PRD §11A.S8 / §9: Push-
 * Benachrichtigung ergänzt das bestehende Pull-Postfach
 * (/api/v1/kurator/bedarfe-in-pruefung), damit Bedarfe nicht in der
 * Queue versanden.
 *
 * Betreff: „Neuer Bedarf wartet auf deine Prüfung"
 */

import { Button, Heading, Section, Text } from '@react-email/components';
import * as React from 'react';
import { Layout } from './_layout';

export interface KuratorNeuerBedarfZurPruefungProps {
  /** Titel des Bedarfs für Inline-Bezug. */
  titel: string;
  /** Sprach-Check-Treffer (z.B. ["pitch", "ausschreibung"]) — leer wenn keine. */
  sprachCheckTreffer: string[];
  /** Direktlink ins Postfach für diesen Kurator. */
  postfachUrl: string;
  appUrl?: string;
}

export const T304_BETREFF = 'Neuer Bedarf wartet auf deine Prüfung';

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

export function KuratorNeuerBedarfZurPruefung(
  props: KuratorNeuerBedarfZurPruefungProps,
): React.JSX.Element {
  const {
    titel,
    sprachCheckTreffer,
    postfachUrl,
    appUrl = 'https://werkzirkel.de',
  } = props;

  return (
    <Layout
      vorschau={`Neuer Bedarf "${titel}" wartet im Kurator-Postfach.`}
      appUrl={appUrl}
    >
      <Heading as="h1" style={{ fontSize: '20px', margin: '0 0 16px 0' }}>
        Neuer Bedarf wartet auf deine Prüfung
      </Heading>

      <Text style={{ margin: '0 0 16px 0' }}>
        Eine Auftraggeber:in hat den Bedarf {'„'}
        {titel}
        {'“'} zur City-Leads-Prüfung eingereicht. Er ist noch nicht
        öffentlich sichtbar — du entscheidest, ob er ins Bedarfs-Heft kommt.
      </Text>

      {sprachCheckTreffer.length > 0 ? (
        <Text style={{ margin: '0 0 16px 0' }}>
          Der Sprach-Check hat angeschlagen auf:{' '}
          <strong>{sprachCheckTreffer.join(', ')}</strong>. Schau bitte einmal
          drüber, bevor du freigibst.
        </Text>
      ) : null}

      <Section style={{ textAlign: 'center', margin: '24px 0' }}>
        <Button href={postfachUrl} style={buttonStyle}>
          Im Kurator-Postfach öffnen
        </Button>
      </Section>

      <Text
        style={{
          margin: '24px 0 0 0',
          fontSize: '13px',
          color: '#78716c',
        }}
      >
        Du bekommst diese Mail, weil du City-Lead dieser Stadt bist.
      </Text>
    </Layout>
  );
}

export default KuratorNeuerBedarfZurPruefung;
