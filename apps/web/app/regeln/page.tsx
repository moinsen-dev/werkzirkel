/**
 * /regeln — Werkstatt-Regeln der Werkzirkel-Plattform.
 *
 * Quelle: PRD §9 (Werkstatt-Regeln) + §11A (erweiterte Bedarfsseite-Regeln).
 *
 * Server Component.
 */

import type { Metadata } from 'next';

import SiteFooter from '@/components/ui/site-footer';
import SiteNav from '@/components/ui/site-nav';

export const metadata: Metadata = {
  title: 'Werkstatt-Regeln',
  description:
    'Die Werkzirkel-Regeln: kein Cold-Outreach, kein Pitch-Wettbewerb, keine Verkaufsprovisionen. Build-Kultur statt Marktplatz.',
};

export default function RegelnPage() {
  return (
    <div className="page-shell">
      <SiteNav />
      <main className="legal-page">
        <div className="wrap">
          <p className="legal-eyebrow">Kultur</p>
          <h1>Werkstatt-Regeln</h1>
          <p className="legal-meta">
            Verbindliche Verhaltensregeln. Sie schützen die Build-Kultur und werden bei
            Verstößen auch kuratorisch durchgesetzt.
          </p>

          <h2>1. Wir machen, statt zu pitchen</h2>
          <p>
            Werkzirkel ist kein Pitch-Wettbewerb. Werke sind Arbeitsstände, keine
            Verkaufs-Decks. Wer hier ist, will gemeinsam bauen — nicht den lautesten Slot
            gewinnen.
          </p>

          <h2>2. Kein Cold-Outreach an die Nachfrage-Seite</h2>
          <p>
            Direkte Privatnachrichten („Hey, ich hätte da was für dich“) an
            Auftraggeber:innen oder Sponsor:innen sind nicht vorgesehen und werden bei
            Wiederholung mit Kontosperre geahndet. Kontakt entsteht über{' '}
            <strong>Werkangebote</strong> (Antwort auf einen offenen Bedarf),{' '}
            <strong>Demo Nights</strong> und <strong>Briefing Nights</strong> — kuratiert und
            sichtbar für alle.
          </p>

          <h2>3. Bedarfe sind reale Probleme, keine Stellenanzeigen</h2>
          <ul>
            <li>
              Ein Bedarf beschreibt das <em>Problem und den Nutzen</em>, nicht eine vordefinierte
              Lösung oder ein Lasten-Stunden-Heft.
            </li>
            <li>
              Wer mehrere reine Stellenanzeigen einreicht, wird vom City-Leads-Team auf den
              Briefing Night-Modus umgeschult oder verliert den Schreibzugriff.
            </li>
          </ul>

          <h2>4. Membership-Beitrag statt Vorab-Honorar</h2>
          <p>
            Auftraggeber:innen erbringen einen Membership-Beitrag — Sachleistung (Räume,
            Catering, Werkzeug) oder Spende — bevor ihr Bedarf öffentlich wird. Damit
            unterscheidet sich Werkzirkel klar von Ausschreibungsplattformen und filtert
            ernsthafte Anfragen.
          </p>

          <h2>5. Förder-Mitgliedschaft erfordert Anwesenheit</h2>
          <p>
            Wer als Sponsor:in verifiziert sein will, ist mindestens einmal pro Quartal auf einer
            Briefing Night anwesend. „Stille Spende ohne Gesicht“ ist möglich, gibt aber keinen
            verifizierten Förder-Status.
          </p>

          <h2>6. Keine Equity-Vermittlung über die Plattform</h2>
          <p>
            Werkzirkel zeigt Sponsor-Profile, aber jede Form von Beteiligung, Equity oder
            Investment wird ausschließlich offline und in Eigenverantwortung der Beteiligten
            verhandelt. Plattform-vermittelte Equity-Deals sind kategorisch ausgeschlossen.
          </p>

          <h2>7. Tester-Feedback ist konstruktiv</h2>
          <ul>
            <li>Kein Trolling, kein „das ist Müll“, keine persönlichen Angriffe.</li>
            <li>Drei Reports rechtfertigen eine Konto-Prüfung, bei Wiederholung Sperre.</li>
            <li>
              Feedback gibt es öffentlich (mit Namen) oder pseudonym — beides ist okay; die
              Builder:in entscheidet, was sie übernimmt.
            </li>
          </ul>

          <h2>8. Kein Cross-Posting in andere Städte ohne Bezug</h2>
          <p>
            Hamburg-First. Werke und Bedarfe gehören in die Stadt, in der die Person tatsächlich
            arbeitet. Eine Berliner Person, die Hamburger Briefing Nights für Akquise nutzt,
            verstößt gegen den Lokalbezug — City-Leads können das Profil verschieben oder
            pausieren.
          </p>

          <h2>9. Diskriminierungsfreiheit</h2>
          <p>
            Werkzirkel ist diskriminierungsfrei. Inhalte, die einzelne Personen oder Gruppen
            wegen ihrer Herkunft, Religion, Geschlechtsidentität, sexuellen Orientierung,
            Behinderung oder politischen Überzeugung herabwürdigen, werden gelöscht und führen
            zu Konto-Sperre.
          </p>

          <h2>10. City-Leads-Entscheidungen sind verbindlich</h2>
          <p>
            City-Leads verteilen Schau-Slots, geben Bedarfe frei und können Profile pausieren.
            Ihre Entscheidungen können per E-Mail an{' '}
            <a href="mailto:developer@moinsen.dev">developer@moinsen.dev</a> widersprochen
            werden; das Veto-Recht liegt bei der Plattform-Leitung. Im Zweifel gilt: Wer die
            Build-Kultur ernst meint, akzeptiert City-Leads-Entscheidungen, auch wenn
            sie einmal gegen das eigene Werk gehen.
          </p>

          <p className="legal-note">
            Diese Regeln sind verbindlich. Mit der Registrierung erkennst du sie an. Wiederholte
            Verstöße führen zu Konto-Pausierung oder Sperre — die rechtliche Grundlage hierfür
            steht in den <a href="/agb">AGB</a>.
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
