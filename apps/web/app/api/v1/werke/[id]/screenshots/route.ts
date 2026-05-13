/**
 * POST + DELETE /api/v1/werke/:id/screenshots
 *
 * Werk-Screenshot-Upload + -Loeschen gemaess PRD §15.3 (Screenshot-Endpunkte)
 * und §8.3 (max 3 Screenshots).
 *
 * - POST: Multipart-FormData mit `file`. MIME image/jpeg|png|webp, max 5 MB raw.
 *   Sharp-Pipeline: resize 1600x1200 fit-inside, JPEG q85, EXIF strip
 *   (DSGVO §34 — keine GPS/Geraete-Metadaten). Production: Upload nach R2.
 *   Dev-Fallback (R2_*-Env leer): data:-URL mit verkleinerter Variante.
 * - DELETE: erwartet Body `{ url }` — Path-Params taugen nicht fuer ganze URLs.
 *   Entfernt URL aus `werk.screenshots`-Array. Im Produktionspfad zusaetzlich
 *   aus R2.
 *
 * Auth + Inhaber:innen-Check fuer beide Verben.
 */

import { eq } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';

import { db } from '@/lib/db';
import { werk } from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth/session';
import { rejectIfBadOrigin } from '@/lib/auth/csrf';
import { isR2Configured, uploadToR2, deleteFromR2, extractKeyFromUrl } from '@/lib/storage/r2';
import { resizeWerkScreenshot, makeDevPreview } from '@/lib/storage/image';

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB raw
const MAX_SCREENSHOTS = 3;
const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: Request, ctx: RouteContext): Promise<Response> {
  const originResp = rejectIfBadOrigin(req);
  if (originResp) return originResp;

  const sess = await getSessionFromRequest(req);
  if (!sess) {
    return Response.json(
      {
        error: {
          code: 'nicht_berechtigt',
          message: 'Du musst eingeloggt sein, um Screenshots hochzuladen.',
        },
      },
      { status: 401 },
    );
  }

  const { id } = await ctx.params;
  const rows = await db.select().from(werk).where(eq(werk.id, id)).limit(1);
  const current = rows[0];
  if (!current) {
    return Response.json({ fehler: 'nicht_gefunden' }, { status: 404 });
  }
  if (current.nutzerId !== sess.nutzerId) {
    return Response.json(
      {
        error: {
          code: 'nicht_berechtigt',
          message: 'Du kannst nur Screenshots zu eigenen Werken hochladen.',
        },
      },
      { status: 403 },
    );
  }

  if (current.screenshots.length >= MAX_SCREENSHOTS) {
    return Response.json(
      {
        error: {
          code: 'screenshot_limit',
          message: `Maximal ${MAX_SCREENSHOTS} Screenshots pro Werk.`,
        },
      },
      { status: 422 },
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return Response.json({ fehler: 'ungueltiger_body' }, { status: 400 });
  }

  const fileEntry = formData.get('file');
  if (!fileEntry || !(fileEntry instanceof Blob)) {
    return Response.json(
      {
        error: {
          code: 'datei_fehlt',
          message: 'Bitte eine Bild-Datei im Feld "file" hochladen.',
        },
      },
      { status: 422 },
    );
  }

  const mime = (fileEntry.type || '').toLowerCase();
  if (!ALLOWED_MIMES.has(mime)) {
    return Response.json(
      {
        error: {
          code: 'mime_invalid',
          message: `Nicht unterstuetzter Bild-Typ: ${mime || 'unbekannt'}. Erlaubt sind JPG, PNG oder WebP.`,
        },
      },
      { status: 422 },
    );
  }

  const arrayBuffer = await fileEntry.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_BYTES) {
    return Response.json(
      {
        error: {
          code: 'datei_zu_gross',
          message: `Datei ist zu gross (${arrayBuffer.byteLength} Bytes). Maximal 5 MB erlaubt.`,
        },
      },
      { status: 422 },
    );
  }

  const inputBuffer = Buffer.from(arrayBuffer);
  let resizedBuffer: Buffer;
  try {
    resizedBuffer = await resizeWerkScreenshot(inputBuffer);
  } catch (err) {
    return Response.json(
      {
        error: {
          code: 'bild_unverarbeitbar',
          message: 'Das Bild konnte nicht verarbeitet werden. Bitte ein anderes JPG/PNG/WebP probieren.',
          details: err instanceof Error ? err.message : undefined,
        },
      },
      { status: 422 },
    );
  }

  // Persistenz: R2 oder Dev-Fallback (data:-URL).
  let url: string;
  const suffix = createId();
  const key = `werke/${id}-${suffix}.jpg`;
  if (isR2Configured()) {
    url = await uploadToR2(key, resizedBuffer, 'image/jpeg');
  } else {
    // DEV: kein R2 konfiguriert — wir speichern eine verkleinerte
    //      data:-URL, damit der DB-/Cookie-Header nicht explodiert.
    const preview = await makeDevPreview(resizedBuffer);
    url = `data:image/jpeg;base64,${preview.toString('base64')}`;
  }

  const updated = await db
    .update(werk)
    .set({
      screenshots: [...current.screenshots, url],
      aktualisiertAm: new Date(),
    })
    .where(eq(werk.id, id))
    .returning({ screenshots: werk.screenshots });

  return Response.json(
    { screenshots: updated[0]?.screenshots ?? [] },
    { status: 200 },
  );
}

export async function DELETE(req: Request, ctx: RouteContext): Promise<Response> {
  const originResp = rejectIfBadOrigin(req);
  if (originResp) return originResp;

  const sess = await getSessionFromRequest(req);
  if (!sess) {
    return Response.json(
      {
        error: {
          code: 'nicht_berechtigt',
          message: 'Du musst eingeloggt sein, um Screenshots zu loeschen.',
        },
      },
      { status: 401 },
    );
  }

  const { id } = await ctx.params;
  const rows = await db.select().from(werk).where(eq(werk.id, id)).limit(1);
  const current = rows[0];
  if (!current) {
    return Response.json({ fehler: 'nicht_gefunden' }, { status: 404 });
  }
  if (current.nutzerId !== sess.nutzerId) {
    return Response.json(
      {
        error: {
          code: 'nicht_berechtigt',
          message: 'Du kannst nur Screenshots eigener Werke loeschen.',
        },
      },
      { status: 403 },
    );
  }

  let body: { url?: unknown };
  try {
    body = (await req.json()) as { url?: unknown };
  } catch {
    return Response.json({ fehler: 'ungueltiger_body' }, { status: 400 });
  }
  const urlToDelete = typeof body.url === 'string' ? body.url : null;
  if (!urlToDelete) {
    return Response.json(
      {
        error: {
          code: 'url_fehlt',
          message: 'Bitte die zu loeschende URL im Feld "url" mitsenden.',
        },
      },
      { status: 422 },
    );
  }

  if (!current.screenshots.includes(urlToDelete)) {
    return Response.json(
      {
        error: {
          code: 'screenshot_nicht_gefunden',
          message: 'Dieser Screenshot gehoert nicht zu diesem Werk.',
        },
      },
      { status: 404 },
    );
  }

  // R2 (best-effort): Original-Datei loeschen, wenn die URL aus dem R2-Bucket
  // kommt. data:-URLs (Dev-Fallback) haben keinen R2-Key — skip.
  if (isR2Configured()) {
    const key = extractKeyFromUrl(urlToDelete);
    if (key) {
      try {
        await deleteFromR2(key);
      } catch {
        // R2-Loeschen darf den DB-Loeschen-Erfolg nicht blockieren — die
        // Datei verwaist hoechstens. Eventuelle Aufraeumung waere ein
        // separater Cron-Job (siehe Sprint 12 / Speicher-Aufraeumung).
      }
    }
  }

  const nextScreenshots = current.screenshots.filter((s) => s !== urlToDelete);
  const updated = await db
    .update(werk)
    .set({ screenshots: nextScreenshots, aktualisiertAm: new Date() })
    .where(eq(werk.id, id))
    .returning({ screenshots: werk.screenshots });

  return Response.json(
    { screenshots: updated[0]?.screenshots ?? [] },
    { status: 200 },
  );
}
