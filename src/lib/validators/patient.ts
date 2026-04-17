import { z } from 'zod';

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
});

export const patientUpdateSchema = patientCreateSchema
  .partial()
  .extend({
    patient_id: z.string().uuid('ID de paciente inválido'),
  });

export type PatientCreateInput = z.infer<typeof patientCreateSchema>;
export type PatientUpdateInput = z.infer<typeof patientUpdateSchema>;
