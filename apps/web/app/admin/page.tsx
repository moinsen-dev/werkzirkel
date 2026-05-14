/**
 * /admin — Admin-Dashboard.
 *
 * Knappe Count-Uebersicht ueber das System: Nutzer:innen-Anzahl je Status,
 * Stadt-Anzahl je Status, offene Meldungen, Audit-Log-Eintraege heute.
 *
 * Permission via /admin/layout.tsx — wenn wir hier ankommen, ist der User Admin.
 *
 * PRD-Referenz: §15.14, §26.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { count, eq, gte } from 'drizzle-orm';

import { db } from '@/lib/db';
import {
  auditLog,
  emailBenachrichtigungLog,
  meldung,
  nutzer,
  stadt,
} from '@/lib/db/schema';

export const metadata: Metadata = {
  title: 'Admin-Dashboard — Werkzirkel',
};

export default async function AdminDashboardPage() {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const [nutzerCounts, stadtCounts, offeneMeldungen, auditHeute, emailHeute] =
    await Promise.all([
      db
        .select({ status: nutzer.status, n: count() })
        .from(nutzer)
        .groupBy(nutzer.status),
      db
        .select({ status: stadt.status, n: count() })
        .from(stadt)
        .groupBy(stadt.status),
      db
        .select({ n: count() })
        .from(meldung)
        .where(eq(meldung.status, 'offen')),
      db
        .select({ n: count() })
        .from(auditLog)
        .where(gte(auditLog.erstelltAm, today)),
      db
        .select({ n: count() })
        .from(emailBenachrichtigungLog)
        .where(gte(emailBenachrichtigungLog.erstelltAm, today)),
    ]);

  const findCount = (
    arr: Array<{ status: string; n: number }>,
    s: string,
  ): number => arr.find((r) => r.status === s)?.n ?? 0;

  return (
    <>
      <header className="hero" id="top">
        <div className="wrap hero-grid single">
          <div>
            <p className="eyebrow">Werkzirkel · Admin</p>
            <h1>Dashboard</h1>
            <p className="hero-copy">
              Statistik des aktuellen Plattform-Zustands.
            </p>
          </div>
        </div>
      </header>

      <section className="section compact">
        <div className="wrap">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 16,
            }}
            data-testid="admin-dashboard-cards"
          >
            <Card title="Nutzer:innen aktiv" value={findCount(nutzerCounts, 'aktiv')} href="/admin/nutzer?status=aktiv" />
            <Card title="Nutzer:innen pausiert" value={findCount(nutzerCounts, 'pausiert')} href="/admin/nutzer?status=pausiert" />
            <Card title="Nutzer:innen gesperrt" value={findCount(nutzerCounts, 'gesperrt')} href="/admin/nutzer?status=gesperrt" />
            <Card title="Loeschung anstehend" value={findCount(nutzerCounts, 'loeschung_anstehend')} href="/admin/nutzer?status=loeschung_anstehend" />
            <Card title="Staedte aktiv" value={findCount(stadtCounts, 'aktiv')} href="/admin/staedte" />
            <Card title="Staedte in Vorbereitung" value={findCount(stadtCounts, 'vorbereitung')} href="/admin/staedte" />
            <Card title="Offene Meldungen" value={offeneMeldungen[0]?.n ?? 0} href="/kurator/meldungen?status=offen" />
            <Card title="Audit-Eintraege heute" value={auditHeute[0]?.n ?? 0} href="/admin/audit-log" />
            <Card title="E-Mails heute" value={emailHeute[0]?.n ?? 0} href="/admin/email-log" />
          </div>
        </div>
      </section>
    </>
  );
}

function Card({
  title,
  value,
  href,
}: {
  title: string;
  value: number;
  href: string;
}) {
  return (
    <Link
      href={href}
      style={{
        display: 'block',
        textDecoration: 'none',
        color: 'inherit',
        border: '1px solid var(--hairline-color, #ddd)',
        borderRadius: 12,
        padding: 16,
      }}
    >
      <div style={{ fontSize: 13, color: 'var(--muted, #555)' }}>{title}</div>
      <div style={{ fontSize: 32, fontWeight: 600, marginTop: 4 }}>{value}</div>
    </Link>
  );
}

