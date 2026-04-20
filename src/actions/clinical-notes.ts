'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { appointments, clinicalNotes, patients } from '@/lib/db/schema';
import { requireRole } from '@/lib/auth/session';
import { auditLog, getClientIpFromHeaders } from '@/lib/audit';
import { generateId } from '@/lib/utils/generate-id';
import {
  clinicalNoteCreateSchema,
  clinicalNoteSignSchema,
  clinicalNoteSpecialtyDataSchema,
  clinicalNoteUpdateSchema,
  type ClinicalNoteSpecialtyData,
} from '@/lib/validators/clinical-note';

// ─── Action state ─────────────────────────────────────────────────────────────

export type ClinicalNoteActionState =
  | null
  | { success: true; noteId?: string; signed?: boolean }
  | {
      success: false;
      error: string;
      fieldErrors?: Record<string, string[] | undefined>;
    };

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Turn a "" coming from an unfilled <input> into undefined so Zod's .optional()
// is respected instead of treating '' as a submitted value and then failing
// length/format checks.
function emptyToUndefined(v: FormDataEntryValue | null): string | undefined {
  if (v === null) return undefined;
  const s = typeof v === 'string' ? v : String(v);
  return s === '' ? undefined : s;
}

// Pull and validate the `specialty_data` JSON blob. The frontend encodes the
// whole object as a single JSON string hidden input — same pattern as
// MedicalHistoryForm. Returns undefined when the field wasn't submitted.
function parseSpecialtyData(
  formData: FormData,
): { ok: true; value: ClinicalNoteSpecialtyData | undefined } | { ok: false; error: string } {
  const raw = formData.get('specialty_data');
  if (raw === null || raw === '') return { ok: true, value: undefined };
  if (typeof raw !== 'string') {
    return { ok: false, error: 'Datos de especialidad inválidos' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'Datos de especialidad con formato inválido' };
  }

  const result = clinicalNoteSpecialtyDataSchema.safeParse(parsed);
  if (!result.success) {
    return { ok: false, error: 'Datos de especialidad inválidos' };
  }

  // Strip undefined keys so we don't overwrite existing values with NULL on
  // update (parity with how medical-history handles the JSONB merge).
  const cleaned = Object.fromEntries(
    Object.entries(result.data).filter(([, v]) => v !== undefined),
  ) as ClinicalNoteSpecialtyData;

  return { ok: true, value: cleaned };
}

// Map FormData → raw object shaped for the Zod schemas. Keeps the action
// bodies short and makes it easy to see exactly which fields come from the
// client.
function extractCreateInput(formData: FormData) {
  return {
    patient_id: (formData.get('patient_id') as string | null) ?? '',
    appointment_id: emptyToUndefined(formData.get('appointment_id')),
    note_date: (formData.get('note_date') as string | null) ?? '',
    chief_complaint: emptyToUndefined(formData.get('chief_complaint')),
    subjective: emptyToUndefined(formData.get('subjective')),
    objective: emptyToUndefined(formData.get('objective')),
    assessment: emptyToUndefined(formData.get('assessment')),
    plan: emptyToUndefined(formData.get('plan')),
    diagnosis_text: emptyToUndefined(formData.get('diagnosis_text')),
    diagnosis_code: emptyToUndefined(formData.get('diagnosis_code')),
    internal_notes: emptyToUndefined(formData.get('internal_notes')),
  };
}

function extractUpdateInput(formData: FormData) {
  return {
    note_id: (formData.get('note_id') as string | null) ?? '',
    note_date: emptyToUndefined(formData.get('note_date')),
    chief_complaint: emptyToUndefined(formData.get('chief_complaint')),
    subjective: emptyToUndefined(formData.get('subjective')),
    objective: emptyToUndefined(formData.get('objective')),
    assessment: emptyToUndefined(formData.get('assessment')),
    plan: emptyToUndefined(formData.get('plan')),
    diagnosis_text: emptyToUndefined(formData.get('diagnosis_text')),
    diagnosis_code: emptyToUndefined(formData.get('diagnosis_code')),
    internal_notes: emptyToUndefined(formData.get('internal_notes')),
  };
}

// ─── createClinicalNote ───────────────────────────────────────────────────────
//
// PRD Técnico §2: only `doctor` may create clinical notes. `requireRole` will
// throw for admin/receptionist. We also verify the patient belongs to the
// caller's clinic, and (if `appointment_id` was passed) that the appointment
// is for that same patient + clinic, before inserting.

export async function createClinicalNote(
  _prevState: ClinicalNoteActionState,
  formData: FormData,
): Promise<ClinicalNoteActionState> {
  let session;
  try {
    session = await requireRole(['doctor']);
  } catch {
    return {
      success: false,
      error: 'Solo médicos pueden crear notas de evolución',
    };
  }

  const specialty = parseSpecialtyData(formData);
  if (!specialty.ok) {
    return { success: false, error: specialty.error };
  }

  const raw = {
    ...extractCreateInput(formData),
    specialty_data: specialty.value,
  };

  const parsed = clinicalNoteCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: 'Revisa los datos del formulario',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const data = parsed.data;

  // Clinic-scoped patient check. Prevents a doctor of clinic A from
  // attaching a note to a patient of clinic B by tampering with the
  // hidden `patient_id` field.
  const patientRow = await db
    .select({ id: patients.id })
    .from(patients)
    .where(and(eq(patients.id, data.patient_id), eq(patients.clinicId, session.clinicId)))
    .limit(1);
  if (patientRow.length === 0) {
    return { success: false, error: 'Paciente no encontrado' };
  }

  // Optional appointment link must also belong to the same patient + clinic.
  if (data.appointment_id) {
    const apptRow = await db
      .select({ id: appointments.id })
      .from(appointments)
      .where(
        and(
          eq(appointments.id, data.appointment_id),
          eq(appointments.clinicId, session.clinicId),
          eq(appointments.patientId, data.patient_id),
        ),
      )
      .limit(1);
    if (apptRow.length === 0) {
      return { success: false, error: 'La cita asociada no existe o no corresponde al paciente' };
    }
  }

  const noteId = generateId();

  await db.insert(clinicalNotes).values({
    id: noteId,
    patientId: data.patient_id,
    appointmentId: data.appointment_id ?? null,
    authorId: session.userId,
    noteDate: data.note_date,
    chiefComplaint: data.chief_complaint ?? null,
    subjective: data.subjective ?? null,
    objective: data.objective ?? null,
    assessment: data.assessment ?? null,
    plan: data.plan ?? null,
    diagnosisText: data.diagnosis_text ?? null,
    diagnosisCode: data.diagnosis_code ?? null,
    internalNotes: data.internal_notes ?? null,
    specialtyData: (data.specialty_data ?? {}) as Record<string, unknown>,
    isSigned: false,
  });

  await auditLog({
    clinicId: session.clinicId,
    userId: session.userId,
    action: 'CREATE',
    resourceType: 'clinical_note',
    resourceId: noteId,
    details: {
      patientId: data.patient_id,
      appointmentId: data.appointment_id ?? null,
      diagnosisCode: data.diagnosis_code ?? null,
    },
    ipAddress: await getClientIpFromHeaders(),
  });

  revalidatePath(`/pacientes/${data.patient_id}`);
  revalidatePath(`/pacientes/${data.patient_id}/notas`);
  redirect(`/pacientes/${data.patient_id}/notas/${noteId}`);
}

// ─── updateClinicalNote ───────────────────────────────────────────────────────
//
// PRD Técnico §2 + §4: only `doctor`, only the author, only while the note
// is NOT signed. Attempting to update a signed note returns a clear error —
// both the UI and any direct request (curl, devtools) hit the same gate.

export async function updateClinicalNote(
  _prevState: ClinicalNoteActionState,
  formData: FormData,
): Promise<ClinicalNoteActionState> {
  let session;
  try {
    session = await requireRole(['doctor']);
  } catch {
    return {
      success: false,
      error: 'Solo médicos pueden editar notas de evolución',
    };
  }

  const specialty = parseSpecialtyData(formData);
  if (!specialty.ok) {
    return { success: false, error: specialty.error };
  }

  const raw = {
    ...extractUpdateInput(formData),
    specialty_data: specialty.value,
  };

  const parsed = clinicalNoteUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: 'Revisa los datos del formulario',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { note_id, specialty_data, ...fields } = parsed.data;

  // Fetch the note joined with the patient so we can enforce clinic scope
  // + author + not-signed in a single trip. Clinic scope lives in the SQL
  // WHERE — a cross-clinic note_id simply yields zero rows, mirroring the
  // read queries in src/queries/clinical-notes.ts.
  const rows = await db
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
        eq(clinicalNotes.id, note_id),
        eq(patients.clinicId, session.clinicId),
      ),
    )
    .limit(1);

  if (rows.length === 0) {
    return { success: false, error: 'Nota no encontrada' };
  }

  const existing = rows[0];

  if (existing.authorId !== session.userId) {
    return {
      success: false,
      error: 'Solo el médico autor puede editar esta nota',
    };
  }

  if (existing.isSigned) {
    return {
      success: false,
      error:
        'Esta nota está firmada y no puede editarse. Para corregir, crea una nueva nota referenciando a esta.',
    };
  }

  // Build the partial update payload. Any field whose input was omitted
  // from the FormData stays untouched; fields submitted as "" become NULL
  // so users can clear them (e.g. delete a diagnosis code that was wrong).
  const updateData: Record<string, unknown> = { updatedAt: new Date() };

  if (fields.note_date !== undefined) updateData.noteDate = fields.note_date;
  if (fields.chief_complaint !== undefined)
    updateData.chiefComplaint = fields.chief_complaint || null;
  if (fields.subjective !== undefined) updateData.subjective = fields.subjective || null;
  if (fields.objective !== undefined) updateData.objective = fields.objective || null;
  if (fields.assessment !== undefined) updateData.assessment = fields.assessment || null;
  if (fields.plan !== undefined) updateData.plan = fields.plan || null;
  if (fields.diagnosis_text !== undefined)
    updateData.diagnosisText = fields.diagnosis_text || null;
  if (fields.diagnosis_code !== undefined)
    updateData.diagnosisCode = fields.diagnosis_code || null;
  if (fields.internal_notes !== undefined)
    updateData.internalNotes = fields.internal_notes || null;
  if (specialty_data !== undefined) {
    // Full replace on update. The form always re-serializes the entire
    // specialty_data payload, so a merge would just re-introduce stale
    // values that the doctor explicitly cleared.
    updateData.specialtyData = specialty_data;
  }

  // Concurrency guard: re-check `is_signed=false` inside the UPDATE so a
  // race with a parallel sign request can't let a late write land on top
  // of a freshly signed note.
  const result = await db
    .update(clinicalNotes)
    .set(updateData)
    .where(
      and(
        eq(clinicalNotes.id, note_id),
        eq(clinicalNotes.authorId, session.userId),
        eq(clinicalNotes.isSigned, false),
      ),
    )
    .returning({ id: clinicalNotes.id });

  if (result.length === 0) {
    return {
      success: false,
      error: 'La nota fue firmada por otro proceso. Recarga la página.',
    };
  }

  await auditLog({
    clinicId: session.clinicId,
    userId: session.userId,
    action: 'UPDATE',
    resourceType: 'clinical_note',
    resourceId: note_id,
    details: {
      fields: Object.keys(updateData).filter((k) => k !== 'updatedAt'),
    },
    ipAddress: await getClientIpFromHeaders(),
  });

  revalidatePath(`/pacientes/${existing.patientId}`);
  revalidatePath(`/pacientes/${existing.patientId}/notas`);
  revalidatePath(`/pacientes/${existing.patientId}/notas/${note_id}`);

  return { success: true, noteId: note_id };
}

// ─── signClinicalNote ─────────────────────────────────────────────────────────
//
// PRD Técnico §2: only the doctor author can sign. IRREVERSIBLE — once
// `is_signed=true`, the note is immutable. Attempting to sign an already
// signed note is a no-op with a friendly error.

export async function signClinicalNote(
  _prevState: ClinicalNoteActionState,
  formData: FormData,
): Promise<ClinicalNoteActionState> {
  let session;
  try {
    session = await requireRole(['doctor']);
  } catch {
    return {
      success: false,
      error: 'Solo médicos pueden firmar notas de evolución',
    };
  }

  const parsed = clinicalNoteSignSchema.safeParse({
    note_id: formData.get('note_id'),
  });
  if (!parsed.success) {
    return { success: false, error: 'ID de nota inválido' };
  }

  const { note_id } = parsed.data;

  const rows = await db
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
        eq(clinicalNotes.id, note_id),
        eq(patients.clinicId, session.clinicId),
      ),
    )
    .limit(1);

  if (rows.length === 0) {
    return { success: false, error: 'Nota no encontrada' };
  }

  const existing = rows[0];

  if (existing.authorId !== session.userId) {
    return {
      success: false,
      error: 'Solo el médico autor puede firmar esta nota',
    };
  }

  if (existing.isSigned) {
    return { success: false, error: 'La nota ya está firmada' };
  }

  const now = new Date();

  // Same concurrency guard as update: a concurrent sign attempt will see
  // `is_signed=true` in the WHERE clause and return zero rows, so only the
  // first writer succeeds.
  const result = await db
    .update(clinicalNotes)
    .set({ isSigned: true, signedAt: now, updatedAt: now })
    .where(
      and(
        eq(clinicalNotes.id, note_id),
        eq(clinicalNotes.authorId, session.userId),
        eq(clinicalNotes.isSigned, false),
      ),
    )
    .returning({ id: clinicalNotes.id });

  if (result.length === 0) {
    return { success: false, error: 'La nota ya está firmada' };
  }

  await auditLog({
    clinicId: session.clinicId,
    userId: session.userId,
    action: 'UPDATE',
    resourceType: 'clinical_note',
    resourceId: note_id,
    details: { action: 'sign', signedAt: now.toISOString() },
    ipAddress: await getClientIpFromHeaders(),
  });

  revalidatePath(`/pacientes/${existing.patientId}`);
  revalidatePath(`/pacientes/${existing.patientId}/notas`);
  revalidatePath(`/pacientes/${existing.patientId}/notas/${note_id}`);

  return { success: true, noteId: note_id, signed: true };
}
