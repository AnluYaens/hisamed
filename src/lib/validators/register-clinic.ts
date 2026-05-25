import { z } from 'zod';

export const COUNTRY_TIMEZONES: Record<string, string> = {
  Venezuela: 'America/Caracas',
  Colombia: 'America/Bogota',
  México: 'America/Mexico_City',
  Perú: 'America/Lima',
  Chile: 'America/Santiago',
  Ecuador: 'America/Guayaquil',
  Argentina: 'America/Argentina/Buenos_Aires',
  Otro: 'America/Caracas',
};

export const COUNTRIES = Object.keys(COUNTRY_TIMEZONES) as [string, ...string[]];

export const registerClinicSchema = z
  .object({
    clinicName: z.string().min(1, 'El nombre de tu consultorio es requerido').max(255),
    fullName: z.string().min(1, 'Su nombre completo es requerido').max(255),
    email: z.string().email('Ingresa un email válido').max(255),
    password: z.string().min(10, 'La contraseña debe tener al menos 10 caracteres').max(128),
    confirmPassword: z.string(),
    country: z.enum(COUNTRIES, { error: 'Selecciona un país' }),
    terms: z
      .string()
      .or(z.literal(true))
      .refine((v) => v === 'on' || v === true, {
        message: 'Debes aceptar los términos de servicio',
      }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  });

export type RegisterClinicInput = z.infer<typeof registerClinicSchema>;
