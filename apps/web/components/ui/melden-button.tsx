'use client';

/**
 * Melden-Button (Client Component) — generischer Inhalt-Melden-Knopf.
 *
 * Quelle: PRD §27 (Workflow + SLA), §F-503 (Melden-Knopf an allen
 * Nutzerinhalten).
 *
 * - Rendert einen kleinen Text-Button. Klick oeffnet ein Modal mit
 *   Kategorie-Auswahl + optionaler Beschreibung.
 * - Sendet POST /api/v1/meldungen — anonym OK (kein Auth-Header noetig).
 * - Bei Erfolg: Modal schliesst, Inline-Hinweis "Danke fuer deine Meldung."
 * - Bei 422/Origin-Fehler: deutscher Fehler-String im Modal.
 *
 * Wir benutzen kein externes Modal-Lib — `<dialog>` Element via Refs reicht.
 * Origin-Header wird vom Browser bei `fetch(...)` automatisch gesetzt, daher
 * funktioniert der CSRF-Check serverseitig (rejectIfBadOrigin).
 */

import { useId, useRef, useState } from 'react';

import type {
  MeldungReferenzTyp,
  MeldungKategorie,
} from '@/lib/db/schema/enums';

const KATEGORIE_LABELS: Record<MeldungKategorie, string> = {
  cold_outreach: 'Kalt-Akquise / Cold-Outreach',
  sales_sprech: 'Sales-Sprech / Werbung',
  spam: 'Spam',
  beleidigung: 'Beleidigung / Beleidigender Ton',
  sonstiges: 'Sonstiges',
};

const KATEGORIE_ORDER: MeldungKategorie[] = [
  'cold_outreach',
  'sales_sprech',
  'spam',
  'beleidigung',
  'sonstiges',
];

export interface MeldenButtonProps {
  referenzTyp: MeldungReferenzTyp;
  referenzId: string;
  /**
   * Optionaler Variant fuer die Button-Optik. `inline` ist klein und unauffaellig
   * (Footer-Stil), `button` ist als sichtbarer Button gestylt.
   * Default `inline`.
   */
  variant?: 'inline' | 'button';
  /** Optional: Anzeigetext des Buttons (Default: "Melden"). */
  label?: string;
}

type ModalStatus = 'idle' | 'submitting' | 'ok' | 'error';

export default function MeldenButton({
  referenzTyp,
  referenzId,
  variant = 'inline',
  label = 'Melden',
}: MeldenButtonProps) {
  const [offen, setOffen] = useState(false);
  const [kategorie, setKategorie] = useState<MeldungKategorie>('spam');
  const [beschreibung, setBeschreibung] = useState('');
  const [status, setStatus] = useState<ModalStatus>('idle');
  const [fehler, setFehler] = useState<string | null>(null);

  const titelId = useId();
  const beschreibungId = useId();
  const formRef = useRef<HTMLFormElement | null>(null);

  function reset() {
    setKategorie('spam');
    setBeschreibung('');
    setStatus('idle');
    setFehler(null);
  }

  function schliessen() {
    setOffen(false);
    // erst nach Animation/Verzoegerung reset, damit der Erfolgs-Hinweis kurz stehen bleibt
    setTimeout(reset, 200);
  }

  async function absenden(ev: React.FormEvent) {
    ev.preventDefault();
    if (status === 'submitting') return;
    setStatus('submitting');
    setFehler(null);
    try {
      const res = await fetch('/api/v1/meldungen', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          referenz_typ: referenzTyp,
          referenz_id: referenzId,
          kategorie,
          beschreibung: beschreibung.trim() === '' ? null : beschreibung.trim(),
        }),
      });
      if (res.status === 201) {
        setStatus('ok');
        return;
      }
      if (res.status === 422) {
        const data = (await res.json().catch(() => null)) as
          | { details?: Record<string, string[]> }
          | null;
        const ersterFehler =
          data?.details && Object.values(data.details).flat()[0];
        setFehler(
          ersterFehler ??
            'Die Eingaben sind ungueltig. Bitte pruefe Kategorie und Beschreibung.',
        );
        setStatus('error');
        return;
      }
      if (res.status === 429) {
        setFehler(
          'Du hast zu viele Meldungen in kurzer Zeit abgegeben. Bitte warte ein paar Minuten.',
        );
        setStatus('error');
        return;
      }
      setFehler(
        'Das Absenden der Meldung ist fehlgeschlagen. Bitte versuche es noch einmal.',
      );
      setStatus('error');
    } catch {
      setFehler(
        'Verbindungsfehler — die Meldung konnte nicht gesendet werden. Bitte spaeter erneut versuchen.',
      );
      setStatus('error');
    }
  }

  const buttonClassname =
    variant === 'button' ? 'button secondary' : 'melden-link';
  const inlineStyle: React.CSSProperties =
    variant === 'inline'
      ? {
          background: 'none',
          border: 'none',
          padding: 0,
          color: 'var(--muted)',
          fontSize: 13,
          textDecoration: 'underline',
          cursor: 'pointer',
        }
      : {};

  return (
    <>
      <button
        type="button"
        className={buttonClassname}
        style={inlineStyle}
        onClick={() => setOffen(true)}
        data-melden-button
        data-referenz-typ={referenzTyp}
        data-referenz-id={referenzId}
      >
        {label}
      </button>

      {offen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titelId}
          aria-describedby={beschreibungId}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 9999,
            padding: 16,
          }}
          onClick={(ev) => {
            // Hintergrund-Klick schliesst Modal — Form-Klicks NICHT.
            if (ev.target === ev.currentTarget) schliessen();
          }}
        >
          <div
            style={{
              background: 'var(--surface, white)',
              color: 'var(--fg, #111)',
              borderRadius: 14,
              maxWidth: 480,
              width: '100%',
              padding: 24,
              boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
            }}
          >
            <h2 id={titelId} style={{ margin: 0, fontSize: 22 }}>
              Inhalt melden
            </h2>
            <p
              id={beschreibungId}
              style={{ margin: '8px 0 16px', color: 'var(--muted, #555)' }}
            >
              Hilf uns, die Werkstatt sauber zu halten. Deine Meldung geht an die
              Kurator:in. Anonyme Meldungen sind moeglich.
            </p>

            {status === 'ok' ? (
              <div>
                <p style={{ margin: '12px 0' }}>
                  Danke fuer deine Meldung. Die Kurator:in pruest sie zeitnah
                  (SLA 48 Stunden).
                </p>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    marginTop: 16,
                  }}
                >
                  <button
                    type="button"
                    className="button primary"
                    onClick={schliessen}
                  >
                    Schliessen
                  </button>
                </div>
              </div>
            ) : (
              <form ref={formRef} onSubmit={absenden}>
                <fieldset
                  style={{ border: 'none', padding: 0, margin: '0 0 12px' }}
                  disabled={status === 'submitting'}
                >
                  <legend
                    style={{
                      padding: 0,
                      fontWeight: 600,
                      marginBottom: 8,
                    }}
                  >
                    Kategorie
                  </legend>
                  {KATEGORIE_ORDER.map((k) => (
                    <label
                      key={k}
                      style={{
                        display: 'flex',
                        gap: 8,
                        alignItems: 'center',
                        padding: '4px 0',
                      }}
                    >
                      <input
                        type="radio"
                        name="kategorie"
                        value={k}
                        checked={kategorie === k}
                        onChange={() => setKategorie(k)}
                      />
                      <span>{KATEGORIE_LABELS[k]}</span>
                    </label>
                  ))}
                </fieldset>

                <label
                  style={{
                    display: 'block',
                    fontWeight: 600,
                    marginBottom: 4,
                  }}
                >
                  Beschreibung{' '}
                  <span
                    style={{
                      color: 'var(--muted, #777)',
                      fontWeight: 400,
                    }}
                  >
                    (optional)
                  </span>
                </label>
                <textarea
                  value={beschreibung}
                  onChange={(e) => setBeschreibung(e.target.value)}
                  rows={4}
                  maxLength={2000}
                  disabled={status === 'submitting'}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: 8,
                    fontFamily: 'inherit',
                    fontSize: 14,
                    border: '1px solid var(--hairline-color, #ddd)',
                    borderRadius: 8,
                  }}
                  placeholder="Was ist konkret problematisch?"
                />

                {fehler ? (
                  <p
                    role="alert"
                    style={{
                      margin: '12px 0 0',
                      color: 'var(--fehler, #b00020)',
                      fontSize: 14,
                    }}
                  >
                    {fehler}
                  </p>
                ) : null}

                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    justifyContent: 'flex-end',
                    marginTop: 20,
                  }}
                >
                  <button
                    type="button"
                    className="button"
                    onClick={schliessen}
                    disabled={status === 'submitting'}
                  >
                    Abbrechen
                  </button>
                  <button
                    type="submit"
                    className="button primary"
                    disabled={status === 'submitting'}
                  >
                    {status === 'submitting' ? 'Sende…' : 'Meldung absenden'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
