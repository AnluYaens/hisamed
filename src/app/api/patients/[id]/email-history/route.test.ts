import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getFullClinic: vi.fn(),
  getPatientHistoryForExport: vi.fn(),
  buildPatientHistoryPdf: vi.fn(),
  exportHistoryFilename: vi.fn(),
  getResendConfig: vi.fn(),
  sendPatientHistoryEmail: vi.fn(),
  auditLog: vi.fn(),
  safeAuditLog: vi.fn(),
  getClientIpFromHeaders: vi.fn(),
  enforceRateLimits: vi.fn(),
}));

vi.mock('@/lib/auth/session', () => ({ getSession: mocks.getSession }));
vi.mock('@/queries/clinic', () => ({ getFullClinic: mocks.getFullClinic }));
vi.mock('@/queries/export-history', () => ({
  getPatientHistoryForExport: mocks.getPatientHistoryForExport,
}));
vi.mock('@/lib/pdf/patient-history', () => ({
  buildPatientHistoryPdf: mocks.buildPatientHistoryPdf,
  exportHistoryFilename: mocks.exportHistoryFilename,
}));
vi.mock('@/lib/email/resend', () => ({
  getResendConfig: mocks.getResendConfig,
  sendPatientHistoryEmail: mocks.sendPatientHistoryEmail,
}));
vi.mock('@/lib/audit', () => ({
  auditLog: mocks.auditLog,
  safeAuditLog: mocks.safeAuditLog,
  getClientIpFromHeaders: mocks.getClientIpFromHeaders,
}));
vi.mock('@/lib/rate-limit', () => ({
  enforceRateLimits: mocks.enforceRateLimits,
}));

import { POST } from './route';

const CLINIC_ID = '11111111-1111-4111-8111-111111111111';
const DOCTOR_ID = '22222222-2222-4222-8222-222222222222';
const ADMIN_ID = '33333333-3333-4333-8333-333333333333';
const RECEPTIONIST_ID = '44444444-4444-4444-8444-444444444444';
const PATIENT_ID = '55555555-5555-4555-8555-555555555555';

const PDF_BYTES = Buffer.from('%PDF-1.4 fake');

function makeRequest(
  body: unknown,
  url = `http://localhost/api/patients/${PATIENT_ID}/email-history`,
): NextRequest {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as NextRequest;
}

function ctxFor(id: string) {
  return { params: Promise.resolve({ id }) };
}

const VALID_BODY = {
  recipient_email: 'paciente@correo.com',
  confirmed_patient_authorization: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({
    userId: DOCTOR_ID,
    clinicId: CLINIC_ID,
    role: 'doctor',
  });
  mocks.getFullClinic.mockResolvedValue({
    id: CLINIC_ID,
    name: 'Clínica Test',
    address: null,
    phone: null,
    timezone: 'America/Caracas',
    weekStartsOn: 1,
  });
  mocks.getPatientHistoryForExport.mockResolvedValue({
    patient: {
      id: PATIENT_ID,
      firstName: 'María',
      lastName: 'Pérez',
      email: 'paciente@correo.com',
    },
    partner: null,
    medicalHistory: null,
    vitalSigns: [],
    notes: [],
    documents: [],
    attachments: [],
  });
  mocks.buildPatientHistoryPdf.mockResolvedValue(PDF_BYTES);
  mocks.exportHistoryFilename.mockReturnValue('historia-clinica-maria-perez.pdf');
  mocks.getResendConfig.mockReturnValue({
    apiKey: 'test-key',
    fromEmail: 'noreply@test.com',
    fromName: 'Hisamed',
  });
  mocks.sendPatientHistoryEmail.mockResolvedValue({ ok: true, id: 'msg_1' });
  mocks.auditLog.mockResolvedValue(undefined);
  mocks.safeAuditLog.mockResolvedValue(undefined);
  mocks.getClientIpFromHeaders.mockResolvedValue(undefined);
  mocks.enforceRateLimits.mockResolvedValue({
    allowed: true,
    remaining: 4,
    retryAfterSeconds: 0,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('POST /api/patients/[id]/email-history', () => {
  it('returns 401 when no session', async () => {
    mocks.getSession.mockResolvedValue(null);
    const res = await POST(makeRequest(VALID_BODY), ctxFor(PATIENT_ID));
    expect(res.status).toBe(401);
    expect(mocks.sendPatientHistoryEmail).not.toHaveBeenCalled();
    expect(mocks.auditLog).not.toHaveBeenCalled();
  });

  it('returns 403 for receptionist', async () => {
    mocks.getSession.mockResolvedValue({
      userId: RECEPTIONIST_ID,
      clinicId: CLINIC_ID,
      role: 'receptionist',
    });
    const res = await POST(makeRequest(VALID_BODY), ctxFor(PATIENT_ID));
    expect(res.status).toBe(403);
    expect(mocks.sendPatientHistoryEmail).not.toHaveBeenCalled();
    expect(mocks.auditLog).not.toHaveBeenCalled();
  });

  it('returns 400 on malformed patient id', async () => {
    const res = await POST(makeRequest(VALID_BODY), ctxFor('nope'));
    expect(res.status).toBe(400);
    expect(mocks.getPatientHistoryForExport).not.toHaveBeenCalled();
  });

  it('returns 404 when patient is not in caller clinic', async () => {
    mocks.getPatientHistoryForExport.mockResolvedValue(null);
    const res = await POST(makeRequest(VALID_BODY), ctxFor(PATIENT_ID));
    expect(res.status).toBe(404);
    expect(mocks.sendPatientHistoryEmail).not.toHaveBeenCalled();
  });

  it('rejects invalid recipient email', async () => {
    const res = await POST(
      makeRequest({ ...VALID_BODY, recipient_email: 'not-an-email' }),
      ctxFor(PATIENT_ID),
    );
    expect(res.status).toBe(400);
    expect(mocks.sendPatientHistoryEmail).not.toHaveBeenCalled();
  });

  it('rejects missing confirmed_patient_authorization', async () => {
    const res = await POST(
      makeRequest({ recipient_email: 'p@test.com' }),
      ctxFor(PATIENT_ID),
    );
    expect(res.status).toBe(400);
    expect(mocks.sendPatientHistoryEmail).not.toHaveBeenCalled();
  });

  it('rejects when confirmed_patient_authorization is false', async () => {
    const res = await POST(
      makeRequest({ ...VALID_BODY, confirmed_patient_authorization: false }),
      ctxFor(PATIENT_ID),
    );
    expect(res.status).toBe(400);
    expect(mocks.sendPatientHistoryEmail).not.toHaveBeenCalled();
  });

  it('returns 503 when Resend config missing', async () => {
    mocks.getResendConfig.mockReturnValue(null);
    const res = await POST(makeRequest(VALID_BODY), ctxFor(PATIENT_ID));
    expect(res.status).toBe(503);
    expect(mocks.sendPatientHistoryEmail).not.toHaveBeenCalled();
    expect(mocks.auditLog).not.toHaveBeenCalled();
  });

  it('admin happy path: pre-send audit BEFORE send, then sent audit AFTER', async () => {
    mocks.getSession.mockResolvedValue({
      userId: ADMIN_ID,
      clinicId: CLINIC_ID,
      role: 'admin',
    });

    // Track call ordering across audit + send so we can prove the attempt
    // row is persisted before Resend is invoked.
    const order: string[] = [];
    mocks.auditLog.mockImplementation(async (args: { details: { status: string } }) => {
      order.push(`audit:${args.details.status}`);
    });
    mocks.sendPatientHistoryEmail.mockImplementation(async () => {
      order.push('send');
      return { ok: true, id: 'msg_1' };
    });

    const res = await POST(makeRequest(VALID_BODY), ctxFor(PATIENT_ID));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true });

    expect(mocks.buildPatientHistoryPdf).toHaveBeenCalledOnce();
    expect(mocks.sendPatientHistoryEmail).toHaveBeenCalledOnce();
    expect(order).toEqual(['audit:attempted', 'send', 'audit:sent']);

    expect(mocks.auditLog).toHaveBeenCalledTimes(2);
    const attemptedRow = mocks.auditLog.mock.calls[0]?.[0] as {
      action: string;
      resourceType: string;
      resourceId: string;
      details: Record<string, unknown>;
    };
    expect(attemptedRow.action).toBe('EMAIL_EXPORT');
    expect(attemptedRow.resourceType).toBe('patient_history');
    expect(attemptedRow.resourceId).toBe(PATIENT_ID);
    expect(attemptedRow.details).toMatchObject({
      format: 'pdf',
      delivery_provider: 'resend',
      recipient_email: 'paciente@correo.com',
      pdf_byte_size: PDF_BYTES.length,
      status: 'attempted',
    });

    const sentRow = mocks.auditLog.mock.calls[1]?.[0] as {
      details: Record<string, unknown>;
    };
    expect(sentRow.details).toMatchObject({
      status: 'sent',
      resend_message_id: 'msg_1',
      recipient_email: 'paciente@correo.com',
      pdf_byte_size: PDF_BYTES.length,
    });
  });

  it('doctor happy path also writes attempted + sent', async () => {
    const res = await POST(makeRequest(VALID_BODY), ctxFor(PATIENT_ID));
    expect(res.status).toBe(200);
    expect(mocks.sendPatientHistoryEmail).toHaveBeenCalledOnce();
    expect(mocks.auditLog).toHaveBeenCalledTimes(2);
    const statuses = mocks.auditLog.mock.calls.map(
      (call) => (call[0] as { details: { status: string } }).details.status,
    );
    expect(statuses).toEqual(['attempted', 'sent']);
  });

  it('aborts and does NOT send if pre-send audit fails', async () => {
    // The first auditLog call (the "attempted" row) blows up; the route
    // must refuse to call Resend in this state.
    mocks.auditLog.mockRejectedValueOnce(new Error('db down'));

    const res = await POST(makeRequest(VALID_BODY), ctxFor(PATIENT_ID));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/No se envió el correo/);
    expect(mocks.sendPatientHistoryEmail).not.toHaveBeenCalled();
    // Only the one (failed) audit attempt — no follow-up row.
    expect(mocks.auditLog).toHaveBeenCalledTimes(1);
    const attemptedRow = mocks.auditLog.mock.calls[0]?.[0] as {
      details: Record<string, unknown>;
    };
    expect(attemptedRow.details.status).toBe('attempted');
  });

  it('Resend failure: writes attempted + failed and returns 502', async () => {
    mocks.sendPatientHistoryEmail.mockResolvedValue({
      ok: false,
      errorMessage: 'No se pudo enviar el correo',
    });
    const res = await POST(makeRequest(VALID_BODY), ctxFor(PATIENT_ID));
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body.success).toBe(false);
    expect(mocks.auditLog).toHaveBeenCalledTimes(2);
    const statuses = mocks.auditLog.mock.calls.map(
      (call) => (call[0] as { details: { status: string } }).details.status,
    );
    expect(statuses).toEqual(['attempted', 'failed']);
  });

  it('post-send audit failure surfaces 500 but attempted row is already persisted', async () => {
    // First call (attempted) succeeds, second call (sent) throws.
    mocks.auditLog
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('db blip'));

    const res = await POST(makeRequest(VALID_BODY), ctxFor(PATIENT_ID));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/correo fue enviado/i);
    expect(mocks.sendPatientHistoryEmail).toHaveBeenCalledOnce();
    expect(mocks.auditLog).toHaveBeenCalledTimes(2);
    const attemptedRow = mocks.auditLog.mock.calls[0]?.[0] as {
      details: Record<string, unknown>;
    };
    expect(attemptedRow.details.status).toBe('attempted');
  });

  it('Resend failure does not leak provider error verbatim from secrets', async () => {
    mocks.sendPatientHistoryEmail.mockResolvedValue({
      ok: false,
      errorMessage: 'No se pudo enviar el correo',
    });
    const res = await POST(makeRequest(VALID_BODY), ctxFor(PATIENT_ID));
    const body = await res.json();

    expect(body.error).toBe('No se pudo enviar el correo');
    expect(body.error).not.toMatch(/api[_\s-]?key/i);
    expect(body.error).not.toMatch(/test-key/);
  });

  it('email-history response is no-store', async () => {
    const res = await POST(makeRequest(VALID_BODY), ctxFor(PATIENT_ID));
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
  });

  it('returns 429 when rate limited, without building PDF or calling Resend', async () => {
    mocks.enforceRateLimits.mockResolvedValue({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 1800,
    });

    const res = await POST(makeRequest(VALID_BODY), ctxFor(PATIENT_ID));
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.error).toBe(
      'Has alcanzado el límite de envíos. Intenta nuevamente más tarde.',
    );
    expect(res.headers.get('Retry-After')).toBe('1800');
    expect(mocks.buildPatientHistoryPdf).not.toHaveBeenCalled();
    expect(mocks.sendPatientHistoryEmail).not.toHaveBeenCalled();
    // No attempted/sent EMAIL_EXPORT row — no send happened.
    expect(mocks.auditLog).not.toHaveBeenCalled();
  });

  it('rate-limited request audits status=rate_limited (no recipient email in details)', async () => {
    mocks.enforceRateLimits.mockResolvedValue({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 60,
    });

    await POST(makeRequest(VALID_BODY), ctxFor(PATIENT_ID));

    expect(mocks.safeAuditLog).toHaveBeenCalledOnce();
    const row = mocks.safeAuditLog.mock.calls[0]?.[0] as {
      action: string;
      details: Record<string, unknown>;
    };
    expect(row.action).toBe('EMAIL_EXPORT');
    expect(row.details.status).toBe('rate_limited');
    expect(JSON.stringify(row.details)).not.toContain('paciente@correo.com');
  });

  it('rate-limit keys passed to the limiter never contain the recipient email', async () => {
    mocks.enforceRateLimits.mockResolvedValue({
      allowed: true,
      remaining: 4,
      retryAfterSeconds: 0,
    });

    await POST(makeRequest(VALID_BODY), ctxFor(PATIENT_ID));

    const specs = mocks.enforceRateLimits.mock.calls[0]?.[0] as Array<{ key: string }>;
    for (const spec of specs) {
      expect(spec.key).not.toContain('paciente@correo.com');
    }
  });
});
