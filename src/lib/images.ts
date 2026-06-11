import sharp from 'sharp';

// Server-side image ingestion. Every uploaded image — avatar or attachment —
// is decoded and re-encoded to JPEG before it touches storage. That gives us:
//
//   1. Format normalization: Samsung/iPhone cameras produce HEIC/WebP, which
//      browsers can't always render; the stored object is always image/jpeg.
//   2. Metadata stripping: re-encoding discards EXIF (GPS coordinates, device
//      serials, timestamps). Patient photos must never leak a home address.
//   3. Content validation: a buffer that survives a full decode is a real
//      image, which is a much stronger check than magic bytes alone.
//
// EXIF orientation is applied to the pixels (`.rotate()` with no args) before
// the metadata is dropped, so portrait photos don't end up sideways.

// Input types we accept. Output is always PROCESSED_IMAGE_MIME.
export const ALLOWED_IMAGE_INPUT_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/heic',
  'image/heif',
]);

export const PROCESSED_IMAGE_MIME = 'image/jpeg';
export const PROCESSED_IMAGE_EXT = 'jpg';

// User-facing (Spanish) message for files that declare an accepted image type
// but cannot actually be decoded — corrupt, truncated, or mislabeled.
export const IMAGE_PROCESSING_ERROR_MESSAGE =
  'No se pudo procesar la imagen. El archivo puede estar dañado o en un formato no compatible.';

export class ImageProcessingError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'ImageProcessingError';
  }
}

// ─── Magic-bytes validation ───────────────────────────────────────────────────
//
// Browsers derive `file.type` from the filename extension, so a renamed binary
// can pass a declared-MIME whitelist. This is the cheap first-line check; the
// sharp decode in processImageToJpeg is the authoritative one.

const JPEG_SIG = Buffer.from([0xff, 0xd8, 0xff]);
const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const RIFF_SIG = Buffer.from('RIFF');
const WEBP_FOURCC = Buffer.from('WEBP');
const FTYP_MARKER = Buffer.from('ftyp');

// ISO BMFF brands for HEIF-family containers. HEIC files from phones usually
// carry `heic` or `mif1`; AVIF uses `avif`/`avis`. We accept the union for any
// of the three declared MIMEs — distinguishing siblings here buys nothing,
// since the decoder validates the actual codec right after.
const HEIF_FAMILY_BRANDS = new Set([
  'heic',
  'heix',
  'heim',
  'heis',
  'hevc',
  'hevx',
  'hevm',
  'hevs',
  'heif',
  'mif1',
  'mif2',
  'msf1',
  'avif',
  'avis',
]);

function isHeifFamilyContainer(buffer: Buffer): boolean {
  // 4-byte box size + "ftyp" + 4-byte major brand = 12 bytes minimum.
  if (buffer.length < 12) return false;
  if (!buffer.subarray(4, 8).equals(FTYP_MARKER)) return false;
  return HEIF_FAMILY_BRANDS.has(buffer.subarray(8, 12).toString('ascii'));
}

export function imageMagicBytesMatch(buffer: Buffer, mime: string): boolean {
  switch (mime) {
    case 'image/jpeg':
    case 'image/jpg':
      return buffer.length >= JPEG_SIG.length && buffer.subarray(0, JPEG_SIG.length).equals(JPEG_SIG);
    case 'image/png':
      return buffer.length >= PNG_SIG.length && buffer.subarray(0, PNG_SIG.length).equals(PNG_SIG);
    case 'image/webp':
      // RIFF container: "RIFF" + 4-byte size + "WEBP" fourcc.
      return (
        buffer.length >= 12 &&
        buffer.subarray(0, 4).equals(RIFF_SIG) &&
        buffer.subarray(8, 12).equals(WEBP_FOURCC)
      );
    case 'image/avif':
    case 'image/heic':
    case 'image/heif':
      return isHeifFamilyContainer(buffer);
    default:
      return false;
  }
}

// ─── Re-encode to JPEG ────────────────────────────────────────────────────────

const JPEG_OPTIONS = { quality: 85, progressive: true, mozjpeg: true } as const;

// The prebuilt sharp/libvips npm binaries do NOT include the HEVC codec (it is
// patent-encumbered), so sharp alone cannot decode HEIC from Samsung/iPhone
// cameras — it throws "Support for this compression format has not been built
// in". heic-decode (libheif compiled to WASM with the libde265 HEVC decoder)
// covers that gap: it yields raw RGBA pixels, which carry no metadata, and
// libheif applies the container's rotation/mirror transforms during decode.
// Dynamic import so the WASM blob only loads when a HEIC actually arrives.
async function heicToJpeg(buffer: Buffer): Promise<Buffer> {
  const { default: decode } = await import('heic-decode');
  const { width, height, data } = await decode({ buffer });
  return sharp(Buffer.from(data), { raw: { width, height, channels: 4 } })
    .jpeg(JPEG_OPTIONS)
    .toBuffer();
}

/**
 * Decode an uploaded image and re-encode it as a clean JPEG: EXIF stripped,
 * orientation applied, quality 85. Throws ImageProcessingError if the buffer
 * is not a decodable image.
 *
 * @param declaredMime the MIME the client declared — used only to decide
 *   whether the HEIC fallback decoder applies when sharp can't decode.
 */
export async function processImageToJpeg(buffer: Buffer, declaredMime: string): Promise<Buffer> {
  try {
    // sharp first: handles JPEG/PNG/WebP/AVIF, and HEIC too on custom libvips
    // builds that include HEVC.
    return await sharp(buffer).rotate().jpeg(JPEG_OPTIONS).toBuffer();
  } catch (sharpErr) {
    if (declaredMime === 'image/heic' || declaredMime === 'image/heif') {
      try {
        return await heicToJpeg(buffer);
      } catch (heicErr) {
        throw new ImageProcessingError(IMAGE_PROCESSING_ERROR_MESSAGE, { cause: heicErr });
      }
    }
    throw new ImageProcessingError(IMAGE_PROCESSING_ERROR_MESSAGE, { cause: sharpErr });
  }
}
