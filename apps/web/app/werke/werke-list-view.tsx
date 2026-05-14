/**
 * Pure, sessionless Server-Component-Renderer fuer die Werke-Uebersicht.
 *
 * Bewusst getrennt vom Page-Modul, damit Unit-Tests die Komponente mit
 * Mock-Daten rendern koennen, ohne `next/headers`, `notFound()` oder die
 * DB mocken zu muessen.
 *
 * Hard rules:
 * - KEIN `<input type="search">`, kein name='q'/'query'/'suche'. P4 Verbindlichkeit
 *   statt Rauschen. Filter NUR via Checkbox/Radio/Select.
 * - Inhaber:innen-Daten in der Liste: NUR `anzeigename`, `avatarUrl`, Stadt-Name.
 *   NIE email/klarname.
 */

import Link from 'next/link';

import { AvatarImage } from '@/components/ui/avatar-image';
import { de } from '@/i18n/de';
import {
  hilfebedarf as hilfebedarfEnum,
  werkstand as werkstandEnum,
  type Hilfebedarf,
  type Werkstand,
} from '@/lib/db/schema/enums';

export type SortOption = 'aktuell' | 'neu' | 'sucht_hilfe';

export interface WerkeListItem {
  id: string;
  name: string;
  kurzbeschreibung: string;
  werkstand: Werkstand;
  hilfebedarf: Hilfebedarf[];
  screenshots: string[];
  inhaberAnzeigename: string;
  inhaberAvatarUrl: string | null;
  inhaberStadtName: string;
}

export interface WerkeListFilterState {
  stadt: string;
  werkstand: Werkstand[];
  hilfebedarf: Hilfebedarf[];
  sort: SortOption;
}

export interface WerkeListViewProps {
  items: WerkeListItem[];
  filter: WerkeListFilterState;
  stadtOptions: Array<{ id: string; name: string; status: 'aktiv' | 'vorbereitung' | 'inaktiv' }>;
  stadtName: string;
  /** Gesamt-Anzahl Werke fuer aktiven Stadt-Filter (vor Werkstand/Hilfebedarf). */
  gesamtAktuell: number;
  nextCursor: string | null;
}

function werkstandLabel(w: string): string {
  return (de.werkstand as Record<string, string>)[w] ?? w;
}

function hilfebedarfLabel(h: string): string {
  return (de.hilfebedarf as Record<string, string>)[h] ?? h;
}

function avatarInitialen(name: string): string {
  const parts = name.trim().split(/\s+/);
  const letters = parts
    .map((p) => p[0] ?? '')
    .filter(Boolean)
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return letters || '?';
}

/**
 * Baut eine URL fuer "Weitere 20 Werke ansehen" — uebernimmt alle aktuellen
 * Filter und haengt den Cursor an.
 */
export function buildCursorHref(filter: WerkeListFilterState, cursor: string): string {
  const sp = new URLSearchParams();
  if (filter.stadt !== 'hh') sp.set('stadt', filter.stadt);
  for (const w of filter.werkstand) sp.append('werkstand', w);
  for (const h of filter.hilfebedarf) sp.append('hilfebedarf', h);
  if (filter.sort !== 'aktuell') sp.set('sort', filter.sort);
  sp.set('cursor', cursor);
  const qs = sp.toString();
  return qs ? `/werke?${qs}` : '/werke';
}

const SORT_OPTIONS: Array<{ value: SortOption; label: string }> = [
  { value: 'aktuell', label: 'Zuletzt aktualisiert' },
  { value: 'neu', label: 'Neu angelegt' },
  { value: 'sucht_hilfe', label: 'Sucht aktiv Hilfe' },
];

export default function WerkeListView({
  items,
  filter,
  stadtOptions,
  stadtName,
  gesamtAktuell,
  nextCursor,
}: WerkeListViewProps) {
  const istBerlinLeer = filter.stadt === 'b' && items.length === 0;
  const istLeerNormal = items.length === 0 && !istBerlinLeer;

  return (
    <div className="page-shell">
      <nav className="site-nav" aria-label="Hauptnavigation">
        <div className="wrap nav-inner">
          <Link href="/" className="brand" aria-label="Werkzirkel Start">
            <span className="brand-mark" aria-hidden="true">
              <span></span>
              <span></span>
              <span></span>
              <span></span>
            </span>
            <span>Werkzirkel</span>
          </Link>
          <div className="nav-links" aria-label="Bereiche">
            <Link href="/">Macher:innen</Link>
            <Link href="/werke" aria-current="page">
              Werke
            </Link>
            <Link href="/bedarf">Bedarf einbringen</Link>
            <Link href="/foerdern">Werke fördern</Link>
          </div>
          <Link className="nav-cta" href="/anmelden">
            Anmelden
          </Link>
        </div>
      </nav>

      <header className="hero" id="top">
        <div className="wrap hero-grid single">
          <div>
            <p className="eyebrow">
              Werke im Werkzirkel {stadtName || ''}
            </p>
            <h1>Werke aus der Region.</h1>
            <p className="hero-copy">
              {gesamtAktuell === 0
                ? 'Noch keine öffentlichen Werke. Wer Rückmeldung will, hilft auch anderen.'
                : `${gesamtAktuell} ${
                    gesamtAktuell === 1 ? 'Werk' : 'Werke'
                  } gerade aktiv. Wer Rückmeldung will, hilft auch anderen.`}
            </p>
          </div>
        </div>
      </header>

      <section className="section">
        <div
          className="wrap"
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(240px, 280px) minmax(0, 1fr)',
            gap: 40,
            alignItems: 'start',
          }}
        >
          {/* ────── Filter-Sidebar ────── */}
          <aside
            aria-label="Filter"
            style={{
              position: 'sticky',
              top: 16,
              border: 'var(--hairline)',
              borderRadius: 16,
              padding: 18,
              background: 'var(--surface)',
            }}
          >
            <form method="get" action="/werke" style={{ display: 'grid', gap: 18 }}>
              <fieldset style={fieldsetStyle}>
                <legend style={legendStyle}>Stadt</legend>
                <select
                  name="stadt"
                  defaultValue={filter.stadt}
                  style={inputStyle}
                  aria-label="Stadt auswählen"
                >
                  {stadtOptions.map((s) => {
                    const inVorbereitung = s.status === 'vorbereitung';
                    const inaktiv = s.status === 'inaktiv';
                    const label = inVorbereitung
                      ? `${s.name} (in Vorbereitung)`
                      : inaktiv
                        ? `${s.name} (inaktiv)`
                        : s.name;
                    return (
                      <option
                        key={s.id}
                        value={s.id}
                        disabled={inaktiv}
                      >
                        {label}
                      </option>
                    );
                  })}
                </select>
              </fieldset>

              <fieldset style={fieldsetStyle}>
                <legend style={legendStyle}>Werkstand</legend>
                <div style={{ display: 'grid', gap: 6 }}>
                  {werkstandEnum.map((w) => (
                    <label
                      key={w}
                      style={{
                        display: 'inline-flex',
                        gap: 8,
                        alignItems: 'center',
                        fontSize: 14,
                      }}
                    >
                      <input
                        type="checkbox"
                        name="werkstand"
                        value={w}
                        defaultChecked={filter.werkstand.includes(w)}
                      />
                      <span>{werkstandLabel(w)}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset style={fieldsetStyle}>
                <legend style={legendStyle}>Hilfebedarf</legend>
                <div style={{ display: 'grid', gap: 6 }}>
                  {hilfebedarfEnum.map((h) => (
                    <label
                      key={h}
                      style={{
                        display: 'inline-flex',
                        gap: 8,
                        alignItems: 'center',
                        fontSize: 14,
                      }}
                    >
                      <input
                        type="checkbox"
                        name="hilfebedarf"
                        value={h}
                        defaultChecked={filter.hilfebedarf.includes(h)}
                      />
                      <span>{hilfebedarfLabel(h)}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset style={fieldsetStyle}>
                <legend style={legendStyle}>Sortierung</legend>
                <div style={{ display: 'grid', gap: 6 }}>
                  {SORT_OPTIONS.map((opt) => (
                    <label
                      key={opt.value}
                      style={{
                        display: 'inline-flex',
                        gap: 8,
                        alignItems: 'center',
                        fontSize: 14,
                      }}
                    >
                      <input
                        type="radio"
                        name="sort"
                        value={opt.value}
                        defaultChecked={filter.sort === opt.value}
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <button type="submit" className="button primary">
                Filter anwenden
              </button>
              <Link
                href="/werke"
                style={{ fontSize: 13, color: 'var(--muted)' }}
              >
                Alle Filter zurücksetzen
              </Link>
            </form>
          </aside>

          {/* ────── Liste ────── */}
          <div>
            {istBerlinLeer ? (
              <div
                className="callout"
                role="status"
                style={{
                  padding: 20,
                  borderRadius: 14,
                  border: 'var(--hairline)',
                  background: 'var(--surface)',
                }}
              >
                <h2 style={{ marginTop: 0 }}>Berlin startet, sobald Hamburg trägt.</h2>
                <p style={{ marginTop: 8, color: 'var(--muted)' }}>
                  Aktuell keine Werke. Trag dich in den Hamburger Kreis ein oder
                  schreib uns auf der Berlin-Zirkel-Seite.
                </p>
                <div
                  style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}
                >
                  <Link href="/werke?stadt=hh" className="button primary">
                    Hamburger Werke ansehen
                  </Link>
                  <Link href="/zirkel/b" className="button secondary">
                    Berlin-Zirkel-Seite
                  </Link>
                </div>
              </div>
            ) : istLeerNormal ? (
              <div
                className="callout"
                role="status"
                style={{
                  padding: 20,
                  borderRadius: 14,
                  border: 'var(--hairline)',
                  background: 'var(--surface)',
                }}
              >
                <h2 style={{ marginTop: 0 }}>Keine Werke für diese Filter.</h2>
                <p style={{ marginTop: 8, color: 'var(--muted)' }}>
                  Noch keine Werke für diese Filter-Kombination. Probier weniger
                  restriktive Filter oder lege selbst eines an.
                </p>
                <div style={{ marginTop: 14 }}>
                  <Link href="/werke" className="button secondary">
                    Alle Filter zurücksetzen
                  </Link>
                </div>
              </div>
            ) : (
              <ul
                aria-label="Werke-Liste"
                style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: 0,
                  display: 'grid',
                  gap: 18,
                }}
              >
                {items.map((w) => (
                  <li key={w.id}>
                    <article
                      className="work-card"
                      style={{
                        display: 'grid',
                        gridTemplateColumns: w.screenshots[0]
                          ? '160px minmax(0, 1fr)'
                          : 'minmax(0, 1fr)',
                        gap: 0,
                      }}
                    >
                      {w.screenshots[0] ? (
                        <div
                          style={{
                            background: 'var(--bg)',
                            display: 'grid',
                            placeItems: 'center',
                            minHeight: 140,
                            borderRight: 'var(--hairline)',
                            overflow: 'hidden',
                          }}
                          aria-hidden="true"
                        >
                          <AvatarImage
                            src={w.screenshots[0]}
                            alt=""
                            width={400}
                            height={300}
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                              display: 'block',
                            }}
                          />
                        </div>
                      ) : null}

                      <div
                        className="work-body"
                        style={{ padding: 18, display: 'grid', gap: 8 }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: 12,
                            alignItems: 'baseline',
                            flexWrap: 'wrap',
                          }}
                        >
                          <h3 style={{ margin: 0, fontSize: 20 }}>
                            <Link
                              href={`/werke/${w.id}`}
                              style={{ color: 'var(--fg)' }}
                            >
                              {w.name}
                            </Link>
                          </h3>
                          <span className="status-pill warm">
                            Werkstand: {werkstandLabel(w.werkstand)}
                          </span>
                        </div>

                        <p
                          style={{
                            margin: 0,
                            color: 'var(--muted)',
                            fontSize: 15,
                            lineHeight: 1.5,
                          }}
                        >
                          {w.kurzbeschreibung}
                        </p>

                        {w.hilfebedarf.length > 0 ? (
                          <div
                            style={{
                              display: 'flex',
                              gap: 6,
                              flexWrap: 'wrap',
                              marginTop: 4,
                            }}
                          >
                            {w.hilfebedarf.slice(0, 3).map((h) => (
                              <span key={h} className="status-pill">
                                {hilfebedarfLabel(h)}
                              </span>
                            ))}
                            {w.hilfebedarf.length > 3 ? (
                              <span
                                className="status-pill"
                                style={{ opacity: 0.7 }}
                              >
                                … mehr
                              </span>
                            ) : null}
                          </div>
                        ) : null}

                        <div
                          style={{
                            display: 'flex',
                            gap: 8,
                            alignItems: 'center',
                            marginTop: 6,
                            color: 'var(--muted)',
                            fontSize: 13,
                          }}
                        >
                          {w.inhaberAvatarUrl ? (
                            <AvatarImage
                              src={w.inhaberAvatarUrl}
                              alt=""
                              width={24}
                              height={24}
                              style={{
                                borderRadius: '50%',
                                objectFit: 'cover',
                                border: 'var(--hairline)',
                              }}
                            />
                          ) : (
                            <span
                              aria-hidden="true"
                              style={{
                                display: 'inline-grid',
                                placeItems: 'center',
                                width: 24,
                                height: 24,
                                borderRadius: '50%',
                                background: 'var(--bg)',
                                border: 'var(--hairline)',
                                fontSize: 11,
                                fontWeight: 700,
                              }}
                            >
                              {avatarInitialen(w.inhaberAnzeigename)}
                            </span>
                          )}
                          <span>
                            von {w.inhaberAnzeigename}
                            {w.inhaberStadtName ? ` · ${w.inhaberStadtName}` : ''}
                          </span>
                        </div>
                      </div>
                    </article>
                  </li>
                ))}
              </ul>
            )}

            {nextCursor ? (
              <div style={{ marginTop: 24, textAlign: 'center' }}>
                <Link
                  href={buildCursorHref(filter, nextCursor)}
                  className="button secondary"
                >
                  Weitere 20 Werke ansehen
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <footer className="site-footer">
        <div className="wrap footer-inner">
          <span>Werkzirkel — Gemeinsam digitale Produkte bauen.</span>
          <div className="footer-links" aria-label="Fußnavigation">
            <Link href="/">Macher:innen</Link>
            <Link href="/bedarf">Bedarf</Link>
            <Link href="/foerdern">Fördern</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

const fieldsetStyle: React.CSSProperties = {
  border: 'var(--hairline)',
  borderRadius: 10,
  padding: '10px 12px',
};

const legendStyle: React.CSSProperties = {
  fontWeight: 600,
  fontSize: 13,
  padding: '0 6px',
};

const inputStyle: React.CSSProperties = {
  padding: '8px 10px',
  borderRadius: 8,
  border: 'var(--hairline)',
  background: 'var(--surface)',
  color: 'var(--fg)',
  fontSize: 14,
  width: '100%',
};
