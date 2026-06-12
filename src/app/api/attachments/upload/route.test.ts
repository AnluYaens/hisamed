import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { NextRequest } from "next/server";
import sharp from "sharp";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  select: vi.fn(),
  insert: vi.fn(),
  transaction: vi.fn(),
  uploadFile: vi.fn(),
  deleteFile: vi.fn(),
  auditLog: vi.fn(),
  safeAuditLog: vi.fn(),
  getClientIpFromHeaders: vi.fn(),
  generateId: vi.fn(),
  consumeRateLimit: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getSession: mocks.getSession,
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: mocks.select,
    insert: mocks.insert,
    transaction: mocks.transaction,
  },
}));

vi.mock("@/lib/storage", () => ({
  uploadFile: mocks.uploadFile,
  deleteFile: mocks.deleteFile,
}));

vi.mock("@/lib/audit", () => ({
  auditLog: mocks.auditLog,
  safeAuditLog: mocks.safeAuditLog,
  getClientIpFromHeaders: mocks.getClientIpFromHeaders,
}));

vi.mock("@/lib/rate-limit", () => ({
  consumeRateLimit: mocks.consumeRateLimit,
}));

vi.mock("@/lib/utils/generate-id", () => ({
  generateId: mocks.generateId,
}));

import { POST } from "./route";

const CLINIC_ID = "11111111-1111-4111-8111-111111111111";
const DOCTOR_ID = "22222222-2222-4222-8222-222222222222";
const ADMIN_ID = "33333333-3333-4333-8333-333333333333";
const PATIENT_ID = "44444444-4444-4444-8444-444444444444";
const NOTE_ID = "55555555-5555-4555-8555-555555555555";
const ATTACHMENT_ID = "66666666-6666-4666-8666-666666666666";

// Images now go through a real sharp decode on upload, so fixtures must be
// decodable images — a bare signature is no longer enough.
const PNG_BYTES = await sharp({
  create: {
    width: 4,
    height: 4,
    channels: 3,
    background: { r: 10, g: 20, b: 30 },
  },
})
  .png()
  .toBuffer();

const HEIC_FIXTURE = readFileSync(
  path.resolve(__dirname, "../../../../../tests/fixtures/sample.heic"),
);

const JPEG_SIG = Buffer.from([0xff, 0xd8, 0xff]);

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
  file = new File([new Uint8Array(PNG_BYTES)], "eco.png", {
    type: "image/png",
  }),
  category = "other",
  clinicalNoteId,
}: {
  file?: File;
  category?: string;
  clinicalNoteId?: string;
} = {}): NextRequest {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("patient_id", PATIENT_ID);
  formData.append("category", category);
  if (clinicalNoteId) formData.append("clinical_note_id", clinicalNoteId);

  return new Request("http://localhost/api/attachments/upload", {
    method: "POST",
    body: formData,
  }) as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({
    userId: DOCTOR_ID,
    clinicId: CLINIC_ID,
    role: "doctor",
  });
  mocks.uploadFile.mockResolvedValue(undefined);
  mocks.deleteFile.mockResolvedValue(undefined);
  mocks.auditLog.mockResolvedValue(undefined);
  mocks.safeAuditLog.mockResolvedValue(undefined);
  mocks.getClientIpFromHeaders.mockResolvedValue(null);
  mocks.consumeRateLimit.mockResolvedValue({
    allowed: true,
    remaining: 29,
    retryAfterSeconds: 0,
  });
  mocks.generateId
    .mockReturnValueOnce(ATTACHMENT_ID)
    .mockReturnValueOnce("77777777-7777-4777-8777-777777777777");
});

// The route runs a 2-query storage quota check (clinic plan limit +
// summed bytes already on disk) between the patient lookup and any
// optional clinical-note lookup. Tests that reach that point must queue
// these mocks or the chain returns undefined.
// The SUM-of-bytes query awaits .where() directly (no .limit() terminator),
// so its mock must resolve there.
function selectAtWhere(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(rows),
  };
}

function queueQuotaOk() {
  mocks.select
    .mockReturnValueOnce(selectRows([{ maxStorageMb: 1024 }]))
    .mockReturnValueOnce(selectAtWhere([{ used: "0" }]));
}

describe("POST /api/attachments/upload", () => {
  it("rejects uploads linked to a signed clinical note before storing bytes", async () => {
    mocks.select.mockReturnValueOnce(selectRows([{ id: PATIENT_ID }]));
    queueQuotaOk();
    mocks.select.mockReturnValueOnce(
      selectRows([{ id: NOTE_ID, authorId: DOCTOR_ID, isSigned: true }]),
    );

    const res = await POST(
      requestFor({ clinicalNoteId: NOTE_ID, category: "ultrasound" }),
    );
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.success).toBe(false);
    expect(mocks.uploadFile).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("rejects note-linked uploads from non-author or non-doctor users", async () => {
    mocks.getSession.mockResolvedValue({
      userId: ADMIN_ID,
      clinicId: CLINIC_ID,
      role: "admin",
    });
    mocks.select.mockReturnValueOnce(selectRows([{ id: PATIENT_ID }]));
    queueQuotaOk();
    mocks.select.mockReturnValueOnce(
      selectRows([{ id: NOTE_ID, authorId: DOCTOR_ID, isSigned: false }]),
    );

    const res = await POST(requestFor({ clinicalNoteId: NOTE_ID }));

    expect(res.status).toBe(403);
    expect(mocks.uploadFile).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("requires ultrasound uploads to be linked to a clinical note", async () => {
    const res = await POST(requestFor({ category: "ultrasound" }));

    expect(res.status).toBe(400);
    expect(mocks.select).not.toHaveBeenCalled();
    expect(mocks.uploadFile).not.toHaveBeenCalled();
  });

  it("enforces video magic bytes server-side", async () => {
    mocks.select.mockReturnValueOnce(selectRows([{ id: PATIENT_ID }]));
    queueQuotaOk();

    const spoofedMp4 = new File(
      [new Uint8Array(Buffer.from("not an mp4"))],
      "clip.mp4",
      {
        type: "video/mp4",
      },
    );
    const res = await POST(
      requestFor({ file: spoofedMp4, category: "imaging" }),
    );

    expect(res.status).toBe(415);
    expect(mocks.uploadFile).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("redacts storageKey from successful upload responses", async () => {
    const uploadedAt = new Date("2026-05-11T12:00:00.000Z");
    mocks.select.mockReturnValueOnce(selectRows([{ id: PATIENT_ID }]));
    queueQuotaOk();
    mocks.insert.mockReturnValueOnce(
      insertRows([
        {
          id: ATTACHMENT_ID,
          patientId: PATIENT_ID,
          clinicalNoteId: null,
          uploadedBy: DOCTOR_ID,
          fileName: "eco.png",
          storageKey: "77777777-7777-4777-8777-777777777777.png",
          fileType: "image/png",
          fileSizeBytes: PNG_BYTES.byteLength,
          category: "other",
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

  it("returns 429 when rate limited, before reading the body or touching storage", async () => {
    mocks.consumeRateLimit.mockResolvedValue({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 900,
    });

    const res = await POST(requestFor());
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.error).toBe(
      "Has alcanzado el límite de solicitudes. Intenta nuevamente más tarde.",
    );
    expect(res.headers.get("Retry-After")).toBe("900");
    expect(mocks.select).not.toHaveBeenCalled();
    expect(mocks.uploadFile).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.safeAuditLog).toHaveBeenCalledOnce();
  });

  it("accepts AVIF and stores it re-encoded as JPEG with a .jpg key", async () => {
    mocks.select.mockReturnValueOnce(selectRows([{ id: PATIENT_ID }]));
    queueQuotaOk();
    mocks.insert.mockReturnValueOnce(
      insertRows([
        { id: ATTACHMENT_ID, category: "imaging", uploadedAt: new Date() },
      ]),
    );

    const avifBytes = await sharp({
      create: {
        width: 4,
        height: 4,
        channels: 3,
        background: { r: 50, g: 60, b: 70 },
      },
    })
      .avif()
      .toBuffer();
    const avif = new File([new Uint8Array(avifBytes)], "eco.avif", {
      type: "image/avif",
    });
    const res = await POST(requestFor({ file: avif, category: "imaging" }));

    expect(res.status).toBe(201);
    expect(mocks.uploadFile).toHaveBeenCalledOnce();
    const [storedBuffer, storageKey, contentType] =
      mocks.uploadFile.mock.calls[0];
    expect(storedBuffer.subarray(0, 3).equals(JPEG_SIG)).toBe(true);
    expect(storageKey.endsWith(".jpg")).toBe(true);
    expect(contentType).toBe("image/jpeg");
    const insertedValues =
      mocks.insert.mock.results[0].value.values.mock.calls[0][0];
    expect(insertedValues.fileType).toBe("image/jpeg");
    expect(insertedValues.fileSizeBytes).toBe(storedBuffer.byteLength);
  });

  it("accepts Samsung-style HEIC and stores it re-encoded as JPEG", async () => {
    mocks.select.mockReturnValueOnce(selectRows([{ id: PATIENT_ID }]));
    queueQuotaOk();
    mocks.insert.mockReturnValueOnce(
      insertRows([
        { id: ATTACHMENT_ID, category: "other", uploadedAt: new Date() },
      ]),
    );

    const heic = new File([new Uint8Array(HEIC_FIXTURE)], "foto.heic", {
      type: "image/heic",
    });
    const res = await POST(requestFor({ file: heic }));

    expect(res.status).toBe(201);
    const [storedBuffer, storageKey, contentType] =
      mocks.uploadFile.mock.calls[0];
    expect(storedBuffer.subarray(0, 3).equals(JPEG_SIG)).toBe(true);
    expect(storageKey.endsWith(".jpg")).toBe(true);
    expect(contentType).toBe("image/jpeg");
  });

  it("rejects an undecodable image with a user-friendly 422, not a 500", async () => {
    mocks.select.mockReturnValueOnce(selectRows([{ id: PATIENT_ID }]));
    queueQuotaOk();

    // Valid JPEG magic bytes but garbage body: passes the signature check,
    // fails the sharp decode.
    const corrupt = new File(
      [
        new Uint8Array(
          Buffer.concat([JPEG_SIG, Buffer.from("garbage, not scan data")]),
        ),
      ],
      "roto.jpg",
      { type: "image/jpeg" },
    );
    const res = await POST(requestFor({ file: corrupt }));
    const body = await res.json();

    expect(res.status).toBe(422);
    expect(body.success).toBe(false);
    expect(body.error).toBe(
      "No se pudo procesar la imagen. El archivo puede estar dañado o en un formato no compatible.",
    );
    expect(mocks.uploadFile).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});
