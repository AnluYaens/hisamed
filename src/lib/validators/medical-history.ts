import { z } from 'zod';

// ─── Ginecología specialty_data ───────────────────────────────────────────────

export const gynecologyDataSchema = z.object({
  menarche_age: z.coerce
    .number()
    .int()
    .min(1)
    .max(30)
    .nullable()
    .optional(),
  cycle_length_days: z.coerce
    .number()
    .int()
    .min(1)
    .max(90)
    .nullable()
    .optional(),
  cycle_regularity: z
    .enum(['regular', 'irregular', 'amenorrhea'])
    .nullable()
    .optional(),
  last_menstrual_period: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)')
    .nullable()
    .optional(),
  contraceptive_method: z
    .enum(['none', 'oral', 'iud', 'implant', 'barrier', 'other'])
    .nullable()
    .optional(),
  pap_smear_last: z
    .string()
    .regex(/^\d{4}-\d{2}$/, 'Formato inválido (YYYY-MM)')
    .nullable()
    .optional(),
  mammography_last: z
    .string()
    .regex(/^\d{4}-\d{2}$/, 'Formato inválido (YYYY-MM)')
    .nullable()
    .optional(),
  gravida: z.coerce.number().int().min(0).nullable().optional(),
  para: z.coerce.number().int().min(0).nullable().optional(),
  cesarean: z.coerce.number().int().min(0).nullable().optional(),
  abortions: z.coerce.number().int().min(0).nullable().optional(),
  ectopic: z.coerce.number().int().min(0).nullable().optional(),
  living_children: z.coerce.number().int().min(0).nullable().optional(),
  // Normalize '' → null so clearing the textarea actually clears the stored
  // value, matching the behaviour of the top-level text fields.
  obstetric_notes: z.preprocess(
    (v) => (v === '' ? null : v),
    z.string().max(2000).nullable().optional(),
  ),
});

export type GynecologyData = z.infer<typeof gynecologyDataSchema>;

// ─── Medical History update ───────────────────────────────────────────────────

export const medicalHistoryUpdateSchema = z.object({
  patient_id: z.string().uuid('ID de paciente inválido'),
  personal_history: z.string().max(5000).optional(),
  family_history: z.string().max(5000).optional(),
  surgical_history: z.string().max(5000).optional(),
  allergies: z.string().max(5000).optional(),
  current_medications: z.string().max(5000).optional(),
  habits: z.string().max(5000).optional(),
  specialty_data: gynecologyDataSchema.optional(),
});

export type MedicalHistoryUpdateInput = z.infer<typeof medicalHistoryUpdateSchema>;
