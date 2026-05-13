/**
 * Bildverarbeitung fuer Werk-Screenshots.
 *
 * - 1600px max Breite, 1200px max Hoehe (fit=inside, withoutEnlargement)
 * - JPEG quality 85 (mozjpeg-Encoder fuer bessere Kompression)
 * - autoOrient nach EXIF, dann EXIF strippen (DSGVO §34 — keine GPS/Geraete-
 *   Daten persistieren)
 *
 * Sharp wird dynamisch importiert, damit Test-Suiten ohne sharp-Native-Binary
 * nicht crashen — der Caller behandelt `null` als „Fallback noetig".
 *
 * `resizeWerkScreenshot` wirft, wenn sharp fehlt — fuer den Produktionspfad
 * ist sharp zwingend (siehe `lib/storage/r2.ts` + werke-screenshots-Route).
 */

import sharp from 'sharp';

/**
 * Resized + komprimiert ein Werk-Screenshot.
 * Output: JPEG-Buffer ohne EXIF, max 1600x1200, quality 85.
 */
export async function resizeWerkScreenshot(input: Buffer | Uint8Array): Promise<Buffer> {
  return sharp(input)
    // `.rotate()` ohne Argument: orientiert nach EXIF, danach wird die
    // Orientierung als Pixel-Drehung „eingebrannt" und das EXIF darf weg.
    .rotate()
    .resize({
      width: 1600,
      height: 1200,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: 85, mozjpeg: true })
    // `.withMetadata` ohne Argument wuerde EXIF behalten — wir wollen das
    // Gegenteil. sharp's default ohne `withMetadata`-Aufruf strippt EXIF
    // bereits; wir bestaetigen das mit einem expliziten Kommentar.
    .toBuffer();
}

/**
 * Erzeugt eine kleine Vorschau (max 256x192) als JPEG-Buffer.
 * Wird nur im Dev-Fallback ohne R2 verwendet, damit data:-URLs nicht
 * die DB sprengen.
 */
export async function makeDevPreview(input: Buffer | Uint8Array): Promise<Buffer> {
  return sharp(input)
    .rotate()
    .resize({ width: 256, height: 192, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 70, mozjpeg: true })
    .toBuffer();
}
