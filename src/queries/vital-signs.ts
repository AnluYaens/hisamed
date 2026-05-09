import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import { patients, users, vitalSigns } from '@/lib/db/schema';
import { requireRole } from '@/lib/auth/session';

export interface VitalSignsRow {
  id: string;
  clinicId: string;
  patientId: string;
  clinicalNoteId: string | null;
  recordedBy: string;
  recordedByName: string;
  recordedAt: Date;
  weightKg: number | null;
  heightCm: number | null;
  bmi: number | null;
  systolicBp: number | null;
  diastolicBp: number | null;
  heartRate: number | null;
  respiratoryRate: number | null;
  temperatureC: number | null;
  oxygenSaturation: number | null;
  notes: string | null;
  createdAt: Date;
}

// Drizzle returns `decimal` columns as strings to preserve precision; the UI
// always wants numbers (or null when missing). Centralize the coercion so
// callers don't have to remember.
function toNumber(v: string | null): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// All authenticated roles in the clinic can read vital signs — receptionists
// often capture them and need to confirm what they recorded. Clinic scope is
// enforced via the patients join.
export async function getVitalSignsByPatient(
  clinicId: string,
  patientId: string,
): Promise<VitalSignsRow[]> {
  const session = await requireRole(['admin', 'doctor', 'receptionist']);
  if (session.clinicId !== clinicId) {
    throw new Error('Sin permisos');
  }

  const rows = await db
    .select({
      id: vitalSigns.id,
      clinicId: vitalSigns.clinicId,
      patientId: vitalSigns.patientId,
      clinicalNoteId: vitalSigns.clinicalNoteId,
      recordedBy: vitalSigns.recordedBy,
      recordedByName: users.fullName,
      recordedAt: vitalSigns.recordedAt,
      weightKg: vitalSigns.weightKg,
      heightCm: vitalSigns.heightCm,
      bmi: vitalSigns.bmi,
      systolicBp: vitalSigns.systolicBp,
      diastolicBp: vitalSigns.diastolicBp,
      heartRate: vitalSigns.heartRate,
      respiratoryRate: vitalSigns.respiratoryRate,
      temperatureC: vitalSigns.temperatureC,
      oxygenSaturation: vitalSigns.oxygenSaturation,
      notes: vitalSigns.notes,
      createdAt: vitalSigns.createdAt,
    })
    .from(vitalSigns)
    .innerJoin(patients, eq(vitalSigns.patientId, patients.id))
    .innerJoin(users, eq(vitalSigns.recordedBy, users.id))
    .where(
      and(
        eq(vitalSigns.patientId, patientId),
        eq(vitalSigns.clinicId, clinicId),
        eq(patients.clinicId, clinicId),
      ),
    )
    .orderBy(desc(vitalSigns.recordedAt));

  return rows.map((r) => ({
    id: r.id,
    clinicId: r.clinicId,
    patientId: r.patientId,
    clinicalNoteId: r.clinicalNoteId,
    recordedBy: r.recordedBy,
    recordedByName: r.recordedByName,
    recordedAt: r.recordedAt,
    weightKg: toNumber(r.weightKg),
    heightCm: toNumber(r.heightCm),
    bmi: toNumber(r.bmi),
    systolicBp: r.systolicBp,
    diastolicBp: r.diastolicBp,
    heartRate: r.heartRate,
    respiratoryRate: r.respiratoryRate,
    temperatureC: toNumber(r.temperatureC),
    oxygenSaturation: r.oxygenSaturation,
    notes: r.notes,
    createdAt: r.createdAt,
  }));
}

// Most recent unassociated vital-signs record for a patient (clinical_note_id
// IS NULL) — what the doctor sees as "ya tomados por la asistente, ¿asociar?"
// when starting a new clinical note.
export async function getLatestUnassignedVitalSigns(
  clinicId: string,
  patientId: string,
): Promise<VitalSignsRow | null> {
  const session = await requireRole(['admin', 'doctor', 'receptionist']);
  if (session.clinicId !== clinicId) {
    throw new Error('Sin permisos');
  }

  const rows = await db
    .select({
      id: vitalSigns.id,
      clinicId: vitalSigns.clinicId,
      patientId: vitalSigns.patientId,
      clinicalNoteId: vitalSigns.clinicalNoteId,
      recordedBy: vitalSigns.recordedBy,
      recordedByName: users.fullName,
      recordedAt: vitalSigns.recordedAt,
      weightKg: vitalSigns.weightKg,
      heightCm: vitalSigns.heightCm,
      bmi: vitalSigns.bmi,
      systolicBp: vitalSigns.systolicBp,
      diastolicBp: vitalSigns.diastolicBp,
      heartRate: vitalSigns.heartRate,
      respiratoryRate: vitalSigns.respiratoryRate,
      temperatureC: vitalSigns.temperatureC,
      oxygenSaturation: vitalSigns.oxygenSaturation,
      notes: vitalSigns.notes,
      createdAt: vitalSigns.createdAt,
    })
    .from(vitalSigns)
    .innerJoin(patients, eq(vitalSigns.patientId, patients.id))
    .innerJoin(users, eq(vitalSigns.recordedBy, users.id))
    .where(
      and(
        eq(vitalSigns.patientId, patientId),
        eq(vitalSigns.clinicId, clinicId),
        eq(patients.clinicId, clinicId),
        isNull(vitalSigns.clinicalNoteId),
      ),
    )
    .orderBy(desc(vitalSigns.recordedAt))
    .limit(1);

  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: r.id,
    clinicId: r.clinicId,
    patientId: r.patientId,
    clinicalNoteId: r.clinicalNoteId,
    recordedBy: r.recordedBy,
    recordedByName: r.recordedByName,
    recordedAt: r.recordedAt,
    weightKg: toNumber(r.weightKg),
    heightCm: toNumber(r.heightCm),
    bmi: toNumber(r.bmi),
    systolicBp: r.systolicBp,
    diastolicBp: r.diastolicBp,
    heartRate: r.heartRate,
    respiratoryRate: r.respiratoryRate,
    temperatureC: toNumber(r.temperatureC),
    oxygenSaturation: r.oxygenSaturation,
    notes: r.notes,
    createdAt: r.createdAt,
  };
}
