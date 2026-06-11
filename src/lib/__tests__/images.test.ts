import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import {
  ALLOWED_IMAGE_INPUT_MIME,
  IMAGE_PROCESSING_ERROR_MESSAGE,
  ImageProcessingError,
  PROCESSED_IMAGE_EXT,
  PROCESSED_IMAGE_MIME,
  imageMagicBytesMatch,
  processImageToJpeg,
} from '@/lib/images';

// Real HEVC-coded HEIC (the format Samsung/iPhone cameras produce).
// See tests/fixtures/README.md for provenance.
const HEIC_FIXTURE = readFileSync(
  path.resolve(__dirname, '../../../tests/fixtures/sample.heic'),
);

const JPEG_SIG = Buffer.from([0xff, 0xd8, 0xff]);

function isJpeg(buffer: Buffer): boolean {
  return buffer.subarray(0, JPEG_SIG.length).equals(JPEG_SIG);
}

function solidImage(width = 16, height = 16) {
  return sharp({
    create: { width, height, channels: 3, background: { r: 120, g: 40, b: 200 } },
  });
}

describe('imageMagicBytesMatch', () => {
  it('accepts real signatures for every allowed input type', async () => {
    const png = await solidImage().png().toBuffer();
    const jpeg = await solidImage().jpeg().toBuffer();
    const webp = await solidImage().webp().toBuffer();
    const avif = await solidImage().avif().toBuffer();

    expect(imageMagicBytesMatch(png, 'image/png')).toBe(true);
    expect(imageMagicBytesMatch(jpeg, 'image/jpeg')).toBe(true);
    expect(imageMagicBytesMatch(jpeg, 'image/jpg')).toBe(true);
    expect(imageMagicBytesMatch(webp, 'image/webp')).toBe(true);
    expect(imageMagicBytesMatch(avif, 'image/avif')).toBe(true);
    expect(imageMagicBytesMatch(HEIC_FIXTURE, 'image/heic')).toBe(true);
    expect(imageMagicBytesMatch(HEIC_FIXTURE, 'image/heif')).toBe(true);
  });

  it('rejects content that does not match the declared type', async () => {
    const png = await solidImage().png().toBuffer();

    expect(imageMagicBytesMatch(png, 'image/jpeg')).toBe(false);
    expect(imageMagicBytesMatch(png, 'image/webp')).toBe(false);
    expect(imageMagicBytesMatch(png, 'image/heic')).toBe(false);
    expect(imageMagicBytesMatch(Buffer.from('MZ\x90\x00 not an image'), 'image/png')).toBe(false);
    expect(imageMagicBytesMatch(Buffer.alloc(0), 'image/jpeg')).toBe(false);
  });

  it('rejects ISO BMFF containers with non-HEIF brands (e.g. MP4)', () => {
    // "ftyp" + "isom": a video container, not an image.
    const mp4Header = Buffer.concat([
      Buffer.from([0x00, 0x00, 0x00, 0x18]),
      Buffer.from('ftypisom'),
      Buffer.alloc(8),
    ]);
    expect(imageMagicBytesMatch(mp4Header, 'image/heic')).toBe(false);
    expect(imageMagicBytesMatch(mp4Header, 'image/avif')).toBe(false);
  });

  it('rejects MIME types outside the whitelist', () => {
    expect(imageMagicBytesMatch(JPEG_SIG, 'image/gif')).toBe(false);
    expect(ALLOWED_IMAGE_INPUT_MIME.has('image/gif')).toBe(false);
  });
});

describe('processImageToJpeg', () => {
  it('re-encodes PNG to JPEG', async () => {
    const png = await solidImage().png().toBuffer();
    const out = await processImageToJpeg(png, 'image/png');

    expect(isJpeg(out)).toBe(true);
    const meta = await sharp(out).metadata();
    expect(meta.format).toBe('jpeg');
    expect(meta.width).toBe(16);
    expect(meta.height).toBe(16);
  });

  it('re-encodes WebP to JPEG', async () => {
    const webp = await solidImage().webp().toBuffer();
    const out = await processImageToJpeg(webp, 'image/webp');

    expect(isJpeg(out)).toBe(true);
    expect((await sharp(out).metadata()).format).toBe('jpeg');
  });

  it('re-encodes AVIF to JPEG', async () => {
    const avif = await solidImage().avif().toBuffer();
    const out = await processImageToJpeg(avif, 'image/avif');

    expect(isJpeg(out)).toBe(true);
    expect((await sharp(out).metadata()).format).toBe('jpeg');
  });

  it('re-encodes HEVC-coded HEIC to JPEG via the WASM fallback decoder', async () => {
    const out = await processImageToJpeg(HEIC_FIXTURE, 'image/heic');

    expect(isJpeg(out)).toBe(true);
    const meta = await sharp(out).metadata();
    expect(meta.format).toBe('jpeg');
    // Known dimensions of the fixture.
    expect(meta.width).toBe(451);
    expect(meta.height).toBe(461);
    expect(meta.exif).toBeUndefined();
  });

  it('strips EXIF metadata, including GPS coordinates', async () => {
    const withGps = await solidImage()
      .jpeg()
      .withExif({
        IFD0: { Make: 'samsung', Model: 'SM-S921B', Software: 'leak-test' },
        // IFD3 is the GPS IFD: coordinates of a home address must not survive.
        IFD3: {
          GPSLatitudeRef: 'N',
          GPSLatitude: '10/1 30/1 0/1',
          GPSLongitudeRef: 'W',
          GPSLongitude: '66/1 55/1 0/1',
        },
      })
      .toBuffer();
    expect((await sharp(withGps).metadata()).exif).toBeDefined();

    const out = await processImageToJpeg(withGps, 'image/jpeg');

    const meta = await sharp(out).metadata();
    expect(meta.exif).toBeUndefined();
    // Belt and braces: no EXIF tag content anywhere in the output bytes.
    expect(out.includes(Buffer.from('SM-S921B'))).toBe(false);
    expect(out.includes(Buffer.from('leak-test'))).toBe(false);
  });

  it('applies EXIF orientation to the pixels before stripping it', async () => {
    // Orientation 6 = rotate 90° CW. A 32x16 source must come out 16x32.
    const rotated = await sharp({
      create: { width: 32, height: 16, channels: 3, background: { r: 0, g: 0, b: 0 } },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();

    const out = await processImageToJpeg(rotated, 'image/jpeg');

    const meta = await sharp(out).metadata();
    expect(meta.width).toBe(16);
    expect(meta.height).toBe(32);
    expect(meta.orientation).toBeUndefined();
  });

  it('rejects undecodable input with a user-friendly error', async () => {
    // Valid JPEG magic bytes, garbage body — passes the cheap check, fails decode.
    const corrupt = Buffer.concat([JPEG_SIG, Buffer.from('definitely not scan data')]);

    await expect(processImageToJpeg(corrupt, 'image/jpeg')).rejects.toThrow(ImageProcessingError);
    await expect(processImageToJpeg(corrupt, 'image/jpeg')).rejects.toThrow(
      IMAGE_PROCESSING_ERROR_MESSAGE,
    );
  });

  it('rejects corrupt HEIC (fallback decoder cannot decode it either)', async () => {
    const corruptHeic = Buffer.concat([
      Buffer.from([0x00, 0x00, 0x00, 0x18]),
      Buffer.from('ftypheic'),
      Buffer.from('garbage payload that is not HEVC'),
    ]);

    await expect(processImageToJpeg(corruptHeic, 'image/heic')).rejects.toThrow(
      ImageProcessingError,
    );
  });
});

describe('processed-output constants', () => {
  it('stored objects are always JPEG with a .jpg key', () => {
    expect(PROCESSED_IMAGE_MIME).toBe('image/jpeg');
    expect(PROCESSED_IMAGE_EXT).toBe('jpg');
  });
});
