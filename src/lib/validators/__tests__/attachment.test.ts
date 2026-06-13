import { describe, expect, it } from 'vitest';
import { ALLOWED_IMAGE_MIMES, ALLOWED_ATTACHMENT_MIME } from '../attachment';

describe('ALLOWED_IMAGE_MIMES', () => {
  it('includes the phone-camera formats so HEIC/WebP/AVIF reach the server', () => {
    // Regression guard: avatar uploaders used to hardcode JPEG/PNG only,
    // which pre-rejected Samsung HEIC files in the browser before upload.
    for (const mime of [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/avif',
      'image/heic',
      'image/heif',
    ]) {
      expect(ALLOWED_IMAGE_MIMES[mime]).toBeDefined();
    }
  });

  it('contains only image/* types (no documents or video)', () => {
    for (const mime of Object.keys(ALLOWED_IMAGE_MIMES)) {
      expect(mime.startsWith('image/')).toBe(true);
    }
  });
});

describe('ALLOWED_ATTACHMENT_MIME', () => {
  it('is a superset of the shared image whitelist', () => {
    for (const [mime, ext] of Object.entries(ALLOWED_IMAGE_MIMES)) {
      expect(ALLOWED_ATTACHMENT_MIME[mime]).toBe(ext);
    }
  });

  it('also accepts PDF and ultrasound video clips', () => {
    expect(ALLOWED_ATTACHMENT_MIME['application/pdf']).toBe('pdf');
    expect(ALLOWED_ATTACHMENT_MIME['video/mp4']).toBe('mp4');
    expect(ALLOWED_ATTACHMENT_MIME['video/quicktime']).toBe('mov');
  });
});
