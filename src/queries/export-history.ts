import { and, asc, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  attachments,
  clinicalDocuments,
  clinicalNotes,
  medicalHistories,
  patientPartners,
  patients,
  users,
  vitalSigns,
} from '@/lib/db/schema';
import type {
  AuditAction,
  BloodType,
  ClinicalDocumentType,
} from '@/lib/db/schema';
import type { AttachmentCategory } from '@/lib/validators/attachment';
import type { ClinicalNoteSpecialtyData, DiagnosisEntry } from '@/lib/validators/clinical-note';
import type { GynecologyData } from '@/lib/validators/medical-history';
import type { FullClinic } from './clinic';

// Aggregated data needed to render a patient's full clinical history PDF.
//
// Clinic scope is enforced inside `getPatientHistoryForExport` by filtering
// every join on `patients.clinicId`. The route handler additionally checks
// the caller's role (admin/doctor) before invoking this helper.

export interface PatientHistoryPatient {
  id: string;
  idNumber: string;
  idType: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  sex: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  bloodType: BloodType | null;
  rhIncompatibility: boolean;
}

export interface PatientHistoryPartner {
  fullName: string;
  idNumber: string | null;
  dateOfBirth: string | null;
  phone: string | null;
  email: string | null;
  bloodType: BloodType | null;
  occupation: string | null;
  notes: string | null;
}

export interface PatientHistoryMedicalHistory {
  personalHistory: string | null;
  familyHistory: string | null;
  surgicalHistory: string | null;
  allergies: string | null;
  currentMedications: string | null;
  habits: string | null;
  specialtyData: GynecologyData | null;
}

export interface PatientHistoryVitalSigns {
  recordedAt: Date;
  recordedByName: string;
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
}

export interface PatientHistoryNote {
  id: string;
  noteDate: string;
  authorFullName: string;
  chiefComplaint: string | null;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  diagnoses: DiagnosisEntry[];
  specialtyData: ClinicalNoteSpecialtyData | null;
  isSigned: boolean;
  signedAt: Date | null;
  vitals: PatientHistoryVitalSigns[];
}

export interface PatientHistoryDocument {
  id: string;
  documentType: ClinicalDocumentType;
  title: string;
  createdAt: Date;
  authorFullName: string;
  clinicalNoteId: string | null;
  clinicalNoteDate: string | null;
}

export interface PatientHistoryAttachment {
  id: string;
  fileName: string;
  fileType: string;
  category: AttachmentCategory | null;
  uploadedAt: Date;
  uploadedByName: string;
  clinicalNoteId: string | null;
  clinicalNoteDate: string | null;
}

export interface PatientHistoryPayload {
  clinic: FullClinic;
  patient: PatientHistoryPatient;
  partner: PatientHistoryPartner | null;
  medicalHistory: PatientHistoryMedicalHistory | null;
  notes: PatientHistoryNote[];
  documents: PatientHistoryDocument[];
  attachments: PatientHistoryAttachment[];
}

function toNumber(v: string | null): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseDiagnoses(raw: unknown): DiagnosisEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw as DiagnosisEntry[];
}

// Aggregates everything the PDF generator needs in one call. All sub-queries
// run in parallel and are clinic-scoped via `patients.clinicId`. The patient
// row is fetched first so a cross-clinic or non-existent id short-circuits
// before any of the other lookups run.
export async function getPatientHistoryForExport(
  clinic: FullClinic,
  patientId: string,
): Promise<PatientHistoryPayload | null> {
  const patientRow = await db
    .select({
      id: patients.id,
      idNumber: patients.idNumber,
      idType: patients.idType,
      firstName: patients.firstName,
      lastName: patients.lastName,
      dateOfBirth: patients.dateOfBirth,
      sex: patients.sex,
      phone: patients.phone,
      email: patients.email,
      address: patients.address,
      bloodType: patients.bloodType,
      rhIncompatibility: patients.rhIncompatibility,
    })
    .from(patients)
    .where(and(eq(patients.id, patientId), eq(patients.clinicId, clinic.id)))
    .limit(1);

  if (patientRow.length === 0) return null;
  const p = patientRow[0];

  const [
    partnerRows,
    historyRows,
    noteRows,
    vitalRows,
    documentRows,
    attachmentRows,
  ] = await Promise.all([
    db
      .select({
        fullName: patientPartners.fullName,
        idNumber: patientPartners.idNumber,
        dateOfBirth: patientPartners.dateOfBirth,
        phone: patientPartners.phone,
        email: patientPartners.email,
        bloodType: patientPartners.bloodType,
        occupation: patientPartners.occupation,
        notes: patientPartners.notes,
      })
      .from(patientPartners)
      .where(eq(patientPartners.patientId, patientId))
      .limit(1),
    db
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
      .where(eq(medicalHistories.patientId, patientId))
      .limit(1),
    db
      .select({
        id: clinicalNotes.id,
        noteDate: clinicalNotes.noteDate,
        chiefComplaint: clinicalNotes.chiefComplaint,
        subjective: clinicalNotes.subjective,
        objective: clinicalNotes.objective,
        assessment: clinicalNotes.assessment,
        plan: clinicalNotes.plan,
        diagnoses: clinicalNotes.diagnoses,
        specialtyData: clinicalNotes.specialtyData,
        isSigned: clinicalNotes.isSigned,
        signedAt: clinicalNotes.signedAt,
        createdAt: clinicalNotes.createdAt,
        authorFullName: users.fullName,
      })
      .from(clinicalNotes)
      .innerJoin(users, eq(clinicalNotes.authorId, users.id))
      .innerJoin(patients, eq(clinicalNotes.patientId, patients.id))
      .where(
        and(eq(clinicalNotes.patientId, patientId), eq(patients.clinicId, clinic.id)),
      )
      .orderBy(desc(clinicalNotes.noteDate), desc(clinicalNotes.createdAt)),
    db
      .select({
        clinicalNoteId: vitalSigns.clinicalNoteId,
        recordedAt: vitalSigns.recordedAt,
        recordedByName: users.fullName,
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
      })
      .from(vitalSigns)
      .innerJoin(users, eq(vitalSigns.recordedBy, users.id))
      .where(
        and(
          eq(vitalSigns.patientId, patientId),
          eq(vitalSigns.clinicId, clinic.id),
        ),
      )
      .orderBy(asc(vitalSigns.recordedAt)),
    db
      .select({
        id: clinicalDocuments.id,
        documentType: clinicalDocuments.documentType,
        title: clinicalDocuments.title,
        createdAt: clinicalDocuments.createdAt,
        authorFullName: users.fullName,
        clinicalNoteId: clinicalDocuments.clinicalNoteId,
        clinicalNoteDate: clinicalNotes.noteDate,
      })
      .from(clinicalDocuments)
      .innerJoin(users, eq(clinicalDocuments.authorId, users.id))
      .leftJoin(clinicalNotes, eq(clinicalDocuments.clinicalNoteId, clinicalNotes.id))
      .where(
        and(
          eq(clinicalDocuments.patientId, patientId),
          eq(clinicalDocuments.clinicId, clinic.id),
        ),
      )
      .orderBy(desc(clinicalDocuments.createdAt)),
    db
      .select({
        id: attachments.id,
        fileName: attachments.fileName,
        fileType: attachments.fileType,
        category: attachments.category,
        uploadedAt: attachments.uploadedAt,
        uploadedByName: users.fullName,
        clinicalNoteId: attachments.clinicalNoteId,
        clinicalNoteDate: clinicalNotes.noteDate,
      })
      .from(attachments)
      .innerJoin(patients, eq(attachments.patientId, patients.id))
      .innerJoin(users, eq(attachments.uploadedBy, users.id))
      .leftJoin(clinicalNotes, eq(attachments.clinicalNoteId, clinicalNotes.id))
      .where(
        and(eq(attachments.patientId, patientId), eq(patients.clinicId, clinic.id)),
      )
      .orderBy(desc(attachments.uploadedAt)),
  ]);

  // Group vital signs by their associated clinical note id so each note in
  // the PDF can render the readings taken at that visit. Vitals without a
  // linked note (free-floating measurements taken by the receptionist) are
  // intentionally dropped here — they're not part of the consultation and
  // adding them would make the per-note section confusing.
  const vitalsByNote = new Map<string, PatientHistoryVitalSigns[]>();
  for (const v of vitalRows) {
    if (!v.clinicalNoteId) continue;
    const list = vitalsByNote.get(v.clinicalNoteId) ?? [];
    list.push({
      recordedAt: v.recordedAt,
      recordedByName: v.recordedByName,
      weightKg: toNumber(v.weightKg),
      heightCm: toNumber(v.heightCm),
      bmi: toNumber(v.bmi),
      systolicBp: v.systolicBp,
      diastolicBp: v.diastolicBp,
      heartRate: v.heartRate,
      respiratoryRate: v.respiratoryRate,
      temperatureC: toNumber(v.temperatureC),
      oxygenSaturation: v.oxygenSaturation,
      notes: v.notes,
    });
    vitalsByNote.set(v.clinicalNoteId, list);
  }

  const partner = partnerRows[0] ?? null;
  const history = historyRows[0] ?? null;

  return {
    clinic,
    patient: {
      id: p.id,
      idNumber: p.idNumber,
      idType: p.idType as string,
      firstName: p.firstName,
      lastName: p.lastName,
      dateOfBirth: p.dateOfBirth as string,
      sex: p.sex as string,
      phone: p.phone,
      email: p.email,
      address: p.address,
      bloodType: (p.bloodType as BloodType | null) ?? null,
      rhIncompatibility: p.rhIncompatibility,
    },
    partner: partner
      ? {
          fullName: partner.fullName,
          idNumber: partner.idNumber,
          dateOfBirth: (partner.dateOfBirth as string | null) ?? null,
          phone: partner.phone,
          email: partner.email,
          bloodType: (partner.bloodType as BloodType | null) ?? null,
          occupation: partner.occupation,
          notes: partner.notes,
        }
      : null,
    medicalHistory: history
      ? {
          personalHistory: history.personalHistory,
          familyHistory: history.familyHistory,
          surgicalHistory: history.surgicalHistory,
          allergies: history.allergies,
          currentMedications: history.currentMedications,
          habits: history.habits,
          specialtyData: (history.specialtyData as GynecologyData | null) ?? null,
        }
      : null,
    notes: noteRows.map((n) => ({
      id: n.id,
      noteDate: n.noteDate as string,
      authorFullName: n.authorFullName,
      chiefComplaint: n.chiefComplaint,
      subjective: n.subjective,
      objective: n.objective,
      assessment: n.assessment,
      plan: n.plan,
      diagnoses: parseDiagnoses(n.diagnoses),
      specialtyData: (n.specialtyData as ClinicalNoteSpecialtyData | null) ?? null,
      isSigned: n.isSigned,
      signedAt: n.signedAt,
      vitals: vitalsByNote.get(n.id) ?? [],
    })),
    documents: documentRows.map((d) => ({
      id: d.id,
      documentType: d.documentType as ClinicalDocumentType,
      title: d.title,
      createdAt: d.createdAt,
      authorFullName: d.authorFullName,
      clinicalNoteId: d.clinicalNoteId,
      clinicalNoteDate: (d.clinicalNoteDate as string | null) ?? null,
    })),
    attachments: attachmentRows.map((a) => ({
      id: a.id,
      fileName: a.fileName,
      fileType: a.fileType,
      category: (a.category as AttachmentCategory | null) ?? null,
      uploadedAt: a.uploadedAt,
      uploadedByName: a.uploadedByName,
      clinicalNoteId: a.clinicalNoteId,
      clinicalNoteDate: (a.clinicalNoteDate as string | null) ?? null,
    })),
  };
}

// Re-export the audit action type so the route handler can stay in one
// import line. Not strictly needed for typing but keeps the surface tight.
export type { AuditAction };
