import { vi, describe, it, expect, beforeAll, afterEach } from 'vitest';

// Establish env vars before any module that reads them is imported
process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-chars-long!!';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-at-least-32-chars!';

// Mock next/headers so session.ts can run outside Next.js context
vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

import { cookies } from 'next/headers';
import { generateAccessToken } from '@/lib/auth/tokens';
import { requireSession, requireRole } from '@/lib/auth/session';
import type { UserRole } from '@/lib/db/schema';

const CLINIC_ID = '00000000-0000-4000-8000-000000000002';
const USER_ID = '00000000-0000-4000-8000-000000000001';

async function mockSession(role: UserRole) {
  const token = await generateAccessToken({ userId: USER_ID, clinicId: CLINIC_ID, role });
  vi.mocked(cookies).mockResolvedValue({
    get: (_name: string) => ({ name: 'access_token', value: token }),
  } as ReturnType<typeof cookies> extends Promise<infer R> ? R : never);
}

function mockNoSession() {
  vi.mocked(cookies).mockResolvedValue({
    get: (_name: string) => undefined,
  } as ReturnType<typeof cookies> extends Promise<infer R> ? R : never);
}

afterEach(() => {
  vi.resetAllMocks();
});

// ─── requireSession ───────────────────────────────────────────────────────────

describe('requireSession', () => {
  it('retorna la sesión cuando hay un token de acceso válido', async () => {
    await mockSession('admin');
    const session = await requireSession();
    expect(session.role).toBe('admin');
    expect(session.clinicId).toBe(CLINIC_ID);
    expect(session.userId).toBe(USER_ID);
  });

  it('lanza error cuando no hay cookie de sesión', async () => {
    mockNoSession();
    await expect(requireSession()).rejects.toThrow('No autenticado');
  });
});

// ─── requireRole ─────────────────────────────────────────────────────────────

describe('requireRole - admin', () => {
  it('permite acceso a admin cuando el rol requerido es admin', async () => {
    await mockSession('admin');
    const session = await requireRole(['admin']);
    expect(session.role).toBe('admin');
  });

  it('deniega acceso a doctor cuando el rol requerido es admin', async () => {
    await mockSession('doctor');
    await expect(requireRole(['admin'])).rejects.toThrow('Sin permisos');
  });

  it('deniega acceso a receptionist cuando el rol requerido es admin', async () => {
    await mockSession('receptionist');
    await expect(requireRole(['admin'])).rejects.toThrow('Sin permisos');
  });
});

describe('requireRole - doctor', () => {
  it('permite acceso a doctor cuando el rol requerido es doctor', async () => {
    await mockSession('doctor');
    const session = await requireRole(['doctor']);
    expect(session.role).toBe('doctor');
  });

  it('deniega acceso a receptionist cuando el rol requerido es doctor', async () => {
    await mockSession('receptionist');
    await expect(requireRole(['doctor'])).rejects.toThrow('Sin permisos');
  });
});

describe('requireRole - múltiples roles permitidos', () => {
  it('permite acceso a admin cuando se acepta admin o doctor', async () => {
    await mockSession('admin');
    const session = await requireRole(['admin', 'doctor']);
    expect(session.role).toBe('admin');
  });

  it('permite acceso a doctor cuando se acepta admin o doctor', async () => {
    await mockSession('doctor');
    const session = await requireRole(['admin', 'doctor']);
    expect(session.role).toBe('doctor');
  });

  it('deniega acceso a receptionist cuando se acepta admin o doctor', async () => {
    await mockSession('receptionist');
    await expect(requireRole(['admin', 'doctor'])).rejects.toThrow('Sin permisos');
  });
});

describe('requireRole - sin sesión', () => {
  it('lanza "No autenticado" cuando no hay sesión (sin importar el rol requerido)', async () => {
    mockNoSession();
    await expect(requireRole(['admin'])).rejects.toThrow('No autenticado');
  });
});
