/**
 * Tests for the patient-history PDF export route. The route depends on
 * the session, the aggregating query, the audit logger, the clinic
 * lookup, and the PDF builder. We mock every dependency so the test
 * exercises only the route's permission gates and response shape.
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-chars-long!!';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-at-least-32-chars!';

const CLINIC_ID = '00000000-0000-4000-8000-000000000002';
const OTHER_CLINIC = '00000000-0000-4000-8000-00000000aaaa';
const USER_ID = '00000000-0000-4000-8000-000000000001';
const PATIENT_ID = '11111111-1111-4111-8111-111111111111';
const CROSS_PATIENT = '22222222-2222-4222-8222-222222222222';

const mocks = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  getFullClinicMock: vi.fn(),
  getPatientHistoryForExportMock: vi.fn(),
  buildPdfMock: vi.fn(),
  auditLogMock: vi.fn(),
  getClientIpFromHeadersMock: vi.fn(),
}));

vi.mock('@/lib/auth/session', () => ({
  getSession: mocks.getSessionMock,
}));

vi.mock('@/queries/clinic', () => ({
  getFullClinic: mocks.getFullClinicMock,
}));

vi.mock('@/queries/export-history', () => ({
  getPatientHistoryForExport: mocks.getPatientHistoryForExportMock,
}));

vi.mock('@/lib/pdf/patient-history', () => ({
  buildPatientHistoryPdf: mocks.buildPdfMock,
  // Pass-through so the response header gets a sensible value without
  // re-importing the real helper (which would pull in pdfkit).
  exportHistoryFilename: (patient: { firstName: string; lastName: string }) =>
    `historia-clinica-${patient.firstName.toLowerCase()}-${patient.lastName.toLowerCase()}.pdf`,
}));

vi.mock('@/lib/audit', () => ({
  auditLog: mocks.auditLogMock,
  getClientIpFromHeaders: mocks.getClientIpFromHeadersMock,
}));

import { GET } from '@/app/api/patients/[id]/export-history/route';
import type { UserRole } from '@/lib/db/schema';

function buildPayload(overrides?: Partial<{ patientId: string }>) {
  return {
    clinic: {
      id: CLINIC_ID,
      name: 'Hisamed Test',
      address: null,
      phone: null,
      timezone: 'America/Caracas',
      weekStartsOn: 1 as const,
    },
    patient: {
      id: overrides?.patientId ?? PATIENT_ID,
      idNumber: 'V-12345678',
      idType: 'cedula',
      firstName: 'Ana',
      lastName: 'Pérez',
      dateOfBirth: '1990-05-12',
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

function paramsOf(id: string) {
  return { params: Promise.resolve({ id }) } as const;
}

function setSession(role: UserRole | null) {
  if (role === null) {
    mocks.getSessionMock.mockResolvedValue(null);
    return;
  }
  mocks.getSessionMock.mockResolvedValue({
    userId: USER_ID,
    clinicId: CLINIC_ID,
    role,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getClientIpFromHeadersMock.mockResolvedValue('127.0.0.1');
  mocks.getFullClinicMock.mockResolvedValue({
    id: CLINIC_ID,
    name: 'Hisamed Test',
    address: null,
    phone: null,
    timezone: 'America/Caracas',
    weekStartsOn: 1,
  });
  mocks.buildPdfMock.mockResolvedValue(Buffer.from('%PDF-1.7\n%fake', 'utf8'));
  mocks.auditLogMock.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.resetAllMocks();
});

const req = new Request('http://localhost/api/patients/x/export-history');

describe('GET /api/patients/[id]/export-history — auth gates', () => {
  it('rechaza la solicitud sin sesión (401)', async () => {
    setSession(null);
    const res = await GET(req as never, paramsOf(PATIENT_ID));
    expect(res.status).toBe(401);
    expect(mocks.getPatientHistoryForExportMock).not.toHaveBeenCalled();
    expect(mocks.auditLogMock).not.toHaveBeenCalled();
  });

  it('rechaza al recepcionista (403)', async () => {
    setSession('receptionist');
    const res = await GET(req as never, paramsOf(PATIENT_ID));
    expect(res.status).toBe(403);
    expect(mocks.getPatientHistoryForExportMock).not.toHaveBeenCalled();
    expect(mocks.auditLogMock).not.toHaveBeenCalled();
  });

  it('rechaza un id inválido (400)', async () => {
    setSession('doctor');
    const res = await GET(req as never, paramsOf('not-a-uuid'));
    expect(res.status).toBe(400);
    expect(mocks.getPatientHistoryForExportMock).not.toHaveBeenCalled();
  });
});

describe('GET /api/patients/[id]/export-history — happy path', () => {
  it('admin recibe PDF con headers correctos y se registra auditoría', async () => {
    setSession('admin');
    mocks.getPatientHistoryForExportMock.mockResolvedValue(buildPayload());

    const res = await GET(req as never, paramsOf(PATIENT_ID));

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
    const dispo = res.headers.get('Content-Disposition');
    expect(dispo).toContain('attachment');
    expect(dispo).toContain('historia-clinica-ana-');
    expect(dispo).toMatch(/\.pdf"?$/);
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');

    expect(mocks.buildPdfMock).toHaveBeenCalledTimes(1);
    expect(mocks.auditLogMock).toHaveBeenCalledTimes(1);
    const auditCall = mocks.auditLogMock.mock.calls[0][0];
    expect(auditCall).toMatchObject({
      clinicId: CLINIC_ID,
      userId: USER_ID,
      action: 'EXPORT',
      resourceType: 'patient_history',
      resourceId: PATIENT_ID,
    });
    expect(auditCall.details).toMatchObject({ format: 'pdf' });

    const body = await res.arrayBuffer();
    expect(new TextDecoder().decode(body.slice(0, 5))).toBe('%PDF-');
  });

  it('doctor recibe PDF y se registra auditoría', async () => {
    setSession('doctor');
    mocks.getPatientHistoryForExportMock.mockResolvedValue(buildPayload());

    const res = await GET(req as never, paramsOf(PATIENT_ID));

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    expect(mocks.auditLogMock).toHaveBeenCalledTimes(1);
  });
});

describe('GET /api/patients/[id]/export-history — cross-clinic', () => {
  it('rechaza con 404 cuando el paciente pertenece a otra clínica', async () => {
    setSession('doctor');
    // The aggregating query enforces the clinic scope and returns null for
    // any patient outside the session's clinic — same shape as "not found".
    mocks.getPatientHistoryForExportMock.mockImplementation(async (clinic, _id) => {
      expect(clinic.id).toBe(CLINIC_ID); // never receives OTHER_CLINIC
      return null;
    });

    const res = await GET(req as never, paramsOf(CROSS_PATIENT));
    expect(res.status).toBe(404);
    expect(mocks.buildPdfMock).not.toHaveBeenCalled();
    expect(mocks.auditLogMock).not.toHaveBeenCalled();
    expect(OTHER_CLINIC).toBeDefined();
  });
});

describe('GET /api/patients/[id]/export-history — failure paths', () => {
  it('responde 500 si la generación de PDF falla', async () => {
    setSession('doctor');
    mocks.getPatientHistoryForExportMock.mockResolvedValue(buildPayload());
    mocks.buildPdfMock.mockRejectedValue(new Error('boom'));
    // Suppress the expected error log so test output stays clean.
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await GET(req as never, paramsOf(PATIENT_ID));
    expect(res.status).toBe(500);
    expect(mocks.auditLogMock).not.toHaveBeenCalled();

    errSpy.mockRestore();
  });
});
