'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { patients, patientPartners } from '@/lib/db/schema';
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

export type PartnerAvatarActionState =
  | null
  | { success: true }
  | { success: false; error: string };

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

export async function updatePartnerAvatar(
  _prevState: PartnerAvatarActionState,
  formData: FormData,
): Promise<PartnerAvatarActionState> {
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

  // Verify patient belongs to clinic
  const patientRows = await db
    .select({ id: patients.id })
    .from(patients)
    .where(and(eq(patients.id, patientId), eq(patients.clinicId, session.clinicId)))
    .limit(1);
  if (patientRows.length === 0) {
    return { success: false, error: 'Paciente no encontrado' };
  }

  const file = formData.get('file');
  if (!(file instanceof File)) return { success: false, error: 'Archivo requerido' };
  if (file.size === 0) return { success: false, error: 'El archivo está vacío' };
  if (file.size > MAX_AVATAR_BYTES) return { success: false, error: 'La foto excede el tamaño máximo de 2MB' };

  const mime = file.type?.toLowerCase() ?? '';
  if (!ALLOWED_IMAGE_INPUT_MIME.has(mime)) {
    return { success: false, error: 'Solo se permiten imágenes (JPG, PNG, WebP, HEIC o AVIF)' };
  }

  const partnerRows = await db
    .select({ id: patientPartners.id, avatarStorageKey: patientPartners.avatarStorageKey })
    .from(patientPartners)
    .where(eq(patientPartners.patientId, patientId))
    .limit(1);

  if (partnerRows.length === 0) {
    return { success: false, error: 'La pareja no tiene un registro aún. Guarda los datos primero.' };
  }

  const previousKey = partnerRows[0].avatarStorageKey;
  const buffer = Buffer.from(await file.arrayBuffer());
  if (!imageMagicBytesMatch(buffer, mime)) {
    return { success: false, error: 'El contenido del archivo no coincide con el tipo declarado' };
  }

  // Re-encode to JPEG: strips EXIF (GPS, device serials), applies orientation,
  // normalizes phone-camera formats. Same pipeline as the patient avatar.
  let cleanBuffer: Buffer;
  try {
    cleanBuffer = await processImageToJpeg(buffer, mime);
  } catch (err) {
    if (err instanceof ImageProcessingError) {
      return { success: false, error: err.message };
    }
    throw err;
  }

  const storageKey = `${generateId()}.${PROCESSED_IMAGE_EXT}`;

  try {
    await uploadFile(cleanBuffer, storageKey, PROCESSED_IMAGE_MIME);
  } catch (err) {
    console.error('[partner-avatar] storage upload failed', err);
    return { success: false, error: 'No se pudo subir la foto' };
  }

  await db
    .update(patientPartners)
    .set({ avatarStorageKey: storageKey, updatedAt: new Date() })
    .where(eq(patientPartners.patientId, patientId));

  if (previousKey) {
    try {
      await deleteFile(previousKey);
    } catch (err) {
      console.error('[partner-avatar] previous avatar delete failed (orphan blob)', err);
    }
  }

  await auditLog({
    clinicId: session.clinicId,
    userId: session.userId,
    action: 'UPDATE',
    resourceType: 'patient_partner',
    resourceId: patientId,
    details: { field: 'avatarStorageKey', previousKey: previousKey ?? null, newKey: storageKey },
    ipAddress: await getClientIpFromHeaders(),
  });

  revalidatePath(`/pacientes/${patientId}`);
  return { success: true };
}

export async function removePartnerAvatar(
  _prevState: PartnerAvatarActionState,
  formData: FormData,
): Promise<PartnerAvatarActionState> {
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

  const patientRows = await db
    .select({ id: patients.id })
    .from(patients)
    .where(and(eq(patients.id, patientId), eq(patients.clinicId, session.clinicId)))
    .limit(1);
  if (patientRows.length === 0) {
    return { success: false, error: 'Paciente no encontrado' };
  }

  const partnerRows = await db
    .select({ avatarStorageKey: patientPartners.avatarStorageKey })
    .from(patientPartners)
    .where(eq(patientPartners.patientId, patientId))
    .limit(1);

  if (partnerRows.length === 0 || !partnerRows[0].avatarStorageKey) {
    return { success: true };
  }

  const previousKey = partnerRows[0].avatarStorageKey;

  await db
    .update(patientPartners)
    .set({ avatarStorageKey: null, updatedAt: new Date() })
    .where(eq(patientPartners.patientId, patientId));

  try {
    await deleteFile(previousKey);
  } catch (err) {
    console.error('[partner-avatar] avatar delete failed (orphan blob)', err);
  }

  await auditLog({
    clinicId: session.clinicId,
    userId: session.userId,
    action: 'UPDATE',
    resourceType: 'patient_partner',
    resourceId: patientId,
    details: { field: 'avatarStorageKey', previousKey, newKey: null },
    ipAddress: await getClientIpFromHeaders(),
  });

  revalidatePath(`/pacientes/${patientId}`);
  return { success: true };
}
