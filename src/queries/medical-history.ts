import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { medicalHistories, patients } from '@/lib/db/schema';
import { requireRole } from '@/lib/auth/session';
import type { GynecologyData } from '@/lib/validators/medical-history';

export interface MedicalHistoryRow {
  id: string;
  patientId: string;
  personalHistory: string | null;
  familyHistory: string | null;
  surgicalHistory: string | null;
  allergies: string | null;
  currentMedications: string | null;
  habits: string | null;
  specialtyData: GynecologyData | null;
  updatedAt: Date;
}

// Clinical data: role is enforced inside the query itself so no call-site can
// accidentally bypass it. The clinic scope is derived from the session — the
// caller cannot pass in another clinic's id.
export async function getMedicalHistory(
  patientId: string,
): Promise<MedicalHistoryRow | null> {
  const session = await requireRole(['admin', 'doctor']);

  const rows = await db
    .select({
      id: medicalHistories.id,
      patientId: medicalHistories.patientId,
      personalHistory: medicalHistories.personalHistory,
      familyHistory: medicalHistories.familyHistory,
      surgicalHistory: medicalHistories.surgicalHistory,
      allergies: medicalHistories.allergies,
      currentMedications: medicalHistories.currentMedications,
      habits: medicalHistories.habits,
      specialtyData: medicalHistories.specialtyData,
      updatedAt: medicalHistories.updatedAt,
    })
    .from(medicalHistories)
    .innerJoin(patients, eq(medicalHistories.patientId, patients.id))
    .where(
      and(
        eq(medicalHistories.patientId, patientId),
        eq(patients.clinicId, session.clinicId),
      ),
    )
    .limit(1);

  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    ...row,
    specialtyData: (row.specialtyData as GynecologyData | null) ?? null,
  };
}
