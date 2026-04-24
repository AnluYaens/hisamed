import { describe, expect, it } from 'vitest';
import { loginSchema } from '@/lib/validators/auth';
import { patientCreateSchema } from '@/lib/validators/patient';
import { userCreateSchema, userUpdateSchema, resetPasswordSchema, clinicSettingsSchema } from '@/lib/validators/user';
import { clinicalNoteCreateSchema, clinicalNoteSpecialtyDataSchema } from '@/lib/validators/clinical-note';
import { appointmentCreateSchema, VALID_TRANSITIONS } from '@/lib/validators/appointment';
import { toDateStr } from '@/lib/dates';

// ─── loginSchema ──────────────────────────────────────────────────────────────

describe('loginSchema', () => {
  it('acepta email y contraseña válidos', () => {
    const result = loginSchema.safeParse({ email: 'user@example.com', password: 'secret' });
    expect(result.success).toBe(true);
  });

  it('rechaza email inválido', () => {
    expect(loginSchema.safeParse({ email: 'not-an-email', password: 'secret' }).success).toBe(false);
  });

  it('rechaza contraseña vacía', () => {
    expect(loginSchema.safeParse({ email: 'user@example.com', password: '' }).success).toBe(false);
  });

  it('rechaza campos faltantes', () => {
    expect(loginSchema.safeParse({ email: 'user@example.com' }).success).toBe(false);
    expect(loginSchema.safeParse({ password: 'secret' }).success).toBe(false);
    expect(loginSchema.safeParse({}).success).toBe(false);
  });
});

// ─── patientCreateSchema ──────────────────────────────────────────────────────

const validPatient = {
  id_number: 'V-12345678',
  id_type: 'cedula',
  first_name: 'Ana',
  last_name: 'Rodríguez',
  date_of_birth: '1990-01-01',
  sex: 'F',
};

describe('patientCreateSchema', () => {
  it('acepta un paciente con datos completos', () => {
    expect(patientCreateSchema.safeParse(validPatient).success).toBe(true);
  });

  it('acepta datos mínimos obligatorios', () => {
    const result = patientCreateSchema.safeParse(validPatient);
    expect(result.success).toBe(true);
  });

  it('rechaza first_name vacío', () => {
    expect(patientCreateSchema.safeParse({ ...validPatient, first_name: '' }).success).toBe(false);
  });

  it('rechaza last_name vacío', () => {
    expect(patientCreateSchema.safeParse({ ...validPatient, last_name: '' }).success).toBe(false);
  });

  it('rechaza id_number menor a 3 caracteres', () => {
    expect(patientCreateSchema.safeParse({ ...validPatient, id_number: 'AB' }).success).toBe(false);
  });

  it('rechaza fecha de nacimiento futura', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const futureDate = toDateStr(tomorrow);
    expect(patientCreateSchema.safeParse({ ...validPatient, date_of_birth: futureDate }).success).toBe(false);
  });

  it('rechaza sexo con valor inválido', () => {
    expect(patientCreateSchema.safeParse({ ...validPatient, sex: 'X' }).success).toBe(false);
  });

  it('acepta campos opcionales ausentes', () => {
    const { ...withoutOptional } = validPatient;
    expect(patientCreateSchema.safeParse(withoutOptional).success).toBe(true);
  });

  it('acepta email válido en campo opcional', () => {
    expect(
      patientCreateSchema.safeParse({ ...validPatient, email: 'paciente@example.com' }).success,
    ).toBe(true);
  });

  it('rechaza email malformado', () => {
    expect(
      patientCreateSchema.safeParse({ ...validPatient, email: 'not-an-email' }).success,
    ).toBe(false);
  });

  it('acepta email vacío (campo opcional vacío)', () => {
    expect(
      patientCreateSchema.safeParse({ ...validPatient, email: '' }).success,
    ).toBe(true);
  });
});

// ─── userCreateSchema ─────────────────────────────────────────────────────────

const validUser = {
  email: 'nuevo@clinica.com',
  password: 'contraseña2026',
  full_name: 'Nuevo Usuario',
  role: 'receptionist',
};

describe('userCreateSchema', () => {
  it('acepta usuario con datos válidos', () => {
    expect(userCreateSchema.safeParse(validUser).success).toBe(true);
  });

  it('rechaza contraseña menor a 10 caracteres', () => {
    expect(userCreateSchema.safeParse({ ...validUser, password: 'corta' }).success).toBe(false);
  });

  it('rechaza email inválido', () => {
    expect(userCreateSchema.safeParse({ ...validUser, email: 'no-email' }).success).toBe(false);
  });

  it('rechaza rol inválido', () => {
    expect(userCreateSchema.safeParse({ ...validUser, role: 'superadmin' }).success).toBe(false);
  });

  it('acepta los tres roles válidos', () => {
    for (const role of ['admin', 'doctor', 'receptionist']) {
      expect(userCreateSchema.safeParse({ ...validUser, role }).success).toBe(true);
    }
  });

  it('rechaza full_name vacío', () => {
    expect(userCreateSchema.safeParse({ ...validUser, full_name: '' }).success).toBe(false);
  });
});

describe('userUpdateSchema', () => {
  it('acepta actualización parcial válida', () => {
    expect(
      userUpdateSchema.safeParse({
        user_id: '00000000-0000-4000-8000-000000000001',
        full_name: 'Nombre Actualizado',
      }).success,
    ).toBe(true);
  });

  it('rechaza user_id que no es UUID', () => {
    expect(userUpdateSchema.safeParse({ user_id: 'no-es-uuid' }).success).toBe(false);
  });
});

describe('resetPasswordSchema', () => {
  it('acepta nueva contraseña válida', () => {
    expect(
      resetPasswordSchema.safeParse({
        user_id: '00000000-0000-4000-8000-000000000001',
        new_password: 'nuevaContraseña2026',
      }).success,
    ).toBe(true);
  });

  it('rechaza nueva contraseña menor a 10 caracteres', () => {
    expect(
      resetPasswordSchema.safeParse({
        user_id: '00000000-0000-4000-8000-000000000001',
        new_password: 'corta',
      }).success,
    ).toBe(false);
  });
});

describe('clinicSettingsSchema', () => {
  it('acepta configuración válida', () => {
    expect(
      clinicSettingsSchema.safeParse({
        name: 'Clínica Test',
        timezone: 'America/Caracas',
      }).success,
    ).toBe(true);
  });

  it('rechaza nombre vacío', () => {
    expect(
      clinicSettingsSchema.safeParse({ name: '', timezone: 'America/Caracas' }).success,
    ).toBe(false);
  });
});

// ─── clinicalNoteCreateSchema ─────────────────────────────────────────────────

const validNote = {
  patient_id: '00000000-0000-4000-8000-000000000001',
  note_date: '2026-04-24',
  subjective: 'Paciente refiere dolor leve.',
  objective: 'PA normal.',
  assessment: 'Sin hallazgos.',
  plan: 'Control en 30 días.',
};

describe('clinicalNoteCreateSchema', () => {
  it('acepta nota válida con campos SOAP', () => {
    expect(clinicalNoteCreateSchema.safeParse(validNote).success).toBe(true);
  });

  it('acepta nota sin campos SOAP opcionales', () => {
    expect(
      clinicalNoteCreateSchema.safeParse({
        patient_id: '00000000-0000-4000-8000-000000000001',
        note_date: '2026-04-24',
      }).success,
    ).toBe(true);
  });

  it('rechaza patient_id que no es UUID', () => {
    expect(clinicalNoteCreateSchema.safeParse({ ...validNote, patient_id: 'no-uuid' }).success).toBe(false);
  });

  it('rechaza note_date con formato inválido', () => {
    expect(
      clinicalNoteCreateSchema.safeParse({ ...validNote, note_date: '24/04/2026' }).success,
    ).toBe(false);
    expect(
      clinicalNoteCreateSchema.safeParse({ ...validNote, note_date: '2026-4-24' }).success,
    ).toBe(false);
  });
});

describe('clinicalNoteSpecialtyDataSchema', () => {
  it('acepta tensión arterial en formato válido', () => {
    expect(
      clinicalNoteSpecialtyDataSchema.safeParse({ blood_pressure: '120/80' }).success,
    ).toBe(true);
    expect(
      clinicalNoteSpecialtyDataSchema.safeParse({ blood_pressure: '130/90' }).success,
    ).toBe(true);
  });

  it('rechaza tensión arterial con formato inválido', () => {
    expect(
      clinicalNoteSpecialtyDataSchema.safeParse({ blood_pressure: '120-80' }).success,
    ).toBe(false);
    expect(
      clinicalNoteSpecialtyDataSchema.safeParse({ blood_pressure: '12/8' }).success,
    ).toBe(false);
  });

  it('acepta campos opcionales ausentes', () => {
    expect(clinicalNoteSpecialtyDataSchema.safeParse({}).success).toBe(true);
  });

  it('rechaza peso fuera de rango', () => {
    expect(
      clinicalNoteSpecialtyDataSchema.safeParse({ weight_kg: -1 }).success,
    ).toBe(false);
    expect(
      clinicalNoteSpecialtyDataSchema.safeParse({ weight_kg: 600 }).success,
    ).toBe(false);
  });
});

// ─── VALID_TRANSITIONS ────────────────────────────────────────────────────────

describe('VALID_TRANSITIONS', () => {
  it('scheduled puede pasar a confirmed, cancelled o no_show', () => {
    expect(VALID_TRANSITIONS.scheduled).toContain('confirmed');
    expect(VALID_TRANSITIONS.scheduled).toContain('cancelled');
    expect(VALID_TRANSITIONS.scheduled).toContain('no_show');
  });

  it('completed no tiene transiciones válidas', () => {
    expect(VALID_TRANSITIONS.completed).toHaveLength(0);
  });

  it('cancelled no tiene transiciones válidas', () => {
    expect(VALID_TRANSITIONS.cancelled).toHaveLength(0);
  });

  it('in_progress puede pasar a completed, cancelled o no_show', () => {
    expect(VALID_TRANSITIONS.in_progress).toContain('completed');
    expect(VALID_TRANSITIONS.in_progress).toContain('cancelled');
    expect(VALID_TRANSITIONS.in_progress).toContain('no_show');
  });
});
