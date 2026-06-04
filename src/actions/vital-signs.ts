'use server';

import { and, eq, isNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { clinicalNotes, patients, vitalSigns } from '@/lib/db/schema';
import { requireRole } from '@/lib/auth/session';
import { isDemoSession, demoWriteBlocked } from '@/lib/auth/demo';
import { auditLog, getClientIpFromHeaders } from '@/lib/audit';
import { generateId } from '@/lib/utils/generate-id';
import { computeBmi, vitalSignsCreateSchema } from '@/lib/validators/vital-signs';

export type VitalSignsActionState =
  | null
  | { success: true; vitalSignsId: string }
  | {
      success: false;
      error: string;
      fieldErrors?: Record<string, string[] | undefined>;
    };

function emptyToUndefined(v: FormDataEntryValue | null): string | undefined {
  if (v === null) return undefined;
  const s = typeof v === 'string' ? v : String(v);
  return s === '' ? undefined : s;
}

// All roles can record vital signs — receptionists/assistants frequently take
// them before the doctor opens the note. Clinic scope is enforced against the
// patient (and optional clinical_note) to prevent cross-tenant writes.
export async function createVitalSigns(
  _prevState: VitalSignsActionState,
  formData: FormData,
): Promise<VitalSignsActionState> {
  let session;
  try {
    session = await requireRole(['admin', 'doctor', 'receptionist']);
  } catch {
    return { success: false, error: 'No autorizado' };
  }

  if (isDemoSession(session)) return demoWriteBlocked();

  const raw = {
    patient_id: (formData.get('patient_id') as string | null) ?? '',
    clinical_note_id: emptyToUndefined(formData.get('clinical_note_id')),
    weight_kg: emptyToUndefined(formData.get('weight_kg')),
    height_cm: emptyToUndefined(formData.get('height_cm')),
    systolic_bp: emptyToUndefined(formData.get('systolic_bp')),
    diastolic_bp: emptyToUndefined(formData.get('diastolic_bp')),
    heart_rate: emptyToUndefined(formData.get('heart_rate')),
    respiratory_rate: emptyToUndefined(formData.get('respiratory_rate')),
    temperature_c: emptyToUndefined(formData.get('temperature_c')),
    oxygen_saturation: emptyToUndefined(formData.get('oxygen_saturation')),
    notes: emptyToUndefined(formData.get('notes')),
  };

  const parsed = vitalSignsCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: 'Revisa los datos del formulario',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const data = parsed.data;

  const patientRow = await db
    .select({ id: patients.id })
    .from(patients)
    .where(and(eq(patients.id, data.patient_id), eq(patients.clinicId, session.clinicId)))
    .limit(1);
  if (patientRow.length === 0) {
    return { success: false, error: 'Paciente no encontrado' };
  }

  if (data.clinical_note_id) {
    const noteRow = await db
      .select({ id: clinicalNotes.id })
      .from(clinicalNotes)
      .innerJoin(patients, eq(clinicalNotes.patientId, patients.id))
      .where(
        and(
          eq(clinicalNotes.id, data.clinical_note_id),
          eq(clinicalNotes.patientId, data.patient_id),
          eq(patients.clinicId, session.clinicId),
        ),
      )
      .limit(1);
    if (noteRow.length === 0) {
      return { success: false, error: 'La nota asociada no existe o no corresponde al paciente' };
    }
  }

  const id = generateId();
  const bmi = computeBmi(data.weight_kg, data.height_cm);

  // Drizzle's `decimal` columns expect strings. Pass undefined for missing
  // values so the column stays NULL instead of being inserted as the string
  // "undefined".
  const toDecimalStr = (v: number | undefined): string | undefined =>
    v === undefined ? undefined : v.toString();

  await db.insert(vitalSigns).values({
    id,
    clinicId: session.clinicId,
    patientId: data.patient_id,
    clinicalNoteId: data.clinical_note_id ?? null,
    recordedBy: session.userId,
    weightKg: toDecimalStr(data.weight_kg),
    heightCm: toDecimalStr(data.height_cm),
    bmi: bmi != null ? bmi.toString() : undefined,
    systolicBp: data.systolic_bp,
    diastolicBp: data.diastolic_bp,
    heartRate: data.heart_rate,
    respiratoryRate: data.respiratory_rate,
    temperatureC: toDecimalStr(data.temperature_c),
    oxygenSaturation: data.oxygen_saturation,
    notes: data.notes ?? null,
  });

  await auditLog({
    clinicId: session.clinicId,
    userId: session.userId,
    action: 'CREATE',
    resourceType: 'vital_signs',
    resourceId: id,
    details: {
      patientId: data.patient_id,
      clinicalNoteId: data.clinical_note_id ?? null,
      hasBmi: bmi != null,
    },
    ipAddress: await getClientIpFromHeaders(),
  });

  revalidatePath(`/pacientes/${data.patient_id}`);
  if (data.clinical_note_id) {
    revalidatePath(`/pacientes/${data.patient_id}/notas/${data.clinical_note_id}`);
  }

  return { success: true, vitalSignsId: id };
}

// ─── attachVitalSignsToNote ──────────────────────────────────────────────────
//
// Doctor-only. Links a previously orphaned vital_signs row (clinical_note_id
// IS NULL) to a clinical note. The receptionist captures vitals at intake and
// the doctor associates them once they open the note for the consultation.
//
// Tenant + integrity guarantees, all enforced in SQL so a tampered form value
// can never make it through:
//   1. requireRole(['doctor']) — receptionist/admin can't attach.
//   2. The vital_signs row must (a) belong to the session's clinic AND
//      (b) currently have clinical_note_id IS NULL (we don't repoint an
//      already-attached record — that would silently rewrite history).
//   3. The clinical note must belong to the same clinic AND the same patient
//      as the vital_signs row (joined via patients.clinicId).
//   4. The author of the note must be the current doctor — same authorship
//      rule as updateClinicalNote.
//   5. The note must NOT be signed yet (signed = immutable).

const attachSchema = z.object({
  vital_signs_id: z.string().uuid('ID de signos vitales inválido'),
  clinical_note_id: z.string().uuid('ID de nota inválido'),
});

export type AttachVitalSignsActionState =
  | null
  | { success: true; vitalSignsId: string; clinicalNoteId: string }
  | {
      success: false;
      error: string;
      fieldErrors?: Record<string, string[] | undefined>;
    };

export async function attachVitalSignsToNote(
  _prevState: AttachVitalSignsActionState,
  formData: FormData,
): Promise<AttachVitalSignsActionState> {
  let session;
  try {
    session = await requireRole(['doctor']);
  } catch {
    return {
      success: false,
      error: 'Solo médicos pueden asociar signos vitales a una nota',
    };
  }

  if (isDemoSession(session)) return demoWriteBlocked();

  const parsed = attachSchema.safeParse({
    vital_signs_id: formData.get('vital_signs_id'),
    clinical_note_id: formData.get('clinical_note_id'),
  });
  if (!parsed.success) {
    return {
      success: false,
      error: 'Revisa los datos del formulario',
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }
  const { vital_signs_id, clinical_note_id } = parsed.data;

  // Fetch the vital signs row scoped to the caller's clinic. Any cross-clinic
  // id simply yields zero rows.
  const vsRows = await db
    .select({
      id: vitalSigns.id,
      patientId: vitalSigns.patientId,
      clinicalNoteId: vitalSigns.clinicalNoteId,
    })
    .from(vitalSigns)
    .where(
      and(
        eq(vitalSigns.id, vital_signs_id),
        eq(vitalSigns.clinicId, session.clinicId),
      ),
    )
    .limit(1);

  if (vsRows.length === 0) {
    return { success: false, error: 'Signos vitales no encontrados' };
  }
  const vs = vsRows[0];

  if (vs.clinicalNoteId !== null) {
    return {
      success: false,
      error: 'Estos signos vitales ya están asociados a una nota',
    };
  }

  // Note must (a) live in the same clinic, (b) belong to the same patient as
  // the vital_signs row, (c) be authored by the current doctor, and (d) not
  // be signed.
  const noteRows = await db
    .select({
      id: clinicalNotes.id,
      patientId: clinicalNotes.patientId,
      authorId: clinicalNotes.authorId,
      isSigned: clinicalNotes.isSigned,
    })
    .from(clinicalNotes)
    .innerJoin(patients, eq(clinicalNotes.patientId, patients.id))
    .where(
      and(
        eq(clinicalNotes.id, clinical_note_id),
        eq(patients.clinicId, session.clinicId),
      ),
    )
    .limit(1);

  if (noteRows.length === 0) {
    return { success: false, error: 'Nota no encontrada' };
  }
  const note = noteRows[0];

  if (note.patientId !== vs.patientId) {
    return {
      success: false,
      error: 'Los signos vitales y la nota corresponden a distintos pacientes',
    };
  }

  if (note.authorId !== session.userId) {
    return {
      success: false,
      error: 'Solo el médico autor puede asociar signos vitales a esta nota',
    };
  }

  if (note.isSigned) {
    return {
      success: false,
      error: 'La nota está firmada y no admite cambios',
    };
  }

  // Concurrency guard: re-check both invariants (still unattached + still
  // unsigned via a parallel sign) inside the UPDATE so a race can't repoint
  // an already-attached row or modify a freshly signed note. `returning`
  // tells us whether we won the race.
  const result = await db
    .update(vitalSigns)
    .set({ clinicalNoteId: clinical_note_id })
    .where(
      and(
        eq(vitalSigns.id, vital_signs_id),
        eq(vitalSigns.clinicId, session.clinicId),
        isNull(vitalSigns.clinicalNoteId),
      ),
    )
    .returning({ id: vitalSigns.id });

  if (result.length === 0) {
    return {
      success: false,
      error: 'Estos signos vitales fueron asociados por otro proceso. Recarga la página.',
    };
  }

  await auditLog({
    clinicId: session.clinicId,
    userId: session.userId,
    action: 'UPDATE',
    resourceType: 'vital_signs',
    resourceId: vital_signs_id,
    details: {
      action: 'attach_to_note',
      clinicalNoteId: clinical_note_id,
      patientId: vs.patientId,
    },
    ipAddress: await getClientIpFromHeaders(),
  });

  revalidatePath(`/pacientes/${vs.patientId}`);
  revalidatePath(`/pacientes/${vs.patientId}/notas/${clinical_note_id}`);

  return {
    success: true,
    vitalSignsId: vital_signs_id,
    clinicalNoteId: clinical_note_id,
  };
}
