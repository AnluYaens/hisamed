import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  date,
  time,
  integer,
  bigint,
  smallint,
  decimal,
  jsonb,
  uniqueIndex,
  index,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

// ─── Enums ────────────────────────────────────────────────────────────────────

export const userRoleEnum = pgEnum('user_role', ['admin', 'doctor', 'receptionist']);

export const bloodTypeEnum = pgEnum('blood_type', ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']);

export const idTypeEnum = pgEnum('id_type', ['cedula', 'passport', 'other']);

export const sexEnum = pgEnum('sex', ['F', 'M', 'other']);

export const appointmentStatusEnum = pgEnum('appointment_status', [
  'scheduled',
  'confirmed',
  'waiting',
  'in_progress',
  'completed',
  'cancelled',
  'no_show',
]);

export const attachmentCategoryEnum = pgEnum('attachment_category', [
  'lab_result',
  'imaging',
  'consent',
  'prescription',
  'procedure_photo',
  'ultrasound',
  'other',
]);

export const auditActionEnum = pgEnum('audit_action', [
  'CREATE',
  'READ',
  'UPDATE',
  'DELETE',
  'LOGIN',
  'LOGOUT',
  'EXPORT',
  'EMAIL_EXPORT',
]);

export const clinicalDocumentTypeEnum = pgEnum('clinical_document_type', [
  'medical_rest',
  'medical_certificate',
  'referral',
  'prescription',
  'patient_instructions',
  'lab_order',
  'imaging_order',
  'interconsultation',
]);

// ─── Tables ───────────────────────────────────────────────────────────────────

export const clinics = pgTable('clinics', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: varchar('name', { length: 255 }).notNull(),
  address: text('address'),
  phone: varchar('phone', { length: 50 }),
  timezone: varchar('timezone', { length: 50 }).notNull().default('America/Caracas'),
  // First day of the calendar week for this clinic. 0 = Sunday (US convention),
  // 1 = Monday (most of Europe / ISO 8601). Default 1 because it is the most
  // universal expectation; Venezuela accepts either without friction.
  weekStartsOn: smallint('week_starts_on').notNull().default(1),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    clinicId: uuid('clinic_id')
      .notNull()
      .references(() => clinics.id),
    email: varchar('email', { length: 255 }).notNull(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    fullName: varchar('full_name', { length: 255 }).notNull(),
    role: userRoleEnum('role').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    lastLoginAt: timestamp('last_login_at'),
  },
  (table) => [
    uniqueIndex('users_clinic_email_idx').on(table.clinicId, table.email),
    index('users_clinic_active_idx').on(table.clinicId, table.isActive),
  ],
);

export const patients = pgTable(
  'patients',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    clinicId: uuid('clinic_id')
      .notNull()
      .references(() => clinics.id),
    idNumber: varchar('id_number', { length: 50 }).notNull(),
    idType: idTypeEnum('id_type').notNull().default('cedula'),
    firstName: varchar('first_name', { length: 255 }).notNull(),
    lastName: varchar('last_name', { length: 255 }).notNull(),
    dateOfBirth: date('date_of_birth').notNull(),
    sex: sexEnum('sex').notNull(),
    phone: varchar('phone', { length: 50 }),
    email: varchar('email', { length: 255 }),
    address: text('address'),
    emergencyContactName: varchar('emergency_contact_name', { length: 255 }),
    emergencyContactPhone: varchar('emergency_contact_phone', { length: 50 }),
    insuranceInfo: text('insurance_info'),
    notes: text('notes'),
    avatarStorageKey: varchar('avatar_storage_key', { length: 500 }),
    bloodType: bloodTypeEnum('blood_type'),
    rhIncompatibility: boolean('rh_incompatibility').notNull().default(false),
    instagram: varchar('instagram', { length: 100 }),
    referralSource: varchar('referral_source', { length: 255 }),
    occupation: varchar('occupation', { length: 255 }),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
  },
  (table) => [
    uniqueIndex('patients_clinic_id_number_idx').on(table.clinicId, table.idNumber),
    index('patients_clinic_name_idx').on(table.clinicId, table.lastName, table.firstName),
    index('patients_clinic_active_idx').on(table.clinicId, table.isActive),
  ],
);

export const medicalHistories = pgTable('medical_histories', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  patientId: uuid('patient_id')
    .notNull()
    .unique()
    .references(() => patients.id),
  personalHistory: text('personal_history'),
  familyHistory: text('family_history'),
  surgicalHistory: text('surgical_history'),
  allergies: text('allergies'),
  currentMedications: text('current_medications'),
  habits: text('habits'),
  specialtyData: jsonb('specialty_data').default({}),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  updatedBy: uuid('updated_by')
    .notNull()
    .references(() => users.id),
});

export const patientPartners = pgTable(
  'patient_partners',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    patientId: uuid('patient_id')
      .notNull()
      .unique()
      .references(() => patients.id),
    fullName: varchar('full_name', { length: 255 }).notNull(),
    idNumber: varchar('id_number', { length: 50 }),
    dateOfBirth: date('date_of_birth'),
    phone: varchar('phone', { length: 50 }),
    email: varchar('email', { length: 255 }),
    bloodType: bloodTypeEnum('blood_type'),
    occupation: varchar('occupation', { length: 255 }),
    notes: text('notes'),
    avatarStorageKey: varchar('avatar_storage_key', { length: 500 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('patient_partners_patient_id_idx').on(table.patientId),
  ],
);

export const appointments = pgTable(
  'appointments',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    clinicId: uuid('clinic_id')
      .notNull()
      .references(() => clinics.id),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id),
    doctorId: uuid('doctor_id')
      .notNull()
      .references(() => users.id),
    date: date('date').notNull(),
    startTime: time('start_time').notNull(),
    endTime: time('end_time'),
    status: appointmentStatusEnum('status').notNull().default('scheduled'),
    reason: varchar('reason', { length: 500 }),
    notes: text('notes'),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    cancelledAt: timestamp('cancelled_at'),
    cancelledBy: uuid('cancelled_by').references(() => users.id),
  },
  (table) => [
    index('appointments_clinic_doctor_date_idx').on(table.clinicId, table.doctorId, table.date),
    index('appointments_clinic_patient_idx').on(table.clinicId, table.patientId),
    index('appointments_clinic_date_status_idx').on(table.clinicId, table.date, table.status),
  ],
);

export const clinicalNotes = pgTable(
  'clinical_notes',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id),
    appointmentId: uuid('appointment_id').references(() => appointments.id),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id),
    noteDate: date('note_date').notNull(),
    chiefComplaint: text('chief_complaint'),
    subjective: text('subjective'),
    objective: text('objective'),
    assessment: text('assessment'),
    plan: text('plan'),
    diagnoses: jsonb('diagnoses').notNull().default([]),
    internalNotes: text('internal_notes'),
    specialtyData: jsonb('specialty_data').default({}),
    isSigned: boolean('is_signed').notNull().default(false),
    signedAt: timestamp('signed_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('clinical_notes_patient_date_idx').on(table.patientId, table.noteDate),
    index('clinical_notes_author_idx').on(table.authorId),
  ],
);

export const attachments = pgTable(
  'attachments',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id),
    clinicalNoteId: uuid('clinical_note_id').references(() => clinicalNotes.id),
    uploadedBy: uuid('uploaded_by')
      .notNull()
      .references(() => users.id),
    fileName: varchar('file_name', { length: 255 }).notNull(),
    storageKey: varchar('storage_key', { length: 500 }).notNull(),
    fileType: varchar('file_type', { length: 100 }).notNull(),
    fileSizeBytes: integer('file_size_bytes').notNull(),
    category: attachmentCategoryEnum('category').default('other'),
    description: varchar('description', { length: 500 }),
    uploadedAt: timestamp('uploaded_at').notNull().defaultNow(),
  },
  (table) => [
    index('attachments_patient_idx').on(table.patientId),
    index('attachments_clinical_note_idx').on(table.clinicalNoteId),
  ],
);

// Generated clinical documents (medical rest, certificates, referrals,
// prescriptions, patient instructions). Body fields live in the JSONB
// `content` column with shape varying per `document_type` — see
// `src/lib/validators/clinical-document.ts` for the discriminated schemas.
export const clinicalDocuments = pgTable(
  'clinical_documents',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    clinicId: uuid('clinic_id')
      .notNull()
      .references(() => clinics.id),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id),
    clinicalNoteId: uuid('clinical_note_id').references(() => clinicalNotes.id),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id),
    documentType: clinicalDocumentTypeEnum('document_type').notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    content: jsonb('content').notNull().default({}),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('clinical_documents_clinic_patient_idx').on(table.clinicId, table.patientId),
    index('clinical_documents_patient_created_idx').on(table.patientId, table.createdAt),
    index('clinical_documents_clinical_note_idx').on(table.clinicalNoteId),
  ],
);

// Vital signs are taken at the start of each consultation. They live in their
// own table — not denormalized into clinical_notes — so the receptionist can
// record them before the doctor opens the note (clinical_note_id NULL until
// the doctor associates them) and so trends across visits can be charted
// without parsing JSONB blobs. BMI is computed at write time when both
// weight_kg and height_cm are present; readers should treat it as a derived
// snapshot of the inputs at that moment, not as a separately editable field.
export const vitalSigns = pgTable(
  'vital_signs',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    clinicId: uuid('clinic_id')
      .notNull()
      .references(() => clinics.id),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id),
    clinicalNoteId: uuid('clinical_note_id').references(() => clinicalNotes.id),
    recordedBy: uuid('recorded_by')
      .notNull()
      .references(() => users.id),
    recordedAt: timestamp('recorded_at').notNull().defaultNow(),
    weightKg: decimal('weight_kg', { precision: 5, scale: 2 }),
    heightCm: decimal('height_cm', { precision: 5, scale: 1 }),
    bmi: decimal('bmi', { precision: 4, scale: 1 }),
    systolicBp: integer('systolic_bp'),
    diastolicBp: integer('diastolic_bp'),
    heartRate: integer('heart_rate'),
    respiratoryRate: integer('respiratory_rate'),
    temperatureC: decimal('temperature_c', { precision: 4, scale: 1 }),
    oxygenSaturation: integer('oxygen_saturation'),
    notes: text('notes'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('vital_signs_clinic_patient_recorded_idx').on(
      table.clinicId,
      table.patientId,
      table.recordedAt,
    ),
    index('vital_signs_clinical_note_idx').on(table.clinicalNoteId),
  ],
);

// Append-only: no FK constraints so records survive user deletion
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  clinicId: uuid('clinic_id').notNull(),
  userId: uuid('user_id').notNull(),
  action: auditActionEnum('action').notNull(),
  resourceType: varchar('resource_type', { length: 50 }).notNull(),
  resourceId: uuid('resource_id'),
  details: jsonb('details'),
  ipAddress: varchar('ip_address', { length: 45 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Fixed-window rate-limit counters. One row per (hashed key, window). The
// key is a SHA-256 hex digest so no raw IP, email or PHI is ever stored.
// Rows are disposable: stale windows are pruned opportunistically on write,
// so the table stays bounded to roughly one row per recently-active key.
export const rateLimitBuckets = pgTable(
  'rate_limit_buckets',
  {
    keyHash: varchar('key_hash', { length: 64 }).notNull(),
    // Epoch milliseconds of the window's start. A plain integer — never a
    // calendar date — so timezone rules in AGENTS.md do not apply here.
    windowStart: bigint('window_start', { mode: 'number' }).notNull(),
    count: integer('count').notNull().default(0),
  },
  (table) => [
    primaryKey({ columns: [table.keyHash, table.windowStart] }),
    index('rate_limit_buckets_window_start_idx').on(table.windowStart),
  ],
);

// ─── Relations ────────────────────────────────────────────────────────────────

export const clinicsRelations = relations(clinics, ({ many }) => ({
  users: many(users),
  patients: many(patients),
  appointments: many(appointments),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  clinic: one(clinics, { fields: [users.clinicId], references: [clinics.id] }),
  patientsCreated: many(patients),
  appointments: many(appointments, { relationName: 'doctorAppointments' }),
  clinicalNotes: many(clinicalNotes),
  attachments: many(attachments),
}));

export const patientsRelations = relations(patients, ({ one, many }) => ({
  clinic: one(clinics, { fields: [patients.clinicId], references: [clinics.id] }),
  createdByUser: one(users, { fields: [patients.createdBy], references: [users.id] }),
  medicalHistory: one(medicalHistories),
  partner: one(patientPartners),
  appointments: many(appointments),
  clinicalNotes: many(clinicalNotes),
  attachments: many(attachments),
}));

export const patientPartnersRelations = relations(patientPartners, ({ one }) => ({
  patient: one(patients, { fields: [patientPartners.patientId], references: [patients.id] }),
}));

export const medicalHistoriesRelations = relations(medicalHistories, ({ one }) => ({
  patient: one(patients, { fields: [medicalHistories.patientId], references: [patients.id] }),
  updatedByUser: one(users, { fields: [medicalHistories.updatedBy], references: [users.id] }),
}));

export const appointmentsRelations = relations(appointments, ({ one, many }) => ({
  clinic: one(clinics, { fields: [appointments.clinicId], references: [clinics.id] }),
  patient: one(patients, { fields: [appointments.patientId], references: [patients.id] }),
  doctor: one(users, {
    fields: [appointments.doctorId],
    references: [users.id],
    relationName: 'doctorAppointments',
  }),
  createdByUser: one(users, { fields: [appointments.createdBy], references: [users.id] }),
  clinicalNotes: many(clinicalNotes),
}));

export const clinicalNotesRelations = relations(clinicalNotes, ({ one, many }) => ({
  patient: one(patients, { fields: [clinicalNotes.patientId], references: [patients.id] }),
  appointment: one(appointments, {
    fields: [clinicalNotes.appointmentId],
    references: [appointments.id],
  }),
  author: one(users, { fields: [clinicalNotes.authorId], references: [users.id] }),
  attachments: many(attachments),
  vitalSigns: many(vitalSigns),
}));

export const vitalSignsRelations = relations(vitalSigns, ({ one }) => ({
  clinic: one(clinics, { fields: [vitalSigns.clinicId], references: [clinics.id] }),
  patient: one(patients, { fields: [vitalSigns.patientId], references: [patients.id] }),
  clinicalNote: one(clinicalNotes, {
    fields: [vitalSigns.clinicalNoteId],
    references: [clinicalNotes.id],
  }),
  recordedByUser: one(users, { fields: [vitalSigns.recordedBy], references: [users.id] }),
}));

export const clinicalDocumentsRelations = relations(clinicalDocuments, ({ one }) => ({
  clinic: one(clinics, { fields: [clinicalDocuments.clinicId], references: [clinics.id] }),
  patient: one(patients, { fields: [clinicalDocuments.patientId], references: [patients.id] }),
  clinicalNote: one(clinicalNotes, {
    fields: [clinicalDocuments.clinicalNoteId],
    references: [clinicalNotes.id],
  }),
  author: one(users, { fields: [clinicalDocuments.authorId], references: [users.id] }),
}));

export const attachmentsRelations = relations(attachments, ({ one }) => ({
  patient: one(patients, { fields: [attachments.patientId], references: [patients.id] }),
  clinicalNote: one(clinicalNotes, {
    fields: [attachments.clinicalNoteId],
    references: [clinicalNotes.id],
  }),
  uploadedByUser: one(users, { fields: [attachments.uploadedBy], references: [users.id] }),
}));

// ─── Types ────────────────────────────────────────────────────────────────────

export type Clinic = typeof clinics.$inferSelect;
export type NewClinic = typeof clinics.$inferInsert;

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Patient = typeof patients.$inferSelect;
export type NewPatient = typeof patients.$inferInsert;

export type MedicalHistory = typeof medicalHistories.$inferSelect;
export type NewMedicalHistory = typeof medicalHistories.$inferInsert;

export type Appointment = typeof appointments.$inferSelect;
export type NewAppointment = typeof appointments.$inferInsert;

export type ClinicalNote = typeof clinicalNotes.$inferSelect;
export type NewClinicalNote = typeof clinicalNotes.$inferInsert;
export type DiagnosisEntry = { code?: string; text: string };

export type Attachment = typeof attachments.$inferSelect;
export type NewAttachment = typeof attachments.$inferInsert;

export type ClinicalDocument = typeof clinicalDocuments.$inferSelect;
export type NewClinicalDocument = typeof clinicalDocuments.$inferInsert;
export type ClinicalDocumentType =
  | 'medical_rest'
  | 'medical_certificate'
  | 'referral'
  | 'prescription'
  | 'patient_instructions'
  | 'lab_order'
  | 'imaging_order'
  | 'interconsultation';

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;

export type RateLimitBucket = typeof rateLimitBuckets.$inferSelect;
export type NewRateLimitBucket = typeof rateLimitBuckets.$inferInsert;

export type VitalSigns = typeof vitalSigns.$inferSelect;
export type NewVitalSigns = typeof vitalSigns.$inferInsert;

export type PatientPartner = typeof patientPartners.$inferSelect;
export type NewPatientPartner = typeof patientPartners.$inferInsert;

export type UserRole = 'admin' | 'doctor' | 'receptionist';
export type AuditAction =
  | 'CREATE'
  | 'READ'
  | 'UPDATE'
  | 'DELETE'
  | 'LOGIN'
  | 'LOGOUT'
  | 'EXPORT'
  | 'EMAIL_EXPORT';
export type BloodType = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
