import { z } from 'zod';

// Validation for the public "Solicitar acceso" form on the marketing landing
// page. Mirrors the rest of the app's Zod + Server Action pattern. Kept
// deliberately small — these requests are emailed to support, not persisted.
export const accessRequestSchema = z.object({
  name: z.string().trim().min(2, 'Ingresa tu nombre').max(120),
  email: z.string().trim().toLowerCase().email('Correo inválido').max(254),
  whatsapp: z.string().trim().min(6, 'Ingresa tu número de WhatsApp').max(40),
  clinic: z.string().trim().min(2, 'Ingresa el nombre de tu consultorio').max(160),
  specialty: z.string().trim().min(2, 'Ingresa tu especialidad').max(120),
});

export type AccessRequestInput = z.infer<typeof accessRequestSchema>;
