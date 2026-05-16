import {
  and,
  desc,
  eq,
  gte,
  inArray,
  lte,
  sql,
  type AnyColumn,
  type SQL,
} from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  appointments,
  attachments,
  auditLogs,
  clinicalDocuments,
  clinicalNotes,
  medicalHistories,
  patients,
  users,
} from '@/lib/db/schema';
import type { AuditAction, ClinicalDocumentType } from '@/lib/db/schema';
import type { AppointmentStatus } from '@/lib/validators/appointment';
import type { AttachmentCategory } from '@/lib/validators/attachment';
import { isValidDateStr } from '@/lib/reports/date-range';

// ─── Constants ────────────────────────────────────────────────────────────────

export const APPOINTMENT_STATUSES: AppointmentStatus[] = [
  'scheduled',
  'confirmed',
  'waiting',
  'in_progress',
  'completed',
  'cancelled',
  'no_show',
];

export const DOCUMENT_TYPES: ClinicalDocumentType[] = [
  'medical_rest',
  'medical_certificate',
  'referral',
  'prescription',
  'patient_instructions',
  'lab_order',
  'imaging_order',
  'interconsultation',
];

export const ATTACHMENT_CATEGORIES: AttachmentCategory[] = [
  'lab_result',
  'imaging',
  'consent',
  'prescription',
  'procedure_photo',
  'ultrasound',
  'other',
];

/** A pregnancy whose FUM is older than this is "stale" (>= 42 weeks). */
const STALE_PREGNANCY_DAYS = 42 * 7;

const RECENT_LIMIT = 15;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReportFilters {
  /** Inclusive YYYY-MM-DD lower bound. */
  from: string;
  /** Inclusive YYYY-MM-DD upper bound. */
  to: string;
  /** Clinic's "today" (YYYY-MM-DD, clinic timezone) for point-in-time metrics. */
  today: string;
  /**
   * Optional doctor scope. Applies to appointments, notes, documents and
   * attachments. Point-in-time obstetric metrics ignore it (no doctor link).
   */
  doctorId?: string | null;
}

export interface ClinicalActivityReport {
  totalPatients: number;
  newPatients: number;
  totalAppointments: number;
  appointmentsByStatus: Record<AppointmentStatus, number>;
  notesCreated: number;
  notesSigned: number;
  notesDraft: number;
}

export interface DocumentsReport {
  byType: Record<ClinicalDocumentType, number>;
  totalDocuments: number;
  historyPdfExports: number;
  historyEmailExportsSent: number;
  historyEmailExportsAttempted: number;
}

export interface AttachmentsReport {
  byCategory: Record<AttachmentCategory, number>;
  totalAttachments: number;
  ultrasoundCount: number;
  procedurePhotoCount: number;
  totalStorageMb: number;
}

export interface ObstetricReport {
  activePregnancies: number;
  staleFumWarnings: number;
  ultrasoundNotes: number;
  gynecologicalExamNotes: number;
}

export interface RecentExportRow {
  id: string;
  createdAt: Date;
  userFullName: string | null;
  action: AuditAction;
  resourceType: string;
  resourceId: string | null;
  status: string | null;
}

export interface RecentActivityRow {
  id: string;
  type: 'note' | 'document' | 'attachment';
  occurredAt: Date;
  patientName: string;
  doctorName: string;
}

export interface ClinicReport {
  range: { from: string; to: string };
  activity: ClinicalActivityReport;
  documents: DocumentsReport;
  attachments: AttachmentsReport;
  obstetric: ObstetricReport;
  recentExports: RecentExportRow[];
  recentActivity: RecentActivityRow[];
  /** False when every aggregate is zero — lets the page show an empty state. */
  hasData: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Returns the two SQL conditions bounding an absolute-timestamp column to a
 * calendar-date range *in the clinic's timezone*. Calendar-date columns
 * (`appointments.date`, `clinical_notes.note_date`) must NOT use this — they
 * are compared directly against the YYYY-MM-DD strings.
 */
function tzDateRange(
  col: AnyColumn,
  timezone: string,
  from: string,
  to: string,
): SQL[] {
  return [
    sql`(${col} AT TIME ZONE ${timezone})::date >= ${from}::date`,
    sql`(${col} AT TIME ZONE ${timezone})::date <= ${to}::date`,
  ];
}

function emptyByStatus(): Record<AppointmentStatus, number> {
  return APPOINTMENT_STATUSES.reduce(
    (acc, s) => ({ ...acc, [s]: 0 }),
    {} as Record<AppointmentStatus, number>,
  );
}

function emptyByType(): Record<ClinicalDocumentType, number> {
  return DOCUMENT_TYPES.reduce(
    (acc, t) => ({ ...acc, [t]: 0 }),
    {} as Record<ClinicalDocumentType, number>,
  );
}

function emptyByCategory(): Record<AttachmentCategory, number> {
  return ATTACHMENT_CATEGORIES.reduce(
    (acc, c) => ({ ...acc, [c]: 0 }),
    {} as Record<AttachmentCategory, number>,
  );
}

// ─── Main aggregate ───────────────────────────────────────────────────────────

/**
 * Builds the full clinic reports dashboard payload. Every sub-query is
 * clinic-scoped (`clinic_id` filter, or a join onto `patients.clinic_id`);
 * the caller passes a `clinicId` derived from the session, so a report can
 * never read another clinic's data. Sub-queries run in parallel and are all
 * grouped/aggregated in SQL — no per-row work and no N+1.
 */
export async function getClinicReport(
  clinicId: string,
  timezone: string,
  filters: ReportFilters,
): Promise<ClinicReport> {
  const { from, to, today, doctorId } = filters;
  const doctor = doctorId || null;

  const staleThreshold = (() => {
    const d = new Date(today + 'T00:00:00Z');
    return new Date(d.getTime() - STALE_PREGNANCY_DAYS * 86_400_000)
      .toISOString()
      .slice(0, 10);
  })();

  const [
    totalPatientsRows,
    newPatientsRows,
    apptRows,
    noteRows,
    docRows,
    pdfExportRows,
    emailExportRows,
    attachmentRows,
    pregnancyRows,
    specialtyNoteRows,
    recentExportRows,
    recentNoteRows,
    recentDocRows,
    recentAttachmentRows,
  ] = await Promise.all([
    // A — total patients (all-time, clinic-wide)
    db
      .select({ cnt: sql<string>`count(*)` })
      .from(patients)
      .where(eq(patients.clinicId, clinicId)),

    // A — new patients in the period (createdAt is a timestamp → tz-aware)
    db
      .select({ cnt: sql<string>`count(*)` })
      .from(patients)
      .where(
        and(
          eq(patients.clinicId, clinicId),
          ...tzDateRange(patients.createdAt, timezone, from, to),
        ),
      ),

    // A — appointments grouped by status (date is a calendar-date column)
    db
      .select({ status: appointments.status, cnt: sql<string>`count(*)` })
      .from(appointments)
      .where(
        and(
          eq(appointments.clinicId, clinicId),
          gte(appointments.date, from),
          lte(appointments.date, to),
          doctor ? eq(appointments.doctorId, doctor) : undefined,
        ),
      )
      .groupBy(appointments.status),

    // A — clinical notes grouped by signed/draft (note_date is calendar-date)
    db
      .select({ isSigned: clinicalNotes.isSigned, cnt: sql<string>`count(*)` })
      .from(clinicalNotes)
      .innerJoin(patients, eq(clinicalNotes.patientId, patients.id))
      .where(
        and(
          eq(patients.clinicId, clinicId),
          gte(clinicalNotes.noteDate, from),
          lte(clinicalNotes.noteDate, to),
          doctor ? eq(clinicalNotes.authorId, doctor) : undefined,
        ),
      )
      .groupBy(clinicalNotes.isSigned),

    // B — documents grouped by type
    db
      .select({ documentType: clinicalDocuments.documentType, cnt: sql<string>`count(*)` })
      .from(clinicalDocuments)
      .where(
        and(
          eq(clinicalDocuments.clinicId, clinicId),
          ...tzDateRange(clinicalDocuments.createdAt, timezone, from, to),
          doctor ? eq(clinicalDocuments.authorId, doctor) : undefined,
        ),
      )
      .groupBy(clinicalDocuments.documentType),

    // B — patient-history PDF exports (audit log)
    db
      .select({ cnt: sql<string>`count(*)` })
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.clinicId, clinicId),
          eq(auditLogs.action, 'EXPORT'),
          eq(auditLogs.resourceType, 'patient_history'),
          ...tzDateRange(auditLogs.createdAt, timezone, from, to),
        ),
      ),

    // B — patient-history email exports grouped by delivery status
    db
      .select({
        status: sql<string | null>`${auditLogs.details}->>'status'`,
        cnt: sql<string>`count(*)`,
      })
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.clinicId, clinicId),
          eq(auditLogs.action, 'EMAIL_EXPORT'),
          eq(auditLogs.resourceType, 'patient_history'),
          ...tzDateRange(auditLogs.createdAt, timezone, from, to),
        ),
      )
      .groupBy(sql`${auditLogs.details}->>'status'`),

    // C — attachments grouped by category, with storage totals
    db
      .select({
        category: attachments.category,
        cnt: sql<string>`count(*)`,
        bytes: sql<string>`coalesce(sum(${attachments.fileSizeBytes}), 0)`,
      })
      .from(attachments)
      .innerJoin(patients, eq(attachments.patientId, patients.id))
      .where(
        and(
          eq(patients.clinicId, clinicId),
          ...tzDateRange(attachments.uploadedAt, timezone, from, to),
          doctor ? eq(attachments.uploadedBy, doctor) : undefined,
        ),
      )
      .groupBy(attachments.category),

    // D — pregnancies (point-in-time, clinic-wide). We deliberately fetch the
    // raw FUM string and classify active vs. stale in JS rather than casting
    // it to `date` in SQL: a value that is regex-shaped but not a real date
    // (e.g. "2026-02-30") would throw on a SQL `::date` cast and crash the
    // whole report. Scoped to female patients with a non-ended pregnancy and
    // a recorded FUM, so this is a short single-text-column read per patient.
    db
      .select({
        lmp: sql<
          string | null
        >`${medicalHistories.specialtyData}->>'last_menstrual_period'`,
      })
      .from(medicalHistories)
      .innerJoin(patients, eq(medicalHistories.patientId, patients.id))
      .where(
        and(
          eq(patients.clinicId, clinicId),
          eq(patients.sex, 'F'),
          sql`coalesce(${medicalHistories.specialtyData}->>'pregnancy_ended', '') <> 'true'`,
          sql`${medicalHistories.specialtyData}->>'last_menstrual_period' is not null`,
        ),
      ),

    // D — ultrasound / gynecological-exam notes in the period
    db
      .select({
        ultrasound: sql<string>`count(*) filter (where jsonb_typeof(${clinicalNotes.specialtyData}->'ultrasound') = 'object')`,
        exam: sql<string>`count(*) filter (where jsonb_typeof(${clinicalNotes.specialtyData}->'gynecological_exam') = 'object')`,
      })
      .from(clinicalNotes)
      .innerJoin(patients, eq(clinicalNotes.patientId, patients.id))
      .where(
        and(
          eq(patients.clinicId, clinicId),
          gte(clinicalNotes.noteDate, from),
          lte(clinicalNotes.noteDate, to),
          doctor ? eq(clinicalNotes.authorId, doctor) : undefined,
        ),
      ),

    // E — recent exports / email exports from the audit log
    db
      .select({
        id: auditLogs.id,
        createdAt: auditLogs.createdAt,
        userFullName: users.fullName,
        action: auditLogs.action,
        resourceType: auditLogs.resourceType,
        resourceId: auditLogs.resourceId,
        status: sql<string | null>`${auditLogs.details}->>'status'`,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .where(
        and(
          eq(auditLogs.clinicId, clinicId),
          inArray(auditLogs.action, ['EXPORT', 'EMAIL_EXPORT']),
          ...tzDateRange(auditLogs.createdAt, timezone, from, to),
        ),
      )
      .orderBy(desc(auditLogs.createdAt))
      .limit(RECENT_LIMIT),

    // E — recent clinical notes
    db
      .select({
        id: clinicalNotes.id,
        occurredAt: clinicalNotes.createdAt,
        firstName: patients.firstName,
        lastName: patients.lastName,
        doctorName: users.fullName,
      })
      .from(clinicalNotes)
      .innerJoin(patients, eq(clinicalNotes.patientId, patients.id))
      .innerJoin(users, eq(clinicalNotes.authorId, users.id))
      .where(
        and(
          eq(patients.clinicId, clinicId),
          ...tzDateRange(clinicalNotes.createdAt, timezone, from, to),
          doctor ? eq(clinicalNotes.authorId, doctor) : undefined,
        ),
      )
      .orderBy(desc(clinicalNotes.createdAt))
      .limit(RECENT_LIMIT),

    // E — recent clinical documents
    db
      .select({
        id: clinicalDocuments.id,
        occurredAt: clinicalDocuments.createdAt,
        firstName: patients.firstName,
        lastName: patients.lastName,
        doctorName: users.fullName,
      })
      .from(clinicalDocuments)
      .innerJoin(patients, eq(clinicalDocuments.patientId, patients.id))
      .innerJoin(users, eq(clinicalDocuments.authorId, users.id))
      .where(
        and(
          eq(clinicalDocuments.clinicId, clinicId),
          ...tzDateRange(clinicalDocuments.createdAt, timezone, from, to),
          doctor ? eq(clinicalDocuments.authorId, doctor) : undefined,
        ),
      )
      .orderBy(desc(clinicalDocuments.createdAt))
      .limit(RECENT_LIMIT),

    // E — recent attachments
    db
      .select({
        id: attachments.id,
        occurredAt: attachments.uploadedAt,
        firstName: patients.firstName,
        lastName: patients.lastName,
        doctorName: users.fullName,
      })
      .from(attachments)
      .innerJoin(patients, eq(attachments.patientId, patients.id))
      .innerJoin(users, eq(attachments.uploadedBy, users.id))
      .where(
        and(
          eq(patients.clinicId, clinicId),
          ...tzDateRange(attachments.uploadedAt, timezone, from, to),
          doctor ? eq(attachments.uploadedBy, doctor) : undefined,
        ),
      )
      .orderBy(desc(attachments.uploadedAt))
      .limit(RECENT_LIMIT),
  ]);

  // ── A — clinical activity ──
  const appointmentsByStatus = emptyByStatus();
  let totalAppointments = 0;
  for (const row of apptRows) {
    const n = num(row.cnt);
    appointmentsByStatus[row.status as AppointmentStatus] = n;
    totalAppointments += n;
  }

  let notesSigned = 0;
  let notesDraft = 0;
  for (const row of noteRows) {
    const n = num(row.cnt);
    if (row.isSigned) notesSigned += n;
    else notesDraft += n;
  }

  const activity: ClinicalActivityReport = {
    totalPatients: num(totalPatientsRows[0]?.cnt),
    newPatients: num(newPatientsRows[0]?.cnt),
    totalAppointments,
    appointmentsByStatus,
    notesCreated: notesSigned + notesDraft,
    notesSigned,
    notesDraft,
  };

  // ── B — documents ──
  const byType = emptyByType();
  let totalDocuments = 0;
  for (const row of docRows) {
    const n = num(row.cnt);
    byType[row.documentType as ClinicalDocumentType] = n;
    totalDocuments += n;
  }

  let emailSent = 0;
  let emailAttempted = 0;
  for (const row of emailExportRows) {
    const n = num(row.cnt);
    // 'attempted' is logged for every send; 'sent' confirms delivery. Counting
    // both lets the report show delivery success vs. total send attempts.
    if (row.status === 'sent') emailSent += n;
    if (row.status === 'attempted') emailAttempted += n;
  }

  const documents: DocumentsReport = {
    byType,
    totalDocuments,
    historyPdfExports: num(pdfExportRows[0]?.cnt),
    historyEmailExportsSent: emailSent,
    historyEmailExportsAttempted: emailAttempted,
  };

  // ── C — attachments ──
  const byCategory = emptyByCategory();
  let totalAttachments = 0;
  let totalBytes = 0;
  for (const row of attachmentRows) {
    const n = num(row.cnt);
    const cat = (row.category ?? 'other') as AttachmentCategory;
    byCategory[cat] = (byCategory[cat] ?? 0) + n;
    totalAttachments += n;
    totalBytes += num(row.bytes);
  }

  const attachmentsReport: AttachmentsReport = {
    byCategory,
    totalAttachments,
    ultrasoundCount: byCategory.ultrasound,
    procedurePhotoCount: byCategory.procedure_photo,
    totalStorageMb: Math.round((totalBytes / (1024 * 1024)) * 100) / 100,
  };

  // ── D — obstetric ──
  // A FUM within the last 42 weeks counts as an active pregnancy; an older
  // one raises a stale-FUM warning. Malformed/impossible FUM strings fail
  // `isValidDateStr` and are skipped entirely. String comparison is safe
  // here because both operands are validated YYYY-MM-DD values.
  let activePregnancies = 0;
  let staleFumWarnings = 0;
  for (const row of pregnancyRows) {
    if (!isValidDateStr(row.lmp)) continue;
    if (row.lmp >= staleThreshold) activePregnancies += 1;
    else staleFumWarnings += 1;
  }

  const obstetric: ObstetricReport = {
    activePregnancies,
    staleFumWarnings,
    ultrasoundNotes: num(specialtyNoteRows[0]?.ultrasound),
    gynecologicalExamNotes: num(specialtyNoteRows[0]?.exam),
  };

  // ── E — recent activity (merge note/document/attachment, newest first) ──
  const recentActivity: RecentActivityRow[] = [
    ...recentNoteRows.map((r) => ({
      id: r.id,
      type: 'note' as const,
      occurredAt: r.occurredAt,
      patientName: `${r.firstName} ${r.lastName}`,
      doctorName: r.doctorName,
    })),
    ...recentDocRows.map((r) => ({
      id: r.id,
      type: 'document' as const,
      occurredAt: r.occurredAt,
      patientName: `${r.firstName} ${r.lastName}`,
      doctorName: r.doctorName,
    })),
    ...recentAttachmentRows.map((r) => ({
      id: r.id,
      type: 'attachment' as const,
      occurredAt: r.occurredAt,
      patientName: `${r.firstName} ${r.lastName}`,
      doctorName: r.doctorName,
    })),
  ]
    .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
    .slice(0, RECENT_LIMIT);

  const hasData =
    activity.totalPatients > 0 ||
    activity.newPatients > 0 ||
    totalAppointments > 0 ||
    activity.notesCreated > 0 ||
    totalDocuments > 0 ||
    documents.historyPdfExports > 0 ||
    documents.historyEmailExportsSent > 0 ||
    documents.historyEmailExportsAttempted > 0 ||
    totalAttachments > 0 ||
    obstetric.activePregnancies > 0 ||
    obstetric.staleFumWarnings > 0 ||
    obstetric.ultrasoundNotes > 0 ||
    obstetric.gynecologicalExamNotes > 0 ||
    recentExportRows.length > 0 ||
    recentActivity.length > 0;

  return {
    range: { from, to },
    activity,
    documents,
    attachments: attachmentsReport,
    obstetric,
    recentExports: recentExportRows as RecentExportRow[],
    recentActivity,
    hasData,
  };
}

/**
 * Doctors of a clinic, for the admin-only doctor filter. Clinic-scoped and
 * role-filtered so the dropdown never lists another clinic's staff.
 */
export async function getClinicDoctorsForFilter(
  clinicId: string,
): Promise<{ id: string; fullName: string }[]> {
  return db
    .select({ id: users.id, fullName: users.fullName })
    .from(users)
    .where(and(eq(users.clinicId, clinicId), eq(users.role, 'doctor')))
    .orderBy(users.fullName);
}
