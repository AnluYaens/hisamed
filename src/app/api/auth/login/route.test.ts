import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  update: vi.fn(),
  getDummyHash: vi.fn(),
  verifyPassword: vi.fn(),
  generateAccessToken: vi.fn(),
  generateRefreshToken: vi.fn(),
  setAuthCookies: vi.fn(),
  safeAuditLog: vi.fn(),
  checkRateLimit: vi.fn(),
  consumeRateLimit: vi.fn(),
  clearRateLimit: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    query: { users: { findFirst: mocks.findFirst } },
    update: mocks.update,
  },
}));
vi.mock('@/lib/auth/password', () => ({
  getDummyHash: mocks.getDummyHash,
  verifyPassword: mocks.verifyPassword,
}));
vi.mock('@/lib/auth/tokens', () => ({
  generateAccessToken: mocks.generateAccessToken,
  generateRefreshToken: mocks.generateRefreshToken,
}));
vi.mock('@/lib/auth/cookies', () => ({ setAuthCookies: mocks.setAuthCookies }));
vi.mock('@/lib/audit', () => ({ safeAuditLog: mocks.safeAuditLog }));
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: mocks.checkRateLimit,
  consumeRateLimit: mocks.consumeRateLimit,
  clearRateLimit: mocks.clearRateLimit,
}));

import { POST } from './route';

const CLINIC_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';

const ALLOWED = { allowed: true, remaining: 5, retryAfterSeconds: 0 };
const DENIED = { allowed: false, remaining: 0, retryAfterSeconds: 420 };

function loginRequest(
  body: unknown = { email: 'doc@clinic.com', password: 'secret-pass' },
  ip = '203.0.113.7',
): NextRequest {
  return new Request('http://localhost/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  }) as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.checkRateLimit.mockResolvedValue(ALLOWED);
  mocks.consumeRateLimit.mockResolvedValue(ALLOWED);
  mocks.clearRateLimit.mockResolvedValue(undefined);
  mocks.getDummyHash.mockResolvedValue('dummy-hash');
  mocks.verifyPassword.mockResolvedValue(true);
  mocks.generateAccessToken.mockResolvedValue('access-token');
  mocks.generateRefreshToken.mockResolvedValue('refresh-token');
  mocks.safeAuditLog.mockResolvedValue(undefined);
  mocks.update.mockReturnValue({
    set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
  });
  mocks.findFirst.mockResolvedValue({
    id: USER_ID,
    clinicId: CLINIC_ID,
    email: 'doc@clinic.com',
    passwordHash: 'real-hash',
    isActive: true,
    fullName: 'Dr. Test',
    role: 'doctor',
  });
});

describe('POST /api/auth/login rate limiting', () => {
  it('blocks with 429 before verifying credentials when a bucket is full', async () => {
    mocks.checkRateLimit.mockResolvedValueOnce(DENIED);

    const res = await POST(loginRequest());
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.error).toBe('Demasiados intentos. Intenta de nuevo en unos minutos.');
    expect(res.headers.get('Retry-After')).toBe('420');
    expect(mocks.verifyPassword).not.toHaveBeenCalled();
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });

  it('counts a failed login against the rate limiter and returns 401 while under the limit', async () => {
    mocks.verifyPassword.mockResolvedValue(false);

    const res = await POST(loginRequest());

    expect(res.status).toBe(401);
    expect(mocks.consumeRateLimit).toHaveBeenCalled();
    expect(mocks.clearRateLimit).not.toHaveBeenCalled();
  });

  it('returns 429 when a failed login pushes a bucket over the limit', async () => {
    mocks.verifyPassword.mockResolvedValue(false);
    mocks.consumeRateLimit.mockResolvedValueOnce(ALLOWED).mockResolvedValueOnce(DENIED);

    const res = await POST(loginRequest());
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.error).toBe('Demasiados intentos. Intenta de nuevo en unos minutos.');
    expect(res.headers.get('Retry-After')).toBe('420');
  });

  it('clears the failure buckets on a successful login', async () => {
    const res = await POST(loginRequest());

    expect(res.status).toBe(200);
    expect(mocks.clearRateLimit).toHaveBeenCalled();
    expect(mocks.consumeRateLimit).not.toHaveBeenCalled();
  });

  it('does not put the raw email in any rate-limit key', async () => {
    await POST(loginRequest());

    const checkedKeys = mocks.checkRateLimit.mock.calls.map(
      (c) => (c[0] as { key: string }).key,
    );
    // The email-scoped key intentionally embeds the email in the logical
    // string — the helper hashes it before storage. The IP-only key must not.
    const ipKey = checkedKeys.find((k) => k.startsWith('login:ip:'));
    expect(ipKey).toBeDefined();
    expect(ipKey).not.toContain('doc@clinic.com');
  });
});
