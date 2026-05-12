/**
 * Smoke test for the actual PDF builder. This runs pdfkit end-to-end (no
 * mocks) so we catch regressions in font loading, layout, or the encoded
 * Spanish-character rendering path. Asserting on byte content is brittle,
 * so we only check the PDF header magic, the trailer marker, and that the
 * document is non-trivially sized.
 */

import { describe, it, expect } from 'vitest';
import {
  buildPatientHistoryPdf,
  exportHistoryFilename,
} from '@/lib/pdf/patient-history';
import type { PatientHistoryPayload } from '@/queries/export-history';

const baseClinic = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Clínica Hisamed',
  address: 'Av. Principal, Caracas',
  phone: '+58 212 555-0000',
  timezone: 'America/Caracas',
  weekStartsOn: 1 as const,
};

function buildFullPayload(): PatientHistoryPayload {
  const noteDate = new Date('2026-04-12T15:30:00Z');
  return {
    clinic: baseClinic,
    patient: {
      id: '11111111-1111-4111-8111-111111111111',
      idNumber: 'V-12.345.678',
      idType: 'cedula',
      firstName: 'María',
      lastName: 'Rodríguez',
      dateOfBirth: '1992-08-17',
      sex: 'F',
      phone: '+58 414 555-1212',
      email: 'maria@example.com',
      address: 'Av. Libertador, Caracas',
      bloodType: 'O+',
      rhIncompatibility: false,
    },
    partner: {
      fullName: 'Juan Pérez',
      idNumber: 'V-98.765.432',
      dateOfBirth: '1990-01-01',
      phone: '+58 414 555-3434',
      email: 'juan@example.com',
      bloodType: 'A+',
      occupation: 'Ingeniero',
      notes: null,
    },
    medicalHistory: {
      personalHistory: 'Sin antecedentes patológicos relevantes.',
      familyHistory: 'Madre con diabetes tipo 2.',
      surgicalHistory: 'Apendicectomía a los 18 años.',
      allergies: 'Penicilina',
      currentMedications: 'Ácido fólico 5 mg c/día',
      habits: 'No fuma, no alcohol.',
      specialtyData: {
        menarche_age: 13,
        cycle_length_days: 28,
        cycle_regularity: 'regular',
        last_menstrual_period: '2026-02-01',
        contraceptive_method: 'none',
        gravida: 2,
        para: 1,
        cesarean: 0,
        abortions: 1,
        ectopic: 0,
        living_children: 1,
        obstetric_notes: 'Embarazo previo sin complicaciones.',
        pregnancy_ended: false,
      },
    },
    notes: [
      {
        id: 'a1111111-1111-4111-8111-111111111111',
        noteDate: '2026-04-12',
        authorFullName: 'Dra. Luisa Martínez',
        chiefComplaint: 'Control prenatal',
        subjective: 'Refiere bienestar general.',
        objective: 'Examen físico sin hallazgos.',
        assessment: 'Embarazo de 10 semanas, evolución normal.',
        plan: 'Continuar suplementación.',
        diagnoses: [{ code: 'Z34.0', text: 'Supervisión de primer embarazo normal' }],
        specialtyData: {
          blood_pressure: '110/70',
          weight_kg: 62,
          height_cm: 165,
          bmi: 22.8,
          last_menstrual_period: '2026-02-01',
          gestational_age_weeks: 10,
          gynecological_exam: {
            cervix: { value: 'normal', note: null },
            vagina: { value: 'normal', note: null },
          },
          ultrasound: {
            obstetric: {
              fetal_count: '1',
              fetal_heart_rate: 160,
            },
          },
        },
        isSigned: true,
        signedAt: noteDate,
        vitals: [
          {
            recordedAt: noteDate,
            recordedByName: 'Ana Asistente',
            weightKg: 62,
            heightCm: 165,
            bmi: 22.8,
            systolicBp: 110,
            diastolicBp: 70,
            heartRate: 78,
            respiratoryRate: 16,
            temperatureC: 36.6,
            oxygenSaturation: 98,
            notes: null,
          },
        ],
      },
    ],
    documents: [
      {
        id: 'd1111111-1111-4111-8111-111111111111',
        documentType: 'prescription',
        title: 'Récipe — Ácido fólico',
        createdAt: noteDate,
        authorFullName: 'Dra. Luisa Martínez',
        clinicalNoteId: 'a1111111-1111-4111-8111-111111111111',
        clinicalNoteDate: '2026-04-12',
      },
    ],
    attachments: [
      {
        id: 'b1111111-1111-4111-8111-111111111111',
        fileName: 'eco-12-semanas.pdf',
        fileType: 'application/pdf',
        category: 'ultrasound',
        uploadedAt: noteDate,
        uploadedByName: 'Dra. Luisa Martínez',
        clinicalNoteId: 'a1111111-1111-4111-8111-111111111111',
        clinicalNoteDate: '2026-04-12',
      },
    ],
  };
}

function buildMinimalPayload(): PatientHistoryPayload {
  return {
    clinic: baseClinic,
    patient: {
      id: '11111111-1111-4111-8111-111111111111',
      idNumber: 'V-1',
      idType: 'cedula',
      firstName: 'Ana',
      lastName: 'Sin Datos',
      dateOfBirth: '1990-01-01',
      sex: 'F',
      phone: null,
      email: null,
      address: null,
      bloodType: null,
      rhIncompatibility: false,
    },
    partner: null,
    medicalHistory: null,
    notes: [],
    documents: [],
    attachments: [],
  };
}

describe('buildPatientHistoryPdf', () => {
  it('emite un PDF válido para un paciente con historial completo', async () => {
    const buf = await buildPatientHistoryPdf(buildFullPayload(), new Date('2026-05-12T12:00:00Z'));
    // PDF magic header
    expect(buf.subarray(0, 5).toString('utf8')).toBe('%PDF-');
    // Trailer at the end of the file — required for a well-formed PDF
    expect(buf.subarray(buf.length - 6).toString('utf8')).toContain('%%EOF');
    // Sanity: a real, multi-section history should be larger than 1KB.
    expect(buf.length).toBeGreaterThan(1024);
  });

  it('emite un PDF válido cuando todos los datos opcionales están vacíos', async () => {
    const buf = await buildPatientHistoryPdf(buildMinimalPayload(), new Date('2026-05-12T12:00:00Z'));
    expect(buf.subarray(0, 5).toString('utf8')).toBe('%PDF-');
    expect(buf.subarray(buf.length - 6).toString('utf8')).toContain('%%EOF');
  });
});

describe('exportHistoryFilename', () => {
  it('normaliza acentos y espacios para un Content-Disposition seguro', () => {
    expect(exportHistoryFilename({ firstName: 'María', lastName: 'Rodríguez' })).toBe(
      'historia-clinica-maria-rodriguez.pdf',
    );
  });

  it('cae a "paciente" si el nombre se vacía tras la limpieza', () => {
    expect(exportHistoryFilename({ firstName: '!!!', lastName: '???' })).toBe(
      'historia-clinica-paciente.pdf',
    );
  });
});
