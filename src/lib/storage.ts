import { promises as fs } from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { LOCAL_STORAGE_DIR } from '@/lib/config/storage';

// ─── Provider selection ───────────────────────────────────────────────────────
//
// The app supports two storage back-ends:
//   - `r2`    → Cloudflare R2, talked to via the S3-compatible SDK
//   - `local` → filesystem-backed, for `pnpm dev` without R2 credentials
// STORAGE_PROVIDER picks between them. The local provider MUST NOT be used in
// production — it writes to a fixed /tmp folder which is per-container and
// ephemeral.

export type StorageProvider = 'r2' | 'local';

function getProvider(): StorageProvider {
  const raw = (process.env.STORAGE_PROVIDER ?? 'local').toLowerCase();
  if (raw === 'r2' || raw === 'local') return raw;
  throw new Error(
    `STORAGE_PROVIDER must be 'r2' or 'local', got '${process.env.STORAGE_PROVIDER}'`,
  );
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface StoredObject {
  body: Readable | ReadableStream | Buffer;
  contentType: string;
  contentLength?: number;
}

export async function uploadFile(
  buffer: Buffer,
  key: string,
  contentType: string,
): Promise<void> {
  if (getProvider() === 'r2') return uploadR2(buffer, key, contentType);
  return uploadLocal(buffer, key, contentType);
}

export async function getPresignedUrl(key: string, expiresIn = 300): Promise<string | null> {
  // Local provider cannot produce a URL outside the app process. The download
  // route handler falls back to streaming in that case — this function returns
  // null to signal "no presigned URL available, stream it instead".
  if (getProvider() === 'local') return null;
  return presignedUrlR2(key, expiresIn);
}

export async function deleteFile(key: string): Promise<void> {
  if (getProvider() === 'r2') return deleteR2(key);
  return deleteLocal(key);
}

// Used by the download route handler when the provider cannot hand out a
// signed URL (local dev) or when we prefer to proxy the bytes through Next.
export async function getObject(key: string): Promise<StoredObject> {
  if (getProvider() === 'r2') return getR2(key);
  return getLocal(key);
}

// ─── R2 / S3 implementation ───────────────────────────────────────────────────

let cachedClient: S3Client | null = null;

function getR2Bucket(): string {
  const bucket = process.env.R2_BUCKET;
  if (!bucket) throw new Error('R2_BUCKET env var is required when STORAGE_PROVIDER=r2');
  return bucket;
}

function getR2Client(): S3Client {
  if (cachedClient) return cachedClient;

  const endpoint = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error(
      'R2 credentials missing — set R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY',
    );
  }

  cachedClient = new S3Client({
    region: process.env.R2_REGION ?? 'auto',
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  });
  return cachedClient;
}

async function uploadR2(buffer: Buffer, key: string, contentType: string): Promise<void> {
  await getR2Client().send(
    new PutObjectCommand({
      Bucket: getR2Bucket(),
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }),
  );
}

async function presignedUrlR2(key: string, expiresIn: number): Promise<string> {
  return getSignedUrl(
    getR2Client(),
    new GetObjectCommand({ Bucket: getR2Bucket(), Key: key }),
    { expiresIn },
  );
}

async function deleteR2(key: string): Promise<void> {
  await getR2Client().send(
    new DeleteObjectCommand({ Bucket: getR2Bucket(), Key: key }),
  );
}

async function getR2(key: string): Promise<StoredObject> {
  const res = await getR2Client().send(
    new GetObjectCommand({ Bucket: getR2Bucket(), Key: key }),
  );
  if (!res.Body) throw new Error('R2 returned empty body');
  return {
    body: res.Body as unknown as Readable,
    contentType: res.ContentType ?? 'application/octet-stream',
    contentLength: res.ContentLength,
  };
}

// ─── Local filesystem implementation ──────────────────────────────────────────

// Reject keys that try to escape the storage root. Upload keys come from
// generateId()+ext so this is defense in depth, but it also guards against
// hand-crafted rows in the attachments table.
function resolveLocalPath(key: string): string {
  if (!key || key.includes('..') || key.startsWith('/') || key.includes('\x00')) {
    throw new Error('Invalid storage key');
  }
  const base = path.resolve(LOCAL_STORAGE_DIR);
  const full = path.resolve(base, key);
  if (!full.startsWith(`${base}${path.sep}`) && full !== base) {
    throw new Error('Invalid storage key');
  }
  return full;
}

async function uploadLocal(buffer: Buffer, key: string, contentType: string): Promise<void> {
  const full = resolveLocalPath(key);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, buffer);
  // Persist content type so `getLocal` can return it without sniffing.
  await fs.writeFile(`${full}.meta`, JSON.stringify({ contentType }), 'utf8');
}

async function deleteLocal(key: string): Promise<void> {
  const full = resolveLocalPath(key);
  // Best-effort: deleting a missing file is not an error from the caller's
  // perspective — the DB row is about to go away either way.
  await fs.rm(full, { force: true });
  await fs.rm(`${full}.meta`, { force: true });
}

async function getLocal(key: string): Promise<StoredObject> {
  const full = resolveLocalPath(key);
  const buffer = await fs.readFile(full);
  let contentType = 'application/octet-stream';
  try {
    const meta = JSON.parse(await fs.readFile(`${full}.meta`, 'utf8')) as { contentType?: string };
    if (meta.contentType) contentType = meta.contentType;
  } catch {
    // no meta sidecar — fall back to octet-stream
  }
  return { body: buffer, contentType, contentLength: buffer.length };
}
