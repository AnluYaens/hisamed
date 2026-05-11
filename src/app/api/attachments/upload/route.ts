import { NextResponse, type NextRequest } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { attachments, clinicalNotes, patients } from '@/lib/db/schema';
import { getSession } from '@/lib/auth/session';
import { auditLog, getClientIpFromHeaders } from '@/lib/audit';
import { generateId } from '@/lib/utils/generate-id';
import { deleteFile, uploadFile } from '@/lib/storage';
import {
  ALLOWED_ATTACHMENT_MIME,
  attachmentUploadMetadataSchema,
  isVideoMime,
  maxBytesForMime,
} from '@/lib/validators/attachment';

// Cap how large a request body we're willing to buffer. Lets the handler
// reject oversize uploads before pulling the full payload into memory.
export const maxDuration = 60;

function emptyToUndefined(v: FormDataEntryValue | null): string | undefined {
  if (v === null) return undefined;
  const s = typeof v === 'string' ? v : String(v);
  return s === '' ? undefined : s;
}

// File-signature ("magic bytes") check. Browsers derive `file.type` from the
// filename extension, so a `.exe` renamed to `.pdf` can pass the declared-MIME
// whitelist. We re-verify by looking at the first bytes of the buffer so the
// declared type has to match what's actually on disk.
const PDF_SIG = Buffer.from('%PDF-');
const JPEG_SIG = Buffer.from([0xff, 0xd8, 0xff]);
const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// MP4 / QuickTime use the ISO BMFF container: bytes 4..8 are the box type
// "ftyp" followed by a 4-byte brand. Both MP4 and MOV start with an `ftyp`
// box, so the check is: skip the first 4 bytes (box size) and look for the
// ASCII "ftyp" marker. We then ensure the brand is one we accept — a few
// reasonable values that cover the iPhone (`qt  `), generic MP4 (`isom`,
// `mp42`, `mp41`) and the iso-spec brands.
const FTYP_MARKER = Buffer.from('ftyp');
const ALLOWED_MP4_BRANDS = new Set([
  'isom',
  'iso2',
  'iso4',
  'iso5',
  'iso6',
  'mp41',
  'mp42',
  'avc1',
  'M4V ',
  'M4A ',
  'dash',
]);
const ALLOWED_MOV_BRANDS = new Set(['qt  ']);

function magicBytesMatch(buffer: Buffer, mime: string): boolean {
  if (mime === 'application/pdf') {
    return buffer.length >= PDF_SIG.length && buffer.subarray(0, PDF_SIG.length).equals(PDF_SIG);
  }
  if (mime === 'image/jpeg' || mime === 'image/jpg') {
    return buffer.length >= JPEG_SIG.length && buffer.subarray(0, JPEG_SIG.length).equals(JPEG_SIG);
  }
  if (mime === 'image/png') {
    return buffer.length >= PNG_SIG.length && buffer.subarray(0, PNG_SIG.length).equals(PNG_SIG);
  }
  if (mime === 'video/mp4' || mime === 'video/quicktime') {
    // Need at least the 4-byte box size + "ftyp" + 4-byte brand = 12 bytes
    if (buffer.length < 12) return false;
    if (!buffer.subarray(4, 8).equals(FTYP_MARKER)) return false;
    const brand = buffer.subarray(8, 12).toString('ascii');
    const allowed =
      mime === 'video/mp4' ? ALLOWED_MP4_BRANDS : ALLOWED_MOV_BRANDS;
    return allowed.has(brand);
  }
  return false;
}

function isInlineClinicalMedia(mime: string): boolean {
  return mime.startsWith('image/') || isVideoMime(mime);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Form data inválido' },
      { status: 400 },
    );
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json(
      { success: false, error: 'Archivo requerido en el campo "file"' },
      { status: 400 },
    );
  }

  const metaRaw = {
    patient_id: (formData.get('patient_id') as string | null) ?? '',
    clinical_note_id: emptyToUndefined(formData.get('clinical_note_id')),
    category: emptyToUndefined(formData.get('category')),
    description: emptyToUndefined(formData.get('description')),
  };

  const metaParsed = attachmentUploadMetadataSchema.safeParse(metaRaw);
  if (!metaParsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: 'Datos del adjunto inválidos',
        fieldErrors: metaParsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }
  const meta = metaParsed.data;

  if (file.size === 0) {
    return NextResponse.json(
      { success: false, error: 'El archivo está vacío' },
      { status: 400 },
    );
  }

  // Validate MIME type against whitelist. Browsers fill `file.type` from the
  // extension; we still rely on it as a first-line gate (the magic-bytes
  // check below catches spoofed extensions).
  const mime = file.type?.toLowerCase() ?? '';
  const ext = ALLOWED_ATTACHMENT_MIME[mime];
  if (!ext) {
    return NextResponse.json(
      {
        success: false,
        error: 'Tipo de archivo no permitido. Solo PDF, JPG, PNG, MP4 o MOV.',
      },
      { status: 415 },
    );
  }

  if (meta.category === 'ultrasound') {
    if (!meta.clinical_note_id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Los archivos de ecografía deben asociarse a una nota clínica',
        },
        { status: 400 },
      );
    }
    if (!isInlineClinicalMedia(mime)) {
      return NextResponse.json(
        {
          success: false,
          error: 'La ecografía solo permite imágenes o videos',
        },
        { status: 415 },
      );
    }
  }

  // Size limit is MIME-dependent: video allows up to 50 MB (a short
  // ultrasound clip), everything else is capped at 10 MB. `file.size` is
  // authoritative for the request; we re-check buffer length further down
  // to guard against inconsistent client reporting.
  const maxBytes = maxBytesForMime(mime);
  if (file.size > maxBytes) {
    const mb = Math.round(maxBytes / (1024 * 1024));
    return NextResponse.json(
      { success: false, error: `El archivo excede el tamaño máximo de ${mb}MB` },
      { status: 413 },
    );
  }

  // Clinic-scoped patient check. Prevents uploading a file against a patient
  // that belongs to another clinic by tampering with the form fields.
  const patientRow = await db
    .select({ id: patients.id })
    .from(patients)
    .where(and(eq(patients.id, meta.patient_id), eq(patients.clinicId, session.clinicId)))
    .limit(1);
  if (patientRow.length === 0) {
    return NextResponse.json(
      { success: false, error: 'Paciente no encontrado' },
      { status: 404 },
    );
  }

  // If the client linked the upload to a clinical note, that note must belong
  // to the same patient and clinic. Keeps the 1-patient → N-attachments graph
  // consistent even when the upload comes from the note editor.
  if (meta.clinical_note_id) {
    const noteRow = await db
      .select({
        id: clinicalNotes.id,
        authorId: clinicalNotes.authorId,
        isSigned: clinicalNotes.isSigned,
      })
      .from(clinicalNotes)
      .innerJoin(patients, eq(clinicalNotes.patientId, patients.id))
      .where(
        and(
          eq(clinicalNotes.id, meta.clinical_note_id),
          eq(clinicalNotes.patientId, meta.patient_id),
          eq(patients.clinicId, session.clinicId),
        ),
      )
      .limit(1);
    if (noteRow.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Nota clínica no encontrada' },
        { status: 404 },
      );
    }
    const note = noteRow[0];
    if (note.isSigned) {
      return NextResponse.json(
        {
          success: false,
          error:
            'No se pueden subir adjuntos a una nota firmada. Las notas firmadas son inmutables.',
        },
        { status: 409 },
      );
    }
    if (session.role !== 'doctor' || note.authorId !== session.userId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Solo el médico autor puede adjuntar archivos a esta nota',
        },
        { status: 403 },
      );
    }
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.byteLength > maxBytes) {
    const mb = Math.round(maxBytes / (1024 * 1024));
    return NextResponse.json(
      { success: false, error: `El archivo excede el tamaño máximo de ${mb}MB` },
      { status: 413 },
    );
  }

  // Content check: the file's magic bytes must match the declared MIME.
  // Catches a spoofed Content-Type on an otherwise-accepted extension.
  if (!magicBytesMatch(buffer, mime)) {
    return NextResponse.json(
      {
        success: false,
        error: 'El contenido del archivo no coincide con el tipo declarado',
      },
      { status: 415 },
    );
  }

  const attachmentId = generateId();
  const storageKey = `${generateId()}.${ext}`;

  try {
    await uploadFile(buffer, storageKey, mime);
  } catch (err) {
    console.error('[attachments] upload to storage failed', err);
    return NextResponse.json(
      { success: false, error: 'No se pudo subir el archivo' },
      { status: 500 },
    );
  }

  // Only use the file name for display; never for the storage key. PRD §1:
  // storage_key is UUID + extension.
  const displayName = file.name || `archivo.${ext}`;

  const insertValues = {
    id: attachmentId,
    patientId: meta.patient_id,
    clinicalNoteId: meta.clinical_note_id ?? null,
    uploadedBy: session.userId,
    fileName: displayName.slice(0, 255),
    storageKey,
    fileType: mime,
    fileSizeBytes: buffer.byteLength,
    category: meta.category ?? 'other',
    description: meta.description ?? null,
  };

  let created;
  if (meta.clinical_note_id) {
    created = await db.transaction(async (tx) => {
      const lockedNote = await tx
        .select({ id: clinicalNotes.id })
        .from(clinicalNotes)
        .where(
          and(
            eq(clinicalNotes.id, meta.clinical_note_id!),
            eq(clinicalNotes.patientId, meta.patient_id),
            eq(clinicalNotes.authorId, session.userId),
            eq(clinicalNotes.isSigned, false),
          ),
        )
        .for('update')
        .limit(1);

      if (lockedNote.length === 0) return null;

      const [row] = await tx.insert(attachments).values(insertValues).returning();
      return row;
    });

    if (!created) {
      try {
        await deleteFile(storageKey);
      } catch (err) {
        console.error('[attachments] cleanup failed after immutable-note race', {
          storageKey,
          error: err instanceof Error ? err.message : String(err),
        });
      }
      return NextResponse.json(
        {
          success: false,
          error:
            'La nota fue firmada antes de completar la subida. Recarga la página.',
        },
        { status: 409 },
      );
    }
  } else {
    [created] = await db.insert(attachments).values(insertValues).returning();
  }

  await auditLog({
    clinicId: session.clinicId,
    userId: session.userId,
    action: 'CREATE',
    resourceType: 'attachment',
    resourceId: attachmentId,
    details: {
      patientId: meta.patient_id,
      clinicalNoteId: meta.clinical_note_id ?? null,
      category: created.category,
      fileType: mime,
      fileSizeBytes: buffer.byteLength,
    },
    ipAddress: await getClientIpFromHeaders(),
  });

  return NextResponse.json(
    {
      success: true,
      data: {
        id: created.id,
        patientId: created.patientId,
        clinicalNoteId: created.clinicalNoteId,
        fileName: created.fileName,
        fileType: created.fileType,
        fileSizeBytes: created.fileSizeBytes,
        category: created.category,
        description: created.description,
        uploadedAt: created.uploadedAt,
      },
    },
    { status: 201 },
  );
}
