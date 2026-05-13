/**
 * Unit-Tests fuer `resizeWerkScreenshot`.
 *
 * DSGVO §34 verlangt Datenminimierung — EXIF-Daten (insbesondere GPS) duerfen
 * nicht persistiert werden. Wir bauen synthetisch ein Bild mit EXIF-GPS-Werten,
 * jagen es durch die Resize-Pipeline und verifizieren, dass die Output-EXIF
 * leer ist.
 */

import { describe, expect, it } from 'vitest';
import sharp from 'sharp';

import { resizeWerkScreenshot } from '@/lib/storage/image';

/**
 * Erstellt ein synthetisches JPEG mit GPS-EXIF-Daten.
 * sharp's `.withExif()` ist ab v0.32 verfuegbar und erzeugt valide EXIF-Blocks.
 */
async function makeJpegMitGpsExif(): Promise<Buffer> {
  return sharp({
    create: {
      width: 200,
      height: 150,
      channels: 3,
      background: { r: 10, g: 20, b: 30 },
    },
  })
    // sharp's TS-Typen erlauben nur IFD0..IFD3, der C-Code akzeptiert aber
    // auch GPS-Felder. Wir casten, um beides nutzen zu koennen — die Pipeline
    // soll alle EXIF-Felder strippen, egal aus welchem IFD.
    .withExif({
      IFD0: {
        Make: 'Werkzirkel-Test',
        Model: 'Synthetic-Camera-9000',
        Software: 'sharp',
      },
      GPS: {
        // 53.5511° N, 9.9937° E ≈ Hamburg
        GPSLatitudeRef: 'N',
        GPSLatitude: '53/1 33/1 4/1',
        GPSLongitudeRef: 'E',
        GPSLongitude: '9/1 59/1 37/1',
      },
    } as unknown as Parameters<sharp.Sharp['withExif']>[0])
    .jpeg({ quality: 90 })
    .toBuffer();
}

describe('resizeWerkScreenshot', () => {
  it('strippt EXIF (GPS + Make + Model) aus dem Output', async () => {
    const input = await makeJpegMitGpsExif();

    // Sanity-Check: das Input-Bild MUSS GPS-Daten haben, sonst testen wir nichts.
    const inputMeta = await sharp(input).metadata();
    expect(inputMeta.exif).toBeDefined();
    expect(inputMeta.exif?.length).toBeGreaterThan(0);

    const output = await resizeWerkScreenshot(input);

    // Output: kein EXIF-Block mehr.
    const outMeta = await sharp(output).metadata();
    // sharp strippt EXIF-by-default; wir verifizieren, dass das auch durch
    // unsere Pipeline durchkommt.
    expect(outMeta.exif).toBeUndefined();
  });

  it('respektiert die maximale Breite 1600 + Hoehe 1200 (fit=inside)', async () => {
    const oversize = await sharp({
      create: {
        width: 3200,
        height: 2400,
        channels: 3,
        background: { r: 0, g: 128, b: 255 },
      },
    })
      .jpeg()
      .toBuffer();

    const output = await resizeWerkScreenshot(oversize);
    const meta = await sharp(output).metadata();
    expect(meta.format).toBe('jpeg');
    expect(meta.width).toBeLessThanOrEqual(1600);
    expect(meta.height).toBeLessThanOrEqual(1200);
  });

  it('vergroessert nicht (withoutEnlargement)', async () => {
    const tiny = await sharp({
      create: {
        width: 320,
        height: 240,
        channels: 3,
        background: { r: 250, g: 250, b: 250 },
      },
    })
      .jpeg()
      .toBuffer();

    const output = await resizeWerkScreenshot(tiny);
    const meta = await sharp(output).metadata();
    expect(meta.width).toBe(320);
    expect(meta.height).toBe(240);
  });
});
