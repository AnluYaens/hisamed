import { z } from 'zod';

// ─── specialty_data (consulta ginecológica) ───────────────────────────────────
// Schema for the JSONB `specialty_data` column on clinical notes. Mirrors
// PRD Técnico §1 plus `height_cm` which we keep here (not in the relational
// columns) so the BMI auto-calc has somewhere to persist its input.

export const bloodPressureRegex = /^\s*\d{2,3}\/\d{2,3}\s*$/;

export const clinicalNoteSpecialtyDataSchema = z.object({
  blood_pressure: z
    .string()
    .regex(bloodPressureRegex, 'Formato TA inválido (ej: 120/80)')
    .max(20)
    .nullable()
    .optional(),
  weight_kg: z.coerce.number().min(0).max(500).nullable().optional(),
  height_cm: z.coerce.number().min(0).max(250).nullable().optional(),
  bmi: z.coerce.number().min(0).max(200).nullable().optional(),
  last_menstrual_period: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)')
    .nullable()
    .optional(),
  gestational_age_weeks: z.coerce.number().min(0).max(45).nullable().optional(),
  ultrasound_findings: z.preprocess(
    (v) => (v === '' ? null : v),
    z.string().max(4000).nullable().optional(),
  ),
  follicle_count_left: z.coerce.number().int().min(0).max(100).nullable().optional(),
  follicle_count_right: z.coerce.number().int().min(0).max(100).nullable().optional(),
  endometrial_thickness_mm: z.coerce.number().min(0).max(50).nullable().optional(),
  procedure_performed: z.preprocess(
    (v) => (v === '' ? null : v),
    z.string().max(2000).nullable().optional(),
  ),
  treatment_protocol: z.preprocess(
    (v) => (v === '' ? null : v),
    z.string().max(2000).nullable().optional(),
  ),
});

export type ClinicalNoteSpecialtyData = z.infer<typeof clinicalNoteSpecialtyDataSchema>;

// ─── Create / Update ──────────────────────────────────────────────────────────
// PRD Técnico §6. The create schema only validates input coming from the
// frontend — server-side we still enforce author/clinic/role rules.

export const clinicalNoteCreateSchema = z.object({
  patient_id: z.string().uuid('ID de paciente inválido'),
  appointment_id: z
    .string()
    .uuid('ID de cita inválido')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  note_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (formato YYYY-MM-DD)'),
  chief_complaint: z.string().max(1000).optional(),
  subjective: z.string().max(5000).optional(),
  objective: z.string().max(5000).optional(),
  assessment: z.string().max(5000).optional(),
  plan: z.string().max(5000).optional(),
  diagnosis_text: z.string().max(500).optional(),
  diagnosis_code: z.string().max(20).optional(),
  internal_notes: z.string().max(5000).optional(),
  specialty_data: clinicalNoteSpecialtyDataSchema.optional(),
});

export type ClinicalNoteCreateInput = z.infer<typeof clinicalNoteCreateSchema>;

// Update reuses the same shape but makes every field optional (except the
// note id) so partial saves (e.g. "Guardar borrador" after editing one
// field) don't have to round-trip the entire form.
export const clinicalNoteUpdateSchema = clinicalNoteCreateSchema
  .partial()
  .extend({
    note_id: z.string().uuid('ID de nota inválido'),
  });

export type ClinicalNoteUpdateInput = z.infer<typeof clinicalNoteUpdateSchema>;

export const clinicalNoteSignSchema = z.object({
  note_id: z.string().uuid('ID de nota inválido'),
});

export type ClinicalNoteSignInput = z.infer<typeof clinicalNoteSignSchema>;
