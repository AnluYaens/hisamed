'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { attachments, clinicalNotes, patients } from '@/lib/db/schema';
import { requireSession } from '@/lib/auth/session';
import { isDemoSession, demoWriteBlocked } from '@/lib/auth/demo';
import { auditLog, getClientIpFromHeaders } from '@/lib/audit';
import { deleteFile } from '@/lib/storage';

export type AttachmentActionState =
  | null
  | { success: true }
  | { success: false; error: string };

const deleteSchema = z.object({
  attachment_id: z.string().uuid('ID de adjunto inválido'),
});

// ─── deleteAttachment ─────────────────────────────────────────────────────────
//
// PRD Técnico §2: admin can delete any attachment. Doctor can only delete
// their own uploads. Receptionist cannot delete at all. We enforce this with
// the raw session.role + session.userId instead of `requireRole` so the
// "own uploads" check stays colocated with the permission check.

export async function deleteAttachment(
  _prevState: AttachmentActionState,
  formData: FormData,
): Promise<AttachmentActionState> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return { success: false, error: 'No autenticado' };
  }

  if (isDemoSession(session)) return demoWriteBlocked();

  const parsed = deleteSchema.safeParse({
    attachment_id: formData.get('attachment_id'),
  });
  if (!parsed.success) {
    return { success: false, error: 'ID de adjunto inválido' };
  }
  const { attachment_id } = parsed.data;

  // Clinic-scoped fetch + info we need for the permission check + the
  // subsequent storage delete. A cross-clinic id yields zero rows. The
  // LEFT JOIN on clinical_notes pulls `is_signed` so we can enforce the
  // signed-note immutability rule below — applies regardless of role,
  // even admin, because a signed clinical note is a legal record.
  const rows = await db
    .select({
      id: attachments.id,
      storageKey: attachments.storageKey,
      uploadedBy: attachments.uploadedBy,
      patientId: attachments.patientId,
      clinicalNoteId: attachments.clinicalNoteId,
      clinicalNoteIsSigned: clinicalNotes.isSigned,
    })
    .from(attachments)
    .innerJoin(patients, eq(attachments.patientId, patients.id))
    .leftJoin(clinicalNotes, eq(attachments.clinicalNoteId, clinicalNotes.id))
    .where(and(eq(attachments.id, attachment_id), eq(patients.clinicId, session.clinicId)))
    .limit(1);

  if (rows.length === 0) {
    return { success: false, error: 'Adjunto no encontrado' };
  }
  const att = rows[0];

  if (session.role === 'receptionist') {
    return { success: false, error: 'No tienes permisos para eliminar adjuntos' };
  }
  if (session.role === 'doctor' && att.uploadedBy !== session.userId) {
    return { success: false, error: 'Solo puedes eliminar adjuntos que tú subiste' };
  }
  // Signed-note immutability: once a clinical note is signed, all linked
  // evidence (including procedure_photo) becomes part of the signed record
  // and cannot be deleted. Applied to every role — admin's "delete anything"
  // privilege stops at the signature line. Note-less attachments still
  // follow the per-role rules above.
  if (att.clinicalNoteId && att.clinicalNoteIsSigned === true) {
    return {
      success: false,
      error:
        'No se puede eliminar: el adjunto pertenece a una nota firmada. Las notas firmadas son inmutables.',
    };
  }
  // admin passes through.

  // Delete DB row first. If the storage delete fails we end up with an orphan
  // blob, which a janitor can sweep later — much safer than losing the blob
  // but keeping a dangling DB row that 500s on download.
  await db.delete(attachments).where(eq(attachments.id, att.id));

  try {
    await deleteFile(att.storageKey);
  } catch (err) {
    console.error('[attachments] storage delete failed (orphan blob)', {
      storageKey: att.storageKey,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  await auditLog({
    clinicId: session.clinicId,
    userId: session.userId,
    action: 'DELETE',
    resourceType: 'attachment',
    resourceId: att.id,
    details: {
      patientId: att.patientId,
      clinicalNoteId: att.clinicalNoteId,
      storageKey: att.storageKey,
    },
    ipAddress: await getClientIpFromHeaders(),
  });

  revalidatePath(`/pacientes/${att.patientId}`);
  if (att.clinicalNoteId) {
    revalidatePath(`/pacientes/${att.patientId}/notas/${att.clinicalNoteId}`);
  }

  return { success: true };
}
