import { z } from 'zod';

// Range bounds picked from the prompt and standard adult vital-sign tables.
// "Plausible human" — not "normal." A doctor records a febrile patient at 40 °C
// or a hypotensive crash at 60/40 and the form must accept the value, only
// flagging it visually. Values outside these bounds are almost always typos
// (e.g. weight=2400 instead of 24.0 kg).

const optionalDecimal = (min: number, max: number, message: string) =>
  z
    .union([z.literal(''), z.coerce.number().min(min, message).max(max, message)])
    .optional()
    .transform((v) => (v === '' || v === undefined ? undefined : v));

const optionalInt = (min: number, max: number, message: string) =>
  z
    .union([z.literal(''), z.coerce.number().int(message).min(min, message).max(max, message)])
    .optional()
    .transform((v) => (v === '' || v === undefined ? undefined : v));

export const vitalSignsCreateSchema = z
  .object({
    patient_id: z.string().uuid('ID de paciente inválido'),
    clinical_note_id: z
      .string()
      .uuid('ID de nota inválido')
      .optional()
      .or(z.literal('').transform(() => undefined)),
    weight_kg: optionalDecimal(20, 300, 'Peso fuera de rango (20-300 kg)'),
    height_cm: optionalDecimal(50, 250, 'Talla fuera de rango (50-250 cm)'),
    systolic_bp: optionalInt(60, 250, 'TA sistólica fuera de rango (60-250)'),
    diastolic_bp: optionalInt(30, 180, 'TA diastólica fuera de rango (30-180)'),
    heart_rate: optionalInt(30, 220, 'Frecuencia cardíaca fuera de rango (30-220)'),
    respiratory_rate: optionalInt(5, 60, 'Frecuencia respiratoria fuera de rango (5-60)'),
    temperature_c: optionalDecimal(30, 45, 'Temperatura fuera de rango (30-45 °C)'),
    oxygen_saturation: optionalInt(50, 100, 'SpO2 fuera de rango (50-100%)'),
    notes: z
      .string()
      .max(2000)
      .optional()
      .transform((v) => (v === '' || v === undefined ? undefined : v)),
  })
  .refine(
    (data) =>
      data.weight_kg !== undefined ||
      data.height_cm !== undefined ||
      data.systolic_bp !== undefined ||
      data.diastolic_bp !== undefined ||
      data.heart_rate !== undefined ||
      data.respiratory_rate !== undefined ||
      data.temperature_c !== undefined ||
      data.oxygen_saturation !== undefined ||
      (data.notes !== undefined && data.notes.length > 0),
    {
      message: 'Registra al menos un signo vital',
      path: ['weight_kg'],
    },
  )
  .refine(
    (data) => {
      if (data.systolic_bp === undefined || data.diastolic_bp === undefined) return true;
      return data.systolic_bp > data.diastolic_bp;
    },
    {
      message: 'La sistólica debe ser mayor que la diastólica',
      path: ['systolic_bp'],
    },
  );

export type VitalSignsCreateInput = z.infer<typeof vitalSignsCreateSchema>;

// BMI is derived from weight + height. Returns null if either input is missing
// or non-positive — never throws, since the form may submit one without the
// other (e.g. just "got the patient on the scale" mid-consult).
export function computeBmi(weightKg: number | undefined, heightCm: number | undefined): number | null {
  if (weightKg == null || heightCm == null) return null;
  if (!Number.isFinite(weightKg) || !Number.isFinite(heightCm)) return null;
  if (weightKg <= 0 || heightCm <= 0) return null;
  const meters = heightCm / 100;
  const bmi = weightKg / (meters * meters);
  if (!Number.isFinite(bmi)) return null;
  return Math.round(bmi * 10) / 10;
}
