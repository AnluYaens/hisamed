import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const mocks = vi.hoisted(() => ({
  requireSession: vi.fn(),
  select: vi.fn(),
  update: vi.fn(),
  uploadFile: vi.fn(),
  deleteFile: vi.fn(),
  auditLog: vi.fn(),
  getClientIpFromHeaders: vi.fn(),
  generateId: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  requireSession: mocks.requireSession,
}));

vi.mock("@/lib/auth/demo", () => ({
  isDemoSession: () => false,
  demoWriteBlocked: () => ({ success: false, error: "demo" }),
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: mocks.select,
    update: mocks.update,
  },
}));

vi.mock("@/lib/storage", () => ({
  uploadFile: mocks.uploadFile,
  deleteFile: mocks.deleteFile,
}));

vi.mock("@/lib/audit", () => ({
  auditLog: mocks.auditLog,
  getClientIpFromHeaders: mocks.getClientIpFromHeaders,
}));

vi.mock("@/lib/utils/generate-id", () => ({
  generateId: mocks.generateId,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

import { updatePartnerAvatar } from "../partner-avatar";

const CLINIC_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const PATIENT_ID = "44444444-4444-4444-8444-444444444444";
const PARTNER_ID = "55555555-5555-4555-8555-555555555555";
const STORAGE_ID = "77777777-7777-4777-8777-777777777777";

const HEIC_FIXTURE = readFileSync(
  path.resolve(__dirname, "../../../tests/fixtures/sample.heic"),
);
const JPEG_SIG = Buffer.from([0xff, 0xd8, 0xff]);

function selectRows(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(rows),
  };
}

function updateChain() {
  return {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(undefined),
  };
}

function formDataFor(file: File): FormData {
  const formData = new FormData();
  formData.append("patient_id", PATIENT_ID);
  formData.append("file", file);
  return formData;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireSession.mockResolvedValue({
    userId: USER_ID,
    clinicId: CLINIC_ID,
    role: "doctor",
  });
  // First select: patient-belongs-to-clinic check; second: partner row.
  mocks.select
    .mockReturnValueOnce(selectRows([{ id: PATIENT_ID }]))
    .mockReturnValueOnce(
      selectRows([{ id: PARTNER_ID, avatarStorageKey: null }]),
    );
  mocks.update.mockReturnValue(updateChain());
  mocks.uploadFile.mockResolvedValue(undefined);
  mocks.deleteFile.mockResolvedValue(undefined);
  mocks.auditLog.mockResolvedValue(undefined);
  mocks.getClientIpFromHeaders.mockResolvedValue(null);
  mocks.generateId.mockReturnValue(STORAGE_ID);
});

describe("updatePartnerAvatar", () => {
  it("accepts a WebP avatar and stores it re-encoded as JPEG", async () => {
    const webpBytes = await sharp({
      create: {
        width: 8,
        height: 8,
        channels: 3,
        background: { r: 10, g: 90, b: 10 },
      },
    })
      .webp()
      .toBuffer();
    const file = new File([new Uint8Array(webpBytes)], "pareja.webp", {
      type: "image/webp",
    });

    const result = await updatePartnerAvatar(null, formDataFor(file));

    expect(result).toEqual({ success: true });
    const [storedBuffer, storageKey, contentType] =
      mocks.uploadFile.mock.calls[0];
    expect(storedBuffer.subarray(0, 3).equals(JPEG_SIG)).toBe(true);
    expect(storageKey).toBe(`${STORAGE_ID}.jpg`);
    expect(contentType).toBe("image/jpeg");
  });

  it("accepts a Samsung-style HEIC avatar and stores it re-encoded as JPEG", async () => {
    const file = new File([new Uint8Array(HEIC_FIXTURE)], "pareja.heic", {
      type: "image/heic",
    });

    const result = await updatePartnerAvatar(null, formDataFor(file));

    expect(result).toEqual({ success: true });
    const [storedBuffer, storageKey, contentType] =
      mocks.uploadFile.mock.calls[0];
    expect(storedBuffer.subarray(0, 3).equals(JPEG_SIG)).toBe(true);
    expect(storageKey).toBe(`${STORAGE_ID}.jpg`);
    expect(contentType).toBe("image/jpeg");
  });

  it("rejects an undecodable image with a user-friendly error", async () => {
    const corrupt = new File(
      [
        new Uint8Array(
          Buffer.concat([JPEG_SIG, Buffer.from("garbage, not scan data")]),
        ),
      ],
      "roto.jpg",
      { type: "image/jpeg" },
    );

    const result = await updatePartnerAvatar(null, formDataFor(corrupt));

    expect(result).toEqual({
      success: false,
      error:
        "No se pudo procesar la imagen. El archivo puede estar dañado o en un formato no compatible.",
    });
    expect(mocks.uploadFile).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
