'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { patients } from '@/lib/db/schema';
import { requireSession } from '@/lib/auth/session';
import { isDemoSession, demoWriteBlocked } from '@/lib/auth/demo';
import { auditLog, getClientIpFromHeaders } from '@/lib/audit';
import { generateId } from '@/lib/utils/generate-id';
import { deleteFile, uploadFile } from '@/lib/storage';
import {
  ALLOWED_IMAGE_INPUT_MIME,
  ImageProcessingError,
  PROCESSED_IMAGE_EXT,
  PROCESSED_IMAGE_MIME,
  imageMagicBytesMatch,
  processImageToJpeg,
} from '@/lib/images';

export type PatientAvatarActionState =
  | null
  | { success: true }
  | { success: false; error: string };

const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2 MB

export async function updatePatientAvatar(
  _prevState: PatientAvatarActionState,
  formData: FormData,
): Promise<PatientAvatarActionState> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return { success: false, error: 'No autenticado' };
  }

  const patientId = formData.get('patient_id');
  if (typeof patientId !== 'string' || !/^[0-9a-f-]{20,}$/i.test(patientId)) {
    return { success: false, error: 'ID de paciente inválido' };
  }

  if (isDemoSession(session)) return demoWriteBlocked();

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return { success: false, error: 'Archivo requerido' };
  }
  if (file.size === 0) {
    return { success: false, error: 'El archivo está vacío' };
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return { success: false, error: 'La foto excede el tamaño máximo de 2MB' };
  }

  const mime = file.type?.toLowerCase() ?? '';
  if (!ALLOWED_IMAGE_INPUT_MIME.has(mime)) {
    return { success: false, error: 'Solo se permiten imágenes (JPG, PNG, WebP, HEIC o AVIF)' };
  }

  const rows = await db
    .select({ id: patients.id, avatarStorageKey: patients.avatarStorageKey })
    .from(patients)
    .where(and(eq(patients.id, patientId), eq(patients.clinicId, session.clinicId)))
    .limit(1);
  if (rows.length === 0) {
    return { success: false, error: 'Paciente no encontrado' };
  }
  const previousKey = rows[0].avatarStorageKey;

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.byteLength > MAX_AVATAR_BYTES) {
    return { success: false, error: 'La foto excede el tamaño máximo de 2MB' };
  }
  if (!imageMagicBytesMatch(buffer, mime)) {
    return {
      success: false,
      error: 'El contenido del archivo no coincide con el tipo declarado',
    };
  }

  // Re-encode to JPEG: strips EXIF (GPS, device serials), applies orientation,
  // and normalizes phone-camera formats (HEIC/WebP) so browsers can render
  // the avatar. The stored object is always image/jpeg.
  let cleanBuffer: Buffer;
  try {
    cleanBuffer = await processImageToJpeg(buffer, mime);
  } catch (err) {
    if (err instanceof ImageProcessingError) {
      return { success: false, error: err.message };
    }
    throw err;
  }

  // Same key pattern as attachments: UUID + extension. Avatars live alongside
  // attachments in the same bucket — no need for a separate prefix because the
  // DB column is the only authoritative reference.
  const storageKey = `${generateId()}.${PROCESSED_IMAGE_EXT}`;

  try {
    await uploadFile(cleanBuffer, storageKey, PROCESSED_IMAGE_MIME);
  } catch (err) {
    console.error('[patient-avatar] storage upload failed', err);
    return { success: false, error: 'No se pudo subir la foto' };
  }

  await db
    .update(patients)
    .set({ avatarStorageKey: storageKey, updatedAt: new Date() })
    .where(and(eq(patients.id, patientId), eq(patients.clinicId, session.clinicId)));

  // Best-effort cleanup of the previous blob. Leaving an orphan is preferable
  // to failing the action after the DB has been updated successfully.
  if (previousKey) {
    try {
      await deleteFile(previousKey);
    } catch (err) {
      console.error('[patient-avatar] previous avatar delete failed (orphan blob)', {
        storageKey: previousKey,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  await auditLog({
    clinicId: session.clinicId,
    userId: session.userId,
    action: 'UPDATE',
    resourceType: 'patient',
    resourceId: patientId,
    details: {
      field: 'avatarStorageKey',
      previousKey: previousKey ?? null,
      newKey: storageKey,
    },
    ipAddress: await getClientIpFromHeaders(),
  });

  revalidatePath(`/pacientes/${patientId}`);
  revalidatePath('/pacientes');

  return { success: true };
}

export async function removePatientAvatar(
  _prevState: PatientAvatarActionState,
  formData: FormData,
): Promise<PatientAvatarActionState> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return { success: false, error: 'No autenticado' };
  }

  const patientId = formData.get('patient_id');
  if (typeof patientId !== 'string' || !/^[0-9a-f-]{20,}$/i.test(patientId)) {
    return { success: false, error: 'ID de paciente inválido' };
  }

  if (isDemoSession(session)) return demoWriteBlocked();

  const rows = await db
    .select({ id: patients.id, avatarStorageKey: patients.avatarStorageKey })
    .from(patients)
    .where(and(eq(patients.id, patientId), eq(patients.clinicId, session.clinicId)))
    .limit(1);
  if (rows.length === 0) {
    return { success: false, error: 'Paciente no encontrado' };
  }

  const previousKey = rows[0].avatarStorageKey;
  if (!previousKey) {
    // Idempotent: nothing to remove. Don't error — the UI may double-fire the
    // action between the user click and the page revalidation.
    return { success: true };
  }

  await db
    .update(patients)
    .set({ avatarStorageKey: null, updatedAt: new Date() })
    .where(and(eq(patients.id, patientId), eq(patients.clinicId, session.clinicId)));

  // Best-effort cleanup, same rationale as in updatePatientAvatar: an orphan
  // blob is preferable to a DB row pointing at a missing object.
  try {
    await deleteFile(previousKey);
  } catch (err) {
    console.error('[patient-avatar] avatar delete failed (orphan blob)', {
      storageKey: previousKey,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  await auditLog({
    clinicId: session.clinicId,
    userId: session.userId,
    action: 'UPDATE',
    resourceType: 'patient',
    resourceId: patientId,
    details: {
      field: 'avatarStorageKey',
      previousKey,
      newKey: null,
    },
    ipAddress: await getClientIpFromHeaders(),
  });

  revalidatePath(`/pacientes/${patientId}`);
  revalidatePath('/pacientes');

  return { success: true };
}
