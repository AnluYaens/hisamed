'use server';

import { and, eq, count } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { patients, medicalHistories, patientPartners, clinics } from '@/lib/db/schema';
import { requireSession, requireRole } from '@/lib/auth/session';
import { auditLog, getClientIpFromHeaders } from '@/lib/audit';
import { generateId } from '@/lib/utils/generate-id';
import { patientCreateSchema, patientUpdateSchema, partnerUpsertSchema } from '@/lib/validators/patient';
import { checkDuplicateIdNumber, getPatientById } from '@/queries/patients';
import { toDateStr } from '@/lib/dates';
import { formFailure, type FormFailure } from '@/lib/forms/state';

export type PatientActionState =
  | null
  | { success: true; patientId?: string }
  | FormFailure;

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
    return formFailure(formData, {
      error: 'Revisa los datos del formulario',
      fieldErrors: parsed.error.flatten().fieldErrors,
    });
  }

  const data = parsed.data;

  const [clinicRow] = await db
    .select({ maxPatients: clinics.maxPatients })
    .from(clinics)
    .where(eq(clinics.id, session.clinicId))
    .limit(1);
  if (clinicRow) {
    const [{ total }] = await db
      .select({ total: count() })
      .from(patients)
      .where(eq(patients.clinicId, session.clinicId));
    if (total >= clinicRow.maxPatients) {
      return formFailure(formData, {
        error: `Has alcanzado el límite de pacientes de tu plan (${clinicRow.maxPatients}). Actualiza tu plan para registrar más pacientes.`,
      });
    }
  }

  const duplicate = await checkDuplicateIdNumber(session.clinicId, data.id_number);
  if (duplicate) {
    return formFailure(formData, {
      error: `Ya existe un paciente registrado con el documento ${data.id_number}`,
      fieldErrors: { id_number: [`Ya existe un paciente con este documento`] },
    });
  }

  const patientId = generateId();
  const dob = toDateStr(data.date_of_birth);

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
      bloodType: data.blood_type || null,
      rhIncompatibility: data.rh_incompatibility ?? false,
      instagram: data.instagram ?? null,
      referralSource: data.referral_source ?? null,
      occupation: data.occupation ?? null,
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
    return formFailure(formData, {
      error: 'Revisa los datos del formulario',
      fieldErrors: parsed.error.flatten().fieldErrors,
    });
  }

  const { patient_id, ...fields } = parsed.data;

  const existing = await getPatientById(session.clinicId, patient_id);
  if (!existing) {
    return formFailure(formData, { error: 'Paciente no encontrado' });
  }

  if (fields.id_number && fields.id_number !== existing.idNumber) {
    const duplicate = await checkDuplicateIdNumber(
      session.clinicId,
      fields.id_number,
      patient_id,
    );
    if (duplicate) {
      return formFailure(formData, {
        error: `Ya existe un paciente registrado con el documento ${fields.id_number}`,
        fieldErrors: { id_number: ['Ya existe un paciente con este documento'] },
      });
    }
  }

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (fields.id_number !== undefined) updateData.idNumber = fields.id_number;
  if (fields.id_type !== undefined) updateData.idType = fields.id_type;
  if (fields.first_name !== undefined) updateData.firstName = fields.first_name;
  if (fields.last_name !== undefined) updateData.lastName = fields.last_name;
  if (fields.date_of_birth !== undefined)
    updateData.dateOfBirth = toDateStr(fields.date_of_birth);
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
  if (fields.blood_type !== undefined) updateData.bloodType = fields.blood_type || null;
  if (fields.rh_incompatibility !== undefined) updateData.rhIncompatibility = fields.rh_incompatibility ?? false;
  if (fields.instagram !== undefined) updateData.instagram = fields.instagram ?? null;
  if (fields.referral_source !== undefined) updateData.referralSource = fields.referral_source ?? null;
  if (fields.occupation !== undefined) updateData.occupation = fields.occupation ?? null;

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

  revalidatePath(`/pacientes/${patient_id}`);

  return { success: true, patientId: patient_id };
}

// ─── togglePatientActive ───────────────────────────────────────────────────────

export async function togglePatientActive(
  _prevState: PatientActionState,
  formData: FormData,
): Promise<PatientActionState> {
  let session;
  try {
    session = await requireRole(['admin', 'doctor']);
  } catch {
    return { success: false, error: 'No tienes permisos para activar/desactivar pacientes' };
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

// ─── upsertPatientPartner ──────────────────────────────────────────────────────

export async function upsertPatientPartner(
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
  const parsed = partnerUpsertSchema.safeParse(raw);

  if (!parsed.success) {
    return formFailure(formData, {
      error: 'Revisa los datos del formulario',
      fieldErrors: parsed.error.flatten().fieldErrors,
    });
  }

  const { patient_id, ...fields } = parsed.data;

  const patient = await getPatientById(session.clinicId, patient_id);
  if (!patient) {
    return formFailure(formData, { error: 'Paciente no encontrado' });
  }

  const existing = await db.query.patientPartners.findFirst({
    where: eq(patientPartners.patientId, patient_id),
    columns: { id: true },
  });

  const isCreate = !existing;

  if (isCreate) {
    await db.insert(patientPartners).values({
      id: generateId(),
      patientId: patient_id,
      fullName: fields.full_name,
      idNumber: fields.id_number ?? null,
      dateOfBirth: fields.date_of_birth || null,
      phone: fields.phone ?? null,
      email: fields.email || null,
      bloodType: fields.blood_type || null,
      occupation: fields.occupation ?? null,
      notes: fields.notes ?? null,
    });
  } else {
    await db
      .update(patientPartners)
      .set({
        fullName: fields.full_name,
        idNumber: fields.id_number ?? null,
        dateOfBirth: fields.date_of_birth || null,
        phone: fields.phone ?? null,
        email: fields.email || null,
        bloodType: fields.blood_type || null,
        occupation: fields.occupation ?? null,
        notes: fields.notes ?? null,
        updatedAt: new Date(),
      })
      .where(eq(patientPartners.patientId, patient_id));
  }

  await auditLog({
    clinicId: session.clinicId,
    userId: session.userId,
    action: isCreate ? 'CREATE' : 'UPDATE',
    resourceType: 'patient_partner',
    resourceId: patient_id,
    details: { fields: Object.keys(fields) },
    ipAddress: await getClientIpFromHeaders(),
  });

  revalidatePath(`/pacientes/${patient_id}`);

  return { success: true, patientId: patient_id };
}
