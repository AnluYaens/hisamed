import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  select: vi.fn(),
  safeAuditLog: vi.fn(),
  getClientIpFromHeaders: vi.fn(),
  getObject: vi.fn(),
  consumeRateLimit: vi.fn(),
}));

vi.mock('@/lib/auth/session', () => ({ getSession: mocks.getSession }));
vi.mock('@/lib/db', () => ({ db: { select: mocks.select } }));
vi.mock('@/lib/audit', () => ({
  safeAuditLog: mocks.safeAuditLog,
  getClientIpFromHeaders: mocks.getClientIpFromHeaders,
}));
vi.mock('@/lib/storage', () => ({ getObject: mocks.getObject }));
vi.mock('@/lib/rate-limit', () => ({ consumeRateLimit: mocks.consumeRateLimit }));

import { GET } from './route';

const CLINIC_ID = '11111111-1111-4111-8111-111111111111';
const DOCTOR_ID = '22222222-2222-4222-8222-222222222222';
const ATTACHMENT_ID = '66666666-6666-4666-8666-666666666666';
const PATIENT_ID = '44444444-4444-4444-8444-444444444444';

function ctxFor(id: string) {
  return { params: Promise.resolve({ id }) };
}

const request = new Request(
  `http://localhost/api/attachments/${ATTACHMENT_ID}/download`,
) as NextRequest;

function selectRows(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(rows),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({
    userId: DOCTOR_ID,
    clinicId: CLINIC_ID,
    role: 'doctor',
  });
  mocks.select.mockReturnValue(
    selectRows([
      {
        id: ATTACHMENT_ID,
        storageKey: 'abc.pdf',
        fileName: 'lab.pdf',
        fileType: 'application/pdf',
        patientId: PATIENT_ID,
        clinicalNoteId: null,
        category: 'lab_result',
      },
    ]),
  );
  mocks.safeAuditLog.mockResolvedValue(undefined);
  mocks.getClientIpFromHeaders.mockResolvedValue(undefined);
  mocks.getObject.mockResolvedValue({
    body: Buffer.from('pdf-bytes'),
    contentType: 'application/pdf',
    contentLength: 9,
  });
  mocks.consumeRateLimit.mockResolvedValue({
    allowed: true,
    remaining: 99,
    retryAfterSeconds: 0,
  });
});

describe('GET /api/attachments/[id]/download', () => {
  it('streams the file when under the limit', async () => {
    const res = await GET(request, ctxFor(ATTACHMENT_ID));
    expect(res.status).toBe(200);
    expect(mocks.getObject).toHaveBeenCalledOnce();
  });

  it('returns 429 when rate limited, before any DB or storage access', async () => {
    mocks.consumeRateLimit.mockResolvedValue({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 300,
    });

    const res = await GET(request, ctxFor(ATTACHMENT_ID));
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.error).toBe(
      'Has alcanzado el límite de solicitudes. Intenta nuevamente más tarde.',
    );
    expect(res.headers.get('Retry-After')).toBe('300');
    expect(mocks.select).not.toHaveBeenCalled();
    expect(mocks.getObject).not.toHaveBeenCalled();
    expect(mocks.safeAuditLog).toHaveBeenCalledOnce();
  });
});
