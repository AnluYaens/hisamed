import { z } from 'zod';

// Whitelist of file types we accept for upload. MIME type is what the browser
// sends; extension is what we append to the storage key. NOTE: all image/*
// inputs are re-encoded to JPEG server-side (see src/lib/images.ts), so for
// images the extension below only feeds the client <input accept> attribute
// and display-name fallbacks — the stored object is always a .jpg.
export const ALLOWED_ATTACHMENT_MIME: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  // Phone-camera formats: Samsung defaults to HEIC (sometimes WebP), iPhone
  // to HEIC; AVIF for completeness.
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/heic': 'heic',
  'image/heif': 'heif',
  // Ultrasound clips. The browser usually labels MP4 as video/mp4 and MOV
  // (QuickTime, what iPhones produce) as video/quicktime — both are allowed
  // so a doctor can drop a clip straight from a phone or a desktop export.
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
};

// Per-file limits. Images and PDFs stay at 10 MB; video clips up to 50 MB
// (a few seconds of ultrasound at the typical bitrate). Routes pick the
// right cap based on the declared MIME so a malicious client can't send
// a 50 MB image and saturate storage.
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10 MB (default)
export const MAX_VIDEO_ATTACHMENT_BYTES = 50 * 1024 * 1024; // 50 MB

export function isVideoMime(mime: string): boolean {
  return mime === 'video/mp4' || mime === 'video/quicktime';
}

export function maxBytesForMime(mime: string): number {
  return isVideoMime(mime) ? MAX_VIDEO_ATTACHMENT_BYTES : MAX_ATTACHMENT_BYTES;
}

export const attachmentCategoryValues = [
  'lab_result',
  'imaging',
  'consent',
  'prescription',
  'procedure_photo',
  'ultrasound',
  'other',
] as const;

export const attachmentCategorySchema = z.enum(attachmentCategoryValues);

export const attachmentUploadMetadataSchema = z.object({
  patient_id: z.string().uuid('ID de paciente inválido'),
  clinical_note_id: z.string().uuid('ID de nota inválido').optional(),
  category: attachmentCategorySchema.optional(),
  description: z.string().max(500).optional(),
});

export type AttachmentCategory = (typeof attachmentCategoryValues)[number];
export type AttachmentUploadMetadata = z.infer<typeof attachmentUploadMetadataSchema>;
