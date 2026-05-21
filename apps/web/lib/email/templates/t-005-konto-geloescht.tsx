/**
 * T-005 — Konto wurde geloescht (Abschluss-Mail).
 *
 * Wird verschickt, nachdem die Karenz abgelaufen ist und der Cron-Job
 * `konto_loeschung_frist_abgelaufen` die endgueltige Loeschung durchgefuehrt
 * hat. Enthaelt im Versand-Pfad einen JSON-Export-Anhang (Anhang-Logik
 * gehoert zu task-cron-jobs-auth — hier nur das Template).
 *
 * Betreff: „Dein Werkzirkel-Konto wurde geloescht"
 */

import { Heading, Text } from '@react-email/components';
import * as React from 'react';
import { Layout } from './_layout';

export interface KontoGeloeschtProps {
  /** Anzeigename der geloeschten Person (fuer persoenliche Anrede). */
  anzeigename: string;
  /** App-URL fuer Footer-Links. */
  appUrl?: string;
}

export const T005_BETREFF = 'Dein Werkzirkel-Konto wurde gelöscht';

export function KontoGeloescht(props: KontoGeloeschtProps): React.JSX.Element {
  const { anzeigename, appUrl = 'https://werkzirkel.de' } = props;
  return (
    <Layout
      vorschau="Deine Daten wurden entfernt. Im Anhang findest du deinen JSON-Export."
      appUrl={appUrl}
    >
      <Heading as="h1" style={{ fontSize: '20px', margin: '0 0 16px 0' }}>
        Tschüss, {anzeigename}.
      </Heading>

      <Text style={{ margin: '0 0 16px 0' }}>
        Dein Werkzirkel-Konto wurde soeben endgültig gelöscht. Dein Profil,
        deine Werke und alle persönlichen Daten sind aus unseren Systemen
        entfernt.
      </Text>

      <Text style={{ margin: '0 0 16px 0' }}>
        Im Anhang dieser E-Mail findest du eine JSON-Datei mit allen Daten,
        die zu deinem Konto gehört haben — falls du etwas davon archivieren
        oder zu einer anderen Plattform mitnehmen möchtest.
      </Text>

      <Text style={{ margin: '0 0 16px 0' }}>
        Feedback, das du zu Werken anderer hinterlassen hast, bleibt anonym
        erhalten. So bleibt das Werk-Feedback für die Builder:innen lesbar,
        ohne dass dein Name oder deine E-Mail mit drin steht.
      </Text>

      <Text style={{ margin: '24px 0 0 0', fontSize: '14px', color: '#78716c' }}>
        Falls du es dir doch anders überlegst: Du kannst dich jederzeit
        wieder anmelden und ein neues Konto anlegen.
      </Text>
    </Layout>
  );
}

export default KontoGeloescht;
