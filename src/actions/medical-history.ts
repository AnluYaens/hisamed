'use server';

import { and, eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { medicalHistories, patients } from '@/lib/db/schema';
import { requireRole } from '@/lib/auth/session';
import { isDemoSession, demoWriteBlocked } from '@/lib/auth/demo';
import { auditLog, getClientIpFromHeaders } from '@/lib/audit';
import {
  medicalHistoryUpdateSchema,
  gynecologyDataSchema,
} from '@/lib/validators/medical-history';

export type MedicalHistoryActionState =
  | null
  | { success: true }
  | { success: false; error: string; fieldErrors?: Record<string, string[] | undefined> };

// ─── Field maps ───────────────────────────────────────────────────────────────
// Single source of truth for translating between form keys and DB columns.

type TextInputKey =
  | 'personal_history'
  | 'family_history'
  | 'surgical_history'
  | 'allergies'
  | 'current_medications'
  | 'habits';

type TextColumnKey =
  | 'personalHistory'
  | 'familyHistory'
  | 'surgicalHistory'
  | 'allergies'
  | 'currentMedications'
  | 'habits';

const TEXT_FIELD_MAP: ReadonlyArray<readonly [TextInputKey, TextColumnKey]> = [
  ['personal_history', 'personalHistory'],
  ['family_history', 'familyHistory'],
  ['surgical_history', 'surgicalHistory'],
  ['allergies', 'allergies'],
  ['current_medications', 'currentMedications'],
  ['habits', 'habits'],
] as const;

// ─── updateMedicalHistory ─────────────────────────────────────────────────────

export async function updateMedicalHistory(
  _prevState: MedicalHistoryActionState,
  formData: FormData,
): Promise<MedicalHistoryActionState> {
  let session;
  try {
    session = await requireRole(['admin', 'doctor']);
  } catch {
    return { success: false, error: 'Solo administradores y médicos pueden editar la historia clínica' };
  }

  if (isDemoSession(session)) return demoWriteBlocked();

  // Parse specialty_data JSON string from hidden input
  let specialtyDataRaw: unknown = undefined;
  const specialtyDataStr = formData.get('specialty_data');
  if (typeof specialtyDataStr === 'string' && specialtyDataStr.trim() !== '') {
    try {
      specialtyDataRaw = JSON.parse(specialtyDataStr);
    } catch {
      return { success: false, error: 'Datos ginecológicos con formato inválido' };
    }
  }

  // Distinguish "field not submitted" (FormData has no entry → undefined) from
  // "field submitted empty" ('' → user wants to clear the stored value).
  function readText(key: string): string | undefined {
    const v = formData.get(key);
    if (v === null) return undefined;
    return typeof v === 'string' ? v : undefined;
  }

  const raw = {
    patient_id: formData.get('patient_id') as string,
    personal_history: readText('personal_history'),
    family_history: readText('family_history'),
    surgical_history: readText('surgical_history'),
    allergies: readText('allergies'),
    current_medications: readText('current_medications'),
    habits: readText('habits'),
    specialty_data: specialtyDataRaw,
  };

  const parsed = medicalHistoryUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: 'Revisa los datos del formulario',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { patient_id, specialty_data, ...textFields } = parsed.data;

  // Primary tenant check: patient must belong to the caller's clinic.
  const patientRow = await db
    .select({ id: patients.id })
    .from(patients)
    .where(and(eq(patients.id, patient_id), eq(patients.clinicId, session.clinicId)))
    .limit(1);

  if (patientRow.length === 0) {
    return { success: false, error: 'Paciente no encontrado' };
  }

  // Re-validate specialty_data independently and strip undefined values so they
  // don't overwrite existing keys with null on the JSONB merge.
  let validatedSpecialtyData: Record<string, unknown> | undefined = undefined;
  if (specialty_data !== undefined) {
    const sdParsed = gynecologyDataSchema.safeParse(specialty_data);
    if (!sdParsed.success) {
      return { success: false, error: 'Datos ginecológicos inválidos' };
    }
    validatedSpecialtyData = Object.fromEntries(
      Object.entries(sdParsed.data).filter(([, v]) => v !== undefined),
    );
  }

  // Snapshot previous row (if any) for the audit diff.
  const existingRows = await db
    .select({
      personalHistory: medicalHistories.personalHistory,
      familyHistory: medicalHistories.familyHistory,
      surgicalHistory: medicalHistories.surgicalHistory,
      allergies: medicalHistories.allergies,
      currentMedications: medicalHistories.currentMedications,
      habits: medicalHistories.habits,
      specialtyData: medicalHistories.specialtyData,
    })
    .from(medicalHistories)
    .where(eq(medicalHistories.patientId, patient_id))
    .limit(1);
  const existing = existingRows[0] ?? null;

  // Collect "submitted" text fields only. '' is preserved here and converted
  // to NULL below so users can clear a previously-filled textarea.
  const submittedText: Partial<Record<TextColumnKey, string | null>> = {};
  for (const [inKey, dbKey] of TEXT_FIELD_MAP) {
    const val = textFields[inKey];
    if (val === undefined) continue;
    submittedText[dbKey] = val === '' ? null : val;
  }

  // Compute per-field diff for the audit log.
  const changes: Record<string, { before: unknown; after: unknown }> = {};
  for (const [, dbKey] of TEXT_FIELD_MAP) {
    if (!(dbKey in submittedText)) continue;
    const prev = existing ? existing[dbKey] ?? null : null;
    const next = submittedText[dbKey] ?? null;
    if (prev !== next) {
      changes[dbKey] = { before: prev, after: next };
    }
  }
  if (validatedSpecialtyData !== undefined) {
    const prevSpec = (existing?.specialtyData ?? {}) as Record<string, unknown>;
    for (const [k, v] of Object.entries(validatedSpecialtyData)) {
      const pv = prevSpec[k] ?? null;
      const nv = v ?? null;
      if (pv !== nv) {
        changes[`specialty_data.${k}`] = { before: pv, after: nv };
      }
    }
  }

  // Nothing actually changed and the row already exists → no-op save.
  if (existing !== null && Object.keys(changes).length === 0) {
    return { success: true };
  }

  // Build upsert payload. INSERT path takes the validated specialty_data as-is
  // (no existing row to merge with); UPDATE path merges at the key level.
  const insertValues: typeof medicalHistories.$inferInsert = {
    patientId: patient_id,
    updatedBy: session.userId,
    updatedAt: new Date(),
    ...submittedText,
    ...(validatedSpecialtyData !== undefined
      ? { specialtyData: validatedSpecialtyData }
      : {}),
  };

  const updateSet: Record<string, unknown> = {
    updatedAt: new Date(),
    updatedBy: session.userId,
    ...submittedText,
  };
  if (validatedSpecialtyData !== undefined) {
    // Shallow top-level merge: keys in the new payload overwrite existing keys,
    // everything else in the stored JSONB is preserved.
    updateSet.specialtyData = sql`COALESCE(${medicalHistories.specialtyData}, '{}'::jsonb) || excluded.specialty_data`;
  }

  // Defense-in-depth: the DO UPDATE path re-verifies, inside the same SQL
  // statement, that the conflicting row's patient still belongs to the caller's
  // clinic. The primary tenant check above already covers the current request;
  // this guards against any future TOCTOU or re-use of this action.
  await db
    .insert(medicalHistories)
    .values(insertValues)
    .onConflictDoUpdate({
      target: medicalHistories.patientId,
      set: updateSet,
      setWhere: sql`EXISTS (SELECT 1 FROM ${patients} WHERE ${patients.id} = ${medicalHistories.patientId} AND ${patients.clinicId} = ${session.clinicId})`,
    });

  await auditLog({
    clinicId: session.clinicId,
    userId: session.userId,
    action: existing === null ? 'CREATE' : 'UPDATE',
    resourceType: 'medical_history',
    resourceId: patient_id,
    details: {
      created: existing === null,
      changes,
    },
    ipAddress: await getClientIpFromHeaders(),
  });

  revalidatePath(`/pacientes/${patient_id}`);

  return { success: true };
}
