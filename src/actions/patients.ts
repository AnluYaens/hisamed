'use server';

import { and, eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { patients, medicalHistories } from '@/lib/db/schema';
import { requireSession, requireRole } from '@/lib/auth/session';
import { auditLog, getClientIpFromHeaders } from '@/lib/audit';
import { generateId } from '@/lib/utils/generate-id';
import { patientCreateSchema, patientUpdateSchema } from '@/lib/validators/patient';
import { checkDuplicateIdNumber, getPatientById } from '@/queries/patients';

export type PatientActionState =
  | null
  | { success: true; patientId?: string }
  | {
      success: false;
      error: string;
      fieldErrors?: Record<string, string[] | undefined>;
    };

// ─── createPatient ─────────────────────────────────────────────────────────────

export async function createPatient(
  _prevState: PatientActionState,
  formData: FormData,
): Promise<PatientActionState> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return { success: false, error: 'No autenticado' };
  }

  const raw = Object.fromEntries(formData.entries());
  const parsed = patientCreateSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      success: false,
      error: 'Revisa los datos del formulario',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const data = parsed.data;

  const duplicate = await checkDuplicateIdNumber(session.clinicId, data.id_number);
  if (duplicate) {
    return {
      success: false,
      error: `Ya existe un paciente registrado con el documento ${data.id_number}`,
    };
  }

  const patientId = generateId();
  const dob = data.date_of_birth.toISOString().split('T')[0];

  await db.transaction(async (tx) => {
    await tx.insert(patients).values({
      id: patientId,
      clinicId: session.clinicId,
      idNumber: data.id_number,
      idType: data.id_type,
      firstName: data.first_name,
      lastName: data.last_name,
      dateOfBirth: dob,
      sex: data.sex,
      phone: data.phone ?? null,
      email: data.email || null,
      address: data.address ?? null,
      emergencyContactName: data.emergency_contact_name ?? null,
      emergencyContactPhone: data.emergency_contact_phone ?? null,
      insuranceInfo: data.insurance_info ?? null,
      notes: data.notes ?? null,
      createdBy: session.userId,
    });

    await tx.insert(medicalHistories).values({
      id: generateId(),
      patientId,
      updatedBy: session.userId,
    });
  });

  await auditLog({
    clinicId: session.clinicId,
    userId: session.userId,
    action: 'CREATE',
    resourceType: 'patient',
    resourceId: patientId,
    details: {
      idNumber: data.id_number,
      name: `${data.first_name} ${data.last_name}`,
    },
    ipAddress: await getClientIpFromHeaders(),
  });

  redirect(`/pacientes/${patientId}`);
}

// ─── updatePatient ─────────────────────────────────────────────────────────────

export async function updatePatient(
  _prevState: PatientActionState,
  formData: FormData,
): Promise<PatientActionState> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return { success: false, error: 'No autenticado' };
  }

  const raw = Object.fromEntries(formData.entries());
  const parsed = patientUpdateSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      success: false,
      error: 'Revisa los datos del formulario',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { patient_id, ...fields } = parsed.data;

  const existing = await getPatientById(session.clinicId, patient_id);
  if (!existing) {
    return { success: false, error: 'Paciente no encontrado' };
  }

  if (fields.id_number && fields.id_number !== existing.idNumber) {
    const duplicate = await checkDuplicateIdNumber(
      session.clinicId,
      fields.id_number,
      patient_id,
    );
    if (duplicate) {
      return {
        success: false,
        error: `Ya existe un paciente registrado con el documento ${fields.id_number}`,
      };
    }
  }

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (fields.id_number !== undefined) updateData.idNumber = fields.id_number;
  if (fields.id_type !== undefined) updateData.idType = fields.id_type;
  if (fields.first_name !== undefined) updateData.firstName = fields.first_name;
  if (fields.last_name !== undefined) updateData.lastName = fields.last_name;
  if (fields.date_of_birth !== undefined)
    updateData.dateOfBirth = fields.date_of_birth.toISOString().split('T')[0];
  if (fields.sex !== undefined) updateData.sex = fields.sex;
  if (fields.phone !== undefined) updateData.phone = fields.phone ?? null;
  if (fields.email !== undefined) updateData.email = fields.email || null;
  if (fields.address !== undefined) updateData.address = fields.address ?? null;
  if (fields.emergency_contact_name !== undefined)
    updateData.emergencyContactName = fields.emergency_contact_name ?? null;
  if (fields.emergency_contact_phone !== undefined)
    updateData.emergencyContactPhone = fields.emergency_contact_phone ?? null;
  if (fields.insurance_info !== undefined)
    updateData.insuranceInfo = fields.insurance_info ?? null;
  if (fields.notes !== undefined) updateData.notes = fields.notes ?? null;

  await db
    .update(patients)
    .set(updateData)
    .where(and(eq(patients.id, patient_id), eq(patients.clinicId, session.clinicId)));

  await auditLog({
    clinicId: session.clinicId,
    userId: session.userId,
    action: 'UPDATE',
    resourceType: 'patient',
    resourceId: patient_id,
    details: { fields: Object.keys(updateData).filter((k) => k !== 'updatedAt') },
    ipAddress: await getClientIpFromHeaders(),
  });

  return { success: true, patientId: patient_id };
}

// ─── togglePatientActive ───────────────────────────────────────────────────────

export async function togglePatientActive(
  _prevState: PatientActionState,
  formData: FormData,
): Promise<PatientActionState> {
  let session;
  try {
    session = await requireRole(['admin']);
  } catch {
    return { success: false, error: 'Solo administradores pueden activar/desactivar pacientes' };
  }

  const patientId = formData.get('patient_id') as string;
  if (!patientId) {
    return { success: false, error: 'ID de paciente requerido' };
  }

  const existing = await getPatientById(session.clinicId, patientId);
  if (!existing) {
    return { success: false, error: 'Paciente no encontrado' };
  }

  const newActive = !existing.isActive;

  await db
    .update(patients)
    .set({ isActive: newActive, updatedAt: new Date() })
    .where(and(eq(patients.id, patientId), eq(patients.clinicId, session.clinicId)));

  await auditLog({
    clinicId: session.clinicId,
    userId: session.userId,
    action: 'UPDATE',
    resourceType: 'patient',
    resourceId: patientId,
    details: { isActive: newActive },
    ipAddress: await getClientIpFromHeaders(),
  });

  return { success: true };
}
