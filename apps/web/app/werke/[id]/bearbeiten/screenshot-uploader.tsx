'use client';

/**
 * Screenshot-Uploader (Client Component).
 *
 * Wir nutzen `'use client'` weil:
 * - File-Upload mit FormData laeuft direkt vom Browser an die JSON-API.
 * - State (`screenshots[]`) wechselt nach Upload/Delete ohne Full-Reload.
 *
 * Limit-Logik:
 * - max 3 Screenshots (clientseitig disabled), API enforced unabhaengig.
 *
 * Fehler-Anzeige: ein einfacher String unter dem Input. Deutsche Meldungen.
 */

import { useState, useRef } from 'react';

interface Props {
  werkId: string;
  initialScreenshots: string[];
  texte: {
    label: string;
    keine: string;
    maxErreicht: string;
    hochladen: string;
    laeuft: string;
    loeschen: string;
  };
}

const MAX_SCREENSHOTS = 3;

export default function ScreenshotUploader({
  werkId,
  initialScreenshots,
  texte,
}: Props) {
  const [screenshots, setScreenshots] = useState<string[]>(initialScreenshots);
  const [uploading, setUploading] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const limitErreicht = screenshots.length >= MAX_SCREENSHOTS;

  async function handleUpload(file: File): Promise<void> {
    setFehler(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`/api/v1/werke/${werkId}/screenshots`, {
        method: 'POST',
        body: fd,
        credentials: 'same-origin',
      });
      if (!res.ok) {
        // Versuche deutsche Message aus dem Body zu ziehen.
        let msg = `Upload fehlgeschlagen (Status ${res.status}).`;
        try {
          const data = (await res.json()) as {
            error?: { message?: string };
            fehler?: string;
          };
          if (data.error?.message) msg = data.error.message;
          else if (data.fehler) msg = data.fehler;
        } catch {
          /* ignore JSON-Parse-Fehler */
        }
        setFehler(msg);
        return;
      }
      const data = (await res.json()) as { screenshots: string[] };
      setScreenshots(data.screenshots);
      if (inputRef.current) inputRef.current.value = '';
    } catch (err) {
      setFehler(err instanceof Error ? err.message : 'Upload fehlgeschlagen.');
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(url: string): Promise<void> {
    setFehler(null);
    try {
      const res = await fetch(`/api/v1/werke/${werkId}/screenshots`, {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url }),
        credentials: 'same-origin',
      });
      if (!res.ok) {
        let msg = `Löschen fehlgeschlagen (Status ${res.status}).`;
        try {
          const data = (await res.json()) as {
            error?: { message?: string };
            fehler?: string;
          };
          if (data.error?.message) msg = data.error.message;
          else if (data.fehler) msg = data.fehler;
        } catch {
          /* ignore */
        }
        setFehler(msg);
        return;
      }
      const data = (await res.json()) as { screenshots: string[] };
      setScreenshots(data.screenshots);
    } catch (err) {
      setFehler(err instanceof Error ? err.message : 'Löschen fehlgeschlagen.');
    }
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <span style={{ fontWeight: 600 }}>{texte.label}</span>

      {screenshots.length === 0 ? (
        <p style={{ margin: 0, color: 'var(--muted)' }}>{texte.keine}</p>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            gap: 12,
          }}
        >
          {screenshots.map((url, i) => (
            <div
              key={url}
              style={{
                position: 'relative',
                border: 'var(--hairline)',
                borderRadius: 10,
                overflow: 'hidden',
                background: 'var(--surface)',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`Screenshot ${i + 1}`}
                style={{ width: '100%', height: 'auto', display: 'block' }}
              />
              <button
                type="button"
                onClick={() => handleDelete(url)}
                aria-label={texte.loeschen}
                style={{
                  position: 'absolute',
                  top: 6,
                  right: 6,
                  background: 'rgba(0,0,0,0.7)',
                  color: 'white',
                  border: 0,
                  borderRadius: '50%',
                  width: 28,
                  height: 28,
                  cursor: 'pointer',
                  fontSize: 16,
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gap: 6 }}>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={limitErreicht || uploading}
          onChange={(e) => {
            const f = e.currentTarget.files?.[0];
            if (f) void handleUpload(f);
          }}
          aria-label={texte.hochladen}
        />
        {limitErreicht ? (
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13 }}>
            {texte.maxErreicht}
          </p>
        ) : null}
        {uploading ? (
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13 }}>
            {texte.laeuft}
          </p>
        ) : null}
        {fehler ? (
          <p
            role="alert"
            style={{ margin: 0, color: '#5a1a1a', fontSize: 13 }}
          >
            {fehler}
          </p>
        ) : null}
      </div>
    </div>
  );
}
