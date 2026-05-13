/**
 * Gemeinsamer Layout-Wrapper fuer alle Werkzirkel-E-Mail-Templates.
 *
 * Liefert:
 * - HTML-Grundgeruest (`<Html>` mit Sprache `de`)
 * - Logo-Header („Werkzirkel" als Wortmarke)
 * - Inhalts-Container
 * - Footer mit Impressum-, Datenschutz- und Abmelde-Link
 *
 * Tonalitaet gemaess PRD §6: du-Anrede, klar, kein Sales-Sprech, deutsch.
 * Englische Strings sind ausschliesslich der Markenname „Werkzirkel" und
 * unvermeidbare HTML-Attribute. Im sichtbaren Body darf kein Englisch
 * erscheinen.
 */

import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';

export interface LayoutProps {
  /** Vorschautext (Preview) — erscheint in Inbox-Listenansicht vor dem Klick. */
  vorschau: string;
  /** App-URL (z.B. https://werkzirkel.de) — fuer Footer-Links. */
  appUrl: string;
  children: React.ReactNode;
}

const styles = {
  body: {
    backgroundColor: '#f5f5f4',
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif",
    margin: 0,
    padding: '32px 0',
  },
  container: {
    backgroundColor: '#ffffff',
    border: '1px solid #e7e5e4',
    borderRadius: '8px',
    margin: '0 auto',
    maxWidth: '560px',
    padding: '32px',
  },
  headerSection: {
    paddingBottom: '24px',
    borderBottom: '1px solid #e7e5e4',
  },
  wortmarke: {
    color: '#0c0a09',
    fontSize: '22px',
    fontWeight: 700,
    letterSpacing: '-0.02em',
    margin: 0,
  },
  contentSection: {
    padding: '24px 0',
    color: '#1c1917',
    fontSize: '16px',
    lineHeight: '1.6',
  },
  footerSection: {
    paddingTop: '16px',
    borderTop: '1px solid #e7e5e4',
    color: '#78716c',
    fontSize: '13px',
    lineHeight: '1.6',
  },
  footerText: {
    margin: '0 0 8px 0',
    color: '#78716c',
    fontSize: '13px',
  },
  footerLink: {
    color: '#78716c',
    textDecoration: 'underline',
    marginRight: '12px',
  },
} as const;

export function Layout(props: LayoutProps): React.JSX.Element {
  const { vorschau, appUrl, children } = props;
  const impressum = `${appUrl}/impressum`;
  const datenschutz = `${appUrl}/datenschutz`;
  const abmelden = `${appUrl}/einstellungen?bereich=benachrichtigungen`;

  return (
    <Html lang="de">
      <Head />
      <Preview>{vorschau}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.headerSection}>
            <Text style={styles.wortmarke}>Werkzirkel</Text>
          </Section>

          <Section style={styles.contentSection}>{children}</Section>

          <Hr style={{ borderColor: '#e7e5e4', margin: '0' }} />
          <Section style={styles.footerSection}>
            <Text style={styles.footerText}>
              Du bekommst diese E-Mail, weil du ein Werkzirkel-Konto hast oder
              eines anlegen wolltest.
            </Text>
            <Text style={styles.footerText}>
              <Link href={impressum} style={styles.footerLink}>
                Impressum
              </Link>
              <Link href={datenschutz} style={styles.footerLink}>
                Datenschutz
              </Link>
              <Link href={abmelden} style={styles.footerLink}>
                Benachrichtigungen verwalten
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export default Layout;
