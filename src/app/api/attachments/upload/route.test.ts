import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  select: vi.fn(),
  insert: vi.fn(),
  transaction: vi.fn(),
  uploadFile: vi.fn(),
  deleteFile: vi.fn(),
  auditLog: vi.fn(),
  getClientIpFromHeaders: vi.fn(),
  generateId: vi.fn(),
}));

vi.mock('@/lib/auth/session', () => ({
  getSession: mocks.getSession,
}));

vi.mock('@/lib/db', () => ({
  db: {
    select: mocks.select,
    insert: mocks.insert,
    transaction: mocks.transaction,
  },
}));

vi.mock('@/lib/storage', () => ({
  uploadFile: mocks.uploadFile,
  deleteFile: mocks.deleteFile,
}));

vi.mock('@/lib/audit', () => ({
  auditLog: mocks.auditLog,
  getClientIpFromHeaders: mocks.getClientIpFromHeaders,
}));

vi.mock('@/lib/utils/generate-id', () => ({
  generateId: mocks.generateId,
}));

import { POST } from './route';

const CLINIC_ID = '11111111-1111-4111-8111-111111111111';
const DOCTOR_ID = '22222222-2222-4222-8222-222222222222';
const ADMIN_ID = '33333333-3333-4333-8333-333333333333';
const PATIENT_ID = '44444444-4444-4444-8444-444444444444';
const NOTE_ID = '55555555-5555-4555-8555-555555555555';
const ATTACHMENT_ID = '66666666-6666-4666-8666-666666666666';

const PNG_BYTES = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
]);

function selectRows(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(rows),
    for: vi.fn().mockReturnThis(),
  };
}

function insertRows(rows: unknown[]) {
  return {
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(rows),
  };
}

function requestFor({
  file = new File([PNG_BYTES], 'eco.png', { type: 'image/png' }),
  category = 'other',
  clinicalNoteId,
}: {
  file?: File;
  category?: string;
  clinicalNoteId?: string;
} = {}): NextRequest {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('patient_id', PATIENT_ID);
  formData.append('category', category);
  if (clinicalNoteId) formData.append('clinical_note_id', clinicalNoteId);

  return new Request('http://localhost/api/attachments/upload', {
    method: 'POST',
    body: formData,
  }) as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({
    userId: DOCTOR_ID,
    clinicId: CLINIC_ID,
    role: 'doctor',
  });
  mocks.uploadFile.mockResolvedValue(undefined);
  mocks.deleteFile.mockResolvedValue(undefined);
  mocks.auditLog.mockResolvedValue(undefined);
  mocks.getClientIpFromHeaders.mockResolvedValue(null);
  mocks.generateId
    .mockReturnValueOnce(ATTACHMENT_ID)
    .mockReturnValueOnce('77777777-7777-4777-8777-777777777777');
});

describe('POST /api/attachments/upload', () => {
  it('rejects uploads linked to a signed clinical note before storing bytes', async () => {
    mocks.select
      .mockReturnValueOnce(selectRows([{ id: PATIENT_ID }]))
      .mockReturnValueOnce(
        selectRows([{ id: NOTE_ID, authorId: DOCTOR_ID, isSigned: true }]),
      );

    const res = await POST(requestFor({ clinicalNoteId: NOTE_ID, category: 'ultrasound' }));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.success).toBe(false);
    expect(mocks.uploadFile).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it('rejects note-linked uploads from non-author or non-doctor users', async () => {
    mocks.getSession.mockResolvedValue({
      userId: ADMIN_ID,
      clinicId: CLINIC_ID,
      role: 'admin',
    });
    mocks.select
      .mockReturnValueOnce(selectRows([{ id: PATIENT_ID }]))
      .mockReturnValueOnce(
        selectRows([{ id: NOTE_ID, authorId: DOCTOR_ID, isSigned: false }]),
      );

    const res = await POST(requestFor({ clinicalNoteId: NOTE_ID }));

    expect(res.status).toBe(403);
    expect(mocks.uploadFile).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it('requires ultrasound uploads to be linked to a clinical note', async () => {
    const res = await POST(requestFor({ category: 'ultrasound' }));

    expect(res.status).toBe(400);
    expect(mocks.select).not.toHaveBeenCalled();
    expect(mocks.uploadFile).not.toHaveBeenCalled();
  });

  it('enforces video magic bytes server-side', async () => {
    mocks.select.mockReturnValueOnce(selectRows([{ id: PATIENT_ID }]));

    const spoofedMp4 = new File([Buffer.from('not an mp4')], 'clip.mp4', {
      type: 'video/mp4',
    });
    const res = await POST(requestFor({ file: spoofedMp4, category: 'imaging' }));

    expect(res.status).toBe(415);
    expect(mocks.uploadFile).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it('redacts storageKey from successful upload responses', async () => {
    const uploadedAt = new Date('2026-05-11T12:00:00.000Z');
    mocks.select.mockReturnValueOnce(selectRows([{ id: PATIENT_ID }]));
    mocks.insert.mockReturnValueOnce(
      insertRows([
        {
          id: ATTACHMENT_ID,
          patientId: PATIENT_ID,
          clinicalNoteId: null,
          uploadedBy: DOCTOR_ID,
          fileName: 'eco.png',
          storageKey: '77777777-7777-4777-8777-777777777777.png',
          fileType: 'image/png',
          fileSizeBytes: PNG_BYTES.byteLength,
          category: 'other',
          description: null,
          uploadedAt,
        },
      ]),
    );

    const res = await POST(requestFor());
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(ATTACHMENT_ID);
    expect(body.data.storageKey).toBeUndefined();
    expect(mocks.uploadFile).toHaveBeenCalledOnce();
  });
});
