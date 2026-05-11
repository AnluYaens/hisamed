import { z } from 'zod';

export const CLINICAL_DOCUMENT_TYPES = [
  'medical_rest',
  'medical_certificate',
  'referral',
  'prescription',
  'patient_instructions',
  'lab_order',
  'imaging_order',
  'interconsultation',
] as const;

export type ClinicalDocumentType = (typeof CLINICAL_DOCUMENT_TYPES)[number];

export const CLINICAL_DOCUMENT_TYPE_LABELS: Record<ClinicalDocumentType, string> = {
  medical_rest: 'Reposo médico',
  medical_certificate: 'Constancia médica',
  referral: 'Referencia',
  prescription: 'Récipe médico',
  patient_instructions: 'Indicaciones al paciente',
  lab_order: 'Orden de laboratorio',
  imaging_order: 'Orden de imagen',
  interconsultation: 'Interconsulta',
};

const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (formato YYYY-MM-DD)');

// ─── Per-type content schemas ─────────────────────────────────────────────────

export const medicalRestContentSchema = z.object({
  diagnosis: z.string().trim().min(1, 'El diagnóstico es obligatorio').max(500),
  rest_days: z.coerce
    .number()
    .int('Debe ser un número entero')
    .min(1, 'Debe ser al menos 1 día')
    .max(365, 'Máximo 365 días'),
  start_date: dateStr,
  // end_date is computed server-side from start_date + rest_days; we still
  // accept it from the client (the form pre-fills it) but the server
  // recomputes to keep the two fields consistent.
  end_date: dateStr,
  observations: z.string().max(4000).optional().or(z.literal('')),
});

export const medicalCertificateContentSchema = z.object({
  purpose: z
    .string()
    .trim()
    .min(1, 'El propósito de la constancia es obligatorio')
    .max(2000),
  observations: z.string().max(4000).optional().or(z.literal('')),
});

export const referralContentSchema = z.object({
  referred_to_specialty: z
    .string()
    .trim()
    .min(1, 'La especialidad es obligatoria')
    .max(255),
  referred_to_doctor: z.string().max(255).optional().or(z.literal('')),
  reason: z.string().trim().min(1, 'El motivo es obligatorio').max(4000),
  clinical_summary: z.string().max(8000).optional().or(z.literal('')),
});

export const prescriptionMedicationSchema = z.object({
  name: z.string().trim().min(1, 'El nombre del medicamento es obligatorio').max(255),
  dose: z.string().trim().min(1, 'La dosis es obligatoria').max(255),
  frequency: z.string().trim().min(1, 'La frecuencia es obligatoria').max(255),
  duration: z.string().trim().min(1, 'La duración es obligatoria').max(255),
  instructions: z.string().max(2000).optional().or(z.literal('')),
});

export const prescriptionContentSchema = z.object({
  medications: z
    .array(prescriptionMedicationSchema)
    .min(1, 'Debe agregar al menos un medicamento')
    .max(50),
});

export const patientInstructionsContentSchema = z.object({
  instructions: z.string().trim().min(1, 'Las indicaciones son obligatorias').max(8000),
});

// ─── Lab order ────────────────────────────────────────────────────────────────

export const labStudySchema = z.object({
  name: z.string().trim().min(1, 'El nombre del estudio es obligatorio').max(255),
  notes: z.string().trim().max(500).optional().or(z.literal('')),
});

export const labOrderContentSchema = z.object({
  studies: z
    .array(labStudySchema)
    .min(1, 'Debe agregar al menos un estudio'),
  clinical_indication: z
    .string()
    .trim()
    .min(1, 'La indicación clínica es obligatoria')
    .max(2000),
  fasting_required: z.boolean(),
  urgency: z.enum(['routine', 'urgent']),
  additional_instructions: z.string().trim().max(2000).optional().or(z.literal('')),
});

// ─── Imaging order ────────────────────────────────────────────────────────────

export const imagingStudySchema = z.object({
  name: z.string().trim().min(1, 'El nombre del estudio es obligatorio').max(255),
  notes: z.string().trim().max(500).optional().or(z.literal('')),
});

export const imagingOrderContentSchema = z.object({
  studies: z
    .array(imagingStudySchema)
    .min(1, 'Debe agregar al menos un estudio'),
  clinical_indication: z
    .string()
    .trim()
    .min(1, 'La indicación clínica es obligatoria')
    .max(2000),
  urgency: z.enum(['routine', 'urgent']),
});

// ─── Interconsultation ────────────────────────────────────────────────────────

export const interconsultationContentSchema = z.object({
  specialty: z.string().trim().min(1, 'La especialidad es obligatoria').max(255),
  doctor_name: z.string().trim().max(255).optional().or(z.literal('')),
  reason: z.string().trim().min(1, 'El motivo es obligatorio').max(2000),
  clinical_summary: z
    .string()
    .trim()
    .min(1, 'El resumen clínico es obligatorio')
    .max(8000),
  current_medications: z.string().trim().max(4000).optional().or(z.literal('')),
  urgency: z.enum(['routine', 'priority', 'urgent']),
  questions_for_specialist: z.string().trim().max(4000).optional().or(z.literal('')),
});

// ─── Discriminated union ──────────────────────────────────────────────────────

export const clinicalDocumentCreateSchema = z.discriminatedUnion('document_type', [
  z.object({
    document_type: z.literal('medical_rest'),
    title: z.string().trim().min(1).max(255),
    clinical_note_id: z.string().uuid().optional(),
    content: medicalRestContentSchema,
  }),
  z.object({
    document_type: z.literal('medical_certificate'),
    title: z.string().trim().min(1).max(255),
    clinical_note_id: z.string().uuid().optional(),
    content: medicalCertificateContentSchema,
  }),
  z.object({
    document_type: z.literal('referral'),
    title: z.string().trim().min(1).max(255),
    clinical_note_id: z.string().uuid().optional(),
    content: referralContentSchema,
  }),
  z.object({
    document_type: z.literal('prescription'),
    title: z.string().trim().min(1).max(255),
    clinical_note_id: z.string().uuid().optional(),
    content: prescriptionContentSchema,
  }),
  z.object({
    document_type: z.literal('patient_instructions'),
    title: z.string().trim().min(1).max(255),
    clinical_note_id: z.string().uuid().optional(),
    content: patientInstructionsContentSchema,
  }),
  z.object({
    document_type: z.literal('lab_order'),
    title: z.string().trim().min(1).max(255),
    clinical_note_id: z.string().uuid().optional(),
    content: labOrderContentSchema,
  }),
  z.object({
    document_type: z.literal('imaging_order'),
    title: z.string().trim().min(1).max(255),
    clinical_note_id: z.string().uuid().optional(),
    content: imagingOrderContentSchema,
  }),
  z.object({
    document_type: z.literal('interconsultation'),
    title: z.string().trim().min(1).max(255),
    clinical_note_id: z.string().uuid().optional(),
    content: interconsultationContentSchema,
  }),
]);

export type MedicalRestContent = z.infer<typeof medicalRestContentSchema>;
export type MedicalCertificateContent = z.infer<typeof medicalCertificateContentSchema>;
export type ReferralContent = z.infer<typeof referralContentSchema>;
export type PrescriptionMedication = z.infer<typeof prescriptionMedicationSchema>;
export type PrescriptionContent = z.infer<typeof prescriptionContentSchema>;
export type PatientInstructionsContent = z.infer<typeof patientInstructionsContentSchema>;
export type LabStudy = z.infer<typeof labStudySchema>;
export type LabOrderContent = z.infer<typeof labOrderContentSchema>;
export type ImagingStudy = z.infer<typeof imagingStudySchema>;
export type ImagingOrderContent = z.infer<typeof imagingOrderContentSchema>;
export type InterconsultationContent = z.infer<typeof interconsultationContentSchema>;

export type ClinicalDocumentCreateInput = z.infer<typeof clinicalDocumentCreateSchema>;

export type ClinicalDocumentContent =
  | MedicalRestContent
  | MedicalCertificateContent
  | ReferralContent
  | PrescriptionContent
  | PatientInstructionsContent
  | LabOrderContent
  | ImagingOrderContent
  | InterconsultationContent;
