import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { clinicalNotes, patients, users } from '@/lib/db/schema';
import { requireRole } from '@/lib/auth/session';
import type { ClinicalNoteSpecialtyData } from '@/lib/validators/clinical-note';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ClinicalNoteListItem {
  id: string;
  patientId: string;
  appointmentId: string | null;
  authorId: string;
  noteDate: string;
  diagnosisText: string | null;
  diagnosisCode: string | null;
  chiefComplaint: string | null;
  isSigned: boolean;
  signedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  author: {
    id: string;
    fullName: string;
  };
}

export interface ClinicalNoteDetail extends ClinicalNoteListItem {
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  /**
   * Doctor-only. `null` for any other role. See the role-aware filter below —
   * this is scrubbed in the SELECT itself, NOT hidden at the UI layer.
   */
  internalNotes: string | null;
  specialtyData: ClinicalNoteSpecialtyData | null;
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    idNumber: string;
    dateOfBirth: string;
    sex: string;
  };
}

// ─── getClinicalNotesByPatient ────────────────────────────────────────────────
//
// Chronological DESC list of notes for a patient. Returns only the headline
// fields (diagnosis, date, author, signed state) — full note bodies are
// fetched per-note by `getClinicalNoteById`. The role gate lives inside the
// query so no call-site can accidentally bypass it:
//
//   - admin, doctor → can list
//   - receptionist  → throws "Sin permisos" via requireRole
//
// The query also enforces the clinic scope by joining `patients` and
// filtering on `patients.clinicId` derived from the session.

export async function getClinicalNotesByPatient(
  clinicId: string,
  patientId: string,
): Promise<ClinicalNoteListItem[]> {
  const session = await requireRole(['admin', 'doctor']);
  if (session.clinicId !== clinicId) {
    throw new Error('Sin permisos');
  }

  const rows = await db
    .select({
      id: clinicalNotes.id,
      patientId: clinicalNotes.patientId,
      appointmentId: clinicalNotes.appointmentId,
      authorId: clinicalNotes.authorId,
      noteDate: clinicalNotes.noteDate,
      diagnosisText: clinicalNotes.diagnosisText,
      diagnosisCode: clinicalNotes.diagnosisCode,
      chiefComplaint: clinicalNotes.chiefComplaint,
      isSigned: clinicalNotes.isSigned,
      signedAt: clinicalNotes.signedAt,
      createdAt: clinicalNotes.createdAt,
      updatedAt: clinicalNotes.updatedAt,
      authorId2: users.id,
      authorFullName: users.fullName,
    })
    .from(clinicalNotes)
    .innerJoin(patients, eq(clinicalNotes.patientId, patients.id))
    .innerJoin(users, eq(clinicalNotes.authorId, users.id))
    .where(
      and(
        eq(clinicalNotes.patientId, patientId),
        eq(patients.clinicId, clinicId),
      ),
    )
    .orderBy(desc(clinicalNotes.noteDate), desc(clinicalNotes.createdAt));

  return rows.map((r) => ({
    id: r.id,
    patientId: r.patientId,
    appointmentId: r.appointmentId,
    authorId: r.authorId,
    noteDate: r.noteDate as string,
    diagnosisText: r.diagnosisText,
    diagnosisCode: r.diagnosisCode,
    chiefComplaint: r.chiefComplaint,
    isSigned: r.isSigned,
    signedAt: r.signedAt,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    author: {
      id: r.authorId2,
      fullName: r.authorFullName,
    },
  }));
}

// ─── getClinicalNoteById ──────────────────────────────────────────────────────
//
// Full note for a single id. Enforces:
//   - Role must be admin or doctor (throws for receptionist).
//   - Clinic scope: note.patient.clinic_id must equal session.clinicId.
//   - `internal_notes` is NULLed out in the SELECT for any role that isn't
//     `doctor`. This is the security-critical filter called out in the
//     prompt — doing it at the query layer means no page, component, or
//     route can accidentally leak the field via `JSON.stringify(note)` or
//     a serialized Server Action response.

export async function getClinicalNoteById(
  clinicId: string,
  noteId: string,
): Promise<ClinicalNoteDetail | null> {
  const session = await requireRole(['admin', 'doctor']);
  if (session.clinicId !== clinicId) {
    throw new Error('Sin permisos');
  }

  const canViewInternalNotes = session.role === 'doctor';

  const rows = await db
    .select({
      id: clinicalNotes.id,
      patientId: clinicalNotes.patientId,
      appointmentId: clinicalNotes.appointmentId,
      authorId: clinicalNotes.authorId,
      noteDate: clinicalNotes.noteDate,
      chiefComplaint: clinicalNotes.chiefComplaint,
      subjective: clinicalNotes.subjective,
      objective: clinicalNotes.objective,
      assessment: clinicalNotes.assessment,
      plan: clinicalNotes.plan,
      diagnosisText: clinicalNotes.diagnosisText,
      diagnosisCode: clinicalNotes.diagnosisCode,
      // Literal NULL substitution at SQL level for non-doctor roles. Even
      // if something downstream spreads `...note` into a response, there's
      // no internal_notes value to leak.
      internalNotes: canViewInternalNotes
        ? clinicalNotes.internalNotes
        : sql<string | null>`NULL`.as('internal_notes'),
      specialtyData: clinicalNotes.specialtyData,
      isSigned: clinicalNotes.isSigned,
      signedAt: clinicalNotes.signedAt,
      createdAt: clinicalNotes.createdAt,
      updatedAt: clinicalNotes.updatedAt,
      authorId2: users.id,
      authorFullName: users.fullName,
      patientId2: patients.id,
      patientFirstName: patients.firstName,
      patientLastName: patients.lastName,
      patientIdNumber: patients.idNumber,
      patientDob: patients.dateOfBirth,
      patientSex: patients.sex,
    })
    .from(clinicalNotes)
    .innerJoin(patients, eq(clinicalNotes.patientId, patients.id))
    .innerJoin(users, eq(clinicalNotes.authorId, users.id))
    .where(
      and(
        eq(clinicalNotes.id, noteId),
        eq(patients.clinicId, clinicId),
      ),
    )
    .limit(1);

  if (rows.length === 0) return null;
  const r = rows[0];

  return {
    id: r.id,
    patientId: r.patientId,
    appointmentId: r.appointmentId,
    authorId: r.authorId,
    noteDate: r.noteDate as string,
    chiefComplaint: r.chiefComplaint,
    subjective: r.subjective,
    objective: r.objective,
    assessment: r.assessment,
    plan: r.plan,
    diagnosisText: r.diagnosisText,
    diagnosisCode: r.diagnosisCode,
    internalNotes: (r.internalNotes as string | null) ?? null,
    specialtyData: (r.specialtyData as ClinicalNoteSpecialtyData | null) ?? null,
    isSigned: r.isSigned,
    signedAt: r.signedAt,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    author: {
      id: r.authorId2,
      fullName: r.authorFullName,
    },
    patient: {
      id: r.patientId2,
      firstName: r.patientFirstName,
      lastName: r.patientLastName,
      idNumber: r.patientIdNumber,
      dateOfBirth: r.patientDob as string,
      sex: r.patientSex as string,
    },
  };
}

