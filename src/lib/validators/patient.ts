import { z } from 'zod';

export const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;

export const patientCreateSchema = z.object({
  id_number: z.string().min(3, 'Mínimo 3 caracteres').max(50),
  id_type: z.enum(['cedula', 'passport', 'other']),
  first_name: z.string().min(1, 'Nombre requerido').max(255).trim(),
  last_name: z.string().min(1, 'Apellido requerido').max(255).trim(),
  date_of_birth: z.coerce
    .date()
    .max(new Date(), { message: 'Fecha de nacimiento no puede ser futura' }),
  sex: z.enum(['F', 'M', 'other']),
  phone: z.string().max(50).optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  address: z.string().max(1000).optional(),
  emergency_contact_name: z.string().max(255).optional(),
  emergency_contact_phone: z.string().max(50).optional(),
  insurance_info: z.string().max(1000).optional(),
  notes: z.string().max(2000).optional(),
  blood_type: z.enum(BLOOD_TYPES).optional().or(z.literal('')),
  rh_incompatibility: z.coerce.boolean().optional(),
  instagram: z.string().max(100).optional(),
  referral_source: z.string().max(255).optional(),
  occupation: z.string().max(255).optional(),
});

export const patientUpdateSchema = patientCreateSchema
  .partial()
  .extend({
    patient_id: z.string().uuid('ID de paciente inválido'),
  });

export const partnerUpsertSchema = z.object({
  patient_id: z.string().uuid('ID de paciente inválido'),
  full_name: z.string().min(1, 'Nombre requerido').max(255).trim(),
  id_number: z.string().max(50).optional(),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD').optional().or(z.literal('')),
  phone: z.string().max(50).optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  blood_type: z.enum(BLOOD_TYPES).optional().or(z.literal('')),
  occupation: z.string().max(255).optional(),
  notes: z.string().max(2000).optional(),
});

export type PatientCreateInput = z.infer<typeof patientCreateSchema>;
export type PatientUpdateInput = z.infer<typeof patientUpdateSchema>;
export type PartnerUpsertInput = z.infer<typeof partnerUpsertSchema>;
